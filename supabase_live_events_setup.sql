-- Live event schedule and attendance setup

-- ==========================================
-- Live Events
-- ==========================================
create table if not exists public.live_events (
  id bigserial primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  description text,
  is_cancelled boolean default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.live_events enable row level security;

drop policy if exists "Allow authenticated for live_events" on public.live_events;
create policy "Allow authenticated for live_events"
on public.live_events for all
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');


-- ==========================================
-- Live Event Registrations (Participation / Check-in)
-- ==========================================
create table if not exists public.live_event_registrations (
  id bigserial primary key,
  event_id bigint not null references public.live_events(id) on delete cascade,
  user_id text not null,
  user_name text,
  status text not null default 'APPLY', -- APPLY / CHECKED_IN / CANCELLED
  applied_at timestamptz not null default timezone('utc'::text, now()),
  checked_in_at timestamptz,
  unique (event_id, user_id)
);

alter table public.live_event_registrations enable row level security;

drop policy if exists "Allow authenticated read registrations" on public.live_event_registrations;
create policy "Allow authenticated read registrations"
on public.live_event_registrations for select
using ((select auth.role()) = 'authenticated');

drop policy if exists "Users can insert their own registrations" on public.live_event_registrations;
create policy "Users can insert their own registrations"
on public.live_event_registrations for insert
with check (user_id = (select auth.uid())::text);

drop policy if exists "Allow authenticated update registrations" on public.live_event_registrations;
create policy "Allow authenticated update registrations"
on public.live_event_registrations for update
using ((select auth.role()) = 'authenticated');
