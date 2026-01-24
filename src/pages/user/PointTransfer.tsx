import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, QrCode, Users, RefreshCw, ArrowRight } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { supabase, isMock } from '../../lib/supabase';

const generateTransferCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const parts = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]);
  return `${parts.slice(0, 4).join('')}-${parts.slice(4).join('')}`;
};

export const UserPointTransfer = () => {
  const { userId } = useCurrentUser();
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const memberships = useLiveQuery(async () => {
    if (!userId) return [];
    return await db.userMemberships.where('userId').equals(userId).toArray();
  }, [userId]);

  const groups = useLiveQuery(() => db.groups.toArray(), []);

  const dissolvedGroups = useMemo(() => {
    if (!memberships || !groups) return [];
    const memberGroupIds = new Set(memberships.map(m => m.groupId));
    return groups.filter(group => group.deletedAt && memberGroupIds.has(group.id));
  }, [memberships, groups]);

  useEffect(() => {
    if (!selectedGroupId && dissolvedGroups.length > 0) {
      setSelectedGroupId(dissolvedGroups[0].id);
    }
  }, [selectedGroupId, dissolvedGroups]);

  useEffect(() => {
    const loadExistingCode = async () => {
      if (!userId || !selectedGroupId) return;
      if (isMock) {
        const localCode = await db.transferCodes
          .where({ userId, sourceGroupId: selectedGroupId })
          .filter(item => !item.usedAt)
          .reverse()
          .first();
        setCurrentCode(localCode?.code ?? null);
        return;
      }
      const { data } = await supabase
        .from('transfer_codes')
        .select('code')
        .eq('user_id', userId)
        .eq('source_group_id', selectedGroupId)
        .is('used_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setCurrentCode(data?.code ?? null);
    };
    loadExistingCode();
  }, [userId, selectedGroupId]);

  const handleGenerate = async () => {
    if (!userId || !selectedGroupId) return;
    setIsGenerating(true);
    try {
      if (isMock) {
        const code = generateTransferCode();
        await db.transferCodes.add({
          code,
          userId,
          sourceGroupId: selectedGroupId,
          createdAt: Date.now()
        });
        setCurrentCode(code);
        return;
      }

      let code = generateTransferCode();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { error } = await supabase.from('transfer_codes').insert({
          code,
          user_id: userId,
          source_group_id: selectedGroupId
        });
        if (!error) {
          setCurrentCode(code);
          await db.transferCodes.add({
            code,
            userId,
            sourceGroupId: selectedGroupId,
            createdAt: Date.now()
          });
          return;
        }
        code = generateTransferCode();
      }
      alert('コードの発行に失敗しました。もう一度お試しください。');
    } catch (err) {
      console.error('Failed to generate transfer code', err);
      alert('コードの発行に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const transferUrl = currentCode ? `${window.location.origin}/user/transfer/apply?code=${currentCode}` : '';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('コピーしました！');
    });
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <div className="flex items-center mb-6">
        <Link to="/user/settings" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold">ポイント引き継ぎ</h1>
      </div>

      <div className="max-w-md mx-auto space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-500">
            解散済みグループのポイントを、他グループへ引き継ぐためのコードを発行します。
          </p>
        </div>

        {dissolvedGroups.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Users size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-bold text-gray-400">解散済みグループがありません</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">引き継ぎ元グループ</label>
              <select
                value={selectedGroupId ?? ''}
                onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm"
              >
                {dissolvedGroups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold">引き継ぎコード</p>
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
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col items-center">
                    <QRCodeCanvas value={transferUrl} size={180} />
                    <p className="text-xs text-gray-400 mt-2">QRコードを読み取って引き継ぎ</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(transferUrl)}
                      className="flex-1 bg-white border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
                    >
                      URLをコピー
                    </button>
                    <Link
                      to={`/user/transfer/apply?code=${currentCode}`}
                      className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-bold text-center hover:bg-primary-dark transition"
                    >
                      引き継ぎへ進む
                    </Link>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-primary text-white py-2.5 rounded-xl font-bold hover:bg-primary-dark transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <QrCode size={16} /> コードを発行
                </button>
              )}
            </div>
          </>
        )}

        <Link to="/user/transfer/apply" className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 transition">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <QrCode size={18} className="text-primary" />
              <span className="font-bold text-sm">引き継ぎコードを入力</span>
            </div>
            <ArrowRight size={18} className="text-gray-300" />
          </div>
        </Link>
      </div>
    </div>
  );
};
