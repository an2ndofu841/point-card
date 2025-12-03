import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, History, Ticket, Star, Loader2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';

// Type for history item
interface HistoryItem {
  id: number;
  type: string;
  points: number;
  created_at: string;
  metadata?: any;
}

export const UserHistory = () => {
  const [userId] = useState('user-sample-123'); // Mock ID
  const [activeGroupId, setActiveGroupId] = useState<number>(1); // Should sync with Home
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user's active group context from somewhere if possible, 
  // or just default to 1 for now, or allow filter. 
  // Better to allow filter or show all. 
  // Let's show all but grouped? Or just list all for now.
  // Ideally we pass `activeGroupId` via location state or context.
  
  // For now let's try to match what is in Home. 
  // But since we don't have global state easily, let's just fetch all for the user.

  // Fetch local pending scans (offline data)
  const pendingScans = useLiveQuery(() => 
    db.pendingScans
      .where('userId').equals(userId)
      .reverse()
      .toArray()
  , [userId]);

  useEffect(() => {
    const fetchRemoteHistory = async () => {
      if (isMock) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('point_history')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        setHistory(data || []);
      } catch (err) {
        console.error("Failed to fetch history", err);
        // Fail gracefully (offline)
      } finally {
        setLoading(false);
      }
    };

    fetchRemoteHistory();
  }, [userId]);

  // Merge local and remote
  const mergedHistory = [
    ...(pendingScans || []).map(s => ({
      id: -s.id, // Negative ID for local
      type: s.type,
      points: s.points,
      created_at: new Date(s.timestamp).toISOString(),
      metadata: { ticketId: s.ticketId, isPending: true }
    })),
    ...history
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <header className="flex items-center mb-8">
        <Link to="/user/home" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h1 className="text-2xl font-bold">ポイント履歴</h1>
      </header>

      <div className="space-y-4 max-w-md mx-auto">
        {loading ? (
           <div className="text-center py-12 text-gray-400">
             <Loader2 className="animate-spin mx-auto mb-2" />
             読み込み中...
           </div>
        ) : mergedHistory.length === 0 ? (
           <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">
             <History size={48} className="mx-auto mb-4 text-gray-200" />
             <p className="font-bold">履歴がありません</p>
           </div>
        ) : (
           mergedHistory.map(item => (
             <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className={`w-12 h-12 rounded-full flex items-center justify-center 
                      ${item.type === 'GRANT' ? 'bg-blue-50 text-primary' : 
                        item.type === 'USE_TICKET' ? 'bg-green-50 text-green-600' : 
                        'bg-purple-50 text-purple-600'}`}>
                      {item.type === 'GRANT' && <Star size={20} />}
                      {item.type === 'USE_TICKET' && <Ticket size={20} />}
                      {item.type === 'GRANT_DESIGN' && <History size={20} />}
                   </div>
                   <div>
                      <div className="font-bold text-text-main">
                        {item.type === 'GRANT' && 'ポイント獲得'}
                        {item.type === 'USE_TICKET' && 'チケット使用'}
                        {item.type === 'GRANT_DESIGN' && 'デザイン獲得'}
                      </div>
                      <div className="text-xs text-text-sub">
                        {new Date(item.created_at).toLocaleString('ja-JP')}
                        {item.metadata?.isPending && <span className="ml-2 text-amber-500 font-bold">(未送信)</span>}
                      </div>
                   </div>
                </div>
                <div className={`font-mono font-bold text-lg ${item.points > 0 ? 'text-primary' : 'text-gray-400'}`}>
                   {item.points > 0 ? `+${item.points}` : item.points}
                </div>
             </div>
           ))
        )}
      </div>
    </div>
  );
};

