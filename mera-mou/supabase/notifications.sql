-- ============================================================
-- Η Μέρα Μου — Καθημερινή ειδοποίηση (push notifications)
-- Τρέξε ΜΕΤΑ το setup.sql, μια φορά, στο Supabase SQL Editor.
--
-- Ήδη εφαρμοσμένο στο τρέχον project (csbbnngpiogbvhnaenjo). Αυτό το
-- αρχείο υπάρχει για να μπορεί να αναπαραχθεί σε νέο project (π.χ. στον
-- ξεχωριστό οργανισμό πριν το launch) — δες docs/design.md.
-- ============================================================

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  timezone    text not null default 'Europe/Athens',
  notify_hour int not null default 8 check (notify_hour between 0 and 23),
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;

create policy "Users manage own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Secrets: VAPID keys + a shared secret for the cron→function call live
-- in Supabase Vault, never as plain Edge Function env vars and never in
-- this repo. Generate a VAPID key pair (e.g. `npx web-push generate-
-- vapid-keys`) and a random cron secret (`openssl rand -hex 32`), then:
--
-- select vault.create_secret('<VAPID_PUBLIC_KEY>',  'vapid_public_key',  'Η Μέρα Μου — VAPID public key');
-- select vault.create_secret('<VAPID_PRIVATE_KEY>', 'vapid_private_key', 'Η Μέρα Μου — VAPID private key');
-- select vault.create_secret('mailto:you@example.com', 'vapid_subject', 'Η Μέρα Μου — VAPID subject contact');
-- select vault.create_secret('<RANDOM_HEX_SECRET>', 'daily_digest_cron_secret', 'Η Μέρα Μου — shared secret so only our own pg_cron job can trigger daily-digest');
--
-- create or replace function public.get_daily_digest_secrets()
-- returns jsonb
-- language sql
-- security definer
-- set search_path = vault, public
-- as $$
--   select jsonb_object_agg(name, decrypted_secret)
--   from vault.decrypted_secrets
--   where name in ('vapid_public_key', 'vapid_private_key', 'vapid_subject', 'daily_digest_cron_secret');
-- $$;
--
-- revoke all on function public.get_daily_digest_secrets() from public, anon, authenticated;
-- grant execute on function public.get_daily_digest_secrets() to service_role;
--
-- The public key also goes in app/config.js (vapidPublicKey) — that one
-- is meant to be public, it's the private key + cron secret that stay
-- vault-only.

-- ------------------------------------------------------------
-- Deploy the Edge Function (supabase/functions/daily-digest) with
-- verify_jwt=false — it isn't user-facing, pg_cron is the only caller,
-- authenticated via the x-cron-secret header instead of a Supabase JWT.
--
-- Then enable pg_cron + pg_net and schedule the hourly trigger:

-- create extension if not exists pg_cron with schema extensions;
-- create extension if not exists pg_net with schema extensions;
--
-- select cron.schedule(
--   'mera-mou-daily-digest',
--   '0 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/daily-digest',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'daily_digest_cron_secret')
--     )
--   );
--   $$
-- );
