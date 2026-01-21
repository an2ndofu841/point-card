import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Edit2, Loader2, Medal, Plus, Save, Trash2 } from 'lucide-react';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';

type LiveEvent = {
  id: number;
  title: string;
  start_at: string;
  is_cancelled?: boolean;
};

type Trophy = {
  id?: number;
  group_id: number;
  name: string;
  rarity: 'BRONZE' | 'SILVER' | 'GOLD';
  condition_type: 'TOTAL_ATTENDANCE' | 'STREAK_ATTENDANCE' | 'EVENT_ATTENDANCE';
  threshold?: number | null;
  event_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

const rarityLabel = (rarity: Trophy['rarity']) => {
  if (rarity === 'SILVER') return 'シルバー';
  if (rarity === 'GOLD') return 'ゴールド';
  return 'ブロンズ';
};

const conditionLabel = (trophy: Trophy, eventMap: Record<number, LiveEvent>) => {
  if (trophy.condition_type === 'TOTAL_ATTENDANCE') {
    return `合計${trophy.threshold ?? 0}回参加で獲得`;
  }
  if (trophy.condition_type === 'STREAK_ATTENDANCE') {
    return `連続${trophy.threshold ?? 0}日参加で獲得`;
  }
  if (trophy.event_id && eventMap[trophy.event_id]) {
    const event = eventMap[trophy.event_id];
    return `「${event.title}」参加で獲得`;
  }
  return '指定ライブ参加で獲得';
};

export const ManageTrophies = () => {
  const [groupId] = useState<number>(() => {
    const saved = localStorage.getItem('admin_selected_group_id');
    return saved ? parseInt(saved) : 1;
  });

  const group = useLiveQuery(() => db.groups.get(groupId));
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Trophy>({
    group_id: groupId,
    name: '',
    rarity: 'BRONZE',
    condition_type: 'TOTAL_ATTENDANCE',
    threshold: 1,
    event_id: null
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
        setTrophies([]);
        setEvents([]);
        return;
      }

      const { data: trophyData, error: trophyError } = await supabase
        .from('live_trophies')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (trophyError) {
        console.error('Failed to fetch trophies', trophyError);
      } else {
        setTrophies((trophyData || []) as Trophy[]);
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

  const handleEdit = (trophy?: Trophy) => {
    if (trophy) {
      setFormData({
        ...trophy,
        threshold: trophy.threshold ?? undefined,
        event_id: trophy.event_id ?? null
      });
      setIsEditing(trophy.id ?? null);
      return;
    }

    setFormData({
      group_id: groupId,
      name: '',
      rarity: 'BRONZE',
      condition_type: 'TOTAL_ATTENDANCE',
      threshold: 1,
      event_id: null
    });
    setIsEditing(-1);
  };

  const handleSave = async () => {
    if (!formData.name) return;
    if (formData.condition_type !== 'EVENT_ATTENDANCE' && !formData.threshold) return;
    if (formData.condition_type === 'EVENT_ATTENDANCE' && !formData.event_id) return;

    setIsSaving(true);
    try {
      if (isMock) {
        setIsEditing(null);
        return;
      }

      const payload = {
        group_id: groupId,
        name: formData.name,
        rarity: formData.rarity,
        condition_type: formData.condition_type,
        threshold: formData.condition_type === 'EVENT_ATTENDANCE' ? null : formData.threshold,
        event_id: formData.condition_type === 'EVENT_ATTENDANCE' ? formData.event_id : null,
        updated_at: new Date().toISOString()
      };

      if (isEditing === -1) {
        const { data, error } = await supabase.from('live_trophies').insert(payload).select().single();
        if (error) throw error;
        setTrophies(prev => [data as Trophy, ...prev]);
      } else if (isEditing !== null) {
        const { data, error } = await supabase
          .from('live_trophies')
          .update(payload)
          .eq('id', isEditing)
          .select()
          .single();
        if (error) throw error;
        setTrophies(prev => prev.map(item => (item.id === isEditing ? (data as Trophy) : item)));
      }

      setIsEditing(null);
    } catch (err) {
      console.error('Failed to save trophy', err);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('このトロフィーを削除してもよろしいですか？')) return;
    try {
      if (!isMock) {
        const { error } = await supabase.from('live_trophies').delete().eq('id', id);
        if (error) throw error;
      }
      setTrophies(prev => prev.filter(item => item.id !== id));
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
            <h1 className="text-2xl font-bold">トロフィー管理</h1>
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
            {isEditing === -1 ? 'トロフィーを登録' : 'トロフィーを編集'}
          </h2>

          <div className="space-y-5">
            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">トロフィー名</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-bold text-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="例: 皆勤賞"
              />
            </div>

            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">レアリティ</label>
              <select
                value={formData.rarity}
                onChange={e => setFormData({ ...formData, rarity: e.target.value as Trophy['rarity'] })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-bold text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="BRONZE">ブロンズ</option>
                <option value="SILVER">シルバー</option>
                <option value="GOLD">ゴールド</option>
              </select>
            </div>

            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">獲得条件</label>
              <select
                value={formData.condition_type}
                onChange={e => {
                  const value = e.target.value as Trophy['condition_type'];
                  setFormData({
                    ...formData,
                    condition_type: value,
                    threshold: value === 'EVENT_ATTENDANCE' ? null : formData.threshold ?? 1,
                    event_id: value === 'EVENT_ATTENDANCE' ? formData.event_id : null
                  });
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-bold text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="TOTAL_ATTENDANCE">LIVE参加合計回数</option>
                <option value="STREAK_ATTENDANCE">連続参加日数</option>
                <option value="EVENT_ATTENDANCE">特定のLIVE参加</option>
              </select>
            </div>

            {formData.condition_type !== 'EVENT_ATTENDANCE' ? (
              <div>
                <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">回数 / 日数</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    value={formData.threshold ?? 1}
                    onChange={e => setFormData({ ...formData, threshold: parseInt(e.target.value) })}
                    className="w-32 bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-mono text-lg font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="font-bold text-gray-400">回/日</span>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">対象LIVE</label>
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
            )}
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
          {trophies.length === 0 && (
            <div className="text-center py-12 opacity-50">
              <Medal size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="font-bold text-gray-400">登録されたトロフィーはありません</p>
              <p className="text-sm text-gray-400">右上の＋ボタンから追加してください</p>
            </div>
          )}

          {trophies.map(trophy => (
            <div key={trophy.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group active:scale-[0.99] transition">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 font-bold flex-shrink-0">
                  <Medal size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-text-main">{trophy.name}</h3>
                  <p className="text-xs text-text-sub line-clamp-1">{conditionLabel(trophy, eventMap)}</p>
                  <p className="text-xs text-gray-400 mt-1">{rarityLabel(trophy.rarity)}</p>
                </div>
              </div>

              <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(trophy)}
                  className="p-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-blue-50 hover:text-primary transition"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(trophy.id!)}
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
