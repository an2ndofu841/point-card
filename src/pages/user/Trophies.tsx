import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Medal, ShieldCheck } from 'lucide-react';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { loadSelectedGroupId, saveSelectedGroupId } from '../../lib/selectedGroup';

type Trophy = {
  id: number;
  group_id: number;
  name: string;
  rarity: 'BRONZE' | 'SILVER' | 'GOLD';
  condition_type: 'TOTAL_ATTENDANCE' | 'STREAK_ATTENDANCE' | 'EVENT_ATTENDANCE';
  threshold?: number | null;
  event_id?: number | null;
};

type AttendanceSummary = {
  total_checked_in: number;
  max_streak: number;
};

type Checkin = {
  event_id: number;
};

type LiveEvent = {
  id: number;
  title: string;
  start_at: string;
  is_cancelled?: boolean;
};

const rarityStyles: Record<Trophy['rarity'], string> = {
  BRONZE: 'bg-amber-100 text-amber-700',
  SILVER: 'bg-gray-100 text-gray-700',
  GOLD: 'bg-yellow-100 text-yellow-700'
};

const rarityLabel: Record<Trophy['rarity'], string> = {
  BRONZE: 'ブロンズ',
  SILVER: 'シルバー',
  GOLD: 'ゴールド'
};

export const UserTrophies = () => {
  const { userId } = useCurrentUser();
  const [activeGroupId, setActiveGroupId] = useState<number | null>(() => loadSelectedGroupId(userId));
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
    if (!userId) return;
    saveSelectedGroupId(userId, activeGroupId);
  }, [userId, activeGroupId]);

  const eventMap = useMemo(() => {
    const map: Record<number, LiveEvent> = {};
    events.forEach(event => {
      map[event.id] = event;
    });
    return map;
  }, [events]);

  useEffect(() => {
    const loadData = async () => {
      if (!userId || !activeGroupId || isMock) {
        setTrophies([]);
        setEvents([]);
        setSummary(null);
        setCheckins([]);
        return;
      }

      setIsLoading(true);

      const { data: trophyData, error: trophyError } = await supabase
        .from('live_trophies')
        .select('*')
        .eq('group_id', activeGroupId)
        .order('created_at', { ascending: true });

      if (trophyError) {
        console.error('Failed to fetch trophies', trophyError);
      } else {
        setTrophies((trophyData || []) as Trophy[]);
      }

      const { data: summaryData, error: summaryError } = await supabase
        .from('live_event_attendance_summary')
        .select('total_checked_in, max_streak')
        .eq('user_id', userId)
        .eq('group_id', activeGroupId)
        .maybeSingle();

      if (summaryError) {
        console.error('Failed to fetch attendance summary', summaryError);
      } else {
        setSummary((summaryData || null) as AttendanceSummary | null);
      }

      const { data: checkinData, error: checkinError } = await supabase
        .from('live_event_checkins')
        .select('event_id')
        .eq('user_id', userId)
        .eq('group_id', activeGroupId);

      if (checkinError) {
        console.error('Failed to fetch checkins', checkinError);
      } else {
        setCheckins((checkinData || []) as Checkin[]);
      }

      const { data: eventData, error: eventError } = await supabase
        .from('live_events')
        .select('id, title, start_at, is_cancelled')
        .eq('group_id', activeGroupId)
        .order('start_at', { ascending: true });

      if (eventError) {
        console.error('Failed to fetch live events', eventError);
      } else {
        setEvents((eventData || []) as LiveEvent[]);
      }

      setIsLoading(false);
    };

    loadData();
  }, [userId, activeGroupId]);

  const earnedMap = useMemo(() => {
    const total = summary?.total_checked_in ?? 0;
    const maxStreak = summary?.max_streak ?? 0;
    const checkedEventIds = new Set(checkins.map(item => item.event_id));

    return trophies.reduce<Record<number, boolean>>((acc, trophy) => {
      let earned = false;
      if (trophy.condition_type === 'TOTAL_ATTENDANCE') {
        earned = total >= (trophy.threshold ?? 0);
      } else if (trophy.condition_type === 'STREAK_ATTENDANCE') {
        earned = maxStreak >= (trophy.threshold ?? 0);
      } else if (trophy.condition_type === 'EVENT_ATTENDANCE') {
        earned = trophy.event_id ? checkedEventIds.has(trophy.event_id) : false;
      }
      acc[trophy.id] = earned;
      return acc;
    }, {});
  }, [trophies, summary, checkins]);

  const conditionLabel = (trophy: Trophy) => {
    if (trophy.condition_type === 'TOTAL_ATTENDANCE') {
      return `合計${trophy.threshold ?? 0}回参加で獲得`;
    }
    if (trophy.condition_type === 'STREAK_ATTENDANCE') {
      return `連続${trophy.threshold ?? 0}日参加で獲得`;
    }
    if (trophy.event_id && eventMap[trophy.event_id]) {
      const event = eventMap[trophy.event_id];
      return `「${event.title}」参加で獲得`;
    }
    return '指定ライブ参加で獲得';
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main pb-24 font-sans">
      <header className="bg-white pt-8 pb-6 px-6 rounded-b-[2rem] shadow-sm border-b border-gray-100 mb-6">
        <div className="flex items-center gap-3">
          <Link to="/user/home" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Medal size={22} /> トロフィー
            </h1>
            <p className="text-xs text-gray-400">LIVE参加実績で獲得できます</p>
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

      <div className="px-6 max-w-3xl mx-auto space-y-4">
        {!groups || groups.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10 bg-white rounded-2xl border border-dashed border-gray-200">
            参加しているグループがありません
          </div>
        ) : trophies.length === 0 && !isLoading ? (
          <div className="text-center text-sm text-gray-400 py-10 bg-white rounded-2xl border border-dashed border-gray-200">
            トロフィーがまだ登録されていません
          </div>
        ) : (
          <div className="space-y-3">
            {trophies.map(trophy => {
              const earned = earnedMap[trophy.id];
              return (
                <div
                  key={trophy.id}
                  className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                      <Medal size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-text-main">{trophy.name}</h3>
                      <p className="text-xs text-text-sub">{conditionLabel(trophy)}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${rarityStyles[trophy.rarity]}`}>
                          {rarityLabel[trophy.rarity]}
                        </span>
                        {earned ? (
                          <span className="text-green-600 font-bold flex items-center gap-1">
                            <ShieldCheck size={14} /> 獲得済み
                          </span>
                        ) : (
                          <span className="text-gray-400 font-bold">未獲得</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
