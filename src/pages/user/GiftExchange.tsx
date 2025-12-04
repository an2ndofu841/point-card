import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Gift } from '../../lib/db';
import { ArrowLeft, Ticket, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export const GiftExchange = () => {
  const navigate = useNavigate();
  const gifts = useLiveQuery(() => db.gifts.filter(g => g.active).toArray());
  
  // Fetch user cache for persistent points
  const userCache = useLiveQuery(() => db.userCache.get('user-sample-123'));
  const userPoints = userCache?.points ?? 120; // Default 120 if not in DB

  const [processingId, setProcessingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Initialize user cache if not exists
  useEffect(() => {
    const initCache = async () => {
        const exists = await db.userCache.get('user-sample-123');
        if (!exists) {
            await db.userCache.add({
                id: 'user-sample-123',
                points: 120,
                rank: 'REGULAR',
                lastUpdated: Date.now()
            });
        }
    };
    initCache();
  }, []);

  const handleExchange = async (gift: Gift) => {
    if (userPoints < gift.pointsRequired) return;
    if (!window.confirm(`${gift.name}を${gift.pointsRequired}ptで交換しますか？`)) return;

    setProcessingId(gift.id!);
    
    try {
      // 1. Deduct points (Update IndexedDB)
      await db.userCache.update('user-sample-123', {
        points: userPoints - gift.pointsRequired,
        lastUpdated: Date.now()
      });

      // 2. Add ticket to local DB
      await db.userTickets.add({
        userId: 'user-sample-123', 
        groupId: 1, // Default to group 1 for now
        giftId: gift.id!,
        giftName: gift.name,
        status: 'UNUSED',
        acquiredAt: Date.now()
      });

      // 3. Add pending transaction for server sync
      await db.pendingScans.add({
        userId: 'user-sample-123',
        groupId: 1, // Default to group 1 for now
        points: -gift.pointsRequired, // Negative points for usage
        type: 'USE_TICKET', 
        timestamp: Date.now(),
        synced: false
      });

      setSuccessMsg(`${gift.name}を受け取りました！`);
      setTimeout(() => {
        setSuccessMsg(null);
        navigate('/user/tickets'); 
      }, 1500);

    } catch (err) {
      console.error(err);
      alert("エラーが発生しました");
    } finally {
      setProcessingId(null);
    }
  };

  if (successMsg) {
    return (
      <div className="min-h-screen bg-bg-main text-text-main p-6 flex flex-col items-center justify-center animate-fade-in">
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-xs w-full">
           <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
             <CheckCircle className="text-green-600" size={40} />
           </div>
           <h2 className="text-xl font-bold mb-2">交換完了！</h2>
           <p className="text-text-sub text-sm mb-4">{successMsg}</p>
           <p className="text-xs text-gray-400">チケット一覧へ移動します...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24">
      <div className="flex items-center mb-6">
        <Link to="/home" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold">特典交換</h1>
      </div>

      {/* Current Points */}
      <div className="bg-gradient-to-r from-primary to-primary-dark text-white p-6 rounded-2xl shadow-lg shadow-blue-500/20 mb-8 flex justify-between items-center">
         <div>
           <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">保有ポイント</p>
           <p className="text-3xl font-mono font-bold">{userPoints}<span className="text-sm font-sans font-normal ml-1 opacity-80">pt</span></p>
         </div>
         <Ticket size={32} className="opacity-20" />
      </div>

      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 ml-1">交換可能な特典</h2>

      <div className="space-y-4">
        {gifts?.length === 0 && (
           <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
             <AlertCircle size={32} className="mx-auto mb-3 text-gray-300" />
             <p className="font-bold text-gray-400">現在交換可能な特典はありません</p>
           </div>
        )}

        {gifts?.map(gift => {
          const canAfford = userPoints >= gift.pointsRequired;
          const isProcessing = processingId === gift.id;
          
          return (
            <div key={gift.id} className={`bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between transition ${(!canAfford || isProcessing) ? 'opacity-80' : 'active:scale-[0.99]'}`}>
               <div className="flex items-center gap-4">
                 <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold flex-shrink-0 border ${canAfford ? 'bg-blue-50 text-primary border-blue-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                   {gift.pointsRequired}<span className="text-xs ml-0.5">pt</span>
                 </div>
                 <div>
                   <h3 className="font-bold text-lg text-text-main line-clamp-1">{gift.name}</h3>
                   <p className="text-xs text-text-sub line-clamp-1">{gift.description || '説明なし'}</p>
                 </div>
               </div>
               
               {canAfford ? (
                 <button 
                   onClick={() => handleExchange(gift)}
                   disabled={isProcessing}
                   className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-blue-500/20 hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px] flex justify-center"
                 >
                   {isProcessing ? <Loader2 className="animate-spin" size={18} /> : '交換'}
                 </button>
               ) : (
                 <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
                   不足
                 </span>
               )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
