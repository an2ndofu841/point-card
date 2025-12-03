import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type UserTicket } from '../../lib/db';
import { ArrowLeft, Ticket, Clock, ChevronRight, CheckCircle, X } from 'lucide-react';

export const UserTickets = () => {
  const tickets = useLiveQuery(() => 
    db.userTickets
      .where('status').equals('UNUSED')
      .reverse()
      .toArray()
  );

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


