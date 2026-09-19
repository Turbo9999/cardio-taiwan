-- CARDIO TAIWAN initial schema
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  official_url text,
  source_updated_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  source_name text default 'World Gym Taiwan',
  created_at timestamptz default now()
);

create table if not exists class_schedules (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  date date,
  start_time time,
  end_time time,
  room text,
  instructor text,
  source_url text,
  source_snapshot_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key,
  display_name text,
  instagram_handle text,
  theme_color text default '#ff4f86',
  xp integer not null default 0,
  streak_days integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  class_schedule_id uuid references class_schedules(id),
  class_name text not null,
  completed_at timestamptz default now(),
  xp_awarded integer not null default 300
);

create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  requirement_type text,
  requirement_value integer
);

create table if not exists user_badges (
  user_id uuid not null,
  badge_id uuid references badges(id) on delete cascade,
  unlocked_at timestamptz default now(),
  primary key(user_id,badge_id)
);

-- Community messages keep the public display name and optional Instagram handle
-- as a snapshot, so other members never need access to private profile rows.
create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  author_instagram text,
  city text not null,
  branch_name text not null,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

-- Safe to run after the original schema has already been applied.
alter table profiles add column if not exists instagram_handle text;
alter table profiles add column if not exists theme_color text default '#ff4f86';
alter table profiles add column if not exists is_admin boolean not null default false;

-- Account support: run this entire file in the Supabase SQL Editor once.
-- auth.users is managed by Supabase; this trigger creates a matching profile.
alter table profiles enable row level security;
alter table workouts enable row level security;
alter table user_badges enable row level security;
alter table community_posts enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop policy if exists "Users read own profile" on profiles;
drop policy if exists "Users update own profile" on profiles;
drop policy if exists "Users read own workouts" on workouts;
drop policy if exists "Users add own workouts" on workouts;
drop policy if exists "Users read own badges" on user_badges;
drop policy if exists "Anyone can read community posts" on community_posts;
drop policy if exists "Users add own community posts" on community_posts;

create policy "Users read own profile" on profiles for select using (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);
create policy "Users read own workouts" on workouts for select using (auth.uid() = user_id);
create policy "Users add own workouts" on workouts for insert with check (auth.uid() = user_id);
create policy "Users read own badges" on user_badges for select using (auth.uid() = user_id);
create policy "Anyone can read community posts" on community_posts for select using (true);
create policy "Users add own community posts" on community_posts for insert with check (auth.uid() = user_id);
grant select, update on public.profiles to authenticated;
grant select on public.community_posts to anon, authenticated;
grant insert on public.community_posts to authenticated;
notify pgrst, 'reload schema';

-- Verified workouts and aggregate leaderboards (new verified records only).
alter table workouts add column if not exists branch_name text;
alter table workouts add column if not exists city text;
alter table workouts add column if not exists class_start_at timestamptz;
alter table workouts add column if not exists verified boolean not null default false;
alter table workouts add column if not exists distance_meters integer;

create table if not exists search_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('city', 'branch_search')),
  label text not null,
  created_at timestamptz not null default now()
);
alter table search_events enable row level security;
drop policy if exists "Anyone can add search events" on search_events;
create policy "Anyone can add search events" on search_events for insert with check (true);
grant insert on public.search_events to anon, authenticated;

create or replace function public.leaderboard_stats()
returns table(kind text, label text, value bigint)
language sql security definer set search_path = public
as $$
  select 'popular_class', class_name, count(*) from workouts where verified group by class_name
  union all
  select 'member', coalesce(p.display_name, '運動夥伴'), count(*) from workouts w join profiles p on p.id = w.user_id where w.verified group by p.display_name
  union all
  select 'city', label, count(*) from search_events where kind = 'city' group by label
  union all
  select 'branch_search', label, count(*) from search_events where kind = 'branch_search' group by label
  union all
  select 'branch_complete', branch_name, count(*) from workouts where verified and branch_name is not null group by branch_name
  union all
  select 'activity', class_name, count(*) from workouts where verified group by class_name;
$$;
grant execute on function public.leaderboard_stats() to anon, authenticated;

-- Admin access. The application checks this field on the server, never in the browser alone.
-- This statement grants the initial administrator requested for this project.
update public.profiles p
set is_admin = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('pkddqq@gmail.com');
