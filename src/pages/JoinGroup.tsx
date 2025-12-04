import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export const JoinGroup = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('処理中...');

  useEffect(() => {
    const join = async () => {
      if (!groupId) {
        setStatus('error');
        setMessage('無効なリンクです');
        return;
      }

      const gId = parseInt(groupId);
      if (isNaN(gId)) {
        setStatus('error');
        setMessage('無効なグループIDです');
        return;
      }

      // Mock User ID (In real app, check auth state here)
      const userId = 'user-sample-123'; 
      // If not logged in, should redirect to /login?redirect=/join/:groupId
      
      try {
        // Check if group exists
        const group = await db.groups.get(gId);
        if (!group) {
            setStatus('error');
            setMessage('グループが見つかりませんでした');
            return;
        }

        // Check if already a member
        const existing = await db.userMemberships.where({ userId, groupId: gId }).first();
        
        if (existing) {
            setStatus('success');
            setMessage(`${group.name} のカードは既に持っています`);
            setTimeout(() => navigate('/user/home'), 2000);
            return;
        }

        // Create membership
        await db.userMemberships.add({
            userId,
            groupId: gId,
            points: 0,
            totalPoints: 0,
            currentRank: 'REGULAR',
            lastUpdated: Date.now()
        });

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
  }, [groupId, navigate]);

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
