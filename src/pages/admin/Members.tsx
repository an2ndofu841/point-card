import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Search, Users, Loader2, RefreshCw } from 'lucide-react';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';
import { formatMemberId } from '../../lib/memberId';

type AdminMembership = {
  id: number;
  userId: string;
  groupId: number;
  points: number;
  totalPoints: number;
  currentRank?: string | null;
  memberId?: string | null;
  displayName?: string | null;
  updatedAt?: string | null;
};

type AdjustmentState = {
  delta: string;
  note: string;
};

export const ManageMembers = () => {
  // Get current admin group context
  const [groupId] = useState<number>(() => {
    const saved = localStorage.getItem('admin_selected_group_id');
    return saved ? parseInt(saved) : 1;
  });

  const group = useLiveQuery(() => db.groups.get(groupId));

  const [members, setMembers] = useState<AdminMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [adjustments, setAdjustments] = useState<Record<number, AdjustmentState>>({});

  const fetchMembers = async () => {
    setLoading(true);
    try {
      if (isMock) {
        const local = await db.userMemberships.where('groupId').equals(groupId).toArray();
        const profileMap = new Map(
          (await db.userCache.toArray()).map(profile => [profile.id, profile.name || null])
        );
        setMembers(local.map(m => ({
          id: m.id ?? Math.random(),
          userId: m.userId,
          groupId: m.groupId,
          points: m.points,
          totalPoints: m.totalPoints,
          currentRank: m.currentRank,
          memberId: m.memberId,
          displayName: profileMap.get(m.userId) || null,
          updatedAt: undefined
        })));
        return;
      }

      const { data, error } = await supabase
        .from('user_memberships')
        .select('id, user_id, group_id, points, total_points, current_rank, member_id, updated_at')
        .eq('group_id', groupId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch members', error);
        return;
      }

      const list = (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        groupId: row.group_id,
        points: row.points ?? 0,
        totalPoints: row.total_points ?? 0,
        currentRank: row.current_rank,
        memberId: row.member_id,
        updatedAt: row.updated_at
      }));

      if (list.length > 0) {
        const ids = list.map(m => m.userId);
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .in('user_id', ids);
        if (profileError) {
          console.error('Failed to fetch user profiles', profileError);
        } else {
          const profileMap = new Map(
            (profiles || []).map(profile => [profile.user_id, profile.display_name || null])
          );
          list.forEach(item => {
            item.displayName = profileMap.get(item.userId) || null;
          });
        }
      }
      setMembers(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [groupId]);

  const filteredMembers = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return members;
    const compactQuery = query.replace(/\s+/g, '');
    return members.filter(member => {
      const userId = member.userId.toLowerCase();
      const memberId = (member.memberId || '').toLowerCase();
      const displayName = (member.displayName || '').toLowerCase();
      const formattedMemberId = formatMemberId(member.memberId).toLowerCase();
      const compactMemberId = formattedMemberId.replace(/\s+/g, '');
      return (
        userId.includes(query) ||
        displayName.includes(query) ||
        memberId.includes(compactQuery) ||
        formattedMemberId.includes(query) ||
        compactMemberId.includes(compactQuery)
      );
    });
  }, [members, searchText]);

  const updateAdjustment = (memberId: number, next: Partial<AdjustmentState>) => {
    setAdjustments(prev => ({
      ...prev,
      [memberId]: {
        delta: prev[memberId]?.delta ?? '',
        note: prev[memberId]?.note ?? '',
        ...next
      }
    }));
  };

  const handleAdjust = async (member: AdminMembership) => {
    const entry = adjustments[member.id];
    const deltaValue = parseInt(entry?.delta || '', 10);
    if (!deltaValue || Number.isNaN(deltaValue)) {
      alert('付与/減算するポイント数を入力してください');
      return;
    }

    const confirmText = deltaValue > 0
      ? `このユーザーに ${deltaValue}pt 付与しますか？`
      : `このユーザーから ${Math.abs(deltaValue)}pt 減算しますか？`;

    if (!window.confirm(confirmText)) return;

    setSavingId(member.id);
    try {
      if (isMock) {
        const nextPoints = member.points + deltaValue;
        if (nextPoints < 0) {
          alert('ポイントが0未満になるため処理できません');
          return;
        }
        const nextTotal = deltaValue > 0 ? member.totalPoints + deltaValue : member.totalPoints;
        if (member.id) {
          await db.userMemberships.where({ userId: member.userId, groupId }).modify({
            points: nextPoints,
            totalPoints: nextTotal,
            lastUpdated: Date.now()
          });
        }
        setMembers(prev => prev.map(m => m.id === member.id ? {
          ...m,
          points: nextPoints,
          totalPoints: nextTotal
        } : m));
      } else {
        const { data: current, error } = await supabase
          .from('user_memberships')
          .select('points, total_points')
          .eq('user_id', member.userId)
          .eq('group_id', groupId)
          .single();

        if (error || !current) {
          throw error || new Error('Membership not found');
        }

        const nextPoints = (current.points ?? 0) + deltaValue;
        if (nextPoints < 0) {
          alert('ポイントが0未満になるため処理できません');
          return;
        }

        const nextTotal = deltaValue > 0
          ? (current.total_points ?? 0) + deltaValue
          : (current.total_points ?? 0);

        const { error: updateError } = await supabase
          .from('user_memberships')
          .update({
            points: nextPoints,
            total_points: nextTotal,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', member.userId)
          .eq('group_id', groupId);

        if (updateError) throw updateError;

        await supabase.from('point_history').insert({
          user_id: member.userId,
          group_id: groupId,
          points: deltaValue,
          type: 'ADMIN_ADJUST',
          created_at: new Date().toISOString(),
          metadata: {
            note: entry?.note || undefined,
            before_points: current.points ?? 0,
            after_points: nextPoints
          }
        });

        setMembers(prev => prev.map(m => m.id === member.id ? {
          ...m,
          points: nextPoints,
          totalPoints: nextTotal,
          updatedAt: new Date().toISOString()
        } : m));
      }

      updateAdjustment(member.id, { delta: '', note: '' });
    } catch (err) {
      console.error('Failed to adjust points', err);
      alert('ポイントの調整に失敗しました');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <header className="flex items-center justify-between mb-8 sticky top-0 bg-bg-main/80 backdrop-blur-md py-4 z-10">
        <div className="flex items-center">
          <Link to="/admin/dashboard" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">登録ユーザー</h1>
            <p className="text-xs text-gray-500 font-bold">{group?.name}</p>
          </div>
        </div>
        <button
          onClick={fetchMembers}
          className="p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition"
          aria-label="再読み込み"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin text-gray-400' : 'text-gray-500'} />
        </button>
      </header>

      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2 rounded-xl text-primary">
              <Users size={20} />
            </div>
            <div>
              <div className="text-xs text-gray-400 font-bold">ポイントカード登録人数</div>
              <div className="text-2xl font-bold">{members.length}人</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <Search size={18} className="text-gray-400" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="会員番号 / ユーザーID / 名前 で検索"
            className="w-full bg-transparent outline-none text-sm font-bold text-text-main"
          />
          {searchText && (
            <span className="text-xs text-gray-400 font-bold">{filteredMembers.length}件</span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <Loader2 className="animate-spin mx-auto mb-3" />
            <p className="font-bold">読み込み中...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="mx-auto mb-3" size={40} />
            <p className="font-bold">登録ユーザーが見つかりません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMembers.map(member => {
              const adjustment = adjustments[member.id] || { delta: '', note: '' };
              return (
                <div key={member.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-gray-400 font-bold">ユーザー名</div>
                        <div className="font-bold text-lg">
                          {member.displayName || '未設定'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-gray-400 font-bold">会員番号</div>
                        <div className="font-mono text-lg tracking-widest">{formatMemberId(member.memberId)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400 font-bold">現在ポイント</div>
                        <div className="font-bold text-lg">{member.points}<span className="text-xs text-gray-400 ml-1">pt</span></div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 font-mono break-all">{member.userId}</div>
                    <div className="text-xs text-gray-400">累計ポイント: <span className="font-bold text-gray-500">{member.totalPoints}pt</span></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,auto] gap-3 items-center">
                    <div>
                      <label className="block text-xs text-text-sub font-bold uppercase tracking-wider mb-1">付与/減算ポイント</label>
                      <input
                        type="number"
                        value={adjustment.delta}
                        onChange={(e) => updateAdjustment(member.id, { delta: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        placeholder="例: 10 または -10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-sub font-bold uppercase tracking-wider mb-1">メモ (任意)</label>
                      <input
                        type="text"
                        value={adjustment.note}
                        onChange={(e) => updateAdjustment(member.id, { note: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        placeholder="例: 未反映分を手動付与"
                        maxLength={80}
                      />
                    </div>
                    <button
                      onClick={() => handleAdjust(member)}
                      disabled={savingId === member.id}
                      className="w-full md:w-auto bg-primary text-white font-bold px-5 py-3 rounded-xl shadow-lg shadow-blue-500/20 hover:bg-primary-dark transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {savingId === member.id ? <Loader2 className="animate-spin" size={18} /> : '反映する'}
                    </button>
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
