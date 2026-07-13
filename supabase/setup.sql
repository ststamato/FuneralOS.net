-- FuneralOS — Supabase Database Setup (Authoritative)
-- Run once in: Supabase Dashboard → SQL Editor → New query → Paste → Run
-- Safe to re-run: all statements are idempotent (IF NOT EXISTS / OR REPLACE / DROP IF EXISTS)

-- ── Utility ───────────────────────────────────────────────────────────────────

create or replace function public.generate_referral_code(p_user_id uuid)
returns text language plpgsql as $$
begin
  return 'FOS-' || upper(substring(replace(p_user_id::text, '-', '') from 1 for 6));
end;
$$;

-- ── Tables ────────────────────────────────────────────────────────────────────

-- App State (main data storage per user)
create table if not exists app_state (
  id         uuid primary key references auth.users(id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Office Events (real-time change log)
create table if not exists office_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  event_type text not null,
  payload    jsonb,
  created_at timestamptz default now()
);

-- AI Usage (daily rate limiting)
create table if not exists ai_usage (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  calls_today smallint not null default 0,
  reset_date  date     not null default current_date
);

-- Profiles (referral system)
create table if not exists profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  referral_code       text unique not null,
  referral_credits    integer not null default 0,
  referral_plan_until timestamptz,
  referred_by         text,
  created_at          timestamptz not null default now()
);

-- Referrals
create table if not exists referrals (
  id             uuid primary key default gen_random_uuid(),
  referral_code  text not null,
  referrer_id    uuid references auth.users(id) on delete cascade,
  referred_id    uuid references auth.users(id) on delete cascade,
  referred_email text,
  status         text not null default 'pending',
  created_at     timestamptz not null default now(),
  rewarded_at    timestamptz
);

-- Office Members (team / multi-user)
create table if not exists office_members (
  id         uuid primary key default gen_random_uuid(),
  office_id  uuid references auth.users(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin', 'editor')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at  timestamptz default now(),
  unique (office_id, user_id)
);

-- Office Invites (service-role access only — no client RLS policies)
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

-- ── RLS helper (SECURITY DEFINER breaks policy self-recursion) ───────────────

-- Used by office_members SELECT policy and by app_state/office_events policies.
-- Runs as the function owner (postgres) so RLS on office_members is bypassed
-- for the inner lookup, eliminating the infinite-recursion error.
create or replace function public.is_office_member(p_office_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.office_members
    where office_id = p_office_id
      and user_id   = auth.uid()
  );
$$;

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table app_state      enable row level security;
alter table office_events  enable row level security;
alter table ai_usage       enable row level security;
alter table profiles       enable row level security;
alter table referrals      enable row level security;
alter table office_members enable row level security;
alter table office_invites enable row level security;

-- app_state: role-differentiated access
drop policy if exists "user own state"                     on app_state;
drop policy if exists "user or office member state access" on app_state;
drop policy if exists "app_state select"                   on app_state;
drop policy if exists "app_state write"                    on app_state;
drop policy if exists "app_state update"                   on app_state;
drop policy if exists "app_state delete"                   on app_state;

-- Read: owner OR any office member (admin or editor)
create policy "app_state select" on app_state
  for select using (
    id = auth.uid()
    or public.is_office_member(app_state.id)
  );

-- Insert / Update: owner OR any office member (editors need to save work)
create policy "app_state write" on app_state
  for insert with check (
    id = auth.uid()
    or public.is_office_member(app_state.id)
  );
create policy "app_state update" on app_state
  for update using (
    id = auth.uid()
    or public.is_office_member(app_state.id)
  );

-- Delete: owner only (prevents editors from wiping all office data)
create policy "app_state delete" on app_state
  for delete using (id = auth.uid());

-- office_events: read all events in own office; write own events only
drop policy if exists "user own events"         on office_events;
drop policy if exists "office_events select"    on office_events;
drop policy if exists "office_events insert"    on office_events;

-- All office members see the whole office's event log
create policy "office_events select" on office_events
  for select using (
    user_id = auth.uid()
    or public.is_office_member(office_events.user_id)
    or public.is_office_member(auth.uid())
  );

-- Anyone can insert their own events
create policy "office_events insert" on office_events
  for insert with check (auth.uid() = user_id);

-- ai_usage
drop policy if exists "user own ai_usage"      on ai_usage;
drop policy if exists "Users view own ai usage" on ai_usage;
create policy "user own ai_usage" on ai_usage
  for all using (auth.uid() = user_id);

-- profiles: read own, insert own (fallback when trigger misses), update own
drop policy if exists "user own profile"             on profiles;
drop policy if exists "Users can view own profile"   on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can view own profile"   on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- referrals: read own (as referrer or referred); insert via trigger only
drop policy if exists "user own referrals"             on referrals;
drop policy if exists "insert referral"                on referrals;
drop policy if exists "Users can view their referrals" on referrals;
create policy "Users can view their referrals" on referrals
  for select using (referrer_id = auth.uid() or referred_id = auth.uid());

-- office_members: uses is_office_member() to avoid self-referential recursion
drop policy if exists "office members see each other"   on office_members;
drop policy if exists "office admin can remove members" on office_members;
create policy "office members see each other" on office_members
  for select using (
    office_id = auth.uid()
    or public.is_office_member(office_members.office_id)
  );
create policy "office admin can remove members" on office_members
  for delete using (office_id = auth.uid());

-- office_invites: no client policies — RLS blocks clients, service role bypasses RLS

-- ── Triggers ─────────────────────────────────────────────────────────────────

-- Auto-create profile on signup; record pending referral if referred_by is set
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ref_code    text;
  v_referred_by text;
begin
  v_ref_code    := generate_referral_code(new.id);
  v_referred_by := new.raw_user_meta_data->>'referred_by';
  insert into public.profiles (id, referral_code, referred_by)
  values (new.id, v_ref_code, v_referred_by)
  on conflict (id) do nothing;
  if v_referred_by is not null and v_referred_by <> '' then
    insert into public.referrals (referral_code, referred_id, referred_email, referrer_id)
    select v_referred_by, new.id, new.email, p.id
    from   public.profiles p
    where  p.referral_code = v_referred_by
    limit  1;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Reward referrer when referred user upgrades to a paid plan.
-- Reads from raw_app_meta_data (app_metadata, server-only) — not user_metadata.
-- Idempotent with the webhook's rewardReferrer(): whichever runs first marks
-- the referral 'rewarded'; the second finds nothing pending and is a no-op.
create or replace function public.reward_referrer_on_upgrade()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old_plan    text;
  v_new_plan    text;
  v_referred_by text;
begin
  v_old_plan := old.raw_app_meta_data->>'plan';
  v_new_plan := new.raw_app_meta_data->>'plan';
  if v_new_plan in ('pro', 'business')
     and (v_old_plan is null or v_old_plan not in ('pro', 'business')) then
    select referred_by into v_referred_by from public.profiles where id = new.id;
    if v_referred_by is not null and v_referred_by <> '' then
      update public.referrals
      set    status = 'rewarded', rewarded_at = now()
      where  referred_id = new.id and status = 'pending';
      update public.profiles
      set    referral_credits    = referral_credits + 1,
             referral_plan_until = greatest(coalesce(referral_plan_until, now()), now())
                                   + interval '1 month'
      where  referral_code = v_referred_by;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists on_user_plan_upgrade on auth.users;
create trigger on_user_plan_upgrade
  after update on auth.users
  for each row
  when (old.raw_app_meta_data is distinct from new.raw_app_meta_data)
  execute procedure public.reward_referrer_on_upgrade();

-- ── Backfill existing users ───────────────────────────────────────────────────

insert into public.profiles (id, referral_code)
select id, generate_referral_code(id)
from   auth.users
where  id not in (select id from public.profiles)
on conflict (id) do nothing;
