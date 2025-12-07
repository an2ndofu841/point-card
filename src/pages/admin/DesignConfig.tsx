import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CardDesign } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase'; // Import supabase
import { ArrowLeft, Plus, Trash2, Edit2, Save, ImageIcon, Palette, Loader2 } from 'lucide-react';

export const ManageDesigns = () => {
  // Get current admin group context
  const [groupId] = useState<number>(() => {
      const saved = localStorage.getItem('admin_selected_group_id');
      return saved ? parseInt(saved) : 1;
  });

  // Fetch group info
  const group = useLiveQuery(() => db.groups.get(groupId));

  // Filter designs by group
  const designs = useLiveQuery(() => 
    db.cardDesigns.where('groupId').equals(groupId).toArray()
  , [groupId]);

  const [isEditing, setIsEditing] = useState<number | null>(null);
  
  const [formData, setFormData] = useState<Partial<CardDesign>>({
    name: '',
    imageUrl: '',
    themeColor: '#ffffff',
    groupId: groupId
  });
  
  const [uploading, setUploading] = useState(false); // Upload state

  // Simple gradient presets for MVP
  const presets = [
    { name: 'Sunset', bg: 'linear-gradient(to right, #ff512f, #dd2476)', color: '#ffffff' },
    { name: 'Ocean', bg: 'linear-gradient(to right, #2193b0, #6dd5ed)', color: '#ffffff' },
    { name: 'Forest', bg: 'linear-gradient(to right, #11998e, #38ef7d)', color: '#ffffff' },
    { name: 'Midnight', bg: 'linear-gradient(to right, #232526, #414345)', color: '#ffffff' },
  ];

  const handleEdit = (design?: CardDesign) => {
    if (design) {
      setFormData(design);
      setIsEditing(design.id!);
    } else {
      setFormData({
        name: '',
        imageUrl: presets[0].bg, // Default to gradient
        themeColor: '#ffffff',
        groupId: groupId
      });
      setIsEditing(-1);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setUploading(true);

    try {
      if (isMock) {
        // Mock upload: use FileReader to get base64 (simulate URL)
        const reader = new FileReader();
        reader.onload = (ev) => {
          setFormData({ ...formData, imageUrl: ev.target?.result as string });
          setUploading(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      // Real Supabase Upload
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('card-designs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data } = supabase.storage
        .from('card-designs')
        .getPublicUrl(filePath);

      setFormData({ ...formData, imageUrl: data.publicUrl });

    } catch (error) {
      console.error('Error uploading image:', error);
      alert('画像のアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  // Sync designs from Supabase on mount
  React.useEffect(() => {
    const syncDesigns = async () => {
        if (isMock || !groupId) return;

        const { data, error } = await supabase
            .from('card_designs')
            .select('*')
            .eq('group_id', groupId);

        if (error) {
            console.error("Failed to fetch designs", error);
            return;
        }

        if (data && data.length > 0) {
            await db.cardDesigns.bulkPut(data.map(d => ({
                id: d.id,
                groupId: d.group_id,
                name: d.name,
                imageUrl: d.image_url,
                themeColor: d.theme_color
            })));
        }
    };
    syncDesigns();
  }, [groupId]);

  const handleSave = async () => {
    if (!formData.name) return;

    try {
      if (isMock) {
          if (isEditing === -1) {
            await db.cardDesigns.add({ ...formData, groupId } as CardDesign);
          } else if (isEditing !== null) {
            await db.cardDesigns.update(isEditing, { ...formData, groupId });
          }
      } else {
          // Real Supabase Sync
          if (isEditing === -1) {
              // Insert
              const { data, error } = await supabase
                  .from('card_designs')
                  .insert({
                      group_id: groupId,
                      name: formData.name,
                      image_url: formData.imageUrl,
                      theme_color: formData.themeColor
                  })
                  .select()
                  .single();
              
              if (error) throw error;
              
              // Add to local with returned ID
              await db.cardDesigns.add({ 
                  id: data.id,
                  groupId: data.group_id,
                  name: data.name,
                  imageUrl: data.image_url,
                  themeColor: data.theme_color
              });

          } else if (isEditing !== null) {
              // Update
              const { error } = await supabase
                  .from('card_designs')
                  .update({
                      name: formData.name,
                      image_url: formData.imageUrl,
                      theme_color: formData.themeColor
                  })
                  .eq('id', isEditing);

              if (error) throw error;

              await db.cardDesigns.update(isEditing, { ...formData, groupId });
          }
      }

      setIsEditing(null);
    } catch (err) {
      console.error("Failed to save design", err);
      alert("保存に失敗しました");
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("このデザインを削除してもよろしいですか？")) {
      if (!isMock) {
          const { error } = await supabase.from('card_designs').delete().eq('id', id);
          if (error) {
              console.error("Failed to delete from Supabase", error);
              alert("削除に失敗しました");
              return;
          }
      }
      await db.cardDesigns.delete(id);
    }
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
      <header className="flex items-center justify-between mb-8 sticky top-0 bg-bg-main/80 backdrop-blur-md py-4 z-10">
        <div className="flex items-center">
          <Link to="/admin/dashboard" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
             <h1 className="text-2xl font-bold">券面デザイン管理</h1>
             <p className="text-xs text-gray-500 font-bold">{group?.name}</p>
          </div>
        </div>
        {isEditing === null && (
          <button 
            onClick={() => handleEdit()} 
            className="bg-primary hover:bg-primary-dark text-white p-3 rounded-full shadow-lg shadow-blue-500/30 transition active:scale-95"
          >
            <Plus size={24} />
          </button>
        )}
      </header>

      {isEditing !== null ? (
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 animate-slide-up max-w-lg mx-auto">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            {isEditing === -1 ? <Plus size={20} /> : <Edit2 size={20} />}
            {isEditing === -1 ? 'デザイン登録' : 'デザイン編集'}
          </h2>
          
          <div className="space-y-5">
            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">デザイン名</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-bold text-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="例: 2024夏ツアー限定"
              />
            </div>

            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-2">画像設定</label>
              
              {/* Image Upload Input */}
              <div className="mb-4">
                 <label className="block w-full cursor-pointer bg-gray-50 border-2 border-dashed border-gray-300 hover:border-primary hover:bg-blue-50 transition rounded-xl p-4 text-center">
                    {uploading ? (
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                         <Loader2 className="animate-spin" /> アップロード中...
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-500">
                         <ImageIcon size={24} />
                         <span className="text-sm font-bold">画像をアップロード</span>
                         <span className="text-xs opacity-70">推奨: 1600x1000px (1.6:1)</span>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                 </label>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-2">
                {presets.map(p => (
                  <button
                    key={p.name}
                    onClick={() => setFormData({...formData, imageUrl: p.bg, themeColor: p.color})}
                    className={`h-10 rounded-lg border-2 transition ${formData.imageUrl === p.bg ? 'border-primary scale-105' : 'border-transparent hover:scale-105'}`}
                    style={{ background: p.bg }}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400">※プリセットまたはアップロード画像を選択</p>
            </div>

            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">文字色</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.themeColor}
                  onChange={e => setFormData({...formData, themeColor: e.target.value})}
                  className="w-16 h-14 p-1 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer"
                />
                <span className="font-mono text-sm text-gray-500">{formData.themeColor}</span>
              </div>
            </div>

            <div className="mt-4">
               <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-2">プレビュー</label>
               <div 
                 className="w-full aspect-[1.6/1] rounded-2xl shadow-lg p-4 flex flex-col justify-between relative overflow-hidden"
                 style={{ 
                    ...getBackgroundStyles(formData.imageUrl),
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    color: formData.themeColor 
                 }}
               >
                 <div className="flex justify-between relative z-10">
                   <span className="font-bold drop-shadow-md">RANK</span>
                   <span className="font-bold font-mono drop-shadow-md">120pt</span>
                 </div>
                 <div className="text-right font-mono opacity-80 relative z-10 drop-shadow-md">SAMPLE</div>
               </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button 
              onClick={() => setIsEditing(null)}
              className="flex-1 bg-gray-100 text-gray-500 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition"
            >
              キャンセル
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 bg-primary text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-500/25 hover:bg-primary-dark transition flex items-center justify-center gap-2"
            >
              <Save size={18} /> 保存する
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 max-w-lg mx-auto">
          {designs?.length === 0 && (
             <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
               <Palette size={48} className="mx-auto mb-4 text-gray-300" />
               <p className="font-bold text-gray-400">デザインが登録されていません</p>
               <p className="text-sm text-gray-400 mb-4">新しい券面デザインを追加してください</p>
             </div>
          )}

          {designs?.map(design => (
            <div key={design.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group">
               <div className="flex items-center gap-4">
                 <div 
                   className="w-20 h-12 rounded-lg shadow-sm"
                   style={{ 
                     ...getBackgroundStyles(design.imageUrl),
                     backgroundSize: 'cover',
                     backgroundPosition: 'center',
                     backgroundRepeat: 'no-repeat'
                   }}
                 ></div>
                 <div>
                   <h3 className="font-bold text-text-main">{design.name}</h3>
                   <p className="text-xs text-text-sub font-mono">ID: {design.id}</p>
                 </div>
               </div>
               
               <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                 <button 
                   onClick={() => handleEdit(design)}
                   className="p-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-blue-50 hover:text-primary transition"
                 >
                   <Edit2 size={18} />
                 </button>
                 <button 
                   onClick={() => handleDelete(design.id!)}
                   className="p-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-red-50 hover:text-red-500 transition"
                 >
                   <Trash2 size={18} />
                 </button>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
