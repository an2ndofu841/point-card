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
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export const checkSupabaseConnection = async (): Promise<boolean> => {
    if (isMock) return true;
    try {
        console.log('Checking connection to:', supabaseUrl);
        
        // 1. Simple fetch check (to see if URL is reachable)
        // This helps distinguish between network error vs auth error
        try {
            const healthCheck = await fetch(`${supabaseUrl}/rest/v1/`, {
                method: 'HEAD',
                headers: { 'apikey': supabaseAnonKey }
            });
            console.log('Health check status:', healthCheck.status);
        } catch (fetchErr) {
            console.error('Network reachability check failed:', fetchErr);
        }

        // 2. Client library check
        const { error } = await supabase.from('groups').select('count', { count: 'exact', head: true });
        if (error) {
            console.error('Supabase connection check failed:', error);
            // If code is "PGRST301" (JWT expired) or 401, it might be auth issue
            // If it is FetchError, it is network/URL issue
            throw error; // Re-throw to be caught below
        }
        return true;
    } catch (e: any) {
        console.error('Supabase connection check exception:', e);
        // Add more detail to the error object for the UI
        if (e.message && e.message.includes('FetchError')) {
             throw new Error(`Network Error: Cannot reach ${supabaseUrl}`);
        }
        throw e;
    }
};
