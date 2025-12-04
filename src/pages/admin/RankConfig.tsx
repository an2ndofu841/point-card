import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type RankConfig } from '../../lib/db';
import { ArrowLeft, Plus, Trash2, Edit2, Save, Star, Crown } from 'lucide-react';

export const RankConfigPage = () => {
  // Get current admin group context
  const [groupId] = useState<number>(() => {
      const saved = localStorage.getItem('admin_selected_group_id');
      return saved ? parseInt(saved) : 1;
  });

  // Fetch group info
  const group = useLiveQuery(() => db.groups.get(groupId));

  // Sort by minPoints ASC & filter by group
  const ranks = useLiveQuery(() => 
    db.rankConfigs
      .where('groupId').equals(groupId)
      .sortBy('minPoints')
  , [groupId]);

  const [isEditing, setIsEditing] = useState<number | null>(null);
  
  const [formData, setFormData] = useState<Partial<RankConfig>>({
    name: '',
    minPoints: 0,
    color: '#F59E0B', // Default Amber
    groupId: groupId
  });

  const handleEdit = (rank?: RankConfig) => {
    if (rank) {
      setFormData(rank);
      setIsEditing(rank.id!);
    } else {
      setFormData({
        name: '',
        minPoints: 0,
        color: '#F59E0B',
        groupId: groupId
      });
      setIsEditing(-1);
    }
  };

  const handleSave = async () => {
    if (!formData.name) return;

    try {
      if (isEditing === -1) {
        await db.rankConfigs.add({ ...formData, groupId } as RankConfig);
      } else if (isEditing !== null) {
        await db.rankConfigs.update(isEditing, { ...formData, groupId });
      }
      setIsEditing(null);
    } catch (err) {
      console.error("Failed to save rank", err);
      alert("保存に失敗しました");
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("このランク設定を削除してもよろしいですか？")) {
      await db.rankConfigs.delete(id);
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
             <h1 className="text-2xl font-bold">会員ランク設定</h1>
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
            {isEditing === -1 ? 'ランクを登録' : 'ランクを編集'}
          </h2>
          
          <div className="space-y-5">
            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">ランク名</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-bold text-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="例: ゴールド会員"
              />
            </div>

            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">必要ポイント (以上)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={formData.minPoints}
                  onChange={e => setFormData({...formData, minPoints: parseInt(e.target.value)})}
                  className="w-32 bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-mono text-lg font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <span className="font-bold text-gray-400">pt</span>
              </div>
            </div>

            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">ランクカラー</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.color}
                  onChange={e => setFormData({...formData, color: e.target.value})}
                  className="w-16 h-14 p-1 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer"
                />
                <span className="font-mono text-sm text-gray-500">{formData.color}</span>
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
          {ranks?.length === 0 && (
             <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
               <Crown size={48} className="mx-auto mb-4 text-gray-300" />
               <p className="font-bold text-gray-400">ランク設定がありません</p>
               <p className="text-sm text-gray-400 mb-4">初期設定を追加してください</p>
               <button 
                 onClick={() => {
                   db.rankConfigs.add({ name: 'REGULAR', minPoints: 0, color: '#F59E0B', groupId });
                   db.rankConfigs.add({ name: 'GOLD', minPoints: 500, color: '#FBBF24', groupId });
                   db.rankConfigs.add({ name: 'VIP', minPoints: 1000, color: '#8B5CF6', groupId });
                 }}
                 className="text-primary text-sm font-bold underline"
               >
                 デフォルト設定を追加
               </button>
             </div>
          )}

          {ranks?.map(rank => (
            <div key={rank.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group">
               <div className="flex items-center gap-4">
                 <div 
                   className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md"
                   style={{ backgroundColor: rank.color }}
                 >
                   <Star size={20} fill="currentColor" />
                 </div>
                 <div>
                   <h3 className="font-bold text-lg text-text-main">{rank.name}</h3>
                   <p className="text-xs text-text-sub font-mono">{rank.minPoints} pt ~</p>
                 </div>
               </div>
               
               <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                 <button 
                   onClick={() => handleEdit(rank)}
                   className="p-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-blue-50 hover:text-primary transition"
                 >
                   <Edit2 size={18} />
                 </button>
                 <button 
                   onClick={() => handleDelete(rank.id!)}
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
