-- ==========================================
-- Live Announcements (pinned notices)
-- ==========================================
create table if not exists public.live_announcements (
  id bigserial primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  title text not null,
  body text,
  event_id bigint references public.live_events(id) on delete set null,
  is_pinned boolean default false,
  active boolean default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.live_announcements enable row level security;

drop policy if exists "Allow authenticated for live_announcements" on public.live_announcements;
create policy "Allow authenticated for live_announcements"
on public.live_announcements for all
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');
