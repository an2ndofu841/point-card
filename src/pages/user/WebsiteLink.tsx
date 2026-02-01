import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Link2, RefreshCw, Users } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { supabase, isMock } from '../../lib/supabase';
import { loadSelectedGroupId, saveSelectedGroupId } from '../../lib/selectedGroup';

const generateLinkCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const parts = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]);
  return `${parts.slice(0, 4).join('')}-${parts.slice(4).join('')}`;
};

export const UserWebsiteLink = () => {
  const { userId } = useCurrentUser();
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const memberships = useLiveQuery(async () => {
    if (!userId) return [];
    return await db.userMemberships.where('userId').equals(userId).toArray();
  }, [userId]);

  const groups = useLiveQuery(() => db.groups.toArray(), []);

  const joinedGroups = useMemo(() => {
    if (!memberships || !groups) return [];
    const groupIds = new Set(memberships.map(item => item.groupId));
    return groups.filter(group => groupIds.has(group.id));
  }, [memberships, groups]);

  useEffect(() => {
    if (!userId || selectedGroupId || joinedGroups.length === 0) return;
    const saved = loadSelectedGroupId(userId);
    const next = saved && joinedGroups.find(group => group.id === saved) ? saved : joinedGroups[0].id;
    setSelectedGroupId(next);
  }, [userId, selectedGroupId, joinedGroups]);

  useEffect(() => {
    if (userId && selectedGroupId) {
      saveSelectedGroupId(userId, selectedGroupId);
    }
  }, [userId, selectedGroupId]);

  useEffect(() => {
    const loadExistingCode = async () => {
      if (!userId || !selectedGroupId) return;
      if (isMock) {
        setCurrentCode('DEMO-LINK');
        setExpiresAt(new Date(Date.now() + 60 * 60 * 1000).toISOString());
        return;
      }

      const { data } = await supabase
        .from('user_link_codes')
        .select('code, expires_at')
        .eq('point_user_id', userId)
        .eq('group_id', selectedGroupId)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setCurrentCode(data?.code ?? null);
      setExpiresAt(data?.expires_at ?? null);
    };

    loadExistingCode();
  }, [userId, selectedGroupId]);

  const handleGenerate = async () => {
    if (!userId || !selectedGroupId) return;
    setIsGenerating(true);
    try {
      if (isMock) {
        setCurrentCode('DEMO-LINK');
        setExpiresAt(new Date(Date.now() + 60 * 60 * 1000).toISOString());
        return;
      }

      let code = generateLinkCode();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { error } = await supabase.from('user_link_codes').insert({
          code,
          point_user_id: userId,
          group_id: selectedGroupId
        });
        if (!error) {
          setCurrentCode(code);
          setExpiresAt(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
          return;
        }
        code = generateLinkCode();
      }
      alert('コードの発行に失敗しました。もう一度お試しください。');
    } catch (err) {
      console.error('Failed to generate link code', err);
      alert('コードの発行に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('コピーしました！');
    });
  };

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <div className="flex items-center mb-6">
        <Link to="/user/settings" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold">マイページ連携</h1>
      </div>

      <div className="max-w-md mx-auto space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-500">
            連携コードを自社ホームページのマイページに入力すると、レベル・経験値・実績を表示できます。
          </p>
        </div>

        {joinedGroups.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Users size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-bold text-gray-400">参加しているグループがありません</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">連携対象グループ</label>
              <select
                value={selectedGroupId ?? ''}
                onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm"
              >
                {joinedGroups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold">連携コード</p>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="text-xs font-bold text-primary flex items-center gap-1 hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  {currentCode ? '再発行' : '発行'}
                </button>
              </div>

              {currentCode ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <span className="font-mono text-sm">{currentCode}</span>
                    <button onClick={() => copyToClipboard(currentCode)} className="text-gray-400 hover:text-primary">
                      <Copy size={16} />
                    </button>
                  </div>
                  {expiresLabel && (
                    <p className="text-xs text-gray-400">有効期限: {expiresLabel}</p>
                  )}
                  <div className="text-xs text-gray-500">
                    自社ホームページのマイページで「連携コード」を入力してください。
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-primary text-white py-2.5 rounded-xl font-bold hover:bg-primary-dark transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Link2 size={16} /> コードを発行
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
