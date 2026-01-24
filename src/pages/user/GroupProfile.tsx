import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { supabase, isMock } from '../../lib/supabase';
import { ArrowLeft, Users, Twitter, Instagram, Youtube, Music2, Music, Link as LinkIcon } from 'lucide-react';

export const GroupProfile = () => {
  const { groupId } = useParams();
  const numericGroupId = Number(groupId);

  const group = useLiveQuery(() => numericGroupId ? db.groups.get(numericGroupId) : undefined, [numericGroupId]);
  const members = useLiveQuery(() => numericGroupId
    ? db.groupMembers.where('groupId').equals(numericGroupId).sortBy('sortOrder')
    : [], [numericGroupId]);

  useEffect(() => {
    const syncGroup = async () => {
      if (!numericGroupId || isMock) return;
      if (!group) {
        const { data } = await supabase.from('groups').select('*').eq('id', numericGroupId).maybeSingle();
        if (data) {
          await db.groups.put({
            id: data.id,
            name: data.name,
            themeColor: data.theme_color,
            logoUrl: data.logo_url,
            xUrl: data.x_url,
            instagramUrl: data.instagram_url,
            tiktokUrl: data.tiktok_url,
            youtubeUrl: data.youtube_url,
            itunesUrl: data.itunes_url,
            spotifyUrl: data.spotify_url,
            websiteUrl: data.website_url,
            transferEnabled: data.transfer_enabled ?? false,
            profileCoverUrl: data.profile_cover_url,
            profileDescription: data.profile_description,
            profileIsSolo: data.profile_is_solo ?? false,
            deletedAt: data.deleted_at ? new Date(data.deleted_at).getTime() : null
          });
        }
      }

      const { data: memberData } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', numericGroupId)
        .order('sort_order', { ascending: true });

      if (memberData) {
        await db.groupMembers.bulkPut(memberData.map(item => ({
          id: item.id,
          groupId: item.group_id,
          name: item.name,
          role: item.role,
          imageUrl: item.image_url,
          sortOrder: item.sort_order,
          createdAt: new Date(item.created_at).getTime()
        })));
      }
    };
    syncGroup();
  }, [numericGroupId, group]);

  if (!numericGroupId) {
    return (
      <div className="min-h-screen bg-bg-main text-text-main p-6">
        <p className="text-center text-gray-400">グループが見つかりません</p>
      </div>
    );
  }

  const socialLinks = [
    { id: 'x', label: 'X', url: group?.xUrl, icon: Twitter },
    { id: 'instagram', label: 'Instagram', url: group?.instagramUrl, icon: Instagram },
    { id: 'tiktok', label: 'TikTok', url: group?.tiktokUrl, icon: Music2 },
    { id: 'youtube', label: 'YouTube', url: group?.youtubeUrl, icon: Youtube },
    { id: 'itunes', label: 'iTunes', url: group?.itunesUrl, icon: Music },
    { id: 'spotify', label: 'Spotify', url: group?.spotifyUrl, icon: Music2 },
    { id: 'website', label: 'URL', url: group?.websiteUrl, icon: LinkIcon }
  ].filter(link => !!link.url);

  return (
    <div className="min-h-screen bg-bg-main text-text-main pb-24">
      <div className="relative h-52 bg-gray-200">
        {group?.profileCoverUrl ? (
          <img src={group.profileCoverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
        )}
        <Link to="/user/groups/search" className="absolute top-4 left-4 p-2 bg-white/80 rounded-full border border-white/30 shadow-sm">
          <ArrowLeft size={18} className="text-gray-700" />
        </Link>
      </div>

      <div className="px-6 -mt-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                {group?.logoUrl ? (
                  <img src={group.logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400 font-bold">{group?.name?.[0] ?? '?'}</span>
                )}
              </div>
              <div>
                <h1 className="text-lg font-bold">{group?.name ?? '読み込み中...'}</h1>
                {group?.transferEnabled && (
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                    引き継ぎ可
                  </span>
                )}
              </div>
            </div>
            <Link
              to={`/join/${numericGroupId}`}
              className="bg-primary text-white px-4 py-2 rounded-full text-sm font-bold shadow hover:bg-primary-dark transition"
            >
              追加する
            </Link>
          </div>
          {group?.profileDescription && (
            <p className="text-sm text-gray-600 mt-4 whitespace-pre-wrap">
              {group.profileDescription}
            </p>
          )}
        </div>

        {socialLinks.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">SNS・リンク</h2>
            <div className="flex flex-wrap gap-3">
              {socialLinks.map(link => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-full border border-gray-100 text-gray-600 text-xs font-bold hover:text-primary hover:bg-white transition"
                  >
                    <Icon size={14} />
                    {link.label}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {!group?.profileIsSolo && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">所属メンバー</h2>
            {members && members.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {members.map(member => (
                  <div key={member.id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 overflow-hidden flex items-center justify-center">
                      {member.imageUrl ? (
                        <img src={member.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Users size={18} className="text-gray-300" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{member.name}</p>
                      {member.role && <p className="text-xs text-gray-400">{member.role}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">メンバー情報は準備中です</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
