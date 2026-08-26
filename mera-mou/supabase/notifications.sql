-- ============================================================
-- Η Μέρα Μου — Καθημερινή ειδοποίηση (push notifications)
-- Τρέξε ΜΕΤΑ το setup.sql, μια φορά, στο Supabase SQL Editor.
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

-- Ώρα-ανά-ώρα trigger: καλεί το deployed Edge Function "daily-digest".
-- Αντικατέστησε <PROJECT_REF> και <ANON_OR_SERVICE_KEY> πριν το τρέξεις
-- (χρειάζεται τα extensions pg_cron και pg_net ενεργά — Database →
-- Extensions στο dashboard, ή θα τα ενεργοποιήσουμε μαζί όταν κάνουμε
-- deploy το function).
--
-- select cron.schedule(
--   'mera-mou-daily-digest',
--   '0 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/daily-digest',
--     headers := jsonb_build_object('Authorization', 'Bearer <ANON_OR_SERVICE_KEY>', 'Content-Type', 'application/json')
--   );
--   $$
-- );
