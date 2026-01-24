import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Trash2, AlertTriangle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { supabase, isMock } from '../../lib/supabase';
import { loadSelectedGroupId, saveSelectedGroupId } from '../../lib/selectedGroup';

export const UserGroupManagement = () => {
  const navigate = useNavigate();
  const { userId } = useCurrentUser();
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);
  
  // Fetch All Groups User Belongs To
  const groups = useLiveQuery(async () => {
    if (!userId) return [];
    const memberships = await db.userMemberships.where('userId').equals(userId).toArray();
    if (!memberships.length) return [];
    const groupIds = memberships.map(m => m.groupId);
    return await db.groups.where('id').anyOf(groupIds).toArray();
  }, [userId]);

  const GROUP_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

  const visibleGroups = groups?.filter(group => {
    if (!group.deletedAt) return true;
    return Date.now() - group.deletedAt <= GROUP_RETENTION_MS;
  });

  // Fetch membership info for each group
  const memberships = useLiveQuery(async () => {
    if (!userId || !visibleGroups) return {};
    const result: Record<number, { points: number; totalPoints: number }> = {};
    for (const group of visibleGroups) {
      const membership = await db.userMemberships.where({ userId, groupId: group.id }).first();
      if (membership) {
        result[group.id] = {
          points: membership.points || 0,
          totalPoints: membership.totalPoints || 0
        };
      }
    }
    return result;
  }, [userId, visibleGroups]);

  const handleRemoveGroup = async (groupId: number, groupName: string) => {
    const membership = memberships?.[groupId];
    const pointsText = membership ? `\n現在のポイント: ${membership.points}pt\n累積ポイント: ${membership.totalPoints}pt` : '';
    
    const confirmed = window.confirm(
      `「${groupName}」を削除してもよろしいですか？${pointsText}\n\n⚠️ 注意：\n・このグループで貯めたポイントは完全に消去されます\n・一度削除すると元に戻すことはできません\n・ポイント履歴やトロフィーなども全て失われます\n\n本当に削除しますか？`
    );
    
    if (!confirmed) return;
    
    setDeletingGroupId(groupId);
    
    try {
      // Delete from Supabase
      if (!isMock && userId) {
        const { error } = await supabase
          .from('user_memberships')
          .delete()
          .eq('user_id', userId)
          .eq('group_id', groupId);
          
        if (error) {
          console.error('Failed to delete membership from server', error);
          alert('削除中にエラーが発生しました。もう一度お試しください。');
          setDeletingGroupId(null);
          return;
        }
      }
      
      // Delete from local DB
      if (userId) {
        await db.userMemberships
          .where({ userId: userId, groupId: groupId })
          .delete();
      }
      
      // If the deleted group was active, switch to another group or clear selection
      const savedGroupId = userId ? loadSelectedGroupId(userId) : null;
      if (savedGroupId === groupId) {
        const remainingGroups = visibleGroups?.filter(g => g.id !== groupId);
        if (remainingGroups && remainingGroups.length > 0) {
          const nextGroupId = remainingGroups[0].id;
          if (userId) saveSelectedGroupId(userId, nextGroupId);
        } else {
          if (userId) localStorage.removeItem(`selectedGroup_${userId}`);
        }
      }
      
      alert('グループを削除しました');
      
      // Check if there are any groups left
      const remainingGroups = visibleGroups?.filter(g => g.id !== groupId);
      if (!remainingGroups || remainingGroups.length === 0) {
        navigate('/home');
      }
    } catch (err) {
      console.error('Failed to remove group', err);
      alert('削除中にエラーが発生しました');
    } finally {
      setDeletingGroupId(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-6 pb-24 font-sans">
      <div className="flex items-center mb-6">
        <Link to="/user/settings" className="mr-4 p-2 bg-white rounded-full border border-gray-100 shadow-sm hover:bg-gray-50 transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold">グループ管理</h1>
      </div>

      <div className="max-w-md mx-auto">
        {/* Info Banner */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-yellow-900 mb-1">削除する前にご確認ください</p>
            <p className="text-yellow-700 text-xs leading-relaxed">
              グループを削除すると、そのグループで貯めたポイントやトロフィーなどのデータが完全に削除され、元に戻すことはできません。
            </p>
          </div>
        </div>

        {/* Groups List */}
        {visibleGroups && visibleGroups.length > 0 ? (
          <div className="space-y-3">
            {visibleGroups.map(group => {
              const membership = memberships?.[group.id];
              const isDeleting = deletingGroupId === group.id;
              
              return (
                <div key={group.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div 
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm flex-shrink-0"
                        style={{ backgroundColor: group.themeColor }}
                      >
                        {group.logoUrl ? (
                          <img src={group.logoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          group.name[0]
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-text-main mb-1 flex items-center gap-2">
                          {group.name}
                          {group.deletedAt && (
                            <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                              削除済み
                            </span>
                          )}
                        </h3>
                        {membership && (
                          <div className="text-xs text-gray-500 space-y-0.5">
                            <p>現在のポイント: <span className="font-bold text-primary">{membership.points}pt</span></p>
                            <p>累積ポイント: <span className="font-bold">{membership.totalPoints}pt</span></p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {!group.deletedAt && (
                    <div className="border-t border-gray-50 px-4 py-3">
                      <button
                        onClick={() => handleRemoveGroup(group.id, group.name)}
                        disabled={isDeleting}
                        className="w-full bg-red-50 text-red-600 py-2.5 rounded-xl font-bold hover:bg-red-100 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={16} />
                        {isDeleting ? '削除中...' : 'このグループを削除'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Users size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="font-bold text-gray-400 mb-2">参加しているグループがありません</p>
            <Link 
              to="/user/groups/search"
              className="inline-block mt-4 bg-primary text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-primary-dark transition"
            >
              グループを探す
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
