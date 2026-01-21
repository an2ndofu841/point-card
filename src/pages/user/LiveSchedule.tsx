import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, MapPin, Clock, UserPlus, CheckCircle } from 'lucide-react';

type LiveEvent = {
  id: number;
  group_id: number;
  title: string;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  description?: string | null;
  is_cancelled?: boolean;
};

type LiveRegistration = {
  id: number;
  event_id: number;
  status: string;
  checked_in_at?: string | null;
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const toDateKey = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const toMonthLabel = (date: Date) =>
  `${date.getFullYear()}年${date.getMonth() + 1}月`;

const toDisplayTime = (iso?: string | null) => {
  if (!iso) return '未設定';
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
};

export const UserLiveSchedule = () => {
  const { userId } = useCurrentUser();
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [registrations, setRegistrations] = useState<Record<number, LiveRegistration>>({});
  const [selectedDateKey, setSelectedDateKey] = useState<string>(toDateKey(new Date()));
  const [isLoading, setIsLoading] = useState(false);

  const userProfile = useLiveQuery(async () => {
    if (!userId) return undefined;
    return await db.userCache.get(userId);
  }, [userId]);

  const groups = useLiveQuery(async () => {
    if (!userId) return [];
    const memberships = await db.userMemberships.where('userId').equals(userId).toArray();
    if (!memberships.length) return [];
    const groupIds = memberships.map(m => m.groupId);
    return await db.groups.where('id').anyOf(groupIds).toArray();
  }, [userId]);

  useEffect(() => {
    if (activeGroupId === null && groups && groups.length > 0) {
      setActiveGroupId(groups[0].id);
    }
    if (activeGroupId !== null && groups && !groups.find(g => g.id === activeGroupId)) {
      setActiveGroupId(groups[0]?.id ?? null);
    }
  }, [groups, activeGroupId]);

  useEffect(() => {
    const syncEvents = async () => {
      if (!userId || !activeGroupId || isMock) {
        setEvents([]);
        setRegistrations({});
        return;
      }

      setIsLoading(true);
      const monthStart = new Date(currentMonth);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

      const { data, error } = await supabase
        .from('live_events')
        .select('*')
        .eq('group_id', activeGroupId)
        .gte('start_at', monthStart.toISOString())
        .lte('start_at', monthEnd.toISOString())
        .order('start_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch live events', error);
        setIsLoading(false);
        return;
      }

      const fetchedEvents = (data || []) as LiveEvent[];
      setEvents(fetchedEvents);

      if (fetchedEvents.length === 0) {
        setRegistrations({});
        setIsLoading(false);
        return;
      }

      const eventIds = fetchedEvents.map(e => e.id);
      const { data: regData, error: regError } = await supabase
        .from('live_event_registrations')
        .select('*')
        .eq('user_id', userId)
        .in('event_id', eventIds);

      if (regError) {
        console.error('Failed to fetch registrations', regError);
        setIsLoading(false);
        return;
      }

      const regMap: Record<number, LiveRegistration> = {};
      (regData || []).forEach(reg => {
        regMap[reg.event_id] = {
          id: reg.id,
          event_id: reg.event_id,
          status: reg.status,
          checked_in_at: reg.checked_in_at
        };
      });

      setRegistrations(regMap);
      setIsLoading(false);
    };

    syncEvents();
  }, [userId, activeGroupId, currentMonth]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentMonth);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());
    const end = new Date(lastDay);
    end.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

    const days: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, LiveEvent[]> = {};
    events.forEach(event => {
      const key = toDateKey(new Date(event.start_at));
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });
    return map;
  }, [events]);

  const selectedEvents = eventsByDate[selectedDateKey] || [];

  const handleJoin = async (event: LiveEvent) => {
    if (!userId || isMock) return;
    if (event.is_cancelled) return;

    const displayName = userProfile?.name || 'ゲスト';
    const { error } = await supabase.from('live_event_registrations').upsert({
      event_id: event.id,
      user_id: userId,
      user_name: displayName,
      status: 'APPLY',
      applied_at: new Date().toISOString()
    }, { onConflict: 'event_id,user_id' });

    if (error) {
      console.error('Failed to join event', error);
      alert('参加登録に失敗しました');
      return;
    }

    setRegistrations(prev => ({
      ...prev,
      [event.id]: { ...prev[event.id], event_id: event.id, status: 'APPLY' }
    }));
  };

  const handleCancel = async (event: LiveEvent) => {
    if (!userId || isMock) return;
    const { error } = await supabase
      .from('live_event_registrations')
      .update({ status: 'CANCELLED' })
      .eq('event_id', event.id)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to cancel registration', error);
      alert('取消に失敗しました');
      return;
    }

    setRegistrations(prev => ({
      ...prev,
      [event.id]: { ...prev[event.id], event_id: event.id, status: 'CANCELLED' }
    }));
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main pb-24 font-sans">
      <header className="bg-white pt-8 pb-6 px-6 rounded-b-[2rem] shadow-sm border-b border-gray-100 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/user/home" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <CalendarDays size={22} /> ライブスケジュール
              </h1>
              <p className="text-xs text-gray-400">参加したいライブをチェック</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto no-scrollbar">
          {groups?.map(group => (
            <button
              key={group.id}
              onClick={() => setActiveGroupId(group.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition ${
                activeGroupId === group.id
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>
      </header>

      <div className="px-6 max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                const prev = new Date(currentMonth);
                prev.setMonth(prev.getMonth() - 1);
                setCurrentMonth(prev);
              }}
              className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-lg font-bold">{toMonthLabel(currentMonth)}</div>
            <button
              onClick={() => {
                const next = new Date(currentMonth);
                next.setMonth(next.getMonth() + 1);
                setCurrentMonth(next);
              }}
              className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-xs text-gray-400 font-bold mb-2">
            {WEEKDAYS.map(day => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(date => {
              const key = toDateKey(date);
              const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
              const hasEvents = (eventsByDate[key]?.length || 0) > 0;
              const isSelected = key === selectedDateKey;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDateKey(key)}
                  className={`h-12 rounded-xl text-sm font-bold flex flex-col items-center justify-center transition ${
                    isSelected
                      ? 'bg-primary text-white shadow-md'
                      : isCurrentMonth
                      ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      : 'bg-gray-100 text-gray-300'
                  }`}
                >
                  <span>{date.getDate()}</span>
                  {hasEvents && (
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-primary'}`}></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{selectedDateKey.replace(/-/g, '/')} のライブ</h2>
            {isLoading && <span className="text-xs text-gray-400">読み込み中...</span>}
          </div>

          {selectedEvents.length === 0 && !isLoading && (
            <div className="text-center text-sm text-gray-400 py-8 bg-white rounded-2xl border border-dashed border-gray-200">
              この日のライブ予定はありません
            </div>
          )}

          {selectedEvents.map(event => {
            const registration = registrations[event.id];
            const isCheckedIn = registration?.status === 'CHECKED_IN';
            const isCancelled = registration?.status === 'CANCELLED';
            const isApplied = registration?.status === 'APPLY';

            return (
              <div key={event.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`text-lg font-bold ${event.is_cancelled ? 'text-gray-400 line-through' : 'text-text-main'}`}>
                        {event.title}
                      </h3>
                      {event.is_cancelled && (
                        <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-bold">中止</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                      <Clock size={14} /> {toDisplayTime(event.start_at)}
                      {event.end_at && <span>〜 {toDisplayTime(event.end_at)}</span>}
                    </div>
                    {event.location && (
                      <div className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                        <MapPin size={14} /> {event.location}
                      </div>
                    )}
                    {event.description && (
                      <p className="text-xs text-gray-400 mt-3 whitespace-pre-wrap">{event.description}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {isCheckedIn && (
                      <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                        <CheckCircle size={14} /> 来場済み
                      </span>
                    )}
                    {isApplied && (
                      <span className="text-xs font-bold text-blue-600">参加予定</span>
                    )}
                    {isCancelled && (
                      <span className="text-xs font-bold text-gray-400">参加取消</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  {!registration || isCancelled ? (
                    <button
                      onClick={() => handleJoin(event)}
                      disabled={event.is_cancelled}
                      className="flex-1 bg-primary text-white py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-primary-dark transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <UserPlus size={16} /> 参加する
                    </button>
                  ) : isApplied ? (
                    <button
                      onClick={() => handleCancel(event)}
                      className="flex-1 bg-gray-100 text-gray-500 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition"
                    >
                      参加を取り消す
                    </button>
                  ) : (
                    <button
                      disabled
                      className="flex-1 bg-gray-100 text-gray-400 py-2.5 rounded-xl font-bold cursor-not-allowed"
                    >
                      参加済み
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
