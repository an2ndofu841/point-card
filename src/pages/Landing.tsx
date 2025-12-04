import { Link } from 'react-router-dom';
import { Mail, ArrowRight, Smartphone } from 'lucide-react';

export const Landing = () => {
  return (
    <div className="min-h-screen flex flex-col bg-bg-main text-text-main font-sans overflow-hidden relative">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[70%] h-[50%] bg-blue-100 rounded-full blur-3xl opacity-50 -z-10 animate-fade-in"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[70%] h-[50%] bg-indigo-100 rounded-full blur-3xl opacity-50 -z-10 animate-fade-in"></div>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-md mx-auto z-10">
        
        <div className="mb-12 text-center animate-slide-up">
           <div className="inline-flex items-center justify-center p-5 bg-white rounded-2xl mb-6 shadow-xl shadow-blue-100 ring-1 ring-black/5">
             <Smartphone className="text-primary w-12 h-12" strokeWidth={1.5} />
           </div>
           <h1 className="text-4xl font-extrabold tracking-tight mb-4 text-text-main">
             CF Point Card
           </h1>
           <p className="text-text-sub text-base font-medium leading-relaxed">
             スマホひとつで、もっと楽しく。<br/>
             地下アイドル現場の新しいスタンダード。
           </p>
        </div>

        <div className="w-full space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          
          <Link to="/login" className="group relative block w-full">
            <button className="relative w-full bg-primary text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-blue-500/30 hover:bg-primary-dark hover:shadow-blue-600/40 transition-all transform active:scale-[0.98]">
              <Mail size={20} className="opacity-90" />
              メールアドレスでログイン
              <ArrowRight size={18} className="opacity-70 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>

          <Link to="/register" className="block w-full">
            <button className="w-full bg-white border border-gray-200 text-text-main py-4 rounded-xl font-bold text-lg shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]">
              新規アカウント作成
            </button>
          </Link>
        </div>

        <div className="relative w-full my-10 flex items-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase tracking-widest font-medium">Social Login</span>
            <div className="flex-grow border-t border-gray-200"></div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <button className="flex items-center justify-center gap-2 bg-[#06C755] text-white py-3.5 rounded-xl font-bold shadow-md hover:bg-[#05b34c] transition active:scale-[0.98]">
            LINE
          </button>
          <button className="flex items-center justify-center gap-2 bg-black text-white py-3.5 rounded-xl font-bold shadow-md hover:bg-gray-800 transition active:scale-[0.98]">
             𝕏 (Twitter)
          </button>
        </div>

        <div className="mt-auto pt-10 pb-4 text-center">
          <Link to="/admin/login" className="text-xs text-gray-400 hover:text-primary transition font-medium">
            運営者ログインはこちら
          </Link>
        </div>
      </div>
    </div>
  );
};
