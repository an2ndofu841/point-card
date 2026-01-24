import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, QrCode, Loader2, Users, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Html5QrcodeScanner } from 'html5-qrcode';
import type { IdolGroup } from '../../lib/db';

export const GroupSearch = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'search' | 'scan'>('search');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IdolGroup[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [defaultGroups, setDefaultGroups] = useState<IdolGroup[]>([]);
  const [isLoadingDefault, setIsLoadingDefault] = useState(false);
  
  // Scanner State
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Search Groups
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .ilike('name', `%${searchQuery}%`)
        .is('deleted_at', null)
        .limit(20);
        
      if (error) throw error;
      
      // Map snake_case to camelCase for frontend
      const mappedData = data?.map(g => ({
        id: g.id,
        name: g.name,
        themeColor: g.theme_color,
        logoUrl: g.logo_url,
        transferEnabled: g.transfer_enabled ?? false,
        deletedAt: g.deleted_at ? new Date(g.deleted_at).getTime() : null
      })) || [];
      
      setSearchResults(mappedData);
    } catch (err) {
      console.error("Search failed", err);
      alert("検索中にエラーが発生しました");
    } finally {
      setIsSearching(false);
    }
  };

  const fetchDefaultGroups = async () => {
    setIsLoadingDefault(true);
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .is('deleted_at', null)
        .order('name', { ascending: true })
        .limit(100);

      if (error) throw error;

      const mappedData = data?.map(g => ({
        id: g.id,
        name: g.name,
        themeColor: g.theme_color,
        logoUrl: g.logo_url,
        transferEnabled: g.transfer_enabled ?? false,
        deletedAt: g.deleted_at ? new Date(g.deleted_at).getTime() : null
      })) || [];

      setDefaultGroups(mappedData);
    } catch (err) {
      console.error('Default group fetch failed', err);
      alert('グループ一覧の取得に失敗しました');
    } finally {
      setIsLoadingDefault(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'search') return;
    fetchDefaultGroups();
  }, [activeTab]);

  // Initialize Scanner when tab changes
  useEffect(() => {
    if (activeTab === 'scan') {
      const scannerId = "reader";
      
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        if (!document.getElementById(scannerId)) return;

        // Cleanup previous instance if any
        if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
        }

        const scanner = new Html5QrcodeScanner(
          scannerId,
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          false
        );
        
        scannerRef.current = scanner;
        
        scanner.render((decodedText) => {
          // Success callback
          try {
            // Expect URL like .../join/123
            const url = new URL(decodedText);
            const match = url.pathname.match(/\/join\/(\d+)/);
            
            if (match && match[1]) {
              scanner.clear().then(() => {
                navigate(`/join/${match[1]}`);
              });
            } else {
              setScanError("無効なQRコードです");
            }
          } catch (e) {
             // Not a valid URL, maybe direct JSON?
             console.log("Not a URL", e);
             setScanError("読み取れない形式です");
          }
        }, (errorMessage) => {
          // Error callback (ignore scan failures, only show critical setup errors)
          console.log(errorMessage);
        });
      }, 100);
      
      return () => {
        if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
        }
      };
    }
  }, [activeTab, navigate]);

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <div className="flex items-center mb-6">
        <Link to="/home" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold">グループ追加</h1>
      </div>

      {/* Tab Switcher */}
      <div className="bg-white p-1 rounded-xl border border-gray-200 flex mb-8">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition ${activeTab === 'search' ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          <Search size={16} /> 検索
        </button>
        <button
          onClick={() => setActiveTab('scan')}
          className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition ${activeTab === 'scan' ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          <QrCode size={16} /> スキャン
        </button>
      </div>

      {activeTab === 'search' && (
        <div className="animate-fade-in">
          <div className="relative mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="グループ名で検索..."
              className="w-full bg-white border border-gray-200 rounded-xl py-4 pl-12 pr-4 font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          </div>

          <div className="space-y-4">
             {(isSearching || isLoadingDefault) && (
               <div className="text-center py-8">
                 <Loader2 className="animate-spin mx-auto text-primary mb-2" />
                 <p className="text-xs text-gray-400">{isSearching ? '検索中...' : '読み込み中...'}</p>
               </div>
             )}

             {!isSearching && !isLoadingDefault && searchResults.length === 0 && searchQuery && (
               <div className="text-center py-12 opacity-50">
                 <Users size={40} className="mx-auto mb-3 text-gray-300" />
                 <p className="font-bold text-gray-400">見つかりませんでした</p>
               </div>
             )}

             {!isSearching && !isLoadingDefault && !searchQuery && defaultGroups.length === 0 && (
               <div className="text-center py-12 opacity-50">
                 <Users size={40} className="mx-auto mb-3 text-gray-300" />
                 <p className="font-bold text-gray-400">グループがありません</p>
               </div>
             )}

             {(searchQuery ? searchResults : defaultGroups).map(group => (
               <Link
                 key={group.id}
                 to={`/join/${group.id}`}
                 className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:bg-gray-50 transition"
               >
                 <div className="flex items-center gap-4">
                   <div 
                     className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm"
                     style={{ backgroundColor: group.themeColor }}
                   >
                      {group.logoUrl ? <img src={group.logoUrl} alt="" className="w-full h-full object-cover rounded-full" /> : group.name[0]}
                   </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-text-main">{group.name}</h3>
                      {group.transferEnabled && (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                          引き継ぎ可
                        </span>
                      )}
                    </div>
                  </div>
                 </div>
                 <span 
                   className="bg-gray-50 text-primary p-2.5 rounded-full hover:bg-primary hover:text-white transition"
                   aria-hidden="true"
                 >
                   <ArrowRight size={20} />
                 </span>
               </Link>
             ))}
          </div>
        </div>
      )}

      {activeTab === 'scan' && (
        <div className="animate-fade-in">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div id="reader" className="w-full rounded-lg overflow-hidden"></div>
          </div>
          
          {scanError && (
             <div className="bg-red-50 text-red-500 p-4 rounded-xl text-sm font-bold text-center mb-4">
                {scanError}
             </div>
          )}

          <div className="text-center text-gray-400 text-xs">
            <p>招待QRコードを読み取ってください</p>
          </div>
        </div>
      )}

    </div>
  );
};

