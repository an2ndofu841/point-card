import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isMock } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Mock Mode Check
      if (isMock) {
        const hasMockSession = localStorage.getItem('mock_admin_session');
        if (!hasMockSession) {
           navigate('/admin/login');
        }
        setIsLoading(false);
        return;
      }

      // Supabase Auth Check
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/admin/login');
        setIsLoading(false);
        return;
      }
      
      // Optional: Check for specific admin role claim or metadata
      // For now, we assume any authenticated user on admin login flow is valid
      // Real implementation should check user role in DB or Metadata

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

