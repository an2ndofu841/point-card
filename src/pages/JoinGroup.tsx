import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { supabase, isMock } from '../lib/supabase';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { generateMemberId } from '../lib/memberId';
import { savePendingJoinGroupId, clearPendingJoinGroupId } from '../lib/pendingJoin';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export const JoinGroup = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { userId, loading } = useCurrentUser(); // Use real userId hook
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('処理中...');

  useEffect(() => {
    const join = async () => {
      if (!groupId) {
        setStatus('error');
        setMessage('無効なリンクです');
        return;
      }

      if (loading) {
        return;
      }

      if (!userId) {
        const gId = parseInt(groupId);
        if (!isNaN(gId)) {
          savePendingJoinGroupId(gId);
        }
        navigate(`/register?joinGroupId=${groupId}`);
        return;
      }

      const gId = parseInt(groupId);
      if (isNaN(gId)) {
        setStatus('error');
        setMessage('無効なグループIDです');
        return;
      }
      
      try {
        // 1. Check if group exists locally
        let group = await db.groups.get(gId);

      // 2. If not local, fetch from Supabase (or Mock logic)
        if (!group) {
            // Mock Logic for testing without Supabase data
            if (isMock && gId > 1) {
               // Simulate finding a group in mock mode
               await new Promise(resolve => setTimeout(resolve, 800));
               group = {
                   id: gId,
                   name: `Mock Group ${gId}`,
                   themeColor: '#8B5CF6', // Purple default for mocks
                   logoUrl: undefined,
                   deletedAt: null
               };
               await db.groups.add(group);
            } else {
                // Real Supabase Fetch
                const { data, error } = await supabase
                    .from('groups')
                    .select('*')
                    .eq('id', gId)
                    .single();
                
                if (error || !data) {
                    console.error("Group fetch error:", error);
                    setStatus('error');
                    setMessage('グループが見つかりませんでした');
                    return;
                }

                if (data.deleted_at) {
                    setStatus('error');
                    setMessage('このグループは削除されています');
                    return;
                }

                // Add to local DB
                group = {
                    id: data.id,
                    name: data.name,
                    themeColor: data.theme_color,
                    logoUrl: data.logo_url || undefined,
                    deletedAt: data.deleted_at ? new Date(data.deleted_at).getTime() : null
                };
                await db.groups.add(group);
            }
        }

        if (group.deletedAt) {
            setStatus('error');
            setMessage('このグループは削除されています');
            return;
        }

        // 3. Check if already a member
        const existing = await db.userMemberships.where({ userId, groupId: gId }).first();
        
        if (existing) {
            clearPendingJoinGroupId();
            setStatus('success');
            setMessage(`${group.name} のカードは既に持っています`);
            setTimeout(() => navigate('/user/home'), 2000);
            return;
        }

        // 4. Create membership (Local & Supabase)
        let memberId = generateMemberId();
        
        // Sync to Supabase first (if not mock)
        // Note: Ideally we'd have a 'memberships' table.
        // Since we don't have the migration file yet, we'll try to insert, and catch error if table doesn't exist.
        // For now, we assume the table exists or we'll fail gracefully.
        
        if (!isMock) {
             try {
                 const { error } = await supabase
                  .from('user_memberships')
                  .insert({
                      user_id: userId,
                      group_id: gId,
                      points: 0,
                      total_points: 0,
                      current_rank: 'REGULAR',
                      member_id: memberId
                  });
                 if (error) throw error;
             } catch (e) {
                 console.warn("Failed to sync membership to Supabase (table missing?)", e);
             }
        }

        await db.userMemberships.add({
            userId,
            groupId: gId,
            points: 0,
            totalPoints: 0,
            currentRank: 'REGULAR',
            memberId,
            lastUpdated: Date.now()
        });

        clearPendingJoinGroupId();
        setStatus('success');
        setMessage(`${group.name} のカードを追加しました！`);
        
        // Navigate to home after short delay
        setTimeout(() => navigate('/user/home'), 2000);

      } catch (err) {
          console.error(err);
          setStatus('error');
          setMessage('エラーが発生しました');
      }
    };

    join();
  }, [groupId, navigate, userId, loading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-main p-6">
       <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center">
          {status === 'loading' && (
             <>
                <Loader2 size={48} className="text-primary animate-spin mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-700">カードを追加中...</h2>
             </>
          )}
          
          {status === 'success' && (
             <div className="animate-scale-in">
                <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">完了！</h2>
                <p className="text-gray-500">{message}</p>
             </div>
          )}

          {status === 'error' && (
             <div className="animate-shake">
                <AlertCircle size={64} className="text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">エラー</h2>
                <p className="text-gray-500 mb-6">{message}</p>
                <button 
                    onClick={() => navigate('/user/home')}
                    className="bg-gray-100 text-gray-600 font-bold py-3 px-6 rounded-xl hover:bg-gray-200 transition"
                >
                    ホームへ戻る
                </button>
             </div>
          )}
       </div>
    </div>
  );
};
