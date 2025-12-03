import React, { useState } from 'react';
import { supabase, isMock } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';

export const Register = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      setLoading(false);
      return;
    }

    try {
      if (isMock) {
        // モックモード：実際の通信を行わずに成功とする
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機して通信っぽく見せる
        console.log("Mock Register Success:", email);
        setSuccess(true);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "登録中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-main text-text-main p-6 animate-fade-in">
        <div className="bg-white p-10 rounded-3xl shadow-xl shadow-gray-100 border border-white max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
             <CheckCircle className="text-green-600" size={40} />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-text-main">確認メールを送信しました</h2>
          <p className="text-text-sub mb-8 text-sm leading-relaxed">
            <span className="text-text-main font-bold block mb-1 text-base">{email}</span>
            宛に確認リンクをお送りしました。<br/>
            メール内のリンクをクリックして登録を完了してください。
          </p>
          
          {isMock && (
            <p className="text-xs text-orange-500 mb-4 font-bold bg-orange-50 p-2 rounded">
              ※現在はデモモードです。実際のメールは送信されません。<br/>
              ログイン画面からそのままログイン可能です。
            </p>
          )}

          <Link to="/login" className="block w-full bg-gray-100 hover:bg-gray-200 text-text-main font-bold py-3.5 rounded-xl transition">
            ログイン画面へ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-main text-text-main p-6">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center animate-fade-in">
        
        <Link to="/" className="inline-flex items-center text-text-sub hover:text-primary mb-8 transition font-medium">
          <ArrowLeft size={20} className="mr-2" />
          トップへ戻る
        </Link>

        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-100 border border-white">
          <h1 className="text-2xl font-bold mb-2 text-text-main">アカウント作成</h1>
          <p className="text-text-sub mb-8 text-sm">会員登録して特典をゲットしよう</p>
          
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl mb-6 flex items-start gap-3 animate-slide-up">
              <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
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
                  placeholder="6文字以上"
                  minLength={6}
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
                {loading ? <Loader2 className="animate-spin" /> : 'アカウントを作成'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-text-sub text-sm">
            すでにアカウントをお持ちですか？{' '}
            <Link to="/login" className="text-primary hover:text-primary-dark font-bold transition ml-1">
              ログイン
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
