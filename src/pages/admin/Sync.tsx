import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { ArrowLeft, CloudUpload, Check, Loader2, Database } from 'lucide-react';

export const Sync = () => {
  const pendingScans = useLiveQuery(() => db.pendingScans.filter(s => !s.synced).toArray());
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{success: number} | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = pendingScans?.length ?? 0;

  const handleSync = async () => {
    if (!pendingScans || count === 0) return;
    setSyncing(true);
    setError(null);
    
    try {
       if (isMock) {
         await new Promise(resolve => setTimeout(resolve, 1500));
         // Mock sync: just delete local data
         const ids = pendingScans.map(s => s.id as number);
         await db.pendingScans.bulkDelete(ids);
         setResult({ success: ids.length });
         setSyncing(false);
         return;
       }

      // Separate scans by type
      // USE_TICKET usually means "User used a ticket" (scanned by admin), but in GiftExchange user creates a log too?
      // In GiftExchange.tsx, user adds a log with type 'USE_TICKET' and negative points.
      // Ideally this should be a different type like 'POINT_SPENT' or 'EXCHANGE'.
      // But let's stick to current types if possible.
      // The problem might be that Sync.tsx filters by type.
      const warnings: string[] = [];
      const ticketUseLogs = pendingScans.filter(s => s.type === 'USE_TICKET' && s.ticketId);
      const pointLogs = pendingScans.filter(s => 
        s.type === 'GRANT' || s.type === 'ATTEND' || (s.type === 'USE_TICKET' && !s.ticketId)
      );
      const designLogs = pendingScans.filter(s => s.type === 'GRANT_DESIGN');
      const idsToDelete: number[] = [];

      // 1. Sync Point Logs / Ticket Usage
      const successfulTicketLogs: typeof ticketUseLogs = [];
      for (const log of ticketUseLogs) {
        const usedAt = log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString();
        const { data: updatedTickets, error: updateError } = await supabase
          .from('user_tickets')
          .update({ status: 'USED', used_at: usedAt })
          .eq('id', log.ticketId)
          .eq('status', 'UNUSED')
          .select('id');

        if (updateError) throw updateError;

        if (!updatedTickets || updatedTickets.length === 0) {
          warnings.push(`使用済みのチケットが検出されました (ID: ${log.ticketId})`);
          idsToDelete.push(log.id as number);
          continue;
        }

        successfulTicketLogs.push(log);
        idsToDelete.push(log.id as number);
      }

      const historyLogs = [...pointLogs, ...successfulTicketLogs];
      if (historyLogs.length > 0) {
        const records = historyLogs.map(s => ({
          user_id: s.userId,
          group_id: s.groupId || 1, // Default to 1 if missing
          points: s.points, // s.points can be negative for usage
          type: s.type,
          created_at: new Date(s.timestamp).toISOString(),
          metadata: {
            ticketId: s.ticketId,
            eventId: s.eventId,
            attendancePoints: s.attendancePoints,
            bonusPoints: s.bonusPoints
          }
        }));
        
        // Insert history
        const { error: apiError } = await supabase
          .from('point_history')
          .insert(records);
          
        if (apiError) throw apiError;
      }

      // Update User Memberships Total Points
      // We need to aggregate points per user/group and update 'user_memberships' table
      if (pointLogs.length > 0) {
        // Group by user+group
        const updates = new Map<string, number>();
        pointLogs.forEach(log => {
            const key = `${log.userId}:${log.groupId || 1}`;
            const current = updates.get(key) || 0;
            updates.set(key, current + log.points); // log.points is negative for usage, positive for grant
        });

        for (const [key, pointsToAdd] of updates.entries()) {
            const [userId, gIdStr] = key.split(':');
            const groupId = parseInt(gIdStr);

            const { data: current } = await supabase
               .from('user_memberships')
               .select('points, total_points')
               .eq('user_id', userId)
               .eq('group_id', groupId)
               .single();
            
            if (current) {
                // If pointsToAdd is negative (usage), we subtract from points.
                // For total_points (lifetime), we usually only add POSITIVE grants. 
                // We shouldn't reduce total_points when user spends points.
                // So we need to separate "points delta" from "total points delta".
                
                // Recalculate deltas for this user/group
                const logsForUser = pointLogs.filter(l => l.userId === userId && (l.groupId || 1) === groupId);
                const balanceDelta = logsForUser.reduce((sum, log) => sum + log.points, 0);
                const lifetimeDelta = logsForUser.reduce((sum, log) => sum + (log.points > 0 ? log.points : 0), 0);

                const { error: updateError } = await supabase
                   .from('user_memberships')
                   .update({
                       points: (current.points || 0) + balanceDelta,
                       total_points: (current.total_points || 0) + lifetimeDelta,
                       updated_at: new Date().toISOString()
                   })
                   .eq('user_id', userId)
                   .eq('group_id', groupId);

                if (updateError) {
                    console.error("Failed to update membership", updateError);
                    throw updateError;
                }
            } else {
                // Create membership if not exists (unlikely if they have a card, but possible)
                if (pointsToAdd > 0) {
                    const { error: insertError } = await supabase.from('user_memberships').insert({
                        user_id: userId,
                        group_id: groupId,
                        points: pointsToAdd,
                        total_points: pointsToAdd,
                        current_rank: 'REGULAR'
                    });
                    
                    if (insertError) {
                        console.error("Failed to insert membership", insertError);
                        throw insertError;
                    }
                }
            }
        }

        idsToDelete.push(...pointLogs.map(s => s.id as number));
      }

       // 2. Sync Design Grants (Upsert to user_designs table)
       if (designLogs.length > 0) {
         const designRecords = designLogs.map(s => ({
           user_id: s.userId,
           group_id: s.groupId || 1,
           design_id: s.designId,
           acquired_at: new Date(s.timestamp).toISOString()
         }));

         // Note: Assuming user_designs table exists in Supabase
         // The constraint name might vary, but unique(user_id, group_id, design_id) should handle conflicts.
         // If Supabase returns error on conflict without explicit ON CONFLICT, we might need to loop or use ignore.
         // upsert works if primary key or unique constraint matches.
         const { error: designError } = await supabase
           .from('user_designs')
           .upsert(designRecords, { onConflict: 'user_id, group_id, design_id' }); // Correct composite unique constraint
         
         if (designError) throw designError;
        idsToDelete.push(...designLogs.map(s => s.id as number));
       }
       
       // Clean up local pending scans
      const ids = Array.from(new Set(idsToDelete));
      if (ids.length > 0) {
        await db.pendingScans.bulkDelete(ids);
      }
      
      setResult({ success: ids.length });
      if (warnings.length > 0) {
        setError(warnings.join('\n'));
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "同期に失敗しました");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6">
      <header className="flex items-center mb-8">
        <Link to="/admin/dashboard" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h1 className="text-2xl font-bold">データ同期</h1>
      </header>

      <div className="max-w-md mx-auto">
         <div className="bg-white p-10 rounded-3xl text-center border border-gray-100 shadow-xl shadow-gray-100 mb-6">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
               <Database size={32} className="text-primary" />
            </div>
            <div className="text-6xl font-bold mb-2 text-text-main tracking-tighter">{count}</div>
            <div className="text-text-sub font-medium">未送信データ</div>
         </div>
         
         {error && (
           <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 border border-red-100 text-sm font-medium">
             {error}
           </div>
         )}
         
         {result ? (
           <div className="bg-green-50 text-green-700 p-8 rounded-3xl mb-4 text-center border border-green-100 animate-slide-up">
             <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <Check className="w-8 h-8 text-green-600" />
             </div>
             <div className="font-bold text-xl mb-1">同期完了！</div>
             <div className="text-sm opacity-80 mb-6">{result.success}件のデータを送信しました</div>
             <Link to="/admin/dashboard" className="block w-full bg-white text-green-700 border border-green-200 font-bold py-3.5 rounded-xl hover:bg-green-50 transition">
               ダッシュボードへ戻る
             </Link>
           </div>
         ) : (
           <button 
             onClick={handleSync}
             disabled={count === 0 || syncing}
             className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition shadow-lg
               ${count === 0 
                 ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                 : 'bg-primary hover:bg-primary-dark text-white shadow-blue-500/30 active:scale-[0.98]'}
             `}
           >
             {syncing ? (
               <>
                 <Loader2 className="animate-spin" /> 送信中...
               </>
             ) : (
               <>
                 <CloudUpload size={22} /> サーバーへ送信
               </>
             )}
           </button>
         )}

         {/* Debug List */}
         {count > 0 && !result && (
           <div className="mt-10">
             <h3 className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-4 ml-1">Pending Items</h3>
             <div className="space-y-2">
               {pendingScans?.slice(0, 5).map(item => (
                 <div key={item.id} className="bg-white p-4 rounded-xl text-sm flex justify-between border border-gray-100 shadow-sm">
                   <span className="font-mono text-gray-600">{item.userId}</span>
                   <span className={`font-bold ${item.type === 'GRANT_DESIGN' ? 'text-pink-500' : item.points > 0 ? 'text-primary' : 'text-red-500'}`}>
                     {item.type === 'GRANT_DESIGN' ? 'Design Gift' : `${item.points > 0 ? '+' : ''}${item.points} pt`}
                   </span>
                 </div>
               ))}
               {count > 5 && <div className="text-center text-gray-400 text-xs mt-4">...他 {count - 5} 件</div>}
             </div>
           </div>
         )}
      </div>
    </div>
  );
};
