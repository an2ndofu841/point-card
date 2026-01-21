-- ==========================================
-- Level Configs (per group)
-- ==========================================
create table if not exists public.level_configs (
  id bigserial primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  level integer not null,
  required_points integer not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint level_configs_level_check check (level >= 1 and level <= 100),
  constraint level_configs_points_check check (required_points >= 0),
  unique (group_id, level)
);

alter table public.level_configs enable row level security;

drop policy if exists "Allow authenticated for level_configs" on public.level_configs;
create policy "Allow authenticated for level_configs"
on public.level_configs for all
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');
