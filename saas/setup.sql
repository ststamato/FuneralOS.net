-- ============================================================
-- FuneralOS — Πλήρες Database Setup
-- Τρέξε ΟΛΟ αυτό το αρχείο μια φορά στο Supabase SQL Editor
-- Dashboard → SQL Editor → New query → Paste → Run
-- ============================================================

-- 1. profiles table (referral system)
create table if not exists public.profiles (
  id                  uuid references auth.users on delete cascade primary key,
  referral_code       text unique not null,
  referral_credits    integer not null default 0,
  referral_plan_until timestamptz,
  referred_by         text,
  created_at          timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile"   on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- 2. referrals table
create table if not exists public.referrals (
  id               uuid primary key default gen_random_uuid(),
  referral_code    text not null,
  referrer_id      uuid references auth.users,
  referred_user_id uuid references auth.users,
  referred_email   text,
  status           text not null default 'pending',
  created_at       timestamptz not null default now(),
  rewarded_at      timestamptz
);
alter table public.referrals enable row level security;
drop policy if exists "Users can view their referrals" on public.referrals;
create policy "Users can view their referrals" on public.referrals
  for select using (referrer_id = auth.uid());

-- 3. ai_usage table (server-side AI rate limiting)
create table if not exists public.ai_usage (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  calls_today smallint not null default 0,
  reset_date  date     not null default current_date
);
alter table public.ai_usage enable row level security;
drop policy if exists "Users view own ai usage" on public.ai_usage;
create policy "Users view own ai usage" on public.ai_usage
  for select using (auth.uid() = user_id);

-- 4. Helper: generate referral code from user UUID (e.g. FOS-A1B2C3)
create or replace function public.generate_referral_code(user_id uuid)
returns text language plpgsql as $$
begin
  return 'FOS-' || upper(substring(replace(user_id::text, '-', '') from 1 for 6));
end;
$$;

-- 5. Trigger: auto-create profile on new signup
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
    insert into public.referrals (referral_code, referred_user_id, referred_email, referrer_id)
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

-- 6. Trigger: reward referrer when referred user upgrades to paid plan
create or replace function public.reward_referrer_on_upgrade()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old_plan    text;
  v_new_plan    text;
  v_referred_by text;
begin
  v_old_plan := old.raw_user_meta_data->>'plan';
  v_new_plan := new.raw_user_meta_data->>'plan';
  if v_new_plan in ('pro', 'business')
     and (v_old_plan is null or v_old_plan not in ('pro', 'business')) then
    select referred_by into v_referred_by from public.profiles where id = new.id;
    if v_referred_by is not null and v_referred_by <> '' then
      update public.referrals
      set    status = 'rewarded', rewarded_at = now()
      where  referred_user_id = new.id and status = 'pending';
      update public.profiles
      set    referral_credits    = referral_credits + 1,
             referral_plan_until = greatest(coalesce(referral_plan_until, now()), now()) + interval '1 month'
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
  when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute procedure public.reward_referrer_on_upgrade();

-- 7. Backfill profiles for existing users (safe to re-run)
insert into public.profiles (id, referral_code)
select id, generate_referral_code(id)
from   auth.users
where  id not in (select id from public.profiles)
on conflict (id) do nothing;
