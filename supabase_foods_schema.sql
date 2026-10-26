-- ============================================================
-- Hesbah App — Task 0: foods table idempotent schema & policies
-- Safe to re-run in Supabase SQL editor without destructive drops.
-- ============================================================

-- 1. Create table if not exists
create table if not exists public.foods (
  id          uuid default gen_random_uuid() primary key,
  owner_id    uuid references auth.users(id) on delete set null,
  source      text not null default 'manual',
  name_en     text,
  name_ar     text,
  aliases     text[] default '{}',
  state       text default 'ready_to_eat',
  per_100g    jsonb not null default '{"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}'::jsonb,
  search_text text,
  created_at  timestamp with time zone default now()
);

-- 2. Ensure all columns exist idempotently if table already existed
alter table public.foods add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.foods add column if not exists source text not null default 'manual';
alter table public.foods add column if not exists name_en text;
alter table public.foods add column if not exists name_ar text;
alter table public.foods add column if not exists aliases text[] default '{}';
alter table public.foods add column if not exists state text default 'ready_to_eat';
alter table public.foods add column if not exists per_100g jsonb not null default '{"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}'::jsonb;
alter table public.foods add column if not exists search_text text;
alter table public.foods add column if not exists created_at timestamp with time zone default now();

-- 3. Indexes for fast search
create index if not exists foods_aliases_gin_idx on public.foods using gin (aliases);
create index if not exists foods_search_text_idx on public.foods (search_text);
create index if not exists foods_name_ar_idx on public.foods (name_ar);
create index if not exists foods_name_en_idx on public.foods (name_en);
create index if not exists foods_owner_id_idx on public.foods (owner_id);

-- 4. Row Level Security (RLS)
alter table public.foods enable row level security;

drop policy if exists "Public and custom foods are viewable by all" on public.foods;
drop policy if exists "Users can insert their own custom foods" on public.foods;
drop policy if exists "Users can update their own custom foods" on public.foods;
drop policy if exists "Users can delete their own custom foods" on public.foods;

-- Read policy: Anyone (anon or authenticated) can view global foods (owner_id is null)
-- and users can view their own private custom foods.
create policy "Public and custom foods are viewable by all"
  on public.foods for select
  to anon, authenticated
  using (owner_id is null or auth.uid() = owner_id);

-- Insert policy: Authenticated users can insert their own foods
create policy "Users can insert their own custom foods"
  on public.foods for insert
  to authenticated
  with check (auth.uid() = owner_id);

-- Update policy: Users can only update their own foods
create policy "Users can update their own custom foods"
  on public.foods for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Delete policy: Users can only delete their own foods
create policy "Users can delete their own custom foods"
  on public.foods for delete
  to authenticated
  using (auth.uid() = owner_id);
