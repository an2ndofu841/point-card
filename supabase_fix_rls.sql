-- RLS Policy Update for Admin Access
-- 現状のRLS（Row Level Security）では、ユーザー本人のみが自分のデータを読み書きできるようになっています。
-- 管理者（Admin）がユーザーのポイントを更新したり、メンバーシップを作成したりできるように、
-- 一時的に「ログイン済みユーザーであれば誰でも他人のデータを操作可能」なポリシーに変更します。
-- ※ 本番運用で厳密なセキュリティが必要な場合は、別途Custom Claims等を用いた管理者判定が必要です。

-- 1. Enable RLS (Just in case)
ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing strict policies
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.user_memberships;
DROP POLICY IF EXISTS "Users can insert their own memberships" ON public.user_memberships;
DROP POLICY IF EXISTS "Users can update their own memberships" ON public.user_memberships;

-- 3. Create permissive policies for Authenticated users (Admins & Users)

-- SELECT: Allow all authenticated users to view all memberships
-- (Admin needs to see user's current points)
CREATE POLICY "Allow view for all authenticated" 
ON public.user_memberships 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- INSERT: Allow all authenticated users to insert memberships
-- (Admin needs to create membership when granting points to new user)
CREATE POLICY "Allow insert for all authenticated" 
ON public.user_memberships 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: Allow all authenticated users to update memberships
-- (Admin needs to update points)
CREATE POLICY "Allow update for all authenticated" 
ON public.user_memberships 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- 4. Also ensure point_history is writable by Admin for others
ALTER TABLE public.point_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own history" ON public.point_history;
DROP POLICY IF EXISTS "Users can insert their own history" ON public.point_history;

CREATE POLICY "Allow view history for all authenticated" 
ON public.point_history 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert history for all authenticated" 
ON public.point_history 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');




