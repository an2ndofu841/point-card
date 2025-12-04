import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { ArrowLeft, Check, Lock } from 'lucide-react';

export const UserDesigns = () => {
  const userId = 'user-sample-123'; // Mock ID
  
  // Fetch user cache to get currently selected design
  const userCache = useLiveQuery(() => db.userCache.get(userId));
  const selectedDesignId = userCache?.selectedDesignId;

  // Fetch all available designs
  const allDesigns = useLiveQuery(() => db.cardDesigns.toArray());
  
  // Fetch user owned designs
  const userDesigns = useLiveQuery(() => db.userDesigns.where('userId').equals(userId).toArray());
  
  const handleSelect = async (designId?: number) => {
    await db.userCache.update(userId, { selectedDesignId: designId });
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

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <div className="flex items-center mb-8">
        <Link to="/user/settings" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold">券面デザイン変更</h1>
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
              onClick={() => isOwned && handleSelect(design.id!)}
              className={`relative aspect-[1.6/1] rounded-2xl overflow-hidden transition-all ${isOwned ? 'cursor-pointer' : 'opacity-60 grayscale cursor-not-allowed'} ${isSelected ? 'ring-4 ring-primary ring-offset-2' : ''}`}
            >
               <div 
                 className="absolute inset-0" 
                 style={{ 
                   ...getBackgroundStyles(design.imageUrl),
                   backgroundSize: 'cover',
                   backgroundPosition: 'center',
                   backgroundRepeat: 'no-repeat'
                 }}
               ></div>
               
               <div className="absolute inset-0 p-6 flex flex-col justify-between" style={{ color: design.themeColor }}>
                 <div className="flex justify-between">
                   <span className="text-xs opacity-80 tracking-widest uppercase shadow-black drop-shadow-sm">{design.name}</span>
                   {isSelected && <div className="bg-white/20 backdrop-blur-sm p-1 rounded-full"><Check size={16} /></div>}
                   {!isOwned && <div className="bg-black/40 p-1.5 rounded-full text-white"><Lock size={16} /></div>}
                 </div>
               </div>
            </div>
          );
        })}

      </div>
    </div>
  );
};
