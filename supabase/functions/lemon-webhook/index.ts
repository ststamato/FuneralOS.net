// FuneralOS — Lemon Squeezy Webhook Handler
// Supabase Edge Function (Deno)
// Secrets needed: LEMON_SQUEEZY_WEBHOOK_SECRET, RESEND_API_KEY
// Optional:       FROM_EMAIL (default: FuneralOS <billing@funeralos.gr>)
// Auto-injected:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature",
};

// Map Lemon Squeezy product names → FuneralOS plan keys
const PRO_KEYWORDS      = ["pro"];
const BUSINESS_KEYWORDS = ["business"];

function getPlanFromProductName(name: string): "pro" | "business" | null {
  const n = (name || "").toLowerCase();
  if (BUSINESS_KEYWORDS.some(k => n.includes(k))) return "business";
  if (PRO_KEYWORDS.some(k => n.includes(k))) return "pro";
  return null;
}

async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const computed = Array.from(new Uint8Array(sigBuffer))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    return computed === signature;
  } catch {
    return false;
  }
}

async function findUserByEmail(
  supabaseUrl: string,
  serviceKey: string,
  email: string
): Promise<{ id: string; user_metadata: Record<string, unknown>; app_metadata: Record<string, unknown> } | null> {
  // Use server-side email filter instead of fetching all users
  const res = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}&per_page=1`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const users: Array<{ id: string; email: string; user_metadata: Record<string, unknown>; app_metadata: Record<string, unknown> }> =
    data.users || [];
  return users.find(u => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function setUserPlan(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  currentAppMeta: Record<string, unknown>,
  plan: string
): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    // Write to app_metadata (server-only) so clients cannot self-upgrade
    body: JSON.stringify({ app_metadata: { ...currentAppMeta, plan } }),
  });
  return res.ok;
}

async function rewardReferrer(
  supabaseUrl: string,
  serviceKey: string,
  referredUserId: string
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
  };

  // Find a pending referral where this user was referred
  const refRes = await fetch(
    `${supabaseUrl}/rest/v1/referrals?referred_id=eq.${referredUserId}&status=eq.pending&select=id,referrer_id`,
    { headers }
  );
  if (!refRes.ok) return;
  const refs = await refRes.json();
  if (!refs.length) return;

  const { id: referralId, referrer_id: referrerId } = refs[0];

  // Mark as rewarded (idempotent — next events won't find it)
  await fetch(`${supabaseUrl}/rest/v1/referrals?id=eq.${referralId}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ status: "rewarded" }),
  });

  // Load referrer's current credits & plan_until
  const profRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${referrerId}&select=referral_credits,referral_plan_until`,
    { headers }
  );
  if (!profRes.ok) return;
  const profs = await profRes.json();
  if (!profs.length) return;

  const currentCredits: number = profs[0].referral_credits || 0;
  const currentUntil: string | null = profs[0].referral_plan_until;

  // Extend plan_until by 1 month (stack on existing future date if any)
  const base = currentUntil && new Date(currentUntil) > new Date()
    ? new Date(currentUntil)
    : new Date();
  base.setMonth(base.getMonth() + 1);

  await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${referrerId}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({
      referral_credits: currentCredits + 1,
      referral_plan_until: base.toISOString(),
    }),
  });

  console.log(`Referral rewarded: referrer=${referrerId} credits=${currentCredits + 1} until=${base.toISOString()}`);
}

async function sendReceiptEmail(
  resendKey: string,
  toEmail: string,
  plan: string,
  productName: string
): Promise<void> {
  const planLabel = plan === "business" ? "Business" : "Pro";
  const from = Deno.env.get("FROM_EMAIL") || "FuneralOS <billing@funeralos.net>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [toEmail],
      subject: `✓ Your FuneralOS ${planLabel} plan is active`,
      html: `<div style="font-family:sans-serif;max-width:540px;margin:0 auto;background:#0f1523;color:#c8daf0;padding:32px;border-radius:12px;">
        <h1 style="color:#c8a96e;margin:0 0 4px;font-size:22px;">FuneralOS</h1>
        <h2 style="margin:0 0 24px;color:#fff;font-size:18px;">Your ${planLabel} plan is now active</h2>
        <p style="margin:0 0 16px;">Thank you for subscribing to <strong>FuneralOS ${planLabel}</strong>. Your account has been upgraded and all features are unlocked.</p>
        <div style="background:rgba(200,169,110,.1);border:1px solid rgba(200,169,110,.3);border-radius:8px;padding:16px;margin:0 0 24px;">
          <strong style="color:#c8a96e;">Plan:</strong> ${planLabel}<br>
          <strong style="color:#c8a96e;">Product:</strong> ${productName}<br>
          <strong style="color:#c8a96e;">Account:</strong> ${toEmail}
        </div>
        <p style="margin:0 0 8px;">Manage your subscription at any time from Settings in the app, or visit your <a href="https://app.lemonsqueezy.com/my-orders" style="color:#c8a96e;">Lemon Squeezy orders page</a>.</p>
        <p style="color:#8899aa;font-size:11px;margin-top:32px;border-top:1px solid rgba(255,255,255,.08);padding-top:16px;">FuneralOS — Professional funeral management software</p>
      </div>`,
    }),
  });
  if (!res.ok) console.warn(`Resend receipt email failed: ${res.status} ${await res.text()}`);
  else console.log(`Receipt email sent to ${toEmail}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const webhookSecret = Deno.env.get("LEMON_SQUEEZY_WEBHOOK_SECRET");
  const supabaseUrl   = Deno.env.get("SUPABASE_URL")!;
  const serviceKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey     = Deno.env.get("RESEND_API_KEY") || "";

  if (!webhookSecret) return new Response("LEMON_SQUEEZY_WEBHOOK_SECRET not set", { status: 500 });
  if (!serviceKey)    return new Response("SUPABASE_SERVICE_ROLE_KEY not set", { status: 500 });

  // Read raw body for signature verification
  const body      = await req.text();
  const signature = req.headers.get("X-Signature") || "";

  const valid = await verifySignature(webhookSecret, body, signature);
  if (!valid) {
    console.warn("Invalid webhook signature");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(body); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const meta        = (payload.meta as Record<string, unknown>) || {};
  const eventName   = (meta.event_name as string) || "";
  const customData  = (meta.custom_data as Record<string, unknown>) || {};
  const customUserId = (customData.user_id as string || "").trim();

  const attrs       = ((payload.data as Record<string, unknown>)?.attributes || {}) as Record<string, unknown>;
  const email       = (attrs.user_email as string || "").toLowerCase().trim();
  const productName = (attrs.product_name as string) || "";
  const status      = (attrs.status as string) || "";

  console.log(`Webhook: ${eventName} | product: ${productName} | status: ${status} | email: ${email} | custom_user_id: ${customUserId || "none"}`);

  if (!email && !customUserId) return new Response("OK", { status: 200 });

  // Determine target plan
  let targetPlan: string | null = null;

  if (["subscription_created", "subscription_updated", "subscription_resumed"].includes(eventName)) {
    if (status === "active" || status === "on_trial") {
      targetPlan = getPlanFromProductName(productName);
    }
  } else if (["subscription_cancelled", "subscription_expired", "subscription_paused"].includes(eventName)) {
    targetPlan = "free";
  } else if (eventName === "subscription_payment_recovered") {
    // Payment recovered after failure — re-activate the paid plan
    targetPlan = getPlanFromProductName(productName);
  } else if (eventName === "subscription_payment_failed") {
    // Payment failed but Lemon Squeezy will retry — do not downgrade yet; just log
    console.log(`Payment failed for ${email || customUserId}, product: ${productName} — awaiting retry`);
  } else if (eventName === "order_created") {
    // One-time purchase fallback — treat as pro upgrade
    targetPlan = getPlanFromProductName(productName) || "pro";
  }

  if (!targetPlan) {
    console.log(`No plan change needed for event: ${eventName}, status: ${status}`);
    return new Response("OK", { status: 200 });
  }

  // Resolve user — prefer custom_data.user_id (more reliable than email lookup)
  let userId: string | null = null;
  let userMeta: Record<string, unknown> = {};

  if (customUserId) {
    // Direct user ID from checkout custom data
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${customUserId}`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    });
    if (res.ok) {
      const u = await res.json();
      userId   = u.id;
      userMeta = u.app_metadata || {};
      console.log(`Resolved user by custom_user_id: ${userId}`);
    } else {
      console.warn(`custom_user_id ${customUserId} not found, falling back to email lookup`);
    }
  }

  if (!userId && email) {
    const user = await findUserByEmail(supabaseUrl, serviceKey, email);
    if (user) {
      userId   = user.id;
      userMeta = user.app_metadata || {};
      console.log(`Resolved user by email: ${userId}`);
    }
  }

  if (!userId) {
    console.warn(`No Supabase user found for email: ${email} or user_id: ${customUserId}`);
    return new Response("OK", { status: 200 }); // 200 to prevent LS retries
  }

  // Update plan
  const ok = await setUserPlan(supabaseUrl, serviceKey, userId, userMeta, targetPlan);
  console.log(`Plan update → ${targetPlan} for ${email || customUserId}: ${ok ? "OK" : "FAILED"}`);

  // Reward referrer on paid upgrade (pending referral becomes rewarded, +1 month)
  if (ok && targetPlan !== "free") {
    await rewardReferrer(supabaseUrl, serviceKey, userId);
    // Send receipt email for new subscriptions and one-time purchases
    if (resendKey && email && ["subscription_created", "order_created"].includes(eventName)) {
      await sendReceiptEmail(resendKey, email, targetPlan, productName);
    }
  }

  return new Response(JSON.stringify({ ok, plan: targetPlan }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
