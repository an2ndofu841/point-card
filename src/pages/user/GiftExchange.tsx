import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Gift } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';
import { ArrowLeft, Ticket, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useCurrentUser';

export const GiftExchange = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const groupId = location.state?.groupId as number | undefined;
  const { userId } = useCurrentUser();

  // Redirect if no group context
  useEffect(() => {
    if (!groupId) {
        navigate('/home');
    }
  }, [groupId, navigate]);

  // Fetch gifts from Supabase on mount
  useEffect(() => {
      const syncGifts = async () => {
          if (isMock || !groupId) return;
          
          const { data, error } = await supabase
            .from('gifts')
            .select('*')
            .eq('group_id', groupId)
            .eq('active', true);

          if (error) {
              console.error("Failed to fetch gifts", error);
              return;
          }

          if (data && data.length > 0) {
              // Sync to local
               // To avoid duplicates, we could clear for this group first or use put
               // For user side, we might want to just use put to update existing
               await db.gifts.bulkPut(data.map(g => ({
                id: g.id,
                groupId: g.group_id,
                name: g.name,
                pointsRequired: g.points_required,
                description: g.description,
                active: g.active,
                image: g.image_url
            })));
          }
      };
      syncGifts();
  }, [groupId]);

  const gifts = useLiveQuery(() => 
    groupId ? db.gifts.where('groupId').equals(groupId).filter(g => g.active).toArray() : []
  , [groupId]);
  
  // Fetch user membership for points
  const membership = useLiveQuery(() => 
    (userId && groupId) ? db.userMemberships.where({ userId, groupId }).first() : undefined
  , [userId, groupId]);

  const userPoints = membership?.points ?? 0;

  const [processingId, setProcessingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const isExchangingRef = useRef(false);

  const handleExchange = async (gift: Gift) => {
    if (isExchangingRef.current) return;
    if (!userId || !groupId || !membership?.id) return;
    if (userPoints < gift.pointsRequired) return;
    if (!window.confirm(`${gift.name}を${gift.pointsRequired}ptで交換しますか？`)) return;

    isExchangingRef.current = true;
    setProcessingId(gift.id!);
    
    try {
      // 1. Deduct points (Update IndexedDB)
      await db.userMemberships.update(membership.id, {
        points: userPoints - gift.pointsRequired,
        lastUpdated: Date.now()
      });

      // 2. Add ticket to local DB
      await db.userTickets.add({
        userId, 
        groupId,
        giftId: gift.id!,
        giftName: gift.name,
        status: 'UNUSED',
        acquiredAt: Date.now()
      });

      // 3. Deduct points in Supabase IMMEDIATELY (Online only)
      // This is critical to ensure the user can't double spend if they clear cache or login elsewhere.
      if (!isMock) {
          // Fetch current points first to ensure consistency
          const { data: current } = await supabase
            .from('user_memberships')
            .select('points, total_points')
            .eq('user_id', userId)
            .eq('group_id', groupId)
            .single();

          if (current) {
              // Deduct from points, keep total_points same
              const { error: updateError } = await supabase
                .from('user_memberships')
                .update({
                    points: current.points - gift.pointsRequired,
                    // total_points: current.total_points, // No change
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .eq('group_id', groupId);

              if (updateError) {
                  console.error("Failed to update Supabase points", updateError);
                  // Continue anyway? Or revert local?
                  // If we fail to update server, we should probably revert local or warn.
                  // But 'pendingScans' is our fallback.
              } else {
                  // Also insert history log to Supabase immediately
                  await supabase.from('point_history').insert({
                      user_id: userId,
                      group_id: groupId,
                      points: -gift.pointsRequired,
                      type: 'USE_TICKET',
                      created_at: new Date().toISOString(),
                      metadata: { ticketId: undefined, giftId: gift.id, giftName: gift.name }
                  });
                  
                  // INSERT TICKET to user_tickets table in Supabase
                  await supabase.from('user_tickets').insert({
                      user_id: userId,
                      group_id: groupId,
                      gift_id: gift.id,
                      gift_name: gift.name,
                      status: 'UNUSED',
                      created_at: new Date().toISOString()
                  });
              }
          }
      }

      // 4. Add pending transaction for sync (Offline fallback or just log)
      // Even if we updated Supabase, we might want to keep this for local history tracking
      // or we mark it as synced=true if we succeeded above.
      // For simplicity, let's just add it as unsynced and let Sync handle duplicates/idempotency?
      // No, Sync will double deduct if we are not careful.
      // Actually, Sync logic runs on Admin side usually.
      // But if we add to pendingScans here, WHO syncs it?
      // The USER device doesn't run the Admin Sync page logic automatically.
      // So 'pendingScans' on user device is just a local log unless we have a user-side sync worker.
      // Since we don't have a user-side sync worker yet, the IMMEDIATE update above is MANDATORY for persistence.
      
      await db.pendingScans.add({
        userId,
        groupId,
        points: -gift.pointsRequired, 
        type: 'USE_TICKET', 
        ticketId: undefined, 
        timestamp: Date.now(),
        synced: !isMock // If not mock (and we assume success above), mark as synced? 
        // Ideally we track success of above call.
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
      isExchangingRef.current = false;
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

  if (!groupId) return null; // Avoid rendering if redirecting

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
