-- ============================================================
-- Hesbah App — Feature #1: Smart Weight Tracker (EMA Trend),
-- Weekly Pace, Diet Styles & Goal Projection
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
-- ============================================================

-- 0. Ensure public.user_profiles exists first (in case supabase_migration.sql wasn't run yet)
create table if not exists public.user_profiles (
  user_id            uuid references auth.users on delete cascade not null primary key,
  gender             text check (gender in ('male', 'female')) default 'male',
  age                int default 25,
  height_cm          numeric default 170,
  weight_kg          numeric default 70,
  activity_level     text check (activity_level in ('sedentary', 'light', 'moderate', 'active')) default 'light',
  goal_type          text check (goal_type in ('lose', 'maintain', 'gain')) default 'maintain',
  target_weight_kg   numeric,
  weekly_pace_kg     numeric default 0.5,
  diet_style         text check (diet_style in ('balanced', 'high_protein', 'low_carb')) default 'balanced',
  target_calories    int default 2000,
  target_protein_g   int default 140,
  target_carbs_g     int default 200,
  target_fat_g       int default 65,
  is_custom_targets  boolean default false,
  updated_at         timestamp with time zone default now()
);

-- 1. Extend public.user_profiles if it already existed without the new columns
alter table public.user_profiles
  add column if not exists target_weight_kg numeric,
  add column if not exists weekly_pace_kg   numeric default 0.5,
  add column if not exists diet_style       text check (diet_style in ('balanced', 'high_protein', 'low_carb')) default 'balanced';

-- Row Level Security for public.user_profiles
alter table public.user_profiles enable row level security;

drop policy if exists "Users can view their own profile"   on public.user_profiles;
drop policy if exists "Users can insert their own profile" on public.user_profiles;
drop policy if exists "Users can update their own profile" on public.user_profiles;
drop policy if exists "Users can delete their own profile" on public.user_profiles;

create policy "Users can view their own profile"
  on public.user_profiles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own profile"
  on public.user_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.user_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own profile"
  on public.user_profiles for delete
  to authenticated
  using (auth.uid() = user_id);

-- Keep updated_at fresh on every update to public.user_profiles
create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_user_profiles_updated_at();

-- ============================================================
-- 2. Create public.weight_logs table for daily weight history & EMA trend
-- ============================================================
create table if not exists public.weight_logs (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null,
  logged_date date not null default current_date,
  weight_kg   numeric not null check (weight_kg >= 20 and weight_kg <= 400),
  source      text default 'manual',
  created_at  timestamp with time zone default now(),
  unique (user_id, logged_date)
);

create index if not exists weight_logs_user_date_idx
  on public.weight_logs (user_id, logged_date desc);

-- 3. Row Level Security for public.weight_logs
alter table public.weight_logs enable row level security;

drop policy if exists "Users can view their own weight logs"   on public.weight_logs;
drop policy if exists "Users can insert their own weight logs" on public.weight_logs;
drop policy if exists "Users can update their own weight logs" on public.weight_logs;
drop policy if exists "Users can delete their own weight logs" on public.weight_logs;

create policy "Users can view their own weight logs"
  on public.weight_logs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own weight logs"
  on public.weight_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own weight logs"
  on public.weight_logs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own weight logs"
  on public.weight_logs for delete
  to authenticated
  using (auth.uid() = user_id);
