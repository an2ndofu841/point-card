import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type UserTicket } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { ArrowLeft, Ticket, Clock, ChevronRight, X, AlertTriangle, ArrowRight } from 'lucide-react';

export const UserTickets = () => {
  const { userId } = useCurrentUser();

  // Sync tickets from Supabase on mount
  useEffect(() => {
      const syncTickets = async () => {
          if (isMock || !userId) return;

          const { data, error } = await supabase
            .from('user_tickets')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'UNUSED');

          if (error) {
              console.warn("Failed to fetch tickets", error);
              return;
          }

          if (data) {
              const tickets: UserTicket[] = data.map(t => ({
                  id: t.id,
                  userId: t.user_id,
                  groupId: t.group_id,
                  giftId: t.gift_id,
                  giftName: t.gift_name,
                  status: t.status,
                  acquiredAt: new Date(t.created_at).getTime(),
                  usedAt: t.used_at ? new Date(t.used_at).getTime() : undefined
              }));

              await db.userTickets.bulkPut(tickets);
          }
      };
      syncTickets();
  }, [userId]);

  const tickets = useLiveQuery(() => 
    userId ? db.userTickets
      .where('userId').equals(userId)
      .filter(t => t.status === 'UNUSED')
      .reverse()
      .toArray() : []
  , [userId]);

  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const swipeRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  const handleOpenTicket = (ticket: UserTicket) => {
    setSelectedTicket(ticket);
    setSwipeProgress(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsSwiping(true);
    startXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || !swipeRef.current) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;
    const maxSwipe = swipeRef.current.clientWidth - 56; // 56 is knob width
    
    const progress = Math.max(0, Math.min(diff / maxSwipe, 1));
    setSwipeProgress(progress);
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeProgress > 0.9) {
      handleUseTicket();
    } else {
      setSwipeProgress(0); // Snap back
    }
  };

  const handleUseTicket = async () => {
    if (!selectedTicket || !userId) return;
    
    // Confirm logic is handled by swipe, but double check? 
    // Swipe is explicit enough usually.
    
    try {
        // 1. Update Local
        await db.userTickets.update(selectedTicket.id!, { 
            status: 'USED', 
            usedAt: Date.now() 
        });

        // 2. Sync to Supabase
        if (!isMock) {
            await supabase
                .from('user_tickets')
                .update({ status: 'USED', used_at: new Date().toISOString() })
                .eq('id', selectedTicket.id);
            
            // Also log usage in history/scans? 
            // Admin scanner does this, but self-usage needs to be secure.
            // Ideally backend function handles validation.
        }

        alert('チケットを使用しました');
        setSelectedTicket(null);
        setSwipeProgress(0);
        
    } catch (err) {
        console.error("Failed to use ticket", err);
        alert("チケットの使用に失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24">
      <div className="flex items-center mb-6">
        <Link to="/home" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold">マイチケット</h1>
      </div>

      {/* History Link */}
      <div className="mb-6 flex justify-end">
        <Link to="/user/history" className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full transition">
            <Clock size={12} />
            使用履歴を見る
        </Link>
      </div>

      {/* Ticket List */}
      <div className="space-y-4">
        {tickets?.length === 0 && (
           <div className="text-center py-20 opacity-50">
             <Ticket size={48} className="mx-auto mb-4 text-gray-300" />
             <p className="font-bold text-gray-400">未使用のチケットはありません</p>
             <Link to="/user/gifts" className="text-primary text-sm mt-2 inline-block">
               ポイントを交換する
             </Link>
           </div>
        )}

        {tickets?.map(ticket => (
          <div 
            key={ticket.id} 
            onClick={() => handleOpenTicket(ticket)}
            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer transition hover:shadow-md active:scale-[0.99] relative"
          >
             {/* Left dashed border effect */}
             <div className="absolute left-0 top-0 bottom-0 w-2 bg-primary"></div>
             
             <div className="p-5 pl-7 flex justify-between items-center">
               <div>
                 <h3 className="font-bold text-lg text-text-main mb-1">{ticket.giftName}</h3>
                 <div className="flex items-center gap-2 text-xs text-text-sub">
                   <Clock size={12} />
                   <span>{new Date(ticket.acquiredAt).toLocaleDateString()} 取得</span>
                 </div>
               </div>
               <ChevronRight className="text-gray-300" />
             </div>
          </div>
        ))}
      </div>

      {/* Ticket Usage Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl animate-slide-up relative overflow-hidden">
             
             {/* Close Button */}
             <button 
               onClick={() => setSelectedTicket(null)}
               className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition z-10"
             >
               <X size={20} />
             </button>

             {/* Ticket Visual */}
             <div className="mt-8 mb-8 relative">
                <div className="bg-gradient-to-br from-primary to-primary-dark text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-10 -mb-10 blur-xl"></div>
                    
                    <div className="relative z-10">
                        <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-2">TICKET</p>
                        <h2 className="text-2xl font-bold leading-tight mb-4">{selectedTicket.giftName}</h2>
                        <div className="flex items-center justify-center gap-2 text-xs opacity-90 bg-black/20 py-1 px-3 rounded-full w-fit mx-auto">
                            <Clock size={12} />
                            <span>有効期限: 無期限</span>
                        </div>
                    </div>
                </div>
                
                {/* Torn Paper Effect */}
                <div className="flex justify-between px-2 -mt-1 relative z-10">
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="w-4 h-4 bg-white rounded-full -mt-2"></div>
                    ))}
                </div>
             </div>

             {/* Usage Warning */}
             <div className="mb-8 px-4">
                <div className="flex items-start gap-3 bg-red-50 p-4 rounded-xl text-left border border-red-100">
                    <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-red-700 mb-1">スタッフ確認用</p>
                        <p className="text-xs text-red-600/80 leading-relaxed">
                            この画面をスタッフに提示してください。<br/>
                            ご自身でスワイプして使用済みにしないでください。
                        </p>
                    </div>
                </div>
             </div>

             {/* Swipe to Use */}
             <div className="relative h-14 bg-gray-100 rounded-full overflow-hidden select-none" ref={swipeRef}>
                <div 
                    className="absolute left-0 top-0 bottom-0 bg-primary/20 transition-all duration-75"
                    style={{ width: `${swipeProgress * 100}%` }}
                ></div>
                
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className={`text-sm font-bold text-gray-400 transition-opacity ${swipeProgress > 0.5 ? 'opacity-0' : 'opacity-100'}`}>
                        スワイプして使用する
                    </span>
                </div>

                <div 
                    className="absolute top-1 bottom-1 w-12 bg-white rounded-full shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform duration-75 z-10"
                    style={{ 
                        left: '4px',
                        transform: `translateX(${swipeProgress * (swipeRef.current ? swipeRef.current.clientWidth - 56 : 250)}px)` 
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <ArrowRight size={20} className="text-primary" />
                </div>
             </div>Qnq

          </div>
        </div>
      )}
    </div>
  );
};
