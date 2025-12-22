-- Supabase RLSポリシーの修正用SQL

-- 1. 既存のポリシーをドロップして競合を防ぐ
drop policy if exists "Users can update their own membership" on public.user_memberships;
drop policy if exists "Authenticated users can update memberships" on public.user_memberships; -- 管理者用があれば

-- 2. ユーザーが自分自身のメンバーシップを更新できるようにする
-- (user_idが一致する場合のみ許可)
create policy "Users can update their own membership"
  on public.user_memberships
  for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

-- 3. 権限の再確認 (念のため)
grant all on public.user_memberships to authenticated;
grant all on public.user_memberships to service_role;

-- 4. user_designs テーブルのポリシーも確認（一応）
-- デザイン選択には user_memberships の更新が必要だが、念のため関連テーブルも許可
alter table public.user_memberships enable row level security;


