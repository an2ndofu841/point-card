import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Loader2, Save, Users } from 'lucide-react';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';

type AttendanceCountRow = {
  event_id: number;
  group_id: number;
  title: string;
  start_at: string;
  is_cancelled?: boolean;
  scanned_count: number;
  manual_count: number;
  total_count: number;
};

export const LiveAttendanceCounts = () => {
  const [groupId] = useState<number>(() => {
    const saved = localStorage.getItem('admin_selected_group_id');
    return saved ? parseInt(saved) : 1;
  });

  const group = useLiveQuery(() => db.groups.get(groupId));
  const [rows, setRows] = useState<AttendanceCountRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    const loadCounts = async () => {
      if (isMock) {
        setRows([]);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from('live_event_attendance_counts')
        .select('*')
        .eq('group_id', groupId)
        .order('start_at', { ascending: false })
        .limit(60);

      if (error) {
        console.error('Failed to fetch attendance counts', error);
        setRows([]);
      } else {
        setRows((data || []) as AttendanceCountRow[]);
      }
      setIsLoading(false);
    };

    loadCounts();
  }, [groupId]);

  const handleManualChange = (eventId: number, value: number) => {
    setRows(prev =>
      prev.map(row =>
        row.event_id === eventId
          ? {
              ...row,
              manual_count: Math.max(0, value),
              total_count: row.scanned_count + Math.max(0, value)
            }
          : row
      )
    );
  };

  const saveManual = async (row: AttendanceCountRow) => {
    if (isMock) return;
    setSavingId(row.event_id);
    try {
      const payload = {
        event_id: row.event_id,
        group_id: row.group_id,
        manual_count: row.manual_count,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase
        .from('live_event_attendance_manual')
        .upsert(payload, { onConflict: 'event_id' });
      if (error) throw error;
    } catch (err) {
      console.error('Failed to save manual count', err);
      alert('保存に失敗しました');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <header className="flex items-center justify-between mb-6 sticky top-0 bg-bg-main/80 backdrop-blur-md py-4 z-10">
        <div className="flex items-center">
          <Link to="/admin/dashboard" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">動員数</h1>
            <p className="text-xs text-gray-500 font-bold">{group?.name}</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto space-y-4">
        {isLoading && (
          <div className="text-center text-sm text-gray-400 py-8">読み込み中...</div>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Users size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="font-bold text-gray-400">ライブの登録がありません</p>
            <p className="text-sm text-gray-400">ライブ予定を追加してください</p>
          </div>
        )}

        {rows.map(row => (
          <div key={row.event_id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`font-bold text-lg ${row.is_cancelled ? 'text-gray-400 line-through' : 'text-text-main'}`}>
                    {row.title}
                  </h3>
                  {row.is_cancelled && (
                    <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-bold">中止</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(row.start_at).toLocaleDateString('ja-JP')} {new Date(row.start_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">合計</p>
                <p className="text-2xl font-bold text-text-main">{row.total_count}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">QR来場</p>
                <p className="font-bold text-text-main">{row.scanned_count}人</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">手動追加</p>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min={0}
                    value={row.manual_count}
                    onChange={e => handleManualChange(row.event_id, parseInt(e.target.value || '0'))}
                    className="w-24 bg-white border border-gray-200 rounded-lg p-2 text-right font-mono font-bold"
                  />
                  <span className="text-xs text-gray-400">人</span>
                </div>
              </div>
              <div className="flex items-end justify-end">
                <button
                  onClick={() => saveManual(row)}
                  disabled={savingId === row.event_id}
                  className="w-full bg-primary text-white py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-primary-dark transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {savingId === row.event_id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  保存
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
