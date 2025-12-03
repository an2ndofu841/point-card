import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Star, Trophy, History, Settings, ChevronRight, Smartphone, User, Ticket, Users, ChevronDown } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';

export const UserHome = () => {
  const { isInstallable, install } = usePWAInstall();
  const [qrValue, setQrValue] = useState('');
  const [userId] = useState('user-sample-123'); // Mock ID
  const [activeGroupId, setActiveGroupId] = useState<number>(1); // Default to group 1

  // Fetch User Profile
  const userProfile = useLiveQuery(() => db.userCache.get(userId));
  const userName = userProfile?.name || 'ゲストさん';

  // Fetch All Groups User Belongs To (Updated to query userMemberships)
  // We need to fetch memberships first, then get the groups
  const myMemberships = useLiveQuery(() => db.userMemberships.where('userId').equals(userId).toArray(), [userId]);
  const myGroupIds = myMemberships?.map(m => m.groupId) || [1];
  
  // Fetch only joined groups
  const groups = useLiveQuery(() => 
    myGroupIds.length > 0 
      ? db.groups.where('id').anyOf(myGroupIds).toArray()
      : db.groups.where('id').equals(1).toArray() // Fallback
  , [myGroupIds]);

  const activeGroup = groups?.find(g => g.id === activeGroupId);

  // Fetch Membership for Active Group
  const membership = useLiveQuery(() => 
    db.userMemberships
      .where({ userId: userId, groupId: activeGroupId })
      .first()
  , [userId, activeGroupId]);

  const userPoints = membership?.points ?? 0;
  const totalPoints = membership?.totalPoints ?? 0;

  // Fetch Rank Configs for Active Group
  const ranks = useLiveQuery(() => 
    db.rankConfigs
      .where('groupId').equals(activeGroupId)
      .sortBy('minPoints')
  , [activeGroupId]);
  
  // Calculate Rank
  // Note: Dexie returns sorted array, we reverse to find highest matching rank
  const sortedRanks = ranks ? [...ranks].reverse() : [];
  const currentRank = sortedRanks.find(r => totalPoints >= r.minPoints) || { name: 'REGULAR', color: '#F59E0B' };

  // Fetch Selected Design for Active Group
  const designId = membership?.selectedDesignId;
  const currentDesign = useLiveQuery(() => designId ? db.cardDesigns.get(designId) : Promise.resolve(undefined), [designId]);

  useEffect(() => {
    // Generate static QR code on mount (Identity only)
    const payload = {
      id: userId,
      ts: Date.now()
    };
    setQrValue(btoa(JSON.stringify(payload)));
  }, [userId]);

  // Ensure membership exists (Mock behavior for prototype)
  useEffect(() => {
      const ensureMembership = async () => {
          const exists = await db.userMemberships.where({ userId, groupId: activeGroupId }).first();
          if (!exists) {
              // Auto-join group for demo purposes if not exists
              await db.userMemberships.add({
                  userId,
                  groupId: activeGroupId,
                  points: 0,
                  totalPoints: 0,
                  currentRank: 'REGULAR',
                  lastUpdated: Date.now()
              });
          }
      };
      ensureMembership();
  }, [userId, activeGroupId]);


  // Helper to determine background style properties
  const getBackgroundStyles = (imageUrl?: string) => {
    // Default fallback
    if (!imageUrl) {
      return {
        backgroundImage: activeGroup?.themeColor ? 'none' : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
        backgroundColor: activeGroup?.themeColor || '#2563EB'
      };
    }

    const isUrl = imageUrl.startsWith('http') || imageUrl.startsWith('data:');
    const isGradient = imageUrl.includes('gradient');
    const isColor = !isUrl && !isGradient;

    return {
      backgroundImage: isUrl 
        ? `url(${imageUrl})` 
        : (isGradient ? imageUrl : 'none'),
      backgroundColor: isColor ? imageUrl : 'transparent',
    };
  };

  const bgStyles = getBackgroundStyles(currentDesign?.imageUrl);

  return (
    <div className="min-h-screen bg-bg-main text-text-main pb-24">
      
      {/* Header Area */}
      <div className="bg-white pb-8 pt-6 px-6 rounded-b-[2.5rem] shadow-sm border-b border-gray-100 relative overflow-hidden">
         {/* Decorative blobs */}
         <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-50 rounded-full blur-3xl opacity-80 pointer-events-none"></div>
         
         <div className="flex justify-between items-center mb-6 relative z-10">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 overflow-hidden">
                {activeGroup?.logoUrl ? (
                    <img src={activeGroup.logoUrl} className="w-full h-full object-cover" alt="logo" />
                ) : (
                    <User size={20} className="text-gray-500" />
                )}
             </div>
             <div>
               <h1 className="text-sm font-bold text-gray-500">こんにちは</h1>
               <p className="text-lg font-bold text-text-main -mt-1">{userName}</p>
             </div>
           </div>
           <Link to="/user/settings" className="p-2.5 rounded-full hover:bg-gray-50 transition border border-transparent hover:border-gray-200">
             <Settings size={22} className="text-gray-400" />
           </Link>
         </div>

         {/* Group Switcher */}
         <div className="relative z-10 mb-4">
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {/* Only show joined groups */}
                {groups?.map(group => (
                    <button
                        key={group.id}
                        onClick={() => setActiveGroupId(group.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition whitespace-nowrap
                            ${activeGroupId === group.id 
                                ? 'bg-gray-900 text-white shadow-md' 
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        {group.name}
                    </button>
                ))}
                {/* Mock Add Group Button - Link to admin for now or help text */}
                <Link to="/admin/groups" className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-gray-100 text-gray-400 border border-dashed border-gray-300 hover:bg-gray-200 transition whitespace-nowrap">
                    <Users size={14} /> + 追加
                </Link>
            </div>
         </div>

         {/* Point Card */}
         <div className="relative w-full max-w-sm mx-auto aspect-[1.6/1] rounded-2xl shadow-xl shadow-gray-300/50 overflow-hidden p-6 flex flex-col justify-between isolate transition-all duration-500">
            {/* Dynamic Background */}
            <div 
              className="absolute inset-0 -z-10"
              style={{ 
                ...bgStyles,
                backgroundSize: 'cover', 
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            ></div>
            
            {/* Default Patterns (only if default gradient) */}
            {!currentDesign?.imageUrl && (
              <>
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 blur-2xl rounded-full -ml-10 -mb-10 pointer-events-none"></div>
              </>
            )}
            
            {/* Card Content */}
            <div className="flex justify-between items-start z-10" style={{ color: currentDesign?.themeColor || '#ffffff' }}>
               <div>
                 <p className="text-[10px] uppercase tracking-widest opacity-80 mb-1 font-bold drop-shadow-sm">{activeGroup?.name || 'Unknown Group'}</p>
                 <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow-sm">
                   <Star 
                     size={14} 
                     className="fill-current" 
                     style={{ color: currentDesign?.themeColor || '#ffffff' }}
                   />
                   <span className="font-bold text-sm tracking-wide">{currentRank.name}</span>
                 </div>
               </div>
               <div className="text-right">
                 <p className="text-[10px] uppercase tracking-widest opacity-80 mb-0.5 drop-shadow-sm">Total Points</p>
                 <p className="text-4xl font-mono font-bold tracking-tighter leading-none drop-shadow-md">{userPoints}<span className="text-sm ml-1 font-sans font-normal opacity-80">pt</span></p>
               </div>
            </div>

            <div className="z-10 mt-auto flex justify-between items-end" style={{ color: currentDesign?.themeColor || '#ffffff' }}>
               <div>
                 <p className="text-[10px] opacity-60 font-mono mb-1 uppercase drop-shadow-sm">Lifetime</p>
                 <p className="text-sm font-mono font-bold opacity-90 tracking-wider drop-shadow-sm">{totalPoints} pt</p>
               </div>
               <div>
                 <p className="text-[10px] opacity-60 font-mono mb-1 uppercase text-right drop-shadow-sm">Member ID</p>
                 <p className="text-lg font-mono tracking-widest opacity-90 drop-shadow-sm">0000 1234 5678</p>
               </div>
            </div>
         </div>
      </div>

      {/* QR Code Section */}
      <div className="px-6 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl p-6 shadow-xl shadow-gray-200/50 max-w-[18rem] mx-auto text-center border border-gray-100">
           <div className="mb-4 bg-white p-2 rounded-xl border border-gray-50 inline-block">
             {qrValue && (
                <QRCodeCanvas 
                  value={qrValue} 
                  size={180}
                  level={"H"}
                  className="rounded-lg"
                />
              )}
           </div>
           
           <div className="text-xs text-gray-400 font-bold">
             会員証QRコード
           </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 space-y-3 max-w-md mx-auto mt-4">
         <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2">Menu ({activeGroup?.name})</h3>
         
         <Link to="/user/gifts" className="block w-full">
            <button className="w-full bg-white p-4 rounded-2xl flex items-center justify-between border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition group active:scale-[0.99]">
                <div className="flex items-center gap-4">
                <div className="bg-purple-50 p-3 rounded-xl text-purple-600 group-hover:bg-purple-100 transition">
                    <Trophy size={22} />
                </div>
                <div className="text-left">
                    <p className="font-bold text-text-main">特典交換</p>
                    <p className="text-xs text-text-sub mt-0.5">貯めたポイントを使う</p>
                </div>
                </div>
                <ChevronRight className="text-gray-300 group-hover:text-primary transition" size={20} />
            </button>
         </Link>

         <Link to="/user/tickets" className="block w-full">
           <button className="w-full bg-white p-4 rounded-2xl flex items-center justify-between border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition group active:scale-[0.99]">
              <div className="flex items-center gap-4">
                <div className="bg-green-50 p-3 rounded-xl text-green-600 group-hover:bg-green-100 transition">
                  <Ticket size={22} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-text-main">マイチケット</p>
                  <p className="text-xs text-text-sub mt-0.5">保有中のチケットを確認</p>
                </div>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-primary transition" size={20} />
           </button>
         </Link>

         <Link to="/user/history" className="block w-full">
           <button className="w-full bg-white p-4 rounded-2xl flex items-center justify-between border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition group active:scale-[0.99]">
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600 group-hover:bg-blue-100 transition">
                  <History size={22} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-text-main">ポイント履歴</p>
                  <p className="text-xs text-text-sub mt-0.5">獲得・利用履歴を確認</p>
                </div>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-primary transition" size={20} />
           </button>
         </Link>

         {isInstallable && (
          <button 
            onClick={install}
            className="w-full mt-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition"
          >
            <Download size={20} /> アプリをホームに追加
          </button>
        )}
      </div>

    </div>
  );
};
