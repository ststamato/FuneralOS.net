// FuneralOS — Lemon Squeezy Webhook Handler
// Supabase Edge Function (Deno)
// Secrets needed: LEMON_SQUEEZY_WEBHOOK_SECRET
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
): Promise<{ id: string; user_metadata: Record<string, unknown> } | null> {
  // Search users list (up to 1000) for matching email
  const res = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?per_page=1000`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const users: Array<{ id: string; email: string; user_metadata: Record<string, unknown> }> =
    data.users || [];
  return users.find(u => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function setUserPlan(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  currentMeta: Record<string, unknown>,
  plan: string
): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_metadata: { ...currentMeta, plan } }),
  });
  return res.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const webhookSecret = Deno.env.get("LEMON_SQUEEZY_WEBHOOK_SECRET");
  const supabaseUrl   = Deno.env.get("SUPABASE_URL")!;
  const serviceKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

  const eventName   = (payload.meta as Record<string, unknown>)?.event_name as string || "";
  const attrs       = ((payload.data as Record<string, unknown>)?.attributes || {}) as Record<string, unknown>;
  const email       = (attrs.user_email as string || "").toLowerCase().trim();
  const productName = (attrs.product_name as string) || "";
  const status      = (attrs.status as string) || "";

  console.log(`Webhook: ${eventName} | product: ${productName} | status: ${status} | email: ${email}`);

  if (!email) return new Response("OK", { status: 200 });

  // Determine target plan
  let targetPlan: string | null = null;

  if (["subscription_created", "subscription_updated", "subscription_resumed"].includes(eventName)) {
    if (status === "active" || status === "on_trial") {
      targetPlan = getPlanFromProductName(productName);
    }
  } else if (["subscription_cancelled", "subscription_expired"].includes(eventName)) {
    targetPlan = "free";
  }

  if (!targetPlan) {
    console.log(`No plan change needed for event: ${eventName}, status: ${status}`);
    return new Response("OK", { status: 200 });
  }

  // Find user by email
  const user = await findUserByEmail(supabaseUrl, serviceKey, email);
  if (!user) {
    console.warn(`No Supabase user found for email: ${email}`);
    return new Response("OK", { status: 200 }); // 200 to prevent LS retries
  }

  // Update plan
  const ok = await setUserPlan(supabaseUrl, serviceKey, user.id, user.user_metadata || {}, targetPlan);
  console.log(`Plan update → ${targetPlan} for ${email}: ${ok ? "OK" : "FAILED"}`);

  return new Response(JSON.stringify({ ok, plan: targetPlan }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
