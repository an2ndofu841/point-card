import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Loader2, MinusCircle, PlusCircle, Save } from 'lucide-react';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';

type LevelConfig = {
  level: number;
  required_points: number;
};

const MAX_LEVEL = 100;

const buildDefaultLevels = () => {
  const levels: LevelConfig[] = [];
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    const step = level - 1;
    const required = Math.max(0, Math.floor(step * step * 5 + step * 15));
    levels.push({ level, required_points: required });
  }
  return levels;
};

export const LevelConfigPage = () => {
  const [groupId] = useState<number>(() => {
    const saved = localStorage.getItem('admin_selected_group_id');
    return saved ? parseInt(saved) : 1;
  });

  const group = useLiveQuery(() => db.groups.get(groupId));
  const [levels, setLevels] = useState<LevelConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bulkDelta, setBulkDelta] = useState(0);

  const sortedLevels = useMemo(
    () => [...levels].sort((a, b) => a.level - b.level),
    [levels]
  );

  useEffect(() => {
    const loadLevels = async () => {
      if (isMock) {
        setLevels(buildDefaultLevels());
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from('level_configs')
        .select('level, required_points')
        .eq('group_id', groupId)
        .order('level', { ascending: true });

      if (error) {
        console.error('Failed to fetch level configs', error);
      }

      if (!data || data.length === 0) {
        setLevels([]);
      } else {
        setLevels(data as LevelConfig[]);
      }

      setIsLoading(false);
    };

    loadLevels();
  }, [groupId]);

  const handleGenerateDefaults = async () => {
    const defaults = buildDefaultLevels();
    setLevels(defaults);
    if (isMock) return;
    await saveAll(defaults);
  };

  const handleLevelChange = (level: number, value: number) => {
    setLevels(prev =>
      prev.map(item =>
        item.level === level
          ? { ...item, required_points: Math.max(0, value) }
          : item
      )
    );
  };

  const saveAll = async (target: LevelConfig[]) => {
    if (isMock) return;
    setIsSaving(true);
    try {
      const payload = target.map(item => ({
        group_id: groupId,
        level: item.level,
        required_points: item.required_points,
        updated_at: new Date().toISOString()
      }));
      const { error } = await supabase.from('level_configs').upsert(payload, { onConflict: 'group_id,level' });
      if (error) throw error;
    } catch (err) {
      console.error('Failed to save level configs', err);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const saveSingle = async (level: LevelConfig) => {
    await saveAll([level]);
  };

  const applyBulkDelta = async () => {
    if (levels.length === 0) return;
    const updated = levels.map(item => ({
      ...item,
      required_points: Math.max(0, item.required_points + bulkDelta)
    }));
    setLevels(updated);
    await saveAll(updated);
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <header className="flex items-center justify-between mb-6 sticky top-0 bg-bg-main/80 backdrop-blur-md py-4 z-10">
        <div className="flex items-center">
          <Link to="/admin/dashboard" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">レベル設定</h1>
            <p className="text-xs text-gray-500 font-bold">{group?.name}</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm font-bold">一括クイック調整</p>
              <p className="text-xs text-gray-400">全レベルにポイントを加算/減算します</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setBulkDelta(prev => prev - 10)}
                className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
              >
                <MinusCircle size={18} />
              </button>
              <input
                type="number"
                value={bulkDelta}
                onChange={e => setBulkDelta(parseInt(e.target.value || '0'))}
                className="w-28 bg-gray-50 border border-gray-200 rounded-xl p-2 text-center font-bold"
              />
              <button
                onClick={() => setBulkDelta(prev => prev + 10)}
                className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
              >
                <PlusCircle size={18} />
              </button>
              <button
                onClick={applyBulkDelta}
                disabled={isSaving}
                className="bg-primary text-white px-4 py-2 rounded-xl font-bold shadow-md shadow-blue-500/20 hover:bg-primary-dark transition disabled:opacity-60"
              >
                まとめて適用
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">レベル一覧 (1〜{MAX_LEVEL})</p>
              <p className="text-xs text-gray-400">ポイントは累積値です</p>
            </div>
            {levels.length === 0 && !isLoading && (
              <button
                onClick={handleGenerateDefaults}
                className="bg-gray-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-gray-800 transition"
              >
                デフォルト生成
              </button>
            )}
          </div>

          {isLoading && (
            <div className="text-center text-sm text-gray-400 py-8">読み込み中...</div>
          )}

          {!isLoading && levels.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sortedLevels.map(item => (
                <div key={item.level} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div className="font-bold text-gray-600">Lv.{item.level}</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={item.required_points}
                      onChange={e => handleLevelChange(item.level, parseInt(e.target.value || '0'))}
                      className="w-24 bg-white border border-gray-200 rounded-lg p-2 text-right font-mono font-bold"
                    />
                    <span className="text-xs text-gray-400">pt</span>
                    <button
                      onClick={() => saveSingle(item)}
                      disabled={isSaving}
                      className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-primary hover:border-primary/40 transition disabled:opacity-60"
                    >
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
