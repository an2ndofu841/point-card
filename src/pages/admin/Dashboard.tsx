import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';
import { QrCode, RefreshCw, Gift, AlertTriangle, LogOut, Crown, Palette, Users, ChevronDown } from 'lucide-react';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  
  // Group Selection Logic
  const groups = useLiveQuery(() => db.groups.toArray());
  const [selectedGroupId, setSelectedGroupId] = useState<number>(() => {
      const saved = localStorage.getItem('admin_selected_group_id');
      return saved ? parseInt(saved) : 1;
  });

  useEffect(() => {
      if (selectedGroupId) {
          localStorage.setItem('admin_selected_group_id', selectedGroupId.toString());
      }
  }, [selectedGroupId]);

  const currentGroup = groups?.find(g => g.id === selectedGroupId);

  // Filter pending scans by selected group
  const pendingCount = useLiveQuery(() => 
    db.pendingScans
      .filter(s => !s.synced && s.groupId === selectedGroupId)
      .count()
  , [selectedGroupId]);
  
  const count = pendingCount ?? 0;

  const handleLogout = async () => {
      if (window.confirm('ログアウトしますか？')) {
          if (isMock) {
              localStorage.removeItem('mock_admin_session');
          } else {
              await supabase.auth.signOut();
          }
          navigate('/admin/login');
      }
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main pb-20">
      {/* Header */}
      <header className="bg-white pt-12 pb-6 px-6 rounded-b-[2rem] shadow-sm border-b border-gray-100 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-text-main">運営ダッシュボード</h1>
            <div className="relative mt-1 inline-block">
                <select 
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(parseInt(e.target.value))}
                    className="appearance-none bg-gray-50 border border-gray-200 text-text-main font-bold text-sm py-2 pl-4 pr-10 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                >
                    {groups?.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                    <ChevronDown size={14} />
                </div>
            </div>
          </div>
          <div className="flex gap-2">
             <button 
               onClick={handleLogout}
               className="p-2 rounded-full hover:bg-red-50 transition text-gray-400 hover:text-red-500"
             >
               <LogOut size={20} />
             </button>
          </div>
        </div>

        {count > 0 && (
           <Link to="/admin/sync" className="bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between animate-fade-in">
             <div className="flex items-center gap-2">
               <AlertTriangle size={18} className="text-amber-500" />
               <span>未送信データ ({currentGroup?.name})</span>
             </div>
             <span className="bg-amber-500 text-white px-2 py-0.5 rounded-md text-xs">{count}件</span>
           </Link>
        )}
      </header>
      
      <div className="px-6 grid grid-cols-1 gap-4 max-w-md mx-auto">
        <Link to="/admin/scan" className="group relative bg-gradient-to-br from-primary to-primary-dark text-white p-8 rounded-2xl shadow-xl shadow-blue-500/20 overflow-hidden transition active:scale-[0.98]">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none group-hover:bg-white/20 transition"></div>
          
          <div className="relative z-10 flex items-center justify-between">
             <div className="flex flex-col">
               <span className="font-bold text-2xl mb-1">スキャナー起動</span>
               <span className="text-blue-100 text-sm">会員証QRを読み取る</span>
               <span className="text-white/50 text-xs mt-1 font-mono border border-white/20 rounded px-1.5 py-0.5 w-fit">{currentGroup?.name}</span>
             </div>
             <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
               <QrCode size={32} />
             </div>
          </div>
        </Link>

        <Link to="/admin/sync" className="bg-white p-6 rounded-2xl flex items-center justify-between border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition active:scale-[0.98]">
           <div className="flex items-center gap-4">
             <div className="bg-green-50 p-3 rounded-xl text-green-600">
               <RefreshCw size={24} />
             </div>
             <div className="text-left">
               <div className="font-bold text-lg text-text-main">データ同期</div>
               <div className="text-text-sub text-sm">未送信: <span className={count > 0 ? 'text-amber-500 font-bold' : ''}>{count}件</span></div>
             </div>
           </div>
        </Link>

        <div className="grid grid-cols-2 gap-4">
          <Link to="/admin/gifts" className="bg-white p-6 rounded-2xl flex flex-col items-center justify-center border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition active:scale-[0.98]">
             <div className="bg-purple-50 p-3 rounded-xl text-purple-600 mb-3">
               <Gift size={24} />
             </div>
             <div className="text-center">
               <div className="font-bold text-text-main">特典管理</div>
               <div className="text-text-sub text-xs">交換アイテム設定</div>
             </div>
          </Link>

          <Link to="/admin/groups" className="bg-white p-6 rounded-2xl flex flex-col items-center justify-center border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition active:scale-[0.98]">
             <div className="bg-blue-50 p-3 rounded-xl text-blue-600 mb-3">
               <Users size={24} />
             </div>
             <div className="text-center">
               <div className="font-bold text-text-main">グループ管理</div>
               <div className="text-text-sub text-xs">招待QR作成</div>
             </div>
          </Link>

          <Link to="/admin/ranks" className="bg-white p-6 rounded-2xl flex flex-col items-center justify-center border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition active:scale-[0.98]">
             <div className="bg-yellow-50 p-3 rounded-xl text-yellow-600 mb-3">
               <Crown size={24} />
             </div>
             <div className="text-center">
               <div className="font-bold text-text-main">ランク設定</div>
               <div className="text-text-sub text-xs">昇格条件の編集</div>
             </div>
          </Link>

          <Link to="/admin/designs" className="bg-white p-6 rounded-2xl flex flex-col items-center justify-center border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition active:scale-[0.98]">
             <div className="bg-pink-50 p-3 rounded-xl text-pink-600 mb-3">
               <Palette size={24} />
             </div>
             <div className="text-center">
               <div className="font-bold text-text-main">券面デザイン</div>
               <div className="text-text-sub text-xs">着せ替えの編集</div>
             </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
