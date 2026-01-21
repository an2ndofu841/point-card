-- Security Hardening: Restrict write access to Admin users only
-- Prevents regular users from modifying master data (Groups, Gifts, Ranks, Designs) via API

-- 1. Helper function to check if user is an admin
-- Based on the frontend logic: email must include 'admin'
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email') LIKE '%admin%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Policies for Master Data Tables
-- Only allow INSERT/UPDATE/DELETE if user is admin

-- Groups
DROP POLICY IF EXISTS "Allow authenticated insert/update for groups" ON public.groups;
CREATE POLICY "Allow admin insert/update for groups"
ON public.groups
FOR ALL
USING (auth.role() = 'authenticated' AND is_admin())
WITH CHECK (auth.role() = 'authenticated' AND is_admin());

-- Gifts
DROP POLICY IF EXISTS "Allow authenticated insert/update for gifts" ON public.gifts;
CREATE POLICY "Allow admin insert/update for gifts"
ON public.gifts
FOR ALL
USING (auth.role() = 'authenticated' AND is_admin())
WITH CHECK (auth.role() = 'authenticated' AND is_admin());

-- Rank Configs
DROP POLICY IF EXISTS "Allow authenticated insert/update for rank_configs" ON public.rank_configs;
CREATE POLICY "Allow admin insert/update for rank_configs"
ON public.rank_configs
FOR ALL
USING (auth.role() = 'authenticated' AND is_admin())
WITH CHECK (auth.role() = 'authenticated' AND is_admin());

-- Card Designs
DROP POLICY IF EXISTS "Allow authenticated insert/update for card_designs" ON public.card_designs;
CREATE POLICY "Allow admin insert/update for card_designs"
ON public.card_designs
FOR ALL
USING (auth.role() = 'authenticated' AND is_admin())
WITH CHECK (auth.role() = 'authenticated' AND is_admin());

-- Note: regular users still need read access (SELECT), which is covered by existing "Allow public read..." policies.




