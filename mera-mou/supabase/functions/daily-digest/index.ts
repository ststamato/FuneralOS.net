// Η Μέρα Μου — daily-digest Edge Function
//
// Invoked every hour by a pg_cron + pg_net job (see notifications.sql).
// For each stored push subscription whose local hour matches its
// notify_hour, computes the single most stress-relieving thing to
// know about today (a birthday/nameday, or the soonest due task/home/
// vehicle item) and sends ONE push notification. Sends nothing if
// there's nothing worth surfacing — silence is a feature here, not a bug.
//
// Deployed with verify_jwt=false: this function isn't user-facing, only
// pg_cron calls it, so it authenticates via a shared secret (checked
// against the x-cron-secret header) instead of a Supabase JWT. Both that
// secret and the VAPID keys live in Supabase Vault, readable only through
// the service-role-gated public.get_daily_digest_secrets() RPC — never as
// plain Edge Function env vars, and never in this repo.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const STR: Record<string, any> = {
  el: { appTitle: 'Η Μέρα Μου', today: 'σήμερα', tomorrow: 'αύριο', in: (n: number) => `σε ${n} ημέρες`,
    overdueOne: 'έληξε πριν 1 ημέρα', overdueMany: (n: number) => `έληξε πριν ${n} ημέρες`,
    birthday: (name: string) => `🎂 Σήμερα είναι τα γενέθλια της/του ${name}!`,
    nameday: (name: string) => `🎉 Σήμερα γιορτάζει η/ο ${name}!` },
  it: { appTitle: 'Η Μέρα Μου', today: 'oggi', tomorrow: 'domani', in: (n: number) => `tra ${n} giorni`,
    overdueOne: 'scaduto da 1 giorno', overdueMany: (n: number) => `scaduto da ${n} giorni`,
    birthday: (name: string) => `🎂 Oggi è il compleanno di ${name}!`,
    nameday: (name: string) => `🎉 Oggi è l'onomastico di ${name}!` },
  es: { appTitle: 'Η Μέρα Μου', today: 'hoy', tomorrow: 'mañana', in: (n: number) => `en ${n} días`,
    overdueOne: 'venció hace 1 día', overdueMany: (n: number) => `venció hace ${n} días`,
    birthday: (name: string) => `🎂 ¡Hoy es el cumpleaños de ${name}!`,
    nameday: (name: string) => `🎉 ¡Hoy es el onomástico de ${name}!` },
  fr: { appTitle: 'Η Μέρα Μου', today: 'aujourd’hui', tomorrow: 'demain', in: (n: number) => `dans ${n} jours`,
    overdueOne: 'expiré depuis 1 jour', overdueMany: (n: number) => `expiré depuis ${n} jours`,
    birthday: (name: string) => `🎂 C'est l'anniversaire de ${name} aujourd'hui !`,
    nameday: (name: string) => `🎉 C'est la fête de ${name} aujourd'hui !` },
  en: { appTitle: 'Η Μέρα Μου', today: 'today', tomorrow: 'tomorrow', in: (n: number) => `in ${n} days`,
    overdueOne: 'overdue by 1 day', overdueMany: (n: number) => `overdue by ${n} days`,
    birthday: (name: string) => `🎂 It's ${name}'s birthday today!`,
    nameday: (name: string) => `🎉 It's ${name}'s name day today!` }
};

function dueLabel(lang: string, days: number) {
  const s = STR[lang] || STR.el;
  if (days < 0) return Math.abs(days) === 1 ? s.overdueOne : s.overdueMany(Math.abs(days));
  if (days === 0) return s.today;
  if (days === 1) return s.tomorrow;
  return s.in(days);
}

function daysUntil(dateStr: string, nowInTz: Date) {
  const today = new Date(nowInTz);
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  if (isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function isTodayMonthDay(dateStr: string, nowInTz: Date) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return false;
  return d.getMonth() === nowInTz.getMonth() && d.getDate() === nowInTz.getDate();
}

function localHourAndDate(timezone: string): { hour: number; now: Date } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: 'numeric', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const hour = parseInt(map.hour, 10) % 24;
  const localAsIfUtc = new Date(`${map.year}-${map.month}-${map.day}T00:00:00Z`);
  return { hour, now: localAsIfUtc };
}

function pickMessage(lang: string, store: any, nowInTz: Date): string | null {
  const s = STR[lang] || STR.el;
  for (const m of store.family || []) {
    if (m.birthday && isTodayMonthDay(m.birthday, nowInTz)) return s.birthday(m.name);
    if (m.nameday && isTodayMonthDay(m.nameday, nowInTz)) return s.nameday(m.name);
  }

  const items: { title: string; days: number }[] = [];
  for (const t of store.tasks || []) {
    if (!t.done && t.dueDate) items.push({ title: t.title, days: daysUntil(t.dueDate, nowInTz)! });
  }
  for (const h of store.home || []) {
    if (h.dueDate) items.push({ title: h.title, days: daysUntil(h.dueDate, nowInTz)! });
  }
  for (const v of store.vehicles || []) {
    for (const [field, label] of [['kteo', 'ΚΤΕΟ'], ['insurance', 'Ασφάλεια'], ['service', 'Service'], ['fees', 'Τέλη']] as const) {
      if (v[field]) items.push({ title: `${label} — ${v.name}`, days: daysUntil(v[field], nowInTz)! });
    }
  }
  items.sort((a, b) => a.days - b.days);
  const soonest = items.find((i) => i.days !== null && i.days <= 3);
  if (!soonest) return null;
  return `${soonest.title} — ${dueLabel(lang, soonest.days)}`;
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: secrets, error: secretsError } = await supabase.rpc('get_daily_digest_secrets');
  if (secretsError || !secrets) return new Response(JSON.stringify({ error: 'secrets unavailable' }), { status: 500 });

  if (req.headers.get('x-cron-secret') !== secrets.daily_digest_cron_secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  webpush.setVapidDetails(secrets.vapid_subject, secrets.vapid_public_key, secrets.vapid_private_key);

  const { data: subs, error: subsError } = await supabase.from('push_subscriptions').select('*');
  if (subsError) return new Response(JSON.stringify({ error: subsError.message }), { status: 500 });

  let sent = 0, skipped = 0, removed = 0;

  for (const sub of subs || []) {
    const { hour, now } = localHourAndDate(sub.timezone || 'Europe/Athens');
    if (hour !== sub.notify_hour) { skipped++; continue; }

    const { data: row } = await supabase.from('mera_mou_data').select('data').eq('user_id', sub.user_id).maybeSingle();
    if (!row || !row.data) { skipped++; continue; }

    const lang = (row.data.profile && row.data.profile.lang) || 'el';
    const message = pickMessage(lang, row.data, now);
    if (!message) { skipped++; continue; }

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: (STR[lang] || STR.el).appTitle, body: message })
      );
      sent++;
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        removed++;
      }
    }
  }

  return new Response(JSON.stringify({ sent, skipped, removed }), { headers: { 'Content-Type': 'application/json' } });
});
