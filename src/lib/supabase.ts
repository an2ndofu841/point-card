import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 環境変数が設定されていない、またはプレースホルダーの場合はモックモードとして動作
export const isMock = !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder');

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      // ロック機能の問題を回避するためのカスタムロック (Safari/Chromeの一部の環境対策)
      lock: {
        request: async (_name: string, _options: any, callback: () => any) => {
          return await callback();
        },
      } as any,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
