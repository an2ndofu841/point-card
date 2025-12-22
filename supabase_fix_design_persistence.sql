-- デザイン選択の保存機能に必要なカラム追加と権限設定を一括で行うSQL

-- 1. カラムの追加（まだ存在しない場合）
-- これがないと "400 Bad Request" エラーになります
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name = 'user_memberships' and column_name = 'selected_design_id') then
    alter table public.user_memberships 
    add column selected_design_id bigint references public.card_designs(id);
  end if;
end $$;

-- 2. 古いポリシーの削除（競合回避）
drop policy if exists "Users can update their own membership" on public.user_memberships;
drop policy if exists "Authenticated users can update memberships" on public.user_memberships;
drop policy if exists "Users can update their own selected design" on public.user_memberships;

-- 3. 更新許可ポリシーの作成
-- ユーザー自身（auth.uid() = user_id）であれば更新を許可
create policy "Users can update their own membership"
  on public.user_memberships
  for update
  using ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

-- 4. 権限の再付与
grant all on public.user_memberships to authenticated;
grant all on public.user_memberships to service_role;

-- 5. RLSの有効化確認
alter table public.user_memberships enable row level security;


