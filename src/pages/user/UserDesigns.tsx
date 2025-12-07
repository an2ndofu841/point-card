import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { ArrowLeft, Check, Lock, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export const UserDesigns = () => {
  const { userId } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const stateGroupId = location.state?.groupId as number | undefined;

  const memberships = useLiveQuery(() => 
    userId ? db.userMemberships.where('userId').equals(userId).toArray() : []
  , [userId]);

  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(stateGroupId);

  // If only one group, auto-select it if no state provided
  useEffect(() => {
      if (!stateGroupId && memberships && memberships.length > 0) {
          if (!selectedGroupId) {
              setSelectedGroupId(memberships[0].groupId);
          }
      }
  }, [stateGroupId, memberships, selectedGroupId]);

  const groupId = selectedGroupId;

  // Fetch Group Info for Display
  const group = useLiveQuery(() => groupId ? db.groups.get(groupId) : undefined, [groupId]);

  // Fetch user membership for current group
  const membership = useLiveQuery(() => 
    (userId && groupId) ? db.userMemberships.where({ userId, groupId }).first() : undefined
  , [userId, groupId]);

  const selectedDesignId = membership?.selectedDesignId;

  // Fetch all available designs for this group
  const allDesigns = useLiveQuery(() => 
    groupId ? db.cardDesigns.where('groupId').equals(groupId).toArray() : []
  , [groupId]);
  
  // Fetch user owned designs for this group
  const userDesigns = useLiveQuery(() => 
    (userId && groupId) ? db.userDesigns.where({ userId, groupId }).toArray() : []
  , [userId, groupId]);
  
  const handleSelect = async (designId?: number) => {
    if (!membership?.id) return;
    await db.userMemberships.update(membership.id, { selectedDesignId: designId });
  };

  // Helper to determine background style properties
  const getBackgroundStyles = (imageUrl?: string) => {
    const isUrl = imageUrl?.startsWith('http') || imageUrl?.startsWith('data:');
    const isGradient = imageUrl?.includes('gradient');
    const isColor = !isUrl && !isGradient && imageUrl;

    return {
      backgroundImage: isUrl 
        ? `url(${imageUrl})` 
        : (isGradient ? imageUrl : 'none'),
      backgroundColor: isColor ? imageUrl : '#f0f0f0',
    };
  };

  if (!userId) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  // If no group selected yet (and user has memberships), show selector
  if (!groupId) {
      if (memberships?.length === 0) {
           return (
               <div className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
                   <p className="text-gray-400 mb-4">参加しているグループがありません</p>
                   <Link to="/home" className="text-primary font-bold">ホームへ戻る</Link>
               </div>
           );
      }
      return (
          <div className="min-h-screen bg-bg-main p-6 text-text-main">
              <div className="flex items-center mb-6">
                <Link to="/user/settings" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm">
                  <ArrowLeft size={20} className="text-gray-600" />
                </Link>
                <h1 className="text-xl font-bold">グループを選択</h1>
              </div>
              <p className="text-sm text-gray-500 mb-4">デザイン変更するグループを選んでください</p>
              <div className="space-y-4">
                  {memberships?.map(m => (
                      <GroupSelectorItem key={m.groupId} groupId={m.groupId} onSelect={() => setSelectedGroupId(m.groupId)} />
                  ))}
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <div className="flex items-center mb-8">
        <button onClick={() => {
            // Always go back to home, regardless of how we got here.
            // The user wants to "return" to the main screen.
            navigate('/home');
        }} className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
            <h1 className="text-xl font-bold">券面デザイン変更</h1>
            {group && <p className="text-xs text-gray-400 font-bold">{group.name}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-md mx-auto">
        
        {/* Default Design */}
        <div 
          onClick={() => handleSelect(undefined)}
          className={`relative aspect-[1.6/1] rounded-2xl overflow-hidden cursor-pointer transition-all ${selectedDesignId === undefined ? 'ring-4 ring-primary ring-offset-2' : 'hover:opacity-90'}`}
        >
           <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-dark"></div>
           <div className="absolute inset-0 p-6 text-white flex flex-col justify-between">
             <div className="flex justify-between">
               <span className="text-xs opacity-80 tracking-widest uppercase">Default</span>
               {selectedDesignId === undefined && <div className="bg-white/20 p-1 rounded-full"><Check size={16} /></div>}
             </div>
             <div className="text-center font-bold opacity-50">STANDARD</div>
           </div>
        </div>

        {/* Custom Designs */}
        {allDesigns?.map(design => {
          const isOwned = userDesigns?.some(ud => ud.designId === design.id);
          const isSelected = selectedDesignId === design.id;

          return (
            <div 
              key={design.id} 
              onClick={() => isOwned ? handleSelect(design.id) : null}
              className={`relative aspect-[1.6/1] rounded-2xl overflow-hidden transition-all ${isOwned ? 'cursor-pointer hover:opacity-90' : 'opacity-60 grayscale cursor-not-allowed'} ${isSelected ? 'ring-4 ring-primary ring-offset-2' : ''}`}
            >
               {/* Background */}
               <div 
                 className="absolute inset-0"
                 style={{ 
                   ...getBackgroundStyles(design.imageUrl),
                   backgroundSize: 'cover',
                   backgroundPosition: 'center',
                   backgroundRepeat: 'no-repeat'
                 }}
               ></div>

               {/* Overlay Content */}
               <div className="absolute inset-0 p-4 flex flex-col justify-between z-10">
                 <div className="flex justify-between items-start">
                   {isSelected && <div className="bg-primary text-white p-1 rounded-full shadow-md"><Check size={16} /></div>}
                   {!isOwned && <div className="bg-black/50 text-white p-1.5 rounded-full backdrop-blur-sm ml-auto"><Lock size={16} /></div>}
                 </div>
                 
                 <div className="mt-auto">
                    <p className="text-white font-bold drop-shadow-md text-lg" style={{ color: design.themeColor }}>{design.name}</p>
                 </div>
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Helper Component to fetch Group Name
const GroupSelectorItem = ({ groupId, onSelect }: { groupId: number, onSelect: () => void }) => {
    const group = useLiveQuery(() => db.groups.get(groupId), [groupId]);
    return (
        <button 
            onClick={onSelect}
            className="w-full p-4 bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-left hover:bg-gray-50 flex justify-between items-center"
        >
            <span>{group ? group.name : `Group ID: ${groupId}`}</span>
            <ArrowLeft size={16} className="rotate-180 text-gray-300" />
        </button>
    );
};