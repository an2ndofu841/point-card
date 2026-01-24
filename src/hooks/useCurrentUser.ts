import { useState, useEffect } from 'react';
import { supabase, isMock } from '../lib/supabase';

export const useCurrentUser = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (isMock) {
        setUserId('user-sample-123');
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      }
      setLoading(false);
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { userId, loading };
};




