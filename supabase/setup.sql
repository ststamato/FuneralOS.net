-- FuneralOS — Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor → Run

-- ── App State (main data storage per user) ────────────────────────────────
create table if not exists app_state (
  id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- ── Office Events (real-time change log) ──────────────────────────────────
create table if not exists office_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null,
  payload jsonb,
  created_at timestamptz default now()
);

-- ── AI Usage (daily rate limiting) ───────────────────────────────────────
create table if not exists ai_usage (
  user_id text primary key,
  calls_today integer default 0,
  reset_date text
);

-- ── Profiles (referral system) ────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  referral_code text unique,
  referral_credits integer default 0,
  referral_plan_until timestamptz,
  created_at timestamptz default now()
);

-- ── Referrals ─────────────────────────────────────────────────────────────
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references auth.users(id) on delete cascade,
  referred_id uuid references auth.users(id) on delete cascade,
  status text default 'pending',
  created_at timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────
alter table app_state     enable row level security;
alter table office_events enable row level security;
alter table ai_usage      enable row level security;
alter table profiles      enable row level security;
alter table referrals     enable row level security;

-- app_state: each user can only read/write their own row
create policy "user own state" on app_state
  for all using (auth.uid() = id);

-- office_events: authenticated users can insert; read own
create policy "user own events" on office_events
  for all using (auth.uid() = user_id);

-- ai_usage: authenticated users can read/write their own
create policy "user own ai_usage" on ai_usage
  for all using (auth.uid()::text = user_id);

-- profiles: user reads/writes own
create policy "user own profile" on profiles
  for all using (auth.uid() = id);

-- referrals: user reads own referrals
create policy "user own referrals" on referrals
  for select using (auth.uid() = referrer_id or auth.uid() = referred_id);
create policy "insert referral" on referrals
  for insert with check (auth.uid() = referred_id);

-- ── Team / Multi-user ────────────────────────────────────────────────────

-- Update app_state RLS: allow user OR office member to access office's state
-- office_id in user JWT metadata = the admin's user_id whose app_state row they share
drop policy if exists "user own state" on app_state;
create policy "user or office member state access" on app_state
  for all using (
    id = auth.uid()
    or id = (auth.jwt() -> 'user_metadata' ->> 'office_id')::uuid
  );

-- Office members: who belongs to which office (office_id = admin's user_id)
create table if not exists office_members (
  id          uuid primary key default gen_random_uuid(),
  office_id   uuid references auth.users(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin', 'editor')),
  invited_by  uuid references auth.users(id) on delete set null,
  joined_at   timestamptz default now(),
  unique (office_id, user_id)
);

alter table office_members enable row level security;
create policy "office members see each other" on office_members
  for select using (
    office_id = auth.uid()
    or office_id = (auth.jwt() -> 'user_metadata' ->> 'office_id')::uuid
  );
create policy "office admin can remove members" on office_members
  for delete using (office_id = auth.uid());

-- Office invites (managed server-side via service role only)
create table if not exists office_invites (
  id          uuid primary key default gen_random_uuid(),
  office_id   uuid references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null check (role in ('admin', 'editor')),
  token       text unique not null default encode(gen_random_bytes(24), 'hex'),
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now(),
  expires_at  timestamptz default (now() + interval '7 days'),
  accepted_at timestamptz,
  unique (office_id, email)
);

alter table office_invites enable row level security;
-- No client-side RLS — all access via service role in Edge Functions

-- ── Auto-create profile on signup ─────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, referral_code)
  values (new.id, lower(substring(new.id::text, 1, 8)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
