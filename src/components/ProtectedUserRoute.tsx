import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isMock } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export const ProtectedUserRoute = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (isMock) {
        const hasMockSession = localStorage.getItem('mock_user_session');
        if (!hasMockSession) {
          navigate('/login');
        }
        setIsLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return <>{children}</>;
};
