import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Trash2, Shield, User, Bell, Palette, ChevronRight, Users, Repeat } from 'lucide-react';
import { supabase, isMock } from '../../lib/supabase';
import { db } from '../../lib/db';

export const UserSettings = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (window.confirm('ログアウトしますか？')) {
      if (isMock) {
        localStorage.removeItem('mock_user_session');
      } else {
        await supabase.auth.signOut();
      }
      navigate('/login');
    }
  };

  const handleClearData = async () => {
    if (window.confirm('【デバッグ用】ローカルデータを全削除しますか？\n※ポイントやチケット情報もリセットされます')) {
      await db.delete();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <div className="flex items-center mb-8">
        <Link to="/home" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold">設定</h1>
      </div>

      <div className="space-y-6 max-w-md mx-auto">
        
        {/* Card Settings */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">カード設定</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <Link to="/user/groups/manage" className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition border-b border-gray-50 text-left">
               <div className="flex items-center gap-3">
                 <Users size={20} className="text-purple-600" />
                 <span className="font-bold text-sm">グループ管理</span>
               </div>
               <ChevronRight size={18} className="text-gray-300" />
            </Link>

            <Link to="/user/transfer" className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition border-b border-gray-50 text-left">
               <div className="flex items-center gap-3">
                 <Repeat size={20} className="text-blue-600" />
                 <span className="font-bold text-sm">ポイント引き継ぎ</span>
               </div>
               <ChevronRight size={18} className="text-gray-300" />
            </Link>
            
            <Link to="/user/designs" className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition text-left">
               <div className="flex items-center gap-3">
                 <Palette size={20} className="text-primary" />
                 <span className="font-bold text-sm">券面デザイン変更</span>
               </div>
               <ChevronRight size={18} className="text-gray-300" />
            </Link>
          </div>
        </section>

        {/* Account Section */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">アカウント</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <Link to="/user/profile" className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition border-b border-gray-50 text-left">
               <div className="flex items-center gap-3">
                 <User size={20} className="text-gray-400" />
                 <span className="font-bold text-sm">プロフィール編集</span>
               </div>
               <ChevronRight size={18} className="text-gray-300" />
            </Link>
            <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition text-left">
               <div className="flex items-center gap-3">
                 <Bell size={20} className="text-gray-400" />
                 <span className="font-bold text-sm">通知設定</span>
               </div>
            </button>
          </div>
        </section>

        {/* App Info Section */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">アプリ情報</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-gray-50">
               <span className="text-sm font-bold">バージョン</span>
               <span className="text-sm text-gray-500 font-mono">v1.0.0</span>
            </div>
            <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
               <div className="flex items-center gap-3">
                 <Shield size={20} className="text-gray-400" />
                 <span className="font-bold text-sm">プライバシーポリシー</span>
               </div>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">その他</h2>
          <div className="space-y-3">
            <button 
              onClick={handleLogout}
              className="w-full bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-center gap-2 text-red-500 font-bold hover:bg-red-50 transition"
            >
              <LogOut size={20} /> ログアウト
            </button>

            {/* Debug Only */}
            <button 
              onClick={handleClearData}
              className="w-full bg-transparent p-4 rounded-2xl border border-dashed border-gray-300 flex items-center justify-center gap-2 text-gray-400 text-sm font-bold hover:bg-gray-100 hover:text-gray-600 transition"
            >
              <Trash2 size={18} /> キャッシュクリア (Debug)
            </button>
          </div>
        </section>

        <div className="text-center text-xs text-gray-300 mt-8">
          CF Point Card System<br/>
          &copy; 2024 All Rights Reserved.
        </div>

      </div>
    </div>
  );
};
