-- User link codes and HP profile linkage

create table if not exists public.user_link_codes (
  id bigserial primary key,
  code text not null unique,
  point_user_id uuid not null references auth.users on delete cascade,
  group_id bigint not null references public.groups(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  expires_at timestamptz not null default timezone('utc'::text, now()) + interval '1 day',
  used_at timestamptz,
  used_by_hp_user_id uuid references auth.users,
  used_by_external_user_id text
);

alter table public.user_link_codes enable row level security;

drop policy if exists "Point users can view link codes" on public.user_link_codes;
create policy "Point users can view link codes"
  on public.user_link_codes for select
  using (auth.uid() = point_user_id);

drop policy if exists "Point users can create link codes" on public.user_link_codes;
create policy "Point users can create link codes"
  on public.user_link_codes for insert
  with check (auth.uid() = point_user_id);

create table if not exists public.user_profile_links (
  id bigserial primary key,
  hp_user_id uuid not null references auth.users on delete cascade,
  point_user_id uuid not null references auth.users on delete cascade,
  group_id bigint not null references public.groups(id) on delete cascade,
  linked_at timestamptz not null default timezone('utc'::text, now()),
  unique (hp_user_id, group_id)
);

create table if not exists public.external_user_profile_links (
  id bigserial primary key,
  hp_user_id text not null,
  point_user_id uuid not null references auth.users on delete cascade,
  group_id bigint not null references public.groups(id) on delete cascade,
  linked_at timestamptz not null default timezone('utc'::text, now()),
  unique (hp_user_id, group_id)
);

alter table public.user_profile_links enable row level security;

drop policy if exists "HP users can view their links" on public.user_profile_links;
create policy "HP users can view their links"
  on public.user_profile_links for select
  using (auth.uid() = hp_user_id);

create or replace function public.claim_user_link_code(p_code text)
returns table (group_id bigint, point_user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code record;
  v_code_norm text;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  v_code_norm := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  if length(v_code_norm) < 8 then
    raise exception 'invalid_code_format';
  end if;

  select *
    into v_code
  from public.user_link_codes
  where regexp_replace(upper(code), '[^A-Z0-9]', '', 'g') = v_code_norm
    and used_at is null
    and expires_at > timezone('utc'::text, now())
  for update;

  if not found then
    raise exception 'invalid_or_expired_code';
  end if;

  insert into public.user_profile_links (hp_user_id, point_user_id, group_id, linked_at)
  values (auth.uid(), v_code.point_user_id, v_code.group_id, timezone('utc'::text, now()))
  on conflict (hp_user_id, group_id)
  do update set point_user_id = excluded.point_user_id, linked_at = excluded.linked_at;

  update public.user_link_codes
  set used_at = timezone('utc'::text, now()),
      used_by_hp_user_id = auth.uid()
  where id = v_code.id;

  return query select v_code.group_id, v_code.point_user_id;
end;
$$;

grant execute on function public.claim_user_link_code(text) to authenticated;

create or replace function public.claim_user_link_code_external(p_code text, p_hp_user_id text)
returns table (out_group_id bigint, point_user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code record;
  v_code_norm text;
begin
  v_code_norm := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  if length(v_code_norm) < 8 then
    raise exception 'invalid_code_format';
  end if;

  select *
    into v_code
  from public.user_link_codes
  where regexp_replace(upper(code), '[^A-Z0-9]', '', 'g') = v_code_norm
    and used_at is null
    and expires_at > timezone('utc'::text, now())
  for update;

  if not found then
    raise exception 'invalid_or_expired_code';
  end if;

  insert into public.external_user_profile_links (hp_user_id, point_user_id, group_id, linked_at)
  values (p_hp_user_id, v_code.point_user_id, v_code.group_id, timezone('utc'::text, now()))
  on conflict (hp_user_id, group_id)
  do update set point_user_id = excluded.point_user_id, linked_at = excluded.linked_at;

  update public.user_link_codes
  set used_at = timezone('utc'::text, now()),
      used_by_external_user_id = p_hp_user_id
  where id = v_code.id;

  return query select v_code.group_id as out_group_id, v_code.point_user_id;
end;
$$;

create or replace function public.get_linked_level_external(p_group_id bigint, p_hp_user_id text)
returns table (
  point_user_id uuid,
  group_id bigint,
  total_points integer,
  current_level integer,
  current_required integer,
  next_level integer,
  next_required integer,
  next_remaining integer
)
language sql
security definer
set search_path = public
as $$
  with link as (
    select point_user_id
    from public.external_user_profile_links
    where hp_user_id = p_hp_user_id
      and group_id = p_group_id
    limit 1
  ),
  membership as (
    select coalesce(total_points, 0) as total_points
    from public.user_memberships
    where user_id = (select point_user_id from link)
      and group_id = p_group_id
  ),
  configured as (
    select level, required_points
    from public.level_configs
    where group_id = p_group_id
  ),
  default_levels as (
    select gs as level,
           ((gs - 1) * (gs - 1) * 5 + (gs - 1) * 15)::int as required_points
    from generate_series(1, 100) gs
  ),
  levels as (
    select * from configured
    union all
    select * from default_levels
    where not exists (select 1 from configured)
  ),
  base as (
    select
      (select coalesce(total_points, 0) from membership) as total_points
  ),
  current_level as (
    select max(level) as level
    from levels, base
    where required_points <= base.total_points
  ),
  next_level as (
    select min(level) as level
    from levels, base
    where required_points > base.total_points
  ),
  current_required as (
    select required_points
    from levels
    where level = (select level from current_level)
  ),
  next_required as (
    select required_points
    from levels
    where level = (select level from next_level)
  )
  select
    (select point_user_id from link) as point_user_id,
    p_group_id as group_id,
    (select total_points from base) as total_points,
    coalesce((select level from current_level), 1) as current_level,
    coalesce((select required_points from current_required), 0) as current_required,
    coalesce((select level from next_level), coalesce((select level from current_level), 1)) as next_level,
    coalesce((select required_points from next_required), coalesce((select required_points from current_required), 0)) as next_required,
    greatest(0, coalesce((select required_points from next_required), coalesce((select required_points from current_required), 0)) - (select total_points from base)) as next_remaining
  ;
$$;

create or replace function public.get_linked_trophies_external(p_group_id bigint, p_hp_user_id text)
returns table (
  id bigint,
  name text,
  rarity text,
  condition_type text,
  threshold integer,
  event_id bigint,
  earned boolean
)
language sql
security definer
set search_path = public
as $$
  with link as (
    select point_user_id
    from public.external_user_profile_links
    where hp_user_id = p_hp_user_id
      and group_id = p_group_id
    limit 1
  ),
  summary as (
    select total_checked_in, max_streak
    from public.live_event_attendance_summary
    where user_id = (select point_user_id from link)::text
      and group_id = p_group_id
  )
  select
    t.id,
    t.name,
    t.rarity,
    t.condition_type,
    t.threshold,
    t.event_id,
    case
      when t.condition_type = 'TOTAL_ATTENDANCE' then coalesce((select total_checked_in from summary), 0) >= coalesce(t.threshold, 0)
      when t.condition_type = 'STREAK_ATTENDANCE' then coalesce((select max_streak from summary), 0) >= coalesce(t.threshold, 0)
      when t.condition_type = 'EVENT_ATTENDANCE' then t.event_id is not null and exists (
        select 1
        from public.live_event_checkins c
        where c.user_id = (select point_user_id from link)::text
          and c.group_id = p_group_id
          and c.event_id = t.event_id
      )
      else false
    end as earned
  from public.live_trophies t
  where t.group_id = p_group_id
  order by t.created_at asc;
$$;

create or replace function public.get_linked_level(p_group_id bigint)
returns table (
  point_user_id uuid,
  group_id bigint,
  total_points integer,
  current_level integer,
  current_required integer,
  next_level integer,
  next_required integer,
  next_remaining integer
)
language sql
security definer
set search_path = public
as $$
  with link as (
    select point_user_id
    from public.user_profile_links
    where hp_user_id = auth.uid()
      and group_id = p_group_id
    limit 1
  ),
  membership as (
    select coalesce(total_points, 0) as total_points
    from public.user_memberships
    where user_id = (select point_user_id from link)
      and group_id = p_group_id
  ),
  configured as (
    select level, required_points
    from public.level_configs
    where group_id = p_group_id
  ),
  default_levels as (
    select gs as level,
           ((gs - 1) * (gs - 1) * 5 + (gs - 1) * 15)::int as required_points
    from generate_series(1, 100) gs
  ),
  levels as (
    select * from configured
    union all
    select * from default_levels
    where not exists (select 1 from configured)
  ),
  base as (
    select
      (select coalesce(total_points, 0) from membership) as total_points
  ),
  current_level as (
    select max(level) as level
    from levels, base
    where required_points <= base.total_points
  ),
  next_level as (
    select min(level) as level
    from levels, base
    where required_points > base.total_points
  ),
  current_required as (
    select required_points
    from levels
    where level = (select level from current_level)
  ),
  next_required as (
    select required_points
    from levels
    where level = (select level from next_level)
  )
  select
    (select point_user_id from link) as point_user_id,
    p_group_id as group_id,
    (select total_points from base) as total_points,
    coalesce((select level from current_level), 1) as current_level,
    coalesce((select required_points from current_required), 0) as current_required,
    coalesce((select level from next_level), coalesce((select level from current_level), 1)) as next_level,
    coalesce((select required_points from next_required), coalesce((select required_points from current_required), 0)) as next_required,
    greatest(0, coalesce((select required_points from next_required), coalesce((select required_points from current_required), 0)) - (select total_points from base)) as next_remaining
  ;
$$;

grant execute on function public.get_linked_level(bigint) to authenticated;

create or replace function public.get_linked_trophies(p_group_id bigint)
returns table (
  id bigint,
  name text,
  rarity text,
  condition_type text,
  threshold integer,
  event_id bigint,
  earned boolean
)
language sql
security definer
set search_path = public
as $$
  with link as (
    select point_user_id
    from public.user_profile_links
    where hp_user_id = auth.uid()
      and group_id = p_group_id
    limit 1
  ),
  summary as (
    select total_checked_in, max_streak
    from public.live_event_attendance_summary
    where user_id = (select point_user_id from link)::text
      and group_id = p_group_id
  )
  select
    t.id,
    t.name,
    t.rarity,
    t.condition_type,
    t.threshold,
    t.event_id,
    case
      when t.condition_type = 'TOTAL_ATTENDANCE' then coalesce((select total_checked_in from summary), 0) >= coalesce(t.threshold, 0)
      when t.condition_type = 'STREAK_ATTENDANCE' then coalesce((select max_streak from summary), 0) >= coalesce(t.threshold, 0)
      when t.condition_type = 'EVENT_ATTENDANCE' then t.event_id is not null and exists (
        select 1
        from public.live_event_checkins c
        where c.user_id = (select point_user_id from link)::text
          and c.group_id = p_group_id
          and c.event_id = t.event_id
      )
      else false
    end as earned
  from public.live_trophies t
  where t.group_id = p_group_id
  order by t.created_at asc;
$$;

grant execute on function public.get_linked_trophies(bigint) to authenticated;
