import React, { useState } from 'react';
import { supabase, isMock } from '../../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle, ArrowLeft, Shield } from 'lucide-react';

export const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isMock) {
         // モックモード
         await new Promise(resolve => setTimeout(resolve, 1000));
         console.log("Mock Admin Login Success:", email);
         // 簡易的なチェック: emailにadminが含まれているか
         if (email.includes('admin')) {
            localStorage.setItem('mock_admin_session', 'true');
            navigate('/admin/dashboard');
         } else {
            setError("運営者権限がありません");
         }
         return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // 権限チェック: メタデータのroleが'admin' または メールアドレスに'admin'が含まれる場合のみ許可
      const { data: { user } } = await supabase.auth.getUser();
      const isAdmin = user?.user_metadata?.role === 'admin' || user?.email?.includes('admin');
      
      if (!isAdmin) {
         await supabase.auth.signOut();
         throw new Error("運営者権限がありません");
      }

      if (data.user) {
         navigate('/admin/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setError("メールアドレスまたはパスワードが正しくありません。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-main text-text-main p-6">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center animate-fade-in">
        
        <Link to="/" className="inline-flex items-center text-text-sub hover:text-primary mb-8 transition font-medium">
          <ArrowLeft size={20} className="mr-2" />
          トップへ戻る
        </Link>

        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-500/10 border-t-4 border-blue-500">
          <div className="flex items-center gap-2 mb-2 text-blue-600">
             <Shield size={24} />
             <span className="text-xs font-bold uppercase tracking-widest">Admin Portal</span>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-text-main">運営者ログイン</h1>
          <p className="text-text-sub mb-8 text-sm">管理画面へアクセスします</p>
          
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl mb-6 flex items-start gap-3 animate-slide-up">
              <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider ml-1">メールアドレス</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-blue-600 transition" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 pl-12 pr-4 text-text-main placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  placeholder="admin@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider ml-1">パスワード</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-blue-600 transition" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 pl-12 pr-4 text-text-main placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'ログインする'}
              </button>
            </div>
          </form>
        </div>
        
        {isMock && (
            <div className="mt-6 text-center">
              <p className="text-xs text-orange-500 font-bold bg-orange-50 p-2 rounded inline-block">
                ※デモモード: emailに 'admin' を含めてください
              </p>
            </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-text-sub text-sm">
            アカウントをお持ちでないですか？{' '}
            <Link to="/admin/register" className="text-blue-600 hover:text-blue-700 font-bold transition ml-1">
              新規登録
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

