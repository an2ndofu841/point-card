-- ==========================================
-- Add member_id to user_memberships
-- ==========================================
alter table public.user_memberships
  add column if not exists member_id text;

create unique index if not exists user_memberships_member_id_key
  on public.user_memberships(member_id)
  where member_id is not null;
