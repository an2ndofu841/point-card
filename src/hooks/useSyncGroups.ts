import { useEffect } from 'react';
import { db, DB_ERROR_EVENT } from '../lib/db';
import { supabase, isMock, checkSupabaseConnection } from '../lib/supabase';

export const useSyncGroups = () => {
  useEffect(() => {
    const sync = async () => {
      try {
        if (isMock) {
            const count = await db.groups.count();
            if (count === 0) {
                await db.groups.bulkPut([
                    { id: 1, name: 'Appare!', themeColor: '#2563EB', deletedAt: null },
                    { id: 2, name: 'Mock Group 2', themeColor: '#10B981', deletedAt: null }
                ]);
            }
            return;
        }

        // Check connection first
        const isConnected = await checkSupabaseConnection();
        if (!isConnected) {
            console.error("Supabase connection failed.");
            // Dispatch error event to show banner
            window.dispatchEvent(new CustomEvent(DB_ERROR_EVENT, { detail: new Error("Server Connection Failed") }));
            return;
        }

        const { data, error } = await supabase.from('groups').select('*');
        if (error) throw error;

        if (data && data.length > 0) {
            await db.groups.bulkPut(data.map(g => ({
                id: g.id,
                name: g.name,
                themeColor: g.theme_color || g.themeColor || '#000000',
                logoUrl: g.logo_url || g.logoUrl,
                xUrl: g.x_url || g.xUrl,
                instagramUrl: g.instagram_url || g.instagramUrl,
                tiktokUrl: g.tiktok_url || g.tiktokUrl,
                youtubeUrl: g.youtube_url || g.youtubeUrl,
                itunesUrl: g.itunes_url || g.itunesUrl,
                spotifyUrl: g.spotify_url || g.spotifyUrl,
                websiteUrl: g.website_url || g.websiteUrl,
                transferEnabled: g.transfer_enabled ?? g.transferEnabled ?? false,
                profileCoverUrl: g.profile_cover_url || g.profileCoverUrl,
                profileDescription: g.profile_description || g.profileDescription,
                deletedAt: g.deleted_at ? new Date(g.deleted_at).getTime() : null
            })));
        }
      } catch (err) {
        console.error("Group sync failed", err);
      }
    };
    sync();
  }, []);
};

