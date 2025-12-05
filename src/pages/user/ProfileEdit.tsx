import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { ArrowLeft, Save, User, Loader2 } from 'lucide-react';

export const ProfileEdit = () => {
  const navigate = useNavigate();
  const { userId } = useCurrentUser(); // Use real userId
  
  // Fetch user data
  const userCache = useLiveQuery(() => userId ? db.userCache.get(userId) : undefined, [userId]);
  
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize form with existing data
  useEffect(() => {
    if (userCache) {
      setName(userCache.name || '');
    }
  }, [userCache]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    setLoading(true);

    try {
      // 1. Update Local DB
      const exists = await db.userCache.get(userId);
      if (exists) {
        await db.userCache.update(userId, {
          name: name,
          lastUpdated: Date.now()
        });
      } else {
        await db.userCache.put({
          id: userId,
          name: name,
          lastUpdated: Date.now()
        });
      }
      
      // 2. Sync to Supabase (if not mock)
      if (!isMock) {
         const { error } = await supabase.auth.updateUser({
           data: { display_name: name }
         });
         
         if (error) {
             console.error("Failed to sync profile to Supabase", error);
             // We don't block UI for this, but logging it is good
         }
      }
      
      setTimeout(() => {
        setLoading(false);
        navigate('/user/settings');
      }, 500);
    } catch (err) {
      console.error("Failed to save profile", err);
      setLoading(false);
      alert("保存に失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 font-sans">
      <div className="flex items-center mb-8">
        <Link to="/user/settings" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold">プロフィール編集</h1>
      </div>

      <div className="max-w-md mx-auto">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
           <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-md">
             <User size={48} className="text-gray-400" />
           </div>
           
           <form onSubmit={handleSave} className="space-y-6">
             <div>
               <label className="block text-text-sub text-xs font-bold uppercase tracking-wider mb-2 ml-1">ニックネーム</label>
               <input
                 type="text"
                 value={name}
                 onChange={(e) => setName(e.target.value)}
                 className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 font-bold text-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                 placeholder="ゲストさん"
                 maxLength={20}
               />
               <p className="text-right text-xs text-gray-400 mt-1">{name.length}/20</p>
             </div>

             <button
               type="submit"
               disabled={loading}
               className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl transition shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
             >
               {loading ? <Loader2 className="animate-spin" /> : <><Save size={20} /> 保存する</>}
             </button>
           </form>
        </div>
      </div>
    </div>
  );
};


