// FuneralOS — Push Notification Sender
// Supabase Edge Function (Deno)
// Secrets needed: VAPID_PRIVATE_KEY  (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected)

import webpush from "npm:web-push@3.6.7";

// Capacitor's default WebView origins (iOS: capacitor://localhost, Android:
// https://localhost) — echoed back only when they match, so responses to the
// web app keep getting the plain funeralos.net origin. Computed per-request
// (never a shared module-level object) since concurrent requests in the same
// warm isolate would otherwise race on a mutable CORS value.
const ALLOWED_ORIGINS = ["https://funeralos.net", "capacitor://localhost", "https://localhost"];
function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "https://funeralos.net";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

const VAPID_PUBLIC_KEY =
  "BOojYoP_CZywpO3AHQOvrGMr4C_EM97h-0UelIXrwE8drhzBnGgQYIRItc7GGASr8Y8dxTWAFQTSCplSzTHnELo";
const VAPID_SUBJECT = "mailto:Funeralos.net@gmail.com";

// ── Native push (Capacitor iOS/Android apps) via Firebase Cloud Messaging ──
// FCM's legacy server-key API was shut down by Google in June 2024 — HTTP v1
// requires a short-lived OAuth2 access token, obtained here by signing a JWT
// with the service account's private key (Web Crypto, no npm dependency).
async function getFcmAccessToken(serviceAccountJson: string): Promise<string | null> {
  try {
    const sa = JSON.parse(serviceAccountJson) as { client_email: string; private_key: string };
    const now = Math.floor(Date.now() / 1000);
    const b64url = (bytes: string) =>
      btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claim = b64url(JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }));
    const unsigned = `${header}.${claim}`;
    const pemBody = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
    const derBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      "pkcs8", derBytes.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
    const sig = b64url(String.fromCharCode(...new Uint8Array(sigBuf)));
    const jwt = `${unsigned}.${sig}`;

    const tokRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    if (!tokRes.ok) { console.warn("FCM token exchange failed", await tokRes.text()); return null; }
    const tokData = await tokRes.json();
    return tokData.access_token as string;
  } catch (e) {
    console.warn("FCM auth error", e);
    return null;
  }
}

async function sendFcm(
  projectId: string, accessToken: string, token: string, title: string, body: string
): Promise<{ ok: boolean; expired: boolean }> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { token, notification: { title, body } } }),
  });
  if (res.ok) return { ok: true, expired: false };
  const errBody = await res.text().catch(() => "");
  const expired = res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(errBody);
  return { ok: false, expired };
}

Deno.serve(async (req: Request) => {
  const CORS = corsHeaders(req.headers.get("Origin"));
  function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

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

  // The caller (sendEdgePushBatch in app.js) always sends a real,
  // locale-appropriate title/body — this function has no locale info of its
  // own, so the fallback is deliberately brand-neutral rather than Greek.
  const title   = String(body.title  || "FuneralOS");
  const message = String(body.body   || "Update");

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

  // Configure VAPID
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, vapidPrivate);

  const notifPayload = JSON.stringify({ title, body: message });
  let sent = 0;
  let failed = 0;
  const expired: string[] = [];

  // Web push only runs if there are subscriptions — must NOT early-return
  // when empty, since a user could have zero web subs but real native
  // (iOS/Android) tokens below.
  if (pushSubs.length > 0) {
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
  }

  // Remove expired subscriptions — via a targeted RPC (jsonb_set on just
  // pushSubs, evaluated against the row's current value at UPDATE time), not
  // a blind read-then-PATCH of the whole payload, which could otherwise
  // clobber a concurrent warehouse/settings/trash save that happened while
  // these pushes were being sent.
  if (expired.length > 0) {
    await fetch(`${supabaseUrl}/rest/v1/rpc/remove_expired_push_subs`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ p_office_id: userId, p_expired_endpoints: expired }),
    }).catch((e) => console.warn("Failed to remove expired push subs", e));
  }

  // Native push (Capacitor iOS/Android) — separate token store, FCM transport.
  // Silently skipped (not an error) if the app has no native tokens yet, or
  // the FCM service account secret hasn't been provisioned — web push above
  // still works either way.
  let nativeSent = 0;
  let nativeFailed = 0;
  const fcmServiceAccount = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (fcmServiceAccount) {
    const nativeRes = await fetch(
      `${supabaseUrl}/rest/v1/native_push_tokens?office_id=eq.${userId}&select=token`,
      { headers: h }
    );
    const nativeTokens: Array<{ token: string }> = nativeRes.ok ? await nativeRes.json() : [];
    if (nativeTokens.length) {
      const projectId = (JSON.parse(fcmServiceAccount) as { project_id: string }).project_id;
      const accessToken = await getFcmAccessToken(fcmServiceAccount);
      if (accessToken) {
        const expiredTokens: string[] = [];
        await Promise.allSettled(
          nativeTokens.map(async ({ token: fcmToken }) => {
            const result = await sendFcm(projectId, accessToken, fcmToken, title, message);
            if (result.ok) nativeSent++;
            else {
              nativeFailed++;
              if (result.expired) expiredTokens.push(fcmToken);
            }
          })
        );
        if (expiredTokens.length) {
          const inList = expiredTokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(",");
          await fetch(
            `${supabaseUrl}/rest/v1/native_push_tokens?office_id=eq.${userId}&token=in.(${inList})`,
            { method: "DELETE", headers: h }
          ).catch((e) => console.warn("Failed to remove expired native push tokens", e));
        }
      }
    }
  }

  return json({
    ok: true,
    sent: sent + nativeSent,
    failed: failed + nativeFailed,
    expired: expired.length,
  });
});
