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
      } else {
        setUserId(null);
      }
      setLoading(false);
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { userId, loading };
};

