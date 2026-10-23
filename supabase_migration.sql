-- ============================================================
-- Hesbah App — Task 2: user_profiles (body stats + daily targets)
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
-- ============================================================

create table if not exists public.user_profiles (
  user_id            uuid references auth.users on delete cascade not null primary key,
  gender             text check (gender in ('male', 'female')) default 'male',
  age                int default 25,
  height_cm          numeric default 170,
  weight_kg          numeric default 70,
  activity_level     text check (activity_level in ('sedentary', 'light', 'moderate', 'active')) default 'light',
  goal_type          text check (goal_type in ('lose', 'maintain', 'gain')) default 'maintain',
  target_calories    int default 2000,
  target_protein_g   int default 140,
  target_carbs_g     int default 200,
  target_fat_g       int default 65,
  is_custom_targets  boolean default false,
  updated_at         timestamp with time zone default now()
);

-- ---------- Row Level Security ----------
alter table public.user_profiles enable row level security;

drop policy if exists "Users can view their own profile"   on public.user_profiles;
drop policy if exists "Users can insert their own profile" on public.user_profiles;
drop policy if exists "Users can update their own profile" on public.user_profiles;

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

-- ---------- Keep updated_at fresh on every update ----------
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
-- Task 3: Previous / Saved meals ("وجباتي السابقة")
-- Adds a personal note and a bookmark flag to meals.
-- Safe to re-run. The app works without it (localStorage fallback);
-- running it syncs notes & bookmarks across devices.
-- ============================================================

alter table public.meals add column if not exists custom_note text;
alter table public.meals add column if not exists is_saved boolean not null default false;

-- Fast lookup of a user's bookmarked meals
create index if not exists meals_user_saved_idx
  on public.meals (user_id)
  where is_saved;
