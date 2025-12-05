import { useEffect } from 'react';
import { db } from '../lib/db';
import { supabase, isMock } from '../lib/supabase';

export const useSyncGroups = () => {
  useEffect(() => {
    const sync = async () => {
      try {
        if (isMock) {
            const count = await db.groups.count();
            if (count === 0) {
                await db.groups.bulkPut([
                    { id: 1, name: 'Appare!', themeColor: '#2563EB' },
                    { id: 2, name: 'Mock Group 2', themeColor: '#10B981' }
                ]);
            }
            return;
        }

        const { data, error } = await supabase.from('groups').select('*');
        if (error) throw error;

        if (data && data.length > 0) {
            await db.groups.bulkPut(data.map(g => ({
                id: g.id,
                name: g.name,
                themeColor: g.theme_color || g.themeColor || '#000000',
                logoUrl: g.logo_url || g.logoUrl
            })));
        }
      } catch (err) {
        console.error("Group sync failed", err);
      }
    };
    sync();
  }, []);
};

