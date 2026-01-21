-- Fix Admin Policy for Production
-- Update is_admin() to check for 'admin' role in user_metadata
-- instead of relying on email address string matching.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user_metadata has role 'admin'
  -- OR keep email check for backward compatibility with existing admin emails
  RETURN (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    (auth.jwt() ->> 'email') LIKE '%admin%'
  );
END;
$$;




