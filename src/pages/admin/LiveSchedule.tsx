import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';
import { ArrowLeft, CalendarDays, Edit2, Plus, Save, Trash2, Users, CheckCircle, MapPin, Clock, Loader2 } from 'lucide-react';

type LiveEvent = {
  id: number;
  group_id: number;
  title: string;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  description?: string | null;
  is_cancelled?: boolean;
};

type LiveRegistration = {
  id: number;
  event_id: number;
  user_id: string;
  user_name?: string | null;
  status: string;
  applied_at: string;
  checked_in_at?: string | null;
};

const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toDisplayDateTime = (iso?: string | null) => {
  if (!iso) return '未設定';
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const AdminLiveSchedule = () => {
  const [groupId] = useState<number>(() => {
    const saved = localStorage.getItem('admin_selected_group_id');
    return saved ? parseInt(saved) : 1;
  });

  const group = useLiveQuery(() => db.groups.get(groupId));
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [participants, setParticipants] = useState<LiveRegistration[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    startAt: '',
    endAt: '',
    location: '',
    description: '',
    isCancelled: false
  });

  const selectedEvent = useMemo(
    () => events.find(e => e.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const resetForm = () => {
    setFormData({
      title: '',
      startAt: '',
      endAt: '',
      location: '',
      description: '',
      isCancelled: false
    });
  };

  const fetchEvents = async () => {
    if (isMock) {
      setEvents([]);
      return;
    }

    const { data, error } = await supabase
      .from('live_events')
      .select('*')
      .eq('group_id', groupId)
      .order('start_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch live events', error);
      return;
    }

    setEvents((data || []) as LiveEvent[]);
    if (data && data.length > 0 && !selectedEventId) {
      setSelectedEventId(data[0].id);
    }
  };

  const fetchParticipants = async (eventId: number) => {
    if (isMock) {
      setParticipants([]);
      return;
    }

    setIsLoadingParticipants(true);
    const { data, error } = await supabase
      .from('live_event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .order('applied_at', { ascending: true });

    setIsLoadingParticipants(false);
    if (error) {
      console.error('Failed to fetch participants', error);
      return;
    }

    setParticipants((data || []) as LiveRegistration[]);
  };

  useEffect(() => {
    fetchEvents();
  }, [groupId]);

  useEffect(() => {
    if (selectedEventId) {
      fetchParticipants(selectedEventId);
    } else {
      setParticipants([]);
    }
  }, [selectedEventId]);

  const handleEdit = (event?: LiveEvent) => {
    if (event) {
      setIsEditing(event.id);
      setFormData({
        title: event.title,
        startAt: toLocalInput(event.start_at),
        endAt: toLocalInput(event.end_at),
        location: event.location || '',
        description: event.description || '',
        isCancelled: !!event.is_cancelled
      });
    } else {
      setIsEditing(-1);
      resetForm();
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.startAt) {
      alert('タイトルと開始日時は必須です');
      return;
    }

    setIsSaving(true);
    try {
      if (isMock) {
        setIsEditing(null);
        setIsSaving(false);
        return;
      }

      const payload = {
        group_id: groupId,
        title: formData.title,
        start_at: new Date(formData.startAt).toISOString(),
        end_at: formData.endAt ? new Date(formData.endAt).toISOString() : null,
        location: formData.location || null,
        description: formData.description || null,
        is_cancelled: formData.isCancelled,
        updated_at: new Date().toISOString()
      };

      if (isEditing === -1) {
        const { error } = await supabase.from('live_events').insert(payload);
        if (error) throw error;
      } else if (isEditing !== null) {
        const { error } = await supabase.from('live_events').update(payload).eq('id', isEditing);
        if (error) throw error;
      }

      setIsEditing(null);
      resetForm();
      await fetchEvents();
    } catch (err) {
      console.error('Failed to save live event', err);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (eventId: number) => {
    if (!window.confirm('このライブ予定を削除してもよろしいですか？')) return;

    try {
      if (!isMock) {
        const { error } = await supabase.from('live_events').delete().eq('id', eventId);
        if (error) throw error;
      }

      setEvents(prev => prev.filter(e => e.id !== eventId));
      if (selectedEventId === eventId) {
        setSelectedEventId(null);
        setParticipants([]);
      }
    } catch (err) {
      console.error('Failed to delete live event', err);
      alert('削除に失敗しました');
    }
  };

  const checkedInCount = participants.filter(p => p.status === 'CHECKED_IN').length;

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <header className="flex items-center justify-between mb-8 sticky top-0 bg-bg-main/80 backdrop-blur-md py-4 z-10">
        <div className="flex items-center">
          <Link to="/admin/dashboard" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarDays size={22} /> ライブ予定管理
            </h1>
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
            {isEditing === -1 ? 'ライブ予定を登録' : 'ライブ予定を編集'}
          </h2>

          <div className="space-y-5">
            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">タイトル</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-bold text-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="例: ワンマンライブ"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">開始日時</label>
                <input
                  type="datetime-local"
                  value={formData.startAt}
                  onChange={e => setFormData({ ...formData, startAt: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-mono text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">終了日時 (任意)</label>
                <input
                  type="datetime-local"
                  value={formData.endAt}
                  onChange={e => setFormData({ ...formData, endAt: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-mono text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">会場 (任意)</label>
              <input
                type="text"
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="例: 渋谷O-EAST"
              />
            </div>

            <div>
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-1">説明 (任意)</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 min-h-[120px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="セットリストや注意事項など"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="isCancelled"
                checked={formData.isCancelled}
                onChange={e => setFormData({ ...formData, isCancelled: e.target.checked })}
                className="w-5 h-5 rounded text-primary focus:ring-primary border-gray-300"
              />
              <label htmlFor="isCancelled" className="font-bold text-gray-700">このライブを中止にする</label>
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
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="space-y-3">
            {events.length === 0 && (
              <div className="text-center py-12 opacity-50 bg-white rounded-2xl border border-dashed border-gray-200">
                <CalendarDays size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="font-bold text-gray-400">ライブ予定がまだ登録されていません</p>
                <p className="text-sm text-gray-400">右上の＋ボタンから追加してください</p>
              </div>
            )}

            {events.map(event => (
              <button
                key={event.id}
                onClick={() => setSelectedEventId(event.id)}
                className={`w-full text-left bg-white p-5 rounded-2xl border shadow-sm flex items-start justify-between gap-4 transition ${
                  selectedEventId === event.id ? 'border-primary shadow-md' : 'border-gray-100 hover:border-primary/20'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-primary font-bold flex-shrink-0">
                    <CalendarDays size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`font-bold text-lg ${event.is_cancelled ? 'text-gray-400 line-through' : 'text-text-main'}`}>
                        {event.title}
                      </h3>
                      {event.is_cancelled && (
                        <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-bold">中止</span>
                      )}
                    </div>
                    <div className="text-xs text-text-sub mt-1 flex items-center gap-2">
                      <Clock size={14} /> {toDisplayDateTime(event.start_at)}
                    </div>
                    {event.location && (
                      <div className="text-xs text-text-sub mt-1 flex items-center gap-2">
                        <MapPin size={14} /> {event.location}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(event);
                    }}
                    className="p-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-blue-50 hover:text-primary transition"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(event.id);
                    }}
                    className="p-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-red-50 hover:text-red-500 transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </button>
            ))}
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Users size={18} /> 参加予定者
                </h2>
                {selectedEvent && (
                  <p className="text-xs text-gray-400">{selectedEvent.title}</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-full">参加 {participants.length}名</span>
                <span className="bg-green-50 text-green-600 px-2 py-1 rounded-full">来場 {checkedInCount}名</span>
              </div>
            </div>

            {isLoadingParticipants && (
              <div className="text-center text-sm text-gray-400 py-6">読み込み中...</div>
            )}

            {!isLoadingParticipants && (!selectedEventId || participants.length === 0) && (
              <div className="text-center text-sm text-gray-400 py-8">
                参加予定者がまだいません
              </div>
            )}

            {!isLoadingParticipants && participants.length > 0 && (
              <div className="space-y-3">
                {participants.map(participant => (
                  <div key={participant.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <div>
                      <div className="font-bold text-sm text-gray-800">
                        {participant.user_name || participant.user_id.substring(0, 8)}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">{participant.user_id}</div>
                    </div>
                    <div className="text-xs font-bold">
                      {participant.status === 'CHECKED_IN' ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle size={14} /> 来場済み
                        </span>
                      ) : participant.status === 'CANCELLED' ? (
                        <span className="text-gray-400">取消</span>
                      ) : (
                        <span className="text-blue-600">参加予定</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
