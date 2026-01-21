-- ==========================================
-- Fix group deletes to cascade related data
-- ==========================================

-- user_memberships
alter table public.user_memberships
  drop constraint if exists user_memberships_group_id_fkey;
alter table public.user_memberships
  add constraint user_memberships_group_id_fkey
  foreign key (group_id) references public.groups(id) on delete cascade;

-- gifts
alter table public.gifts
  drop constraint if exists gifts_group_id_fkey;
alter table public.gifts
  add constraint gifts_group_id_fkey
  foreign key (group_id) references public.groups(id) on delete cascade;

-- rank_configs
alter table public.rank_configs
  drop constraint if exists rank_configs_group_id_fkey;
alter table public.rank_configs
  add constraint rank_configs_group_id_fkey
  foreign key (group_id) references public.groups(id) on delete cascade;

-- card_designs
alter table public.card_designs
  drop constraint if exists card_designs_group_id_fkey;
alter table public.card_designs
  add constraint card_designs_group_id_fkey
  foreign key (group_id) references public.groups(id) on delete cascade;

-- user_designs
alter table public.user_designs
  drop constraint if exists user_designs_group_id_fkey;
alter table public.user_designs
  add constraint user_designs_group_id_fkey
  foreign key (group_id) references public.groups(id) on delete cascade;

-- user_tickets
alter table public.user_tickets
  drop constraint if exists user_tickets_group_id_fkey;
alter table public.user_tickets
  add constraint user_tickets_group_id_fkey
  foreign key (group_id) references public.groups(id) on delete cascade;
