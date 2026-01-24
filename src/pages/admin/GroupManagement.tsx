import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type IdolGroup } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';
import { ArrowLeft, Plus, Users, QrCode, Copy, Trash2, Save, Loader2, Camera, Edit } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

export const GroupManagement = () => {
  const groups = useLiveQuery(() => db.groups.toArray());
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form Data
  const [formData, setFormData] = useState<Partial<IdolGroup>>({
    name: '',
    themeColor: '#2563EB',
    logoUrl: '',
    xUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    youtubeUrl: '',
    itunesUrl: '',
    spotifyUrl: '',
    websiteUrl: ''
  });

  const [showQR, setShowQR] = useState<number | null>(null); // ID of group to show QR for

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setIsUploading(true);

    try {
      if (isMock) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setFormData({ ...formData, logoUrl: ev.target?.result as string });
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `group-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('logos').getPublicUrl(filePath);
      setFormData({ ...formData, logoUrl: data.publicUrl });

    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('ロゴのアップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name) return;
    setIsSaving(true);

    try {
      const currentGroup = editingGroupId ? groups?.find(g => g.id === editingGroupId) : undefined;
      const normalizeUrl = (value?: string) => {
        const trimmed = value?.trim();
        return trimmed ? trimmed : undefined;
      };
      const resolveUrlForDb = (value?: string, fallback?: string) => {
        const normalized = normalizeUrl(value);
        return normalized ?? fallback;
      };
      const resolveUrlForSupabase = (value?: string, fallback?: string) => {
        return resolveUrlForDb(value, fallback) ?? null;
      };

      if (isMock) {
          if (editingGroupId) {
            // Local Update Mock
            await db.groups.update(editingGroupId, {
                name: formData.name,
                themeColor: formData.themeColor || '#2563EB',
                logoUrl: formData.logoUrl,
                xUrl: resolveUrlForDb(formData.xUrl, currentGroup?.xUrl),
                instagramUrl: resolveUrlForDb(formData.instagramUrl, currentGroup?.instagramUrl),
                tiktokUrl: resolveUrlForDb(formData.tiktokUrl, currentGroup?.tiktokUrl),
                youtubeUrl: resolveUrlForDb(formData.youtubeUrl, currentGroup?.youtubeUrl),
                itunesUrl: resolveUrlForDb(formData.itunesUrl, currentGroup?.itunesUrl),
                spotifyUrl: resolveUrlForDb(formData.spotifyUrl, currentGroup?.spotifyUrl),
                websiteUrl: resolveUrlForDb(formData.websiteUrl, currentGroup?.websiteUrl)
            });
          } else {
            // Local Create Mock
            await db.groups.add({
                name: formData.name,
                themeColor: formData.themeColor || '#2563EB',
                logoUrl: formData.logoUrl,
                xUrl: normalizeUrl(formData.xUrl),
                instagramUrl: normalizeUrl(formData.instagramUrl),
                tiktokUrl: normalizeUrl(formData.tiktokUrl),
                youtubeUrl: normalizeUrl(formData.youtubeUrl),
                itunesUrl: normalizeUrl(formData.itunesUrl),
                spotifyUrl: normalizeUrl(formData.spotifyUrl),
                websiteUrl: normalizeUrl(formData.websiteUrl),
                deletedAt: null
            } as any);
          }
      } else {
          if (editingGroupId) {
            // Update Supabase
            const { error } = await supabase
                .from('groups')
                .update({
                    name: formData.name,
                    theme_color: formData.themeColor || '#2563EB',
                    logo_url: formData.logoUrl,
                    x_url: resolveUrlForSupabase(formData.xUrl, currentGroup?.xUrl),
                    instagram_url: resolveUrlForSupabase(formData.instagramUrl, currentGroup?.instagramUrl),
                    tiktok_url: resolveUrlForSupabase(formData.tiktokUrl, currentGroup?.tiktokUrl),
                    youtube_url: resolveUrlForSupabase(formData.youtubeUrl, currentGroup?.youtubeUrl),
                    itunes_url: resolveUrlForSupabase(formData.itunesUrl, currentGroup?.itunesUrl),
                    spotify_url: resolveUrlForSupabase(formData.spotifyUrl, currentGroup?.spotifyUrl),
                    website_url: resolveUrlForSupabase(formData.websiteUrl, currentGroup?.websiteUrl)
                })
                .eq('id', editingGroupId);
            
            if (error) throw error;

            // Update Dexie
            await db.groups.update(editingGroupId, {
                name: formData.name,
                themeColor: formData.themeColor,
                logoUrl: formData.logoUrl,
                xUrl: resolveUrlForDb(formData.xUrl, currentGroup?.xUrl),
                instagramUrl: resolveUrlForDb(formData.instagramUrl, currentGroup?.instagramUrl),
                tiktokUrl: resolveUrlForDb(formData.tiktokUrl, currentGroup?.tiktokUrl),
                youtubeUrl: resolveUrlForDb(formData.youtubeUrl, currentGroup?.youtubeUrl),
                itunesUrl: resolveUrlForDb(formData.itunesUrl, currentGroup?.itunesUrl),
                spotifyUrl: resolveUrlForDb(formData.spotifyUrl, currentGroup?.spotifyUrl),
                websiteUrl: resolveUrlForDb(formData.websiteUrl, currentGroup?.websiteUrl)
            });
          } else {
            // 1. Save to Supabase first to get ID
            const { data, error } = await supabase
                .from('groups')
                .insert({
                    name: formData.name,
                    theme_color: formData.themeColor || '#2563EB',
                    logo_url: formData.logoUrl,
                    x_url: normalizeUrl(formData.xUrl) ?? null,
                    instagram_url: normalizeUrl(formData.instagramUrl) ?? null,
                    tiktok_url: normalizeUrl(formData.tiktokUrl) ?? null,
                    youtube_url: normalizeUrl(formData.youtubeUrl) ?? null,
                    itunes_url: normalizeUrl(formData.itunesUrl) ?? null,
                    spotify_url: normalizeUrl(formData.spotifyUrl) ?? null,
                    website_url: normalizeUrl(formData.websiteUrl) ?? null
                })
                .select()
                .single();

            if (error) throw error;
            if (!data) throw new Error('No data returned from Supabase');

            // 2. Save to Local DB with returned ID
            await db.groups.add({
                id: data.id,
                name: data.name,
                themeColor: data.theme_color,
                logoUrl: data.logo_url,
                xUrl: data.x_url,
                instagramUrl: data.instagram_url,
                tiktokUrl: data.tiktok_url,
                youtubeUrl: data.youtube_url,
                itunesUrl: data.itunes_url,
                spotifyUrl: data.spotify_url,
                websiteUrl: data.website_url,
              deletedAt: data.deleted_at ? new Date(data.deleted_at).getTime() : null
            });
          }
      }

      setIsEditing(false);
      setEditingGroupId(null);
      setFormData({ 
        name: '', 
        themeColor: '#2563EB', 
        logoUrl: '',
        xUrl: '',
        instagramUrl: '',
        tiktokUrl: '',
        youtubeUrl: '',
        itunesUrl: '',
        spotifyUrl: '',
        websiteUrl: ''
      });
    } catch (err) {
      console.error("Failed to save group", err);
      alert("保存に失敗しました。インターネット接続を確認してください。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (group: IdolGroup) => {
    setFormData({
        name: group.name,
        themeColor: group.themeColor,
        logoUrl: group.logoUrl,
        xUrl: group.xUrl,
        instagramUrl: group.instagramUrl,
        tiktokUrl: group.tiktokUrl,
        youtubeUrl: group.youtubeUrl,
        itunesUrl: group.itunesUrl,
        spotifyUrl: group.spotifyUrl,
        websiteUrl: group.websiteUrl
    });
    setEditingGroupId(group.id!);
    setIsEditing(true);
  };


  const handleDelete = async (id: number) => {
    if (!window.confirm("このグループを削除してもよろしいですか？\n※注意: 関連するユーザーデータとの整合性が取れなくなる可能性があります。")) {
      return;
    }

    try {
      if (!isMock) {
        const { error } = await supabase
          .from('groups')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      }

      await db.groups.update(id, { deletedAt: Date.now() });
    } catch (err) {
      console.error('Failed to delete group', err);
      alert('削除に失敗しました。');
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
            onClick={() => {
                setEditingGroupId(null);
                setFormData({ 
                  name: '', 
                  themeColor: '#2563EB', 
                  logoUrl: '',
                  xUrl: '',
                  instagramUrl: '',
                  tiktokUrl: '',
                  youtubeUrl: '',
                  itunesUrl: '',
                  spotifyUrl: '',
                  websiteUrl: ''
                });
                setIsEditing(true);
            }} 
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
            {editingGroupId ? 'グループ情報を編集' : '新規グループ作成'}
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
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">ロゴ (任意)</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden relative">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-300 text-xs">No Img</span>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="animate-spin text-white" size={20} />
                    </div>
                  )}
                </div>
                <label className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-50 transition flex items-center gap-2">
                  <Camera size={16} />
                  画像を選択
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-2">SNS・リンク</label>
              <div className="space-y-3">
                <input
                  type="url"
                  value={formData.xUrl || ''}
                  onChange={e => setFormData({ ...formData, xUrl: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="X (旧Twitter) URL"
                />
                <input
                  type="url"
                  value={formData.instagramUrl || ''}
                  onChange={e => setFormData({ ...formData, instagramUrl: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Instagram URL"
                />
                <input
                  type="url"
                  value={formData.tiktokUrl || ''}
                  onChange={e => setFormData({ ...formData, tiktokUrl: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="TikTok URL"
                />
                <input
                  type="url"
                  value={formData.youtubeUrl || ''}
                  onChange={e => setFormData({ ...formData, youtubeUrl: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="YouTube URL"
                />
                <input
                  type="url"
                  value={formData.itunesUrl || ''}
                  onChange={e => setFormData({ ...formData, itunesUrl: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="iTunes URL"
                />
                <input
                  type="url"
                  value={formData.spotifyUrl || ''}
                  onChange={e => setFormData({ ...formData, spotifyUrl: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Spotify URL"
                />
                <input
                  type="url"
                  value={formData.websiteUrl || ''}
                  onChange={e => setFormData({ ...formData, websiteUrl: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="任意URL"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button 
              onClick={() => {
                  setIsEditing(false);
                  setEditingGroupId(null);
                  setFormData({ 
                    name: '', 
                    themeColor: '#2563EB', 
                    logoUrl: '',
                    xUrl: '',
                    instagramUrl: '',
                    tiktokUrl: '',
                    youtubeUrl: '',
                    itunesUrl: '',
                    spotifyUrl: '',
                    websiteUrl: ''
                  });
              }}
              className="flex-1 bg-gray-100 text-gray-500 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition"
            >
              キャンセル
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-primary text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-500/25 hover:bg-primary-dark transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> 保存する</>}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 max-w-lg mx-auto">
          {groups?.map(group => {
            const isDeleted = !!group.deletedAt;
            const daysLeft = isDeleted
              ? Math.max(0, Math.ceil((group.deletedAt! + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000)))
              : null;
            return (
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
                    <div className="flex items-center gap-2">
                      <h3 className={`font-bold text-lg ${isDeleted ? 'text-gray-400 line-through' : 'text-text-main'}`}>{group.name}</h3>
                      {isDeleted && (
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">削除済み</span>
                      )}
                    </div>
                     <p className="text-xs text-text-sub font-mono">ID: {group.id}</p>
                    {isDeleted && (
                      <p className="text-[11px] text-gray-400 mt-1">データは削除後30日間閲覧可能（残り{daysLeft}日）</p>
                    )}
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-2">
                   <button 
                      onClick={() => handleEdit(group)}
                      disabled={isDeleted}
                      className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-blue-50 hover:text-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                       <Edit size={18} />
                   </button>
                   {group.id !== 1 && ( // Prevent deleting default group
                      <button 
                          onClick={() => handleDelete(group.id)}
                          disabled={isDeleted}
                          className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          <Trash2 size={18} />
                      </button>
                   )}
                 </div>
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
          )})}
        </div>
      )}
    </div>
  );
};
