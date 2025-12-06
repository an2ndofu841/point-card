import { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type UserTicket } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { ArrowLeft, Ticket, Clock, ChevronRight, X } from 'lucide-react';

export const UserTickets = () => {
  const { userId } = useCurrentUser();

  // Sync tickets from Supabase on mount
  useEffect(() => {
      const syncTickets = async () => {
          if (isMock || !userId) return;

          // Ideally we filter by groupId too if this page is group-specific
          // But current TicketList UI seems global or context-less?
          // Let's assume we want ALL unused tickets for this user.
          
          // We need a table for user_tickets in Supabase.
          // Assuming 'user_tickets' table exists (created in SQL previously?)
          // If not, we need to create it. 
          // Let's check if we fetch from 'user_tickets'.
          
          const { data, error } = await supabase
            .from('user_tickets')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'UNUSED');

          if (error) {
              // If error, maybe table doesn't exist yet.
              console.warn("Failed to fetch tickets", error);
              return;
          }

          if (data) {
              // Sync to local
              // We want to overwrite local unused tickets with server ones to ensure consistency
              // But we also don't want to lose offline tickets if any.
              // For now, let's UPSERT based on ID if possible, or just ADD missing ones.
              // Actually, if we clear cache, local is empty.
              
              // Map Supabase columns to local columns
              const tickets: UserTicket[] = data.map(t => ({
                  id: t.id,
                  userId: t.user_id,
                  groupId: t.group_id,
                  giftId: t.gift_id,
                  giftName: t.gift_name, // Assuming we store name, or need to join gifts table
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
  const [qrValue, setQrValue] = useState('');

  const handleOpenTicket = (ticket: UserTicket) => {
    const payload = {
      ticketId: ticket.id,
      userId: ticket.userId,
      action: 'USE_TICKET',
      ts: Date.now()
    };
    setQrValue(btoa(JSON.stringify(payload)));
    setSelectedTicket(ticket);
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24">
      <div className="flex items-center mb-6">
        <Link to="/home" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold">マイチケット</h1>
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

      {/* Ticket Modal (QR Display) */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl animate-slide-up relative">
             <button 
               onClick={() => setSelectedTicket(null)}
               className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition"
             >
               <X size={20} />
             </button>

             <div className="mb-6 mt-2">
               <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ticket</p>
               <h2 className="text-2xl font-bold text-text-main leading-tight">{selectedTicket.giftName}</h2>
             </div>

             <div className="bg-gray-50 p-6 rounded-2xl inline-block mb-6 border border-gray-100">
                <QRCodeCanvas 
                  value={qrValue} 
                  size={200}
                  level={"H"}
                  className="rounded-lg"
                />
             </div>

             <div className="flex items-center justify-center gap-2 text-xs font-bold text-text-sub bg-blue-50 py-2 px-4 rounded-full w-fit mx-auto mb-6">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                スタッフに提示してください
             </div>

             <p className="text-xs text-gray-400 leading-relaxed">
               使用するとチケットは消滅します。<br/>
               スクリーンショットは無効です。
             </p>
          </div>
        </div>
      )}
    </div>
  );
};
