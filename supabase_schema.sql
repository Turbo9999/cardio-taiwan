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
