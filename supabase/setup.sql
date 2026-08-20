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

-- Processed Lemon Squeezy webhook events (replay protection — service-role
-- access only). id = SHA-256 hash of the raw webhook body; a hash is only
-- recorded once its event has been fully, successfully processed, so a
-- retry of a genuinely failed delivery is never blocked.
create table if not exists processed_webhook_events (
  id          text primary key,
  received_at timestamptz default now()
);

-- Case document attachments (USA edition — see saas/usa.js). Stores a
-- reference to a file in the private 'case-documents' Storage bucket; one
-- row per (office, case, document type), replaced on re-upload.
create table if not exists case_documents (
  id           uuid primary key default gen_random_uuid(),
  office_id    uuid references auth.users(id) on delete cascade,
  case_id      text not null,
  doc_type     text not null,
  storage_path text not null,
  filename     text not null,
  uploaded_at  timestamptz default now(),
  uploaded_by  uuid references auth.users(id) on delete set null,
  unique (office_id, case_id, doc_type)
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
alter table processed_webhook_events enable row level security;
alter table case_documents enable row level security;

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

-- processed_webhook_events: no client policies — RLS blocks clients, service role bypasses RLS

-- case_documents: owner or office member (same model as ceremonies).
-- Needs insert + update policies (not just insert) because the client
-- upserts on (office_id, case_id, doc_type) when a document is replaced.
drop policy if exists "case_documents select" on case_documents;
drop policy if exists "case_documents insert" on case_documents;
drop policy if exists "case_documents update" on case_documents;
drop policy if exists "case_documents delete" on case_documents;
create policy "case_documents select" on case_documents
  for select using (office_id = auth.uid() or public.is_office_member(office_id));
create policy "case_documents insert" on case_documents
  for insert with check (office_id = auth.uid() or public.is_office_member(office_id));
create policy "case_documents update" on case_documents
  for update using (office_id = auth.uid() or public.is_office_member(office_id))
  with check (office_id = auth.uid() or public.is_office_member(office_id));
create policy "case_documents delete" on case_documents
  for delete using (office_id = auth.uid() or public.is_office_member(office_id));

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

-- ── Free plan: server-side ceremony limit ─────────────────────────────────────

create or replace function public.get_monthly_ceremony_count()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_row_id uuid;
  v_count  integer;
begin
  -- Mirror getCloudSession(): team members use the office owner's row
  select coalesce(
    nullif(raw_user_meta_data->>'office_id', '')::uuid,
    id
  )
  into v_row_id
  from auth.users
  where id = auth.uid();

  select count(*) into v_count
  from app_state,
    jsonb_array_elements(
      case jsonb_typeof(payload->'ceremonies')
        when 'array' then payload->'ceremonies'
        else '[]'::jsonb
      end
    ) as c
  where app_state.id = v_row_id
    and (c->>'date') is not null
    and (c->>'date') >= to_char(date_trunc('month', now()), 'YYYY-MM-DD');

  return coalesce(v_count, 0);
end;
$$;

grant execute on function public.get_monthly_ceremony_count() to authenticated;

-- ── Support Requests ──────────────────────────────────────────────────────────

create table if not exists support_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  subject     text not null,
  message     text not null,
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

alter table support_requests enable row level security;

create policy "user insert own support" on support_requests
  for insert with check (auth.uid() = user_id);

create policy "user read own support" on support_requests
  for select using (auth.uid() = user_id);

-- Admin notes per user (stored in profiles)
alter table profiles add column if not exists admin_notes text default '';

-- Per-user feature flags (toggled from admin panel, read by the app on login)
alter table profiles add column if not exists features jsonb not null default '{}'::jsonb;

-- ── Ceremonies (per-case rows — replaces app_state.payload.ceremonies) ────────
-- Fixes concurrent team-save data loss: app_state was one jsonb blob per office,
-- upserted whole on every save (last-write-wins at the blob level). Moving cases
-- to individual rows means two team members editing different cases never
-- collide; save_ceremony() below adds optimistic locking so even edits to the
-- SAME case turn into a detected conflict instead of a silent overwrite.

create table if not exists ceremonies (
  id         text not null,          -- reuse existing client-generated ids (nowTs().toString())
  office_id  uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Composite PK: id alone is NOT safe as the primary key. ids are client-
-- generated timestamps (nowTs().toString()), so two different offices can
-- generate the same id. With a global PK on id alone, if office B creates a
-- ceremony with an id office A already used, RLS hides A's row from B's
-- SELECT inside save_ceremony() ("not found" from B's perspective), B
-- attempts an INSERT, hits a unique violation on a row it can't even see,
-- and B's ceremony fails to save — permanently, since every retry hits the
-- same collision. Scoping the PK to (office_id, id) makes the same id
-- independently valid per office, closing this off entirely.
alter table ceremonies drop constraint if exists ceremonies_pkey;
alter table ceremonies add constraint ceremonies_pkey primary key (office_id, id);

create index if not exists ceremonies_office_id_idx   on ceremonies (office_id);
create index if not exists ceremonies_office_date_idx on ceremonies (office_id, (data->>'date'));

alter table ceremonies enable row level security;

drop policy if exists "ceremonies select" on ceremonies;
drop policy if exists "ceremonies insert" on ceremonies;
drop policy if exists "ceremonies update" on ceremonies;
drop policy if exists "ceremonies delete" on ceremonies;

-- Mirrors app_state's member policy. Delete is NOT owner-only here (unlike
-- app_state) — moving a single case to trash is a normal, low-blast-radius
-- editor action, not a wipe of the whole office's data.
create policy "ceremonies select" on ceremonies
  for select using (office_id = auth.uid() or public.is_office_member(ceremonies.office_id));
create policy "ceremonies insert" on ceremonies
  for insert with check (office_id = auth.uid() or public.is_office_member(ceremonies.office_id));
create policy "ceremonies update" on ceremonies
  for update using (office_id = auth.uid() or public.is_office_member(ceremonies.office_id));
create policy "ceremonies delete" on ceremonies
  for delete using (office_id = auth.uid() or public.is_office_member(ceremonies.office_id));

-- Authoritative plan lookup — mirrors the client fallback in freemium.js
-- (app_metadata is server-only, set by lemon-webhook on payment; clients
-- cannot self-upgrade it. user_metadata fallback is for accounts that were
-- upgraded before that fix).
create or replace function public.get_office_plan(p_office_id uuid)
returns text language sql security definer stable set search_path = public as $$
  select coalesce(raw_app_meta_data->>'plan', raw_user_meta_data->>'plan', 'free')
  from auth.users
  where id = p_office_id
    and (p_office_id = auth.uid() or public.is_office_member(p_office_id));
$$;

grant execute on function public.get_office_plan(uuid) to authenticated;

-- Optimistic-lock save: no `security definer`, so the RLS policies above are
-- what actually enforce access — this just adds compare-and-swap on updated_at.
-- Also the ONLY server-side enforcement of the free-plan monthly ceremony
-- limit: freemium.js blocks the form submit client-side, but that's trivially
-- bypassable by calling this RPC (or the old app_state upsert) directly with
-- a valid JWT, since RLS alone has no concept of plan/quota. Only gates new
-- inserts — never blocks saving edits to ceremonies that already exist, so a
-- downgrade never deletes/locks existing data.
drop function if exists public.save_ceremony(text, uuid, jsonb, timestamptz);
create or replace function public.save_ceremony(
  p_id text, p_office_id uuid, p_data jsonb, p_expected_updated_at timestamptz
) returns table(ok boolean, server_data jsonb, server_updated_at timestamptz, reason text)
language plpgsql set search_path = public as $$
declare
  v_cur ceremonies;
  v_new ceremonies;
  v_month_count integer;
begin
  select * into v_cur from ceremonies where id = p_id and office_id = p_office_id;

  if not found then
    -- FREE_CEREMONY_LIMIT mirror — keep in sync with saas/freemium.js and
    -- saas/en/freemium.js if this ever changes.
    if coalesce(public.get_office_plan(p_office_id), 'free') = 'free' then
      -- Serializes concurrent inserts for the same office within this
      -- transaction so two simultaneous new-ceremony saves can't both
      -- read the same pre-insert count and both slip past the cap.
      perform pg_advisory_xact_lock(hashtext(p_office_id::text));
      select count(*) into v_month_count
      from ceremonies
      where office_id = p_office_id
        and created_at >= date_trunc('month', now());
      if v_month_count >= 5 then
        return query select false, null::jsonb, null::timestamptz, 'quota_exceeded'::text;
        return;
      end if;
    end if;

    insert into ceremonies (id, office_id, data, updated_at, updated_by)
    values (p_id, p_office_id, p_data, now(), auth.uid())
    returning * into v_new;
    return query select true, null::jsonb, v_new.updated_at, null::text;
    return;
  end if;

  if p_expected_updated_at is null or v_cur.updated_at <> p_expected_updated_at then
    return query select false, v_cur.data, v_cur.updated_at, 'conflict'::text;
    return;
  end if;

  update ceremonies set data = p_data, updated_at = now(), updated_by = auth.uid()
    where id = p_id and office_id = p_office_id
    returning * into v_new;
  return query select true, null::jsonb, v_new.updated_at, null::text;
end;
$$;

grant execute on function public.save_ceremony(text, uuid, jsonb, timestamptz) to authenticated;

-- Optimistic-lock save for the rest of app_state (warehouse, settings,
-- changeLog, deletedCeremonies/trash, etc. — everything except ceremonies,
-- which have their own table + save_ceremony() above). Same failure mode as
-- Showstopper 2 applied here too: a blind upsert let two team members saving
-- concurrently silently clobber each other's warehouse/trash/settings edits.
-- No `security definer` — relies on the existing "app_state select/write/
-- update" RLS policies for access control, this just adds compare-and-swap.
create or replace function public.save_app_state(
  p_office_id uuid, p_payload jsonb, p_expected_updated_at timestamptz
) returns table(ok boolean, server_payload jsonb, server_updated_at timestamptz)
language plpgsql set search_path = public as $$
declare
  v_cur app_state;
  v_new app_state;
begin
  select * into v_cur from app_state where id = p_office_id;

  if not found then
    insert into app_state (id, payload, updated_at)
    values (p_office_id, p_payload, now())
    returning * into v_new;
    return query select true, null::jsonb, v_new.updated_at;
    return;
  end if;

  if p_expected_updated_at is null or v_cur.updated_at is distinct from p_expected_updated_at then
    return query select false, v_cur.payload, v_cur.updated_at;
    return;
  end if;

  update app_state set payload = p_payload, updated_at = now()
    where id = p_office_id
    returning * into v_new;
  return query select true, null::jsonb, v_new.updated_at;
end;
$$;

grant execute on function public.save_app_state(uuid, jsonb, timestamptz) to authenticated;

-- Free-plan monthly quota — now reads the ceremonies table instead of the
-- app_state jsonb blob (backfill below must run before this replaces the old
-- blob-reading version, otherwise it would count zero for everyone).
create or replace function public.get_monthly_ceremony_count()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_row_id uuid;
  v_count  integer;
begin
  select coalesce(nullif(raw_user_meta_data->>'office_id','')::uuid, id)
  into v_row_id
  from auth.users
  where id = auth.uid();

  select count(*) into v_count
  from ceremonies
  where office_id = v_row_id
    and created_at >= date_trunc('month', now());

  return coalesce(v_count, 0);
end;
$$;

grant execute on function public.get_monthly_ceremony_count() to authenticated;

-- One-time backfill from the old app_state.payload.ceremonies blob. Idempotent
-- (on conflict do nothing) — safe to re-run.
insert into ceremonies (id, office_id, data, updated_at, updated_by)
select c->>'id', a.id, (c - 'id'), now(), a.id
from app_state a, jsonb_array_elements(coalesce(a.payload->'ceremonies', '[]'::jsonb)) as c
where c->>'id' is not null
on conflict (office_id, id) do nothing;

-- Strip the now-migrated ceremonies key out of app_state.payload. This ran
-- as a deliberately-kept rollback net for a while (the client stopped
-- reading/writing it, but the stale data stayed in case anything needed
-- reverting) — now that the ceremonies table + client are confirmed working
-- in production, remove it for real. Leaving it in place indefinitely would
-- be actively unsafe: an office that later deletes every ceremony it has
-- would still have old (deleted) ones sitting in this stale key forever,
-- which is exactly the kind of thing that invites a bad "fall back to the
-- blob if the table looks empty" fix down the line — that fallback would
-- silently resurrect deleted ceremonies for any office that's legitimately
-- empty post-migration. Idempotent — a no-op once the key is gone.
update app_state set payload = payload - 'ceremonies' where payload ? 'ceremonies';

-- ── Storage: case document attachments (USA edition) ──────────────────────────
-- Private bucket; path convention is {office_id}/{case_id}/{filename}, so
-- policies can check the office_id folder segment directly.

insert into storage.buckets (id, name, public)
values ('case-documents', 'case-documents', false)
on conflict (id) do nothing;

drop policy if exists "case-documents storage insert" on storage.objects;
drop policy if exists "case-documents storage select" on storage.objects;
drop policy if exists "case-documents storage delete" on storage.objects;

create policy "case-documents storage insert" on storage.objects
  for insert with check (
    bucket_id = 'case-documents'
    and (
      (storage.foldername(name))[1]::uuid = auth.uid()
      or public.is_office_member((storage.foldername(name))[1]::uuid)
    )
  );

create policy "case-documents storage select" on storage.objects
  for select using (
    bucket_id = 'case-documents'
    and (
      (storage.foldername(name))[1]::uuid = auth.uid()
      or public.is_office_member((storage.foldername(name))[1]::uuid)
    )
  );

create policy "case-documents storage delete" on storage.objects
  for delete using (
    bucket_id = 'case-documents'
    and (
      (storage.foldername(name))[1]::uuid = auth.uid()
      or public.is_office_member((storage.foldername(name))[1]::uuid)
    )
  );
