import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, QrCode, Loader2, Users, CheckCircle2, Shield } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';

type TransferRule = {
  id: number;
  targetGroupId: number;
  sourceGroupId: number;
  mode: 'FULL' | 'CAP';
  capPoints?: number | null;
  active: boolean;
};

export const AdminPointTransferApply = () => {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  const initialTarget = Number(searchParams.get('targetGroupId') || '') || null;

  const [activeTab, setActiveTab] = useState<'input' | 'scan'>('input');
  const [code, setCode] = useState(initialCode);
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState<number | null>(initialTarget);
  const [rule, setRule] = useState<TransferRule | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const groups = useLiveQuery(() => db.groups.toArray(), []);
  const activeGroups = groups?.filter(group => !group.deletedAt) ?? [];
  const targetGroup = activeGroups.find(group => group.id === selectedTargetGroupId);
  const transferAllowed = targetGroup?.transferEnabled ?? false;

  useEffect(() => {
    if (!selectedTargetGroupId && activeGroups.length > 0) {
      setSelectedTargetGroupId(activeGroups[0].id);
    }
  }, [activeGroups, selectedTargetGroupId]);

  useEffect(() => {
    if (activeTab !== 'scan') return;
    const scannerId = 'admin-transfer-reader';
    setTimeout(() => {
      if (!document.getElementById(scannerId)) return;
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
      const scanner = new Html5QrcodeScanner(
        scannerId,
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        false
      );
      scannerRef.current = scanner;
      scanner.render((decodedText) => {
        try {
          const url = new URL(decodedText);
          const scannedCode = url.searchParams.get('code');
          if (scannedCode) {
            scanner.clear().then(() => {
              setCode(scannedCode);
              setActiveTab('input');
            });
          } else {
            setMessage('無効なQRコードです');
          }
        } catch (e) {
          setMessage('読み取れない形式です');
        }
      }, () => {});
    }, 100);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [activeTab]);

  useEffect(() => {
    const loadRule = async () => {
      if (!code || !selectedTargetGroupId || isMock || !transferAllowed) {
        setRule(null);
        return;
      }
      const { data: codeData } = await supabase
        .from('transfer_codes')
        .select('source_group_id')
        .eq('code', code)
        .maybeSingle();

      if (!codeData) {
        setRule(null);
        return;
      }

      const { data, error } = await supabase
        .from('transfer_rules')
        .select('*')
        .eq('target_group_id', selectedTargetGroupId)
        .is('source_group_id', null)
        .maybeSingle();

      if (error || !data) {
        setRule(null);
        return;
      }

      setRule({
        id: data.id,
        targetGroupId: data.target_group_id,
        sourceGroupId: data.source_group_id,
        mode: data.mode,
        capPoints: data.cap_points,
        active: data.active
      });
    };
    loadRule();
  }, [code, selectedTargetGroupId, transferAllowed]);

  const handleApply = async () => {
    if (!code || !selectedTargetGroupId) return;
    if (!transferAllowed) {
      setMessage('このグループは引き継ぎが無効です');
      return;
    }
    setIsApplying(true);
    setMessage(null);

    try {
      if (isMock) {
        const mockCode = await db.transferCodes.where('code').equals(code).first();
        if (!mockCode || mockCode.usedAt) {
          setMessage('コードが見つからないか使用済みです');
          return;
        }

        const sourceMembership = await db.userMemberships.where({ userId: mockCode.userId, groupId: mockCode.sourceGroupId }).first();
        if (!sourceMembership) {
          setMessage('引き継ぎ元のポイントが見つかりません');
          return;
        }

        const sourceGroup = groups?.find(group => group.id === mockCode.sourceGroupId);
        if (!sourceGroup?.deletedAt) {
          setMessage('解散済みグループのみ引き継ぎできます');
          return;
        }

        const mockRule = await db.transferRules
          .where({ targetGroupId: selectedTargetGroupId, sourceGroupId: null })
          .first();

        if (!mockRule) {
          setMessage('引き継ぎ条件が設定されていません');
          return;
        }

        const availablePoints = sourceMembership.points || 0;
        const cap = mockRule.mode === 'CAP' ? (mockRule.capPoints || 0) : availablePoints;
        const transferPoints = mockRule.mode === 'FULL' ? availablePoints : Math.min(availablePoints, cap);

        if (transferPoints <= 0) {
          setMessage('引き継げるポイントがありません');
          return;
        }

        const targetLocal = await db.userMemberships.where({ userId: mockCode.userId, groupId: selectedTargetGroupId }).first();
        if (targetLocal?.id) {
          await db.userMemberships.update(targetLocal.id, {
            points: (targetLocal.points || 0) + transferPoints,
            totalPoints: (targetLocal.totalPoints || 0) + transferPoints
          });
        } else {
          await db.userMemberships.add({
            userId: mockCode.userId,
            groupId: selectedTargetGroupId,
            points: transferPoints,
            totalPoints: transferPoints,
            currentRank: 'REGULAR',
            lastUpdated: Date.now()
          });
        }

        if (sourceMembership.id) {
          await db.userMemberships.delete(sourceMembership.id);
        }

        await db.transferCodes.update(mockCode.id!, {
          usedAt: Date.now(),
          usedByUserId: mockCode.userId,
          usedTargetGroupId: selectedTargetGroupId
        });

        await db.transferLogs.add({
          fromGroupId: mockCode.sourceGroupId,
          toGroupId: selectedTargetGroupId,
          fromUserId: mockCode.userId,
          toUserId: mockCode.userId,
          pointsTransferred: transferPoints,
          createdAt: Date.now()
        });

        setMessage('引き継ぎが完了しました');
        return;
      }

      const { data: codeData, error: codeError } = await supabase
        .from('transfer_codes')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (codeError || !codeData) {
        setMessage('コードが見つかりません');
        return;
      }

      if (codeData.used_at) {
        setMessage('このコードは使用済みです');
        return;
      }

      const { data: ruleData, error: ruleError } = await supabase
        .from('transfer_rules')
        .select('*')
        .eq('target_group_id', selectedTargetGroupId)
        .is('source_group_id', null)
        .maybeSingle();

      if (ruleError || !ruleData) {
        setMessage('引き継ぎ条件が設定されていません');
        return;
      }

      const { data: sourceMembership, error: sourceError } = await supabase
        .from('user_memberships')
        .select('*')
        .eq('user_id', codeData.user_id)
        .eq('group_id', codeData.source_group_id)
        .maybeSingle();

      if (sourceError || !sourceMembership) {
        setMessage('引き継ぎ元のポイントが見つかりません');
        return;
      }

      const { data: sourceGroup } = await supabase
        .from('groups')
        .select('deleted_at')
        .eq('id', codeData.source_group_id)
        .maybeSingle();

      if (!sourceGroup?.deleted_at) {
        setMessage('解散済みグループのみ引き継ぎできます');
        return;
      }

      const availablePoints = sourceMembership.points || 0;
      const cap = ruleData.mode === 'CAP' ? (ruleData.cap_points || 0) : availablePoints;
      const transferPoints = ruleData.mode === 'FULL' ? availablePoints : Math.min(availablePoints, cap);

      if (transferPoints <= 0) {
        setMessage('引き継げるポイントがありません');
        return;
      }

      const { data: targetMembership } = await supabase
        .from('user_memberships')
        .select('*')
        .eq('user_id', codeData.user_id)
        .eq('group_id', selectedTargetGroupId)
        .maybeSingle();

      if (targetMembership) {
        const { error: updateError } = await supabase
          .from('user_memberships')
          .update({
            points: (targetMembership.points || 0) + transferPoints,
            total_points: (targetMembership.total_points || 0) + transferPoints
          })
          .eq('user_id', codeData.user_id)
          .eq('group_id', selectedTargetGroupId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('user_memberships').insert({
          user_id: codeData.user_id,
          group_id: selectedTargetGroupId,
          points: transferPoints,
          total_points: transferPoints,
          current_rank: 'REGULAR'
        });
        if (insertError) throw insertError;
      }

      const { error: deleteError } = await supabase
        .from('user_memberships')
        .delete()
        .eq('user_id', codeData.user_id)
        .eq('group_id', codeData.source_group_id);
      if (deleteError) throw deleteError;

      await supabase.from('transfer_codes').update({
        used_at: new Date().toISOString(),
        used_by_user_id: codeData.user_id,
        used_target_group_id: selectedTargetGroupId
      }).eq('id', codeData.id);

      await supabase.from('transfer_logs').insert({
        from_group_id: codeData.source_group_id,
        to_group_id: selectedTargetGroupId,
        from_user_id: codeData.user_id,
        to_user_id: codeData.user_id,
        points_transferred: transferPoints
      });

      const sourceLocal = await db.userMemberships.where({ userId: codeData.user_id, groupId: codeData.source_group_id }).first();
      if (sourceLocal?.id) {
        await db.userMemberships.delete(sourceLocal.id);
      }
      const targetLocal = await db.userMemberships.where({ userId: codeData.user_id, groupId: selectedTargetGroupId }).first();
      if (targetLocal?.id) {
        await db.userMemberships.update(targetLocal.id, {
          points: (targetLocal.points || 0) + transferPoints,
          totalPoints: (targetLocal.totalPoints || 0) + transferPoints
        });
      } else {
        await db.userMemberships.add({
          userId: codeData.user_id,
          groupId: selectedTargetGroupId,
          points: transferPoints,
          totalPoints: transferPoints,
          currentRank: 'REGULAR',
          lastUpdated: Date.now()
        });
      }

      setMessage('引き継ぎが完了しました');
    } catch (err) {
      console.error('Transfer failed', err);
      setMessage('引き継ぎに失敗しました');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <div className="flex items-center mb-6">
        <Link to="/admin/dashboard" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold">ポイント引き継ぎ（運営）</h1>
      </div>

      <div className="bg-white p-1 rounded-xl border border-gray-200 flex mb-6">
        <button
          onClick={() => setActiveTab('input')}
          className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition ${activeTab === 'input' ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          コード入力
        </button>
        <button
          onClick={() => setActiveTab('scan')}
          className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition ${activeTab === 'scan' ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          <QrCode size={16} /> スキャン
        </button>
      </div>

      {activeTab === 'scan' && (
        <div className="animate-fade-in mb-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div id="admin-transfer-reader" className="w-full rounded-lg overflow-hidden"></div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">引き継ぎコード</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-sm"
            placeholder="例: ABCD-1234"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">引き継ぎ先グループ</label>
          <select
            value={selectedTargetGroupId ?? ''}
            onChange={(e) => setSelectedTargetGroupId(Number(e.target.value))}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm"
          >
            {activeGroups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>

        {rule && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-800">
            引き継ぎ条件: {rule.mode === 'FULL' ? '全ポイント' : `上限 ${rule.capPoints ?? 0}pt`}
          </div>
        )}

        {!transferAllowed && (
          <div className="rounded-2xl p-4 text-sm font-bold bg-yellow-50 text-yellow-700">
            このグループは引き継ぎが無効です。グループ管理で有効化してください。
          </div>
        )}

        {message && (
          <div className={`rounded-2xl p-4 text-sm font-bold ${message.includes('完了') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            <div className="flex items-center gap-2">
              {message.includes('完了') ? <CheckCircle2 size={16} /> : <Users size={16} />}
              {message}
            </div>
          </div>
        )}

        <button
          onClick={handleApply}
          disabled={isApplying || !code || !selectedTargetGroupId || !transferAllowed}
          className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-primary-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isApplying ? <Loader2 className="animate-spin" size={18} /> : <><Shield size={18} /> 引き継ぎを実行</>}
        </button>
      </div>
    </div>
  );
};
