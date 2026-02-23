import React, { useState } from 'react';
import { supabase, isMock } from '../lib/supabase';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { loadPendingJoinGroupId, clearPendingJoinGroupId } from '../lib/pendingJoin';

export const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const joinGroupId = searchParams.get('joinGroupId') || (loadPendingJoinGroupId()?.toString() ?? null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isMock) {
         // モックモード
         await new Promise(resolve => setTimeout(resolve, 1000));
         console.log("Mock Login Success:", email);
         if (email.includes('admin')) {
            navigate('/admin/dashboard');
         } else {
            localStorage.setItem('mock_user_session', 'true');
            if (joinGroupId) {
              clearPendingJoinGroupId();
              navigate(`/join/${joinGroupId}`);
            } else {
              navigate('/home');
            }
         }
         return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (data.user) {
        if (email.includes('admin')) {
           navigate('/admin/dashboard');
        } else {
           if (joinGroupId) {
             clearPendingJoinGroupId();
             navigate(`/join/${joinGroupId}`);
           } else {
             navigate('/home');
           }
        }
      }
    } catch (err: any) {
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

        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-100 border border-white">
          <h1 className="text-2xl font-bold mb-2 text-text-main">おかえりなさい</h1>
          <p className="text-text-sub mb-8 text-sm">ログインしてポイントを確認しましょう</p>
          
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
                <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary transition" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 pl-12 pr-4 text-text-main placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-text-sub text-xs font-bold uppercase tracking-wider ml-1">パスワード</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-primary transition" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 pl-12 pr-4 text-text-main placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl transition shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'ログインする'}
              </button>
            </div>
          </form>
        </div>
        
        {isMock && (
            <div className="mt-6 text-center">
              <p className="text-xs text-orange-500 font-bold bg-orange-50 p-2 rounded inline-block">
                ※現在はデモモードです。認証は行われません。
              </p>
            </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-text-sub text-sm">
            アカウントをお持ちでないですか？{' '}
            <Link to={joinGroupId ? `/register?joinGroupId=${joinGroupId}` : '/register'} className="text-primary hover:text-primary-dark font-bold transition ml-1">
              新規登録
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
