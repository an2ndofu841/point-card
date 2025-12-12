import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { ArrowLeft, Clock, Gift } from 'lucide-react';

export const UserHistory = () => {
  const navigate = useNavigate();
  const { userId } = useCurrentUser();

  const history = useLiveQuery(() => 
    userId ? db.pointHistory
      .where('userId').equals(userId)
      .reverse()
      .sortBy('timestamp') : []
  , [userId]);

  // Combine point history and used tickets
  const ticketHistory = useLiveQuery(() => 
    userId ? db.userTickets
      .where('userId').equals(userId)
      .filter(t => t.status === 'USED')
      .reverse()
      .toArray() : []
  , [userId]);

  if (!userId) return null;

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <div className="flex items-center mb-8">
        <button onClick={() => navigate(-1)} className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold">利用履歴</h1>
      </div>

      <div className="space-y-6">
        
        {/* Used Tickets */}
        <div>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">使用済みチケット</h2>
            {ticketHistory && ticketHistory.length > 0 ? (
                <div className="space-y-3">
                    {ticketHistory.map(ticket => (
                        <div key={ticket.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center opacity-70">
                            <div>
                                <p className="font-bold text-text-main">{ticket.giftName}</p>
                                <div className="flex items-center gap-2 text-xs text-text-sub mt-1">
                                    <Clock size={12} />
                                    <span>{ticket.usedAt ? new Date(ticket.usedAt).toLocaleString() : '不明'} 使用</span>
                                </div>
                            </div>
                            <div className="bg-gray-100 p-2 rounded-full">
                                <Gift size={16} className="text-gray-400" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8 bg-white/50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-xs text-gray-400">使用済みのチケットはありません</p>
                </div>
            )}
        </div>

        {/* Point History (Placeholder if needed, or link to separate point history) */}
        {/* Ideally we merge both lists or keep them separate sections */}
        
      </div>
    </div>
  );
};

