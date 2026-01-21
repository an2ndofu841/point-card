-- ==========================================
-- Live Event Attendance Manual Counts
-- ==========================================
create table if not exists public.live_event_attendance_manual (
  id bigserial primary key,
  event_id bigint not null references public.live_events(id) on delete cascade,
  group_id bigint not null references public.groups(id) on delete cascade,
  manual_count integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint live_event_attendance_manual_count_check check (manual_count >= 0),
  unique (event_id)
);

alter table public.live_event_attendance_manual enable row level security;

drop policy if exists "Allow authenticated for live_event_attendance_manual" on public.live_event_attendance_manual;
create policy "Allow authenticated for live_event_attendance_manual"
on public.live_event_attendance_manual for all
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

-- ==========================================
-- Live Event Attendance Counts View
-- ==========================================
create or replace view public.live_event_attendance_counts as
select
  le.id as event_id,
  le.group_id,
  le.title,
  le.start_at,
  le.is_cancelled,
  count(lec.registration_id) as scanned_count,
  coalesce(lem.manual_count, 0) as manual_count,
  count(lec.registration_id) + coalesce(lem.manual_count, 0) as total_count
from public.live_events le
left join public.live_event_checkins lec on lec.event_id = le.id
left join public.live_event_attendance_manual lem on lem.event_id = le.id
group by
  le.id,
  le.group_id,
  le.title,
  le.start_at,
  le.is_cancelled,
  lem.manual_count;
