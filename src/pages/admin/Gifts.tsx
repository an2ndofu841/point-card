import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Gift } from '../../lib/db';
import { ArrowLeft, Plus, Trash2, Edit2, Save, Ticket } from 'lucide-react';

export const ManageGifts = () => {
  // Get current admin group context
  const [groupId] = useState<number>(() => {
      const saved = localStorage.getItem('admin_selected_group_id');
      return saved ? parseInt(saved) : 1;
  });

  // Fetch group info
  const group = useLiveQuery(() => db.groups.get(groupId));

  // Filter gifts by groupId
  const gifts = useLiveQuery(() => 
    db.gifts.where('groupId').equals(groupId).toArray()
  , [groupId]);

  const [isEditing, setIsEditing] = useState<number | null>(null); // null = list mode, -1 = new item, id = edit item
  
  const [formData, setFormData] = useState<Partial<Gift>>({
    name: '',
    pointsRequired: 10,
    description: '',
    active: true,
    groupId: groupId
  });

  const handleEdit = (gift?: Gift) => {
    if (gift) {
      setFormData(gift);
      setIsEditing(gift.id!);
    } else {
      setFormData({
        name: '',
        pointsRequired: 10,
        description: '',
        active: true,
        groupId: groupId
      });
      setIsEditing(-1);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.pointsRequired) return;

    try {
      if (isEditing === -1) {
        await db.gifts.add({ ...formData, groupId } as Gift);
      } else if (isEditing !== null) {
        await db.gifts.update(isEditing, { ...formData, groupId });
      }
      setIsEditing(null);
    } catch (err) {
      console.error("Failed to save gift", err);
      alert("保存に失敗しました");
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("この特典を削除してもよろしいですか？")) {
      await db.gifts.delete(id);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <header className="flex items-center justify-between mb-8 sticky top-0 bg-bg-main/80 backdrop-blur-md py-4 z-10">
        <div className="flex items-center">
          <Link to="/admin/dashboard" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
             <h1 className="text-2xl font-bold">特典管理</h1>
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
        // Edit Form
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 animate-slide-up max-w-lg mx-auto">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            {isEditing === -1 ? <Plus size={20} /> : <Edit2 size={20} />}
            {isEditing === -1 ? '特典を登録' : '特典を編集'}
          </h2>
          
          <div className="space-y-5">
            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">特典名</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-bold text-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="例: 2ショットチェキ券"
              />
            </div>

            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">必要ポイント</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={formData.pointsRequired}
                  onChange={e => setFormData({...formData, pointsRequired: parseInt(e.target.value)})}
                  className="w-32 bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-mono text-lg font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <span className="font-bold text-gray-400">pt</span>
              </div>
            </div>

            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">説明 (オプション)</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 min-h-[100px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="特典の内容や利用条件など"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input 
                type="checkbox" 
                id="active"
                checked={formData.active}
                onChange={e => setFormData({...formData, active: e.target.checked})}
                className="w-5 h-5 rounded text-primary focus:ring-primary border-gray-300"
              />
              <label htmlFor="active" className="font-bold text-gray-700">この特典を有効にする</label>
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
        // List View
        <div className="space-y-4 max-w-lg mx-auto">
          {gifts?.length === 0 && (
             <div className="text-center py-12 opacity-50">
               <Ticket size={48} className="mx-auto mb-4 text-gray-300" />
               <p className="font-bold text-gray-400">登録された特典はありません</p>
               <p className="text-sm text-gray-400">右上の＋ボタンから追加してください</p>
             </div>
          )}

          {gifts?.map(gift => (
            <div key={gift.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group active:scale-[0.99] transition">
               <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-primary font-bold flex-shrink-0">
                   {gift.pointsRequired}<span className="text-xs ml-0.5">pt</span>
                 </div>
                 <div>
                   <h3 className={`font-bold text-lg ${!gift.active ? 'text-gray-400 line-through' : 'text-text-main'}`}>
                     {gift.name}
                   </h3>
                   <p className="text-xs text-text-sub line-clamp-1">{gift.description || '説明なし'}</p>
                 </div>
               </div>
               
               <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                 <button 
                   onClick={() => handleEdit(gift)}
                   className="p-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-blue-50 hover:text-primary transition"
                 >
                   <Edit2 size={18} />
                 </button>
                 <button 
                   onClick={() => handleDelete(gift.id!)}
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
