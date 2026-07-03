// FuneralOS — Push Notification Sender
// Supabase Edge Function (Deno)
// Secrets needed: VAPID_PRIVATE_KEY  (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected)

import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY =
  "BK7NS0ErC-xKQaTiBFm48qDEZE9IZZtbWvTqgAQCrZMGTjzxZtZ2eDvVsJAL7jIvga47TZyc6c-fAtOgijKOLKM";
const VAPID_SUBJECT = "mailto:Funeralos.net@gmail.com";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!vapidPrivate) return json({ error: "VAPID_PRIVATE_KEY not set" }, 500);
  if (!serviceKey)   return json({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }, 500);

  // Authenticate caller — must be a valid Supabase JWT
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
  });
  if (!userRes.ok) return json({ error: "Invalid auth token" }, 401);
  const user = await userRes.json();
  const userId = user?.id as string | null;
  if (!userId) return json({ error: "Could not identify user" }, 401);

  // Parse notification payload
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const title   = String(body.title  || "FuneralOS");
  const message = String(body.body   || "Νέα αλλαγή");

  // Load push subscriptions from this user's app_state
  const h = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  const stateRes = await fetch(
    `${supabaseUrl}/rest/v1/app_state?id=eq.${userId}&select=payload`,
    { headers: h }
  );
  const rows: any[] = stateRes.ok ? await stateRes.json() : [];
  const pushSubs: any[] = Array.isArray(rows[0]?.payload?.pushSubs) ? rows[0].payload.pushSubs : [];

  if (pushSubs.length === 0) {
    return json({ ok: true, sent: 0, message: "No subscriptions found" });
  }

  // Configure VAPID
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, vapidPrivate);

  const notifPayload = JSON.stringify({ title, body: message });
  let sent = 0;
  let failed = 0;
  const expired: string[] = [];

  await Promise.allSettled(
    pushSubs.map(async (sub: any) => {
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          notifPayload
        );
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          // Subscription expired — mark for removal
          expired.push(sub.endpoint);
        }
        failed++;
        console.warn("Push failed:", sub.device, err?.statusCode);
      }
    })
  );

  // Remove expired subscriptions from app_state
  if (expired.length > 0 && rows[0]?.payload) {
    const updatedSubs = pushSubs.filter((s: any) => !expired.includes(s.endpoint));
    const updatedPayload = { ...rows[0].payload, pushSubs: updatedSubs };
    await fetch(`${supabaseUrl}/rest/v1/app_state?id=eq.${userId}`, {
      method: "PATCH",
      headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify({ payload: updatedPayload }),
    }).catch(() => {});
  }

  return json({ ok: true, sent, failed, expired: expired.length });
});
