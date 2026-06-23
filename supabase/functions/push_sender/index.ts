// Supabase Edge Function: push_sender
// V41.3 — Στέλνει Web Push σε ΟΛΕΣ τις εγγεγραμμένες συσκευές όταν κάποιος
// χρήστης αλλάζει κάτι, ώστε να έρχεται ειδοποίηση ακόμη κι όταν η εφαρμογή
// είναι κλειστή (όπως native iOS app — απαιτεί iOS 16.4+ και "Add to Home Screen").
//
// Το app.js ήδη καλεί αυτή τη συνάρτηση (EDGE_FUNCTION_PUSH_SENDER = "push_sender")
// με payload: { app_id, title, body, changes }. Μέχρι τώρα η συνάρτηση δεν υπήρχε,
// οπότε ο client αγνοούσε αθόρυβα την αποτυχία. Τώρα στέλνει πραγματικά push.
//
// ΧΡΥΣΟΙ ΚΑΝΟΝΕΣ:
// - Διαβάζει τις συνδρομές από το app_state.payload.pushSubs (όπου ήδη τις σώζει
//   ο client). Δεν προσθέτει καινούργια δομή δεδομένων.
// - Δεν αλλάζει/δεν διαγράφει δεδομένα της εφαρμογής.
// - Αν λείπουν τα VAPID κλειδιά ή αποτύχει η αποστολή, επιστρέφει ήρεμα — ο client
//   ούτως ή άλλως αγνοεί το αποτέλεσμα.

import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:ststamato@gmail.com";

type PushSub = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  device?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

// Διαβάζει τις συνδρομές push από το app_state (service role -> παρακάμπτει RLS).
async function loadSubscriptions(appId: string): Promise<PushSub[]> {
  if (!SUPABASE_URL || !SERVICE_KEY) return [];
  const url = `${SUPABASE_URL}/rest/v1/app_state?id=eq.${encodeURIComponent(appId)}&select=payload`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) return [];
  const rows = await res.json();
  const payload = rows?.[0]?.payload || {};
  const subs: PushSub[] = Array.isArray(payload.pushSubs) ? payload.pushSubs : [];
  return subs.filter((s) => s?.endpoint && s?.keys?.p256dh && s?.keys?.auth);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return json({ ok: false, error: "Λείπουν τα VAPID κλειδιά (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)." });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const body = await req.json().catch(() => ({}));
    const appId = String(body?.app_id || "main");
    const title = String(body?.title || "Σταυρακάκη — Νέα αλλαγή");
    const message = String(body?.body || "Υπάρχει νέα ενημέρωση στην εφαρμογή.");
    const changes: Array<{ device?: string }> = Array.isArray(body?.changes) ? body.changes : [];

    // Heuristic: αν όλες οι αλλαγές είναι από ΜΙΑ συσκευή, μην ειδοποιήσεις τη ΔΙΚΗ της
    // (ο χρήστης που έκανε την αλλαγή δεν χρειάζεται push για τον εαυτό του).
    const devices = new Set(changes.map((c) => String(c?.device || "")).filter(Boolean));
    const skipDevice = devices.size === 1 ? [...devices][0] : null;

    const subs = await loadSubscriptions(appId);
    if (!subs.length) return json({ ok: true, sent: 0, failed: 0, total: 0, note: "Καμία εγγεγραμμένη συσκευή." });

    const notifPayload = JSON.stringify({
      title,
      body: message,
      url: "./index.html",
      tag: "staurakaki-update",
    });

    let sent = 0;
    let failed = 0;
    const expired: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        if (skipDevice && s.device === skipDevice) return;
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint as string, keys: s.keys as { p256dh: string; auth: string } },
            notifPayload,
          );
          sent++;
        } catch (e) {
          failed++;
          const status = (e as any)?.statusCode;
          // 404/410 = η συνδρομή έχει λήξει/διαγραφεί στη συσκευή.
          if (status === 404 || status === 410) expired.push(s.endpoint as string);
        }
      }),
    );

    return json({ ok: true, sent, failed, total: subs.length, expired: expired.length });
  } catch (error) {
    return json({ ok: false, error: String((error as any)?.message || error) });
  }
});
