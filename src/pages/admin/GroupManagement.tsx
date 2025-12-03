import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type IdolGroup } from '../../lib/db';
import { ArrowLeft, Plus, Users, ExternalLink, QrCode, Copy, Check, Trash2, Save } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

export const GroupManagement = () => {
  const groups = useLiveQuery(() => db.groups.toArray());
  const [isEditing, setIsEditing] = useState<boolean>(false);
  
  // Form Data
  const [formData, setFormData] = useState<Partial<IdolGroup>>({
    name: '',
    themeColor: '#2563EB',
    logoUrl: ''
  });

  const [showQR, setShowQR] = useState<number | null>(null); // ID of group to show QR for

  const handleSave = async () => {
    if (!formData.name) return;

    try {
      // Generate ID: find max existing ID + 1
      const maxId = await db.groups.orderBy('id').last().then(g => g?.id || 0);
      const newId = maxId + 1;

      await db.groups.add({
        id: newId,
        name: formData.name,
        themeColor: formData.themeColor!,
        logoUrl: formData.logoUrl
      });

      setIsEditing(false);
      setFormData({ name: '', themeColor: '#2563EB', logoUrl: '' });
    } catch (err) {
      console.error("Failed to save group", err);
      alert("保存に失敗しました");
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("このグループを削除してもよろしいですか？\n※注意: 関連するユーザーデータとの整合性が取れなくなる可能性があります。")) {
      await db.groups.delete(id);
    }
  };

  const getInviteUrl = (groupId: number) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/join/${groupId}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("コピーしました！");
    });
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <header className="flex items-center justify-between mb-8 sticky top-0 bg-bg-main/80 backdrop-blur-md py-4 z-10">
        <div className="flex items-center">
          <Link to="/admin/dashboard" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <h1 className="text-2xl font-bold">グループ管理</h1>
        </div>
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)} 
            className="bg-primary hover:bg-primary-dark text-white p-3 rounded-full shadow-lg shadow-blue-500/30 transition active:scale-95"
          >
            <Plus size={24} />
          </button>
        )}
      </header>

      {isEditing ? (
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 animate-slide-up max-w-lg mx-auto">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Users size={20} />
            新規グループ作成
          </h2>
          
          <div className="space-y-5">
            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">グループ名</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-bold text-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="例: Appare!"
              />
            </div>

            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">テーマカラー</label>
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
            
             <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">ロゴURL (任意)</label>
              <input
                type="text"
                value={formData.logoUrl}
                onChange={e => setFormData({...formData, logoUrl: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-mono text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button 
              onClick={() => setIsEditing(false)}
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
          {groups?.map(group => (
            <div key={group.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm group-card">
               <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-4">
                   <div 
                     className="w-12 h-12 rounded-full shadow-sm flex items-center justify-center text-white font-bold text-xl"
                     style={{ backgroundColor: group.themeColor }}
                   >
                     {group.logoUrl ? <img src={group.logoUrl} alt="" className="w-full h-full object-cover rounded-full" /> : group.name[0]}
                   </div>
                   <div>
                     <h3 className="font-bold text-text-main text-lg">{group.name}</h3>
                     <p className="text-xs text-text-sub font-mono">ID: {group.id}</p>
                   </div>
                 </div>
                 
                 {group.id !== 1 && ( // Prevent deleting default group
                    <button 
                        onClick={() => handleDelete(group.id)}
                        className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition"
                    >
                        <Trash2 size={18} />
                    </button>
                 )}
               </div>
               
               <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">招待リンク</p>
                  <div className="flex gap-2 mb-4">
                      <input 
                        readOnly 
                        value={getInviteUrl(group.id)} 
                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 focus:outline-none"
                      />
                      <button 
                        onClick={() => copyToClipboard(getInviteUrl(group.id))}
                        className="bg-white border border-gray-200 text-gray-500 p-2 rounded-lg hover:bg-blue-50 hover:border-primary/30 hover:text-primary transition"
                      >
                          <Copy size={16} />
                      </button>
                  </div>

                  <button 
                    onClick={() => setShowQR(showQR === group.id ? null : group.id)}
                    className="w-full bg-white border border-gray-200 text-primary font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-blue-50 transition"
                  >
                      <QrCode size={16} /> {showQR === group.id ? 'QRコードを閉じる' : 'QRコードを表示'}
                  </button>
                  
                  {showQR === group.id && (
                      <div className="mt-4 bg-white p-4 rounded-xl border border-gray-200 flex flex-col items-center animate-fade-in">
                          <QRCodeCanvas 
                            value={getInviteUrl(group.id)} 
                            size={200}
                            className="mb-4"
                          />
                          <p className="text-xs text-gray-400 mb-2">このQRコードをスキャンして参加</p>
                          <a 
                            href={getInviteUrl(group.id)} // Actually download logic needed here but for now simple
                            download={`invite-qr-${group.id}.png`}
                            onClick={(e) => {
                                e.preventDefault();
                                const canvas = document.querySelector('canvas');
                                if (canvas) {
                                    const url = canvas.toDataURL("image/png");
                                    const link = document.createElement('a');
                                    link.download = `invite-${group.name}.png`;
                                    link.href = url;
                                    link.click();
                                }
                            }}
                            className="text-primary text-xs font-bold hover:underline cursor-pointer"
                          >
                              画像をダウンロード
                          </a>
                      </div>
                  )}
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

