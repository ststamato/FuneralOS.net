-- ============================================================
-- Η Μέρα Μου — Supabase setup για συγχρονισμό συσκευών
-- Τρέξε ΟΛΟ αυτό το αρχείο μια φορά στο Supabase SQL Editor
-- Dashboard → SQL Editor → New query → Paste → Run
-- ============================================================

create table if not exists public.mera_mou_data (
  user_id    uuid references auth.users(id) on delete cascade primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.mera_mou_data enable row level security;

drop policy if exists "Users can view own data"   on public.mera_mou_data;
drop policy if exists "Users can insert own data" on public.mera_mou_data;
drop policy if exists "Users can update own data"  on public.mera_mou_data;

create policy "Users can view own data" on public.mera_mou_data
  for select using (auth.uid() = user_id);

create policy "Users can insert own data" on public.mera_mou_data
  for insert with check (auth.uid() = user_id);

create policy "Users can update own data" on public.mera_mou_data
  for update using (auth.uid() = user_id);
