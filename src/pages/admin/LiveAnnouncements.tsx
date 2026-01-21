import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Edit2, Loader2, Pin, Plus, Save, Trash2 } from 'lucide-react';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';

type LiveEvent = {
  id: number;
  title: string;
  start_at: string;
  is_cancelled?: boolean;
};

type Announcement = {
  id?: number;
  group_id: number;
  title: string;
  body?: string | null;
  event_id?: number | null;
  is_pinned: boolean;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export const ManageLiveAnnouncements = () => {
  const [groupId] = useState<number>(() => {
    const saved = localStorage.getItem('admin_selected_group_id');
    return saved ? parseInt(saved) : 1;
  });

  const group = useLiveQuery(() => db.groups.get(groupId));
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Announcement>({
    group_id: groupId,
    title: '',
    body: '',
    event_id: null,
    is_pinned: true,
    active: true
  });

  const eventMap = useMemo(() => {
    const map: Record<number, LiveEvent> = {};
    events.forEach(event => {
      map[event.id] = event;
    });
    return map;
  }, [events]);

  useEffect(() => {
    const loadData = async () => {
      if (isMock) {
        setAnnouncements([]);
        setEvents([]);
        return;
      }

      const { data: annData, error: annError } = await supabase
        .from('live_announcements')
        .select('*')
        .eq('group_id', groupId)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (annError) {
        console.error('Failed to fetch announcements', annError);
      } else {
        setAnnouncements((annData || []) as Announcement[]);
      }

      const { data: eventData, error: eventError } = await supabase
        .from('live_events')
        .select('id, title, start_at, is_cancelled')
        .eq('group_id', groupId)
        .order('start_at', { ascending: true });

      if (eventError) {
        console.error('Failed to fetch live events', eventError);
      } else {
        setEvents((eventData || []) as LiveEvent[]);
      }
    };

    loadData();
  }, [groupId]);

  const handleEdit = (announcement?: Announcement) => {
    if (announcement) {
      setFormData({
        ...announcement,
        body: announcement.body ?? '',
        event_id: announcement.event_id ?? null
      });
      setIsEditing(announcement.id ?? null);
      return;
    }

    setFormData({
      group_id: groupId,
      title: '',
      body: '',
      event_id: null,
      is_pinned: true,
      active: true
    });
    setIsEditing(-1);
  };

  const handleSave = async () => {
    if (!formData.title) return;
    setIsSaving(true);
    try {
      if (isMock) {
        setIsEditing(null);
        return;
      }

      const payload = {
        group_id: groupId,
        title: formData.title,
        body: formData.body || null,
        event_id: formData.event_id || null,
        is_pinned: formData.is_pinned,
        active: formData.active,
        updated_at: new Date().toISOString()
      };

      if (isEditing === -1) {
        const { data, error } = await supabase
          .from('live_announcements')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setAnnouncements(prev => [data as Announcement, ...prev]);
      } else if (isEditing !== null) {
        const { data, error } = await supabase
          .from('live_announcements')
          .update(payload)
          .eq('id', isEditing)
          .select()
          .single();
        if (error) throw error;
        setAnnouncements(prev => prev.map(item => (item.id === isEditing ? (data as Announcement) : item)));
      }

      setIsEditing(null);
    } catch (err) {
      console.error('Failed to save announcement', err);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('この告知を削除してもよろしいですか？')) return;
    try {
      if (!isMock) {
        const { error } = await supabase.from('live_announcements').delete().eq('id', id);
        if (error) throw error;
      }
      setAnnouncements(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error('Delete failed', err);
      alert('削除に失敗しました');
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
            <h1 className="text-2xl font-bold">ライブ告知</h1>
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
            {isEditing === -1 ? '告知を登録' : '告知を編集'}
          </h2>

          <div className="space-y-5">
            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">タイトル</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-bold text-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="例: 重要ライブのお知らせ"
              />
            </div>

            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">本文 (任意)</label>
              <textarea
                value={formData.body ?? ''}
                onChange={e => setFormData({ ...formData, body: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 min-h-[100px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="詳細メッセージを入力"
              />
            </div>

            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">対象LIVE (任意)</label>
              <select
                value={formData.event_id ?? ''}
                onChange={e => setFormData({ ...formData, event_id: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-bold text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">ライブを選択</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.is_cancelled ? '【中止】' : ''}
                    {event.title} ({new Date(event.start_at).toLocaleDateString('ja-JP')})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="pinned"
                checked={formData.is_pinned}
                onChange={e => setFormData({ ...formData, is_pinned: e.target.checked })}
                className="w-5 h-5 rounded text-primary focus:ring-primary border-gray-300"
              />
              <label htmlFor="pinned" className="font-bold text-gray-700 flex items-center gap-2">
                <Pin size={16} /> 固定表示する
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={e => setFormData({ ...formData, active: e.target.checked })}
                className="w-5 h-5 rounded text-primary focus:ring-primary border-gray-300"
              />
              <label htmlFor="active" className="font-bold text-gray-700">この告知を公開する</label>
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
              disabled={isSaving}
              className="flex-1 bg-primary text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-500/25 hover:bg-primary-dark transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> 保存する</>}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 max-w-lg mx-auto">
          {announcements.length === 0 && (
            <div className="text-center py-12 opacity-50">
              <Pin size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="font-bold text-gray-400">告知がありません</p>
              <p className="text-sm text-gray-400">右上の＋ボタンから追加してください</p>
            </div>
          )}

          {announcements.map(item => (
            <div key={item.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group active:scale-[0.99] transition">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.is_pinned ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                  <Pin size={18} />
                </div>
                <div>
                  <h3 className={`font-bold text-lg ${item.active ? 'text-text-main' : 'text-gray-400 line-through'}`}>{item.title}</h3>
                  {item.body && <p className="text-xs text-text-sub line-clamp-2 mt-1">{item.body}</p>}
                  {item.event_id && eventMap[item.event_id] && (
                    <p className="text-xs text-gray-400 mt-1">
                      {eventMap[item.event_id].title} ({new Date(eventMap[item.event_id].start_at).toLocaleDateString('ja-JP')})
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(item)}
                  className="p-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-blue-50 hover:text-primary transition"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(item.id!)}
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
