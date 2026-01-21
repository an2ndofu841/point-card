import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CalendarCheck, Flame, History } from 'lucide-react';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { loadSelectedGroupId, saveSelectedGroupId } from '../../lib/selectedGroup';

type AttendanceSummary = {
  user_id: string;
  group_id: number;
  total_checked_in: number;
  max_streak: number;
  current_streak: number | null;
};

type Checkin = {
  event_date: string;
  checked_in_at: string | null;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

export const UserLiveAttendance = () => {
  const { userId } = useCurrentUser();
  const savedGroupId = userId ? loadSelectedGroupId(userId) : null;
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
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
      const saved = savedGroupId && groups.find(g => g.id === savedGroupId) ? savedGroupId : null;
      setActiveGroupId(saved ?? groups[0].id);
    }
    if (activeGroupId !== null && groups && !groups.find(g => g.id === activeGroupId)) {
      const saved = savedGroupId && groups.find(g => g.id === savedGroupId) ? savedGroupId : null;
      setActiveGroupId(saved ?? groups[0]?.id ?? null);
    }
  }, [groups, activeGroupId, savedGroupId]);

  useEffect(() => {
    if (!groups || !savedGroupId) return;
    if (!groups.find(g => g.id === savedGroupId)) return;
    if (activeGroupId !== savedGroupId) {
      setActiveGroupId(savedGroupId);
    }
  }, [groups, savedGroupId, activeGroupId]);

  useEffect(() => {
    if (!userId) return;
    saveSelectedGroupId(userId, activeGroupId);
  }, [userId, activeGroupId]);

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!userId || !activeGroupId || isMock) {
        setSummary(null);
        setCheckins([]);
        return;
      }

      setIsLoading(true);

      const { data: summaryData, error: summaryError } = await supabase
        .from('live_event_attendance_summary')
        .select('*')
        .eq('user_id', userId)
        .eq('group_id', activeGroupId)
        .maybeSingle();

      if (summaryError) {
        console.error('Failed to fetch attendance summary', summaryError);
      } else {
        setSummary(summaryData as AttendanceSummary | null);
      }

      const { data: checkinData, error: checkinError } = await supabase
        .from('live_event_checkins')
        .select('event_date, checked_in_at')
        .eq('user_id', userId)
        .eq('group_id', activeGroupId)
        .order('event_date', { ascending: false })
        .limit(10);

      if (checkinError) {
        console.error('Failed to fetch checkins', checkinError);
      } else {
        setCheckins((checkinData || []) as Checkin[]);
      }

      setIsLoading(false);
    };

    fetchAttendance();
  }, [userId, activeGroupId]);

  return (
    <div className="min-h-screen bg-bg-main text-text-main pb-24 font-sans">
      <header className="bg-white pt-8 pb-6 px-6 rounded-b-[2rem] shadow-sm border-b border-gray-100 mb-6">
        <div className="flex items-center gap-3">
          <Link to="/user/home" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarCheck size={22} /> ライブ参加実績
            </h1>
            <p className="text-xs text-gray-400">QRチェックイン実績のみカウント</p>
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

      <div className="px-6 max-w-3xl mx-auto space-y-6">
        {!groups || groups.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10 bg-white rounded-2xl border border-dashed border-gray-200">
            参加しているグループがありません
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                  <History size={16} /> トータル参加数
                </div>
                <div className="mt-2 text-3xl font-bold text-text-main">
                  {summary?.total_checked_in ?? 0}
                  <span className="text-sm text-gray-400 ml-1">回</span>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                  <Flame size={16} /> 現在の連続参加
                </div>
                <div className="mt-2 text-3xl font-bold text-text-main">
                  {summary?.current_streak ?? 0}
                  <span className="text-sm text-gray-400 ml-1">日</span>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                  <Flame size={16} /> 最高連続参加
                </div>
                <div className="mt-2 text-3xl font-bold text-text-main">
                  {summary?.max_streak ?? 0}
                  <span className="text-sm text-gray-400 ml-1">日</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-500">最近の参加</h2>
                {isLoading && <span className="text-xs text-gray-400">読み込み中...</span>}
              </div>
              {checkins.length === 0 && !isLoading ? (
                <div className="text-center text-sm text-gray-400 py-8">
                  参加実績がありません
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {checkins.map((checkin, index) => (
                    <div
                      key={`${checkin.event_date}-${index}`}
                      className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 text-sm"
                    >
                      <span className="font-bold text-text-main">{formatDate(checkin.event_date)}</span>
                      <span className="text-xs text-gray-400">
                        {checkin.checked_in_at
                          ? new Date(checkin.checked_in_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400">
              連続参加は「前回参加日から1日以上空いたらリセット」として計算しています。
            </p>
          </>
        )}
      </div>
    </div>
  );
};
