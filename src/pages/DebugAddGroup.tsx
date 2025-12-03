import React, { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const DebugAddGroup = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const addGroup = async () => {
    setStatus('loading');
    try {
      // 1. Create "大鈴グミ" Group
      const gumiGroup = {
        id: 999, // Special ID for testing
        name: '大鈴グミ',
        themeColor: '#FF69B4', // Hot Pink
        logoUrl: '' // Optional
      };
      
      // Check if exists, or update
      await db.groups.put(gumiGroup);

      // 2. Add Membership for current mock user
      const userId = 'user-sample-123';
      
      // Check if already member
      const existing = await db.userMemberships.where({ userId, groupId: 999 }).first();
      
      if (!existing) {
        await db.userMemberships.add({
          userId,
          groupId: 999,
          points: 0,
          totalPoints: 0,
          currentRank: 'REGULAR',
          lastUpdated: Date.now()
        });
        setMessage('「大鈴グミ」グループと会員データを追加しました！');
      } else {
        setMessage('既に「大鈴グミ」の会員データが存在します。');
      }

      setStatus('success');

    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('エラーが発生しました: ' + (err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main p-6 flex flex-col items-center justify-center">
       <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center space-y-6">
          <h1 className="text-xl font-bold">デバッグ用: グループ追加</h1>
          
          {status === 'idle' && (
            <button 
              onClick={addGroup}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg hover:bg-primary-dark transition"
            >
               「大鈴グミ」を追加する
            </button>
          )}

          {status === 'loading' && <Loader2 className="animate-spin mx-auto text-primary" size={32} />}
          
          {status === 'success' && (
            <div className="animate-scale-in">
              <CheckCircle size={48} className="text-green-500 mx-auto mb-2" />
              <p className="font-bold text-gray-800 mb-4">{message}</p>
              <Link to="/user/home" className="block w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-xl">
                ホームに戻る
              </Link>
            </div>
          )}

           {status === 'error' && (
            <div className="animate-shake">
              <XCircle size={48} className="text-red-500 mx-auto mb-2" />
              <p className="font-bold text-red-600 mb-4">{message}</p>
              <button onClick={() => setStatus('idle')} className="text-sm text-gray-400 underline">
                戻る
              </button>
            </div>
          )}
       </div>
    </div>
  );
};

