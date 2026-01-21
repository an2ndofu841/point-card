-- ==========================================
-- Live Trophies (per group)
-- ==========================================
create table if not exists public.live_trophies (
  id bigserial primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  name text not null,
  rarity text not null default 'BRONZE', -- BRONZE / SILVER / GOLD
  condition_type text not null, -- TOTAL_ATTENDANCE / STREAK_ATTENDANCE / EVENT_ATTENDANCE
  threshold integer,
  event_id bigint references public.live_events(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint live_trophies_rarity_check check (rarity in ('BRONZE','SILVER','GOLD')),
  constraint live_trophies_condition_check check (
    (condition_type in ('TOTAL_ATTENDANCE','STREAK_ATTENDANCE') and threshold is not null and threshold > 0 and event_id is null)
    or (condition_type = 'EVENT_ATTENDANCE' and event_id is not null)
  )
);

alter table public.live_trophies enable row level security;

drop policy if exists "Allow authenticated for live_trophies" on public.live_trophies;
create policy "Allow authenticated for live_trophies"
on public.live_trophies for all
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');
