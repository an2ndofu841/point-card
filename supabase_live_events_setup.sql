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
  attendance_points integer default 1,
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

alter table public.live_events
  add column if not exists attendance_points integer default 1;


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

-- ==========================================
-- Live Event Check-ins (QR scanned)
-- ==========================================
create or replace view public.live_event_checkins as
select
  ler.id as registration_id,
  ler.event_id,
  le.group_id,
  ler.user_id,
  ler.user_name,
  ler.checked_in_at,
  le.start_at::date as event_date
from public.live_event_registrations ler
join public.live_events le on le.id = ler.event_id
where
  ler.checked_in_at is not null
  and ler.status = 'CHECKED_IN'
  and le.is_cancelled is not true;

-- ==========================================
-- Live Event Attendance Streaks (by day)
-- ==========================================
create or replace view public.live_event_attendance_streaks as
with ordered as (
  select
    lec.*,
    lag(event_date) over (
      partition by user_id, group_id
      order by event_date
    ) as prev_event_date
  from public.live_event_checkins lec
),
flags as (
  select
    ordered.*,
    case
      when prev_event_date is null then 1
      when (event_date - prev_event_date) > 1 then 1
      else 0
    end as is_new_streak
  from ordered
),
grouped as (
  select
    flags.*,
    sum(is_new_streak) over (
      partition by user_id, group_id
      order by event_date
    ) as streak_group
  from flags
)
select
  grouped.*,
  row_number() over (
    partition by user_id, group_id, streak_group
    order by event_date
  ) as streak_count
from grouped;

-- ==========================================
-- Live Event Attendance Summary (per user, group)
-- ==========================================
create or replace view public.live_event_attendance_summary as
with latest as (
  select
    user_id,
    group_id,
    max(event_date) as latest_event_date
  from public.live_event_attendance_streaks
  group by user_id, group_id
)
select
  s.user_id,
  s.group_id,
  count(*) as total_checked_in,
  max(s.streak_count) as max_streak,
  max(s.streak_count) filter (where s.event_date = l.latest_event_date) as current_streak
from public.live_event_attendance_streaks s
join latest l
  on l.user_id = s.user_id
  and l.group_id = s.group_id
group by s.user_id, s.group_id;
