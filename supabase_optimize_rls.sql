-- Optimize RLS policies to fix Security Advisor warnings
-- 1. Wrap auth functions in (select ...) for performance
-- 2. Remove redundant policies

-- ==========================================
-- User Memberships
-- ==========================================
-- Remove redundant policies (covered by "Allow ... for all authenticated")
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.user_memberships;
DROP POLICY IF EXISTS "Users can insert their own memberships" ON public.user_memberships;
DROP POLICY IF EXISTS "Users can update their own membership" ON public.user_memberships;

-- Optimize: Use (select auth.role())
DROP POLICY IF EXISTS "Allow view for all authenticated" ON public.user_memberships;
CREATE POLICY "Allow view for all authenticated" 
ON public.user_memberships FOR SELECT 
USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow insert for all authenticated" ON public.user_memberships;
CREATE POLICY "Allow insert for all authenticated" 
ON public.user_memberships FOR INSERT 
WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow update for all authenticated" ON public.user_memberships;
CREATE POLICY "Allow update for all authenticated" 
ON public.user_memberships FOR UPDATE 
USING ((select auth.role()) = 'authenticated');


-- ==========================================
-- Groups
-- ==========================================
-- Optimize using (select auth.role())
DROP POLICY IF EXISTS "Allow authenticated insert/update for groups" ON public.groups;
CREATE POLICY "Allow authenticated insert/update for groups"
ON public.groups FOR ALL
USING ((select auth.role()) = 'authenticated')
WITH CHECK ((select auth.role()) = 'authenticated');


-- ==========================================
-- Gifts
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated insert/update for gifts" ON public.gifts;
CREATE POLICY "Allow authenticated insert/update for gifts"
ON public.gifts FOR ALL
USING ((select auth.role()) = 'authenticated')
WITH CHECK ((select auth.role()) = 'authenticated');


-- ==========================================
-- Rank Configs
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated insert/update for rank_configs" ON public.rank_configs;
CREATE POLICY "Allow authenticated insert/update for rank_configs"
ON public.rank_configs FOR ALL
USING ((select auth.role()) = 'authenticated')
WITH CHECK ((select auth.role()) = 'authenticated');


-- ==========================================
-- Card Designs
-- ==========================================
-- Remove old specific policies if they exist
DROP POLICY IF EXISTS "Authenticated users can insert card designs" ON public.card_designs;
DROP POLICY IF EXISTS "Authenticated users can update card designs" ON public.card_designs;
DROP POLICY IF EXISTS "Authenticated users can delete card designs" ON public.card_designs;

-- Optimize
DROP POLICY IF EXISTS "Allow authenticated insert/update for card_designs" ON public.card_designs;
CREATE POLICY "Allow authenticated insert/update for card_designs"
ON public.card_designs FOR ALL
USING ((select auth.role()) = 'authenticated')
WITH CHECK ((select auth.role()) = 'authenticated');


-- ==========================================
-- Point History
-- ==========================================
DROP POLICY IF EXISTS "Users can view their own history" ON public.point_history;
DROP POLICY IF EXISTS "Users can insert their own history" ON public.point_history;

DROP POLICY IF EXISTS "Allow view history for all authenticated" ON public.point_history;
CREATE POLICY "Allow view history for all authenticated" 
ON public.point_history FOR SELECT 
USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow insert history for all authenticated" ON public.point_history;
CREATE POLICY "Allow insert history for all authenticated" 
ON public.point_history FOR INSERT 
WITH CHECK ((select auth.role()) = 'authenticated');


-- ==========================================
-- User Tickets
-- ==========================================
-- Optimize specific user policies (using select auth.uid())
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.user_tickets;
CREATE POLICY "Users can view their own tickets"
ON public.user_tickets FOR SELECT
USING (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "Users can insert their own tickets" ON public.user_tickets;
CREATE POLICY "Users can insert their own tickets"
ON public.user_tickets FOR INSERT
WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "Users can update their own tickets" ON public.user_tickets;
CREATE POLICY "Users can update their own tickets"
ON public.user_tickets FOR UPDATE
USING (user_id = (select auth.uid())::text);


-- ==========================================
-- User Designs
-- ==========================================
-- Remove redundant
DROP POLICY IF EXISTS "Users can view their own designs" ON public.user_designs;

-- Optimize
DROP POLICY IF EXISTS "Authenticated users can view all user designs" ON public.user_designs;
CREATE POLICY "Authenticated users can view all user designs"
ON public.user_designs FOR SELECT
USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert user designs" ON public.user_designs;
CREATE POLICY "Authenticated users can insert user designs"
ON public.user_designs FOR INSERT
WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update user designs" ON public.user_designs;
CREATE POLICY "Authenticated users can update user designs"
ON public.user_designs FOR UPDATE
USING ((select auth.role()) = 'authenticated');




