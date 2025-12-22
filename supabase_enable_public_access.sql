-- Enable RLS for Groups, Gifts, RankConfigs, and CardDesigns
-- This fixes the "RLS Disabled in Public" security warnings
-- Policy: Public Read (Anon), Authenticated Write

-- 1. Groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access for groups" ON public.groups;
CREATE POLICY "Allow public read access for groups"
ON public.groups FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update for groups" ON public.groups;
CREATE POLICY "Allow authenticated insert/update for groups"
ON public.groups FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 2. Gifts
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access for gifts" ON public.gifts;
CREATE POLICY "Allow public read access for gifts"
ON public.gifts FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update for gifts" ON public.gifts;
CREATE POLICY "Allow authenticated insert/update for gifts"
ON public.gifts FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 3. Rank Configs
ALTER TABLE public.rank_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access for rank_configs" ON public.rank_configs;
CREATE POLICY "Allow public read access for rank_configs"
ON public.rank_configs FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update for rank_configs" ON public.rank_configs;
CREATE POLICY "Allow authenticated insert/update for rank_configs"
ON public.rank_configs FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 4. Card Designs
ALTER TABLE public.card_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access for card_designs" ON public.card_designs;
CREATE POLICY "Allow public read access for card_designs"
ON public.card_designs FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert/update for card_designs" ON public.card_designs;
CREATE POLICY "Allow authenticated insert/update for card_designs"
ON public.card_designs FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

