// FuneralOS — RevenueCat Webhook Handler (native iOS/Android IAP)
// Supabase Edge Function (Deno)
// Secrets needed: REVENUECAT_WEBHOOK_AUTH  (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY auto-injected)
//
// Structural twin of lemon-webhook/index.ts, for the native purchase path:
// RevenueCat wraps Apple IAP + Google Play Billing and fires one webhook per
// purchase/renewal/cancellation event. The native app calls
// Purchases.logIn(supabaseUserId) right after auth succeeds, so
// event.app_user_id IS the Supabase user UUID directly — no email-matching
// fallback needed here, unlike lemon-webhook's findUserByEmail path.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// entitlement_ids are configured in the RevenueCat dashboard to match this
// app's plan names directly ("pro"/"business").
function getPlanFromEntitlements(entitlementIds: string[]): "pro" | "business" | null {
  if (entitlementIds.includes("business")) return "business";
  if (entitlementIds.includes("pro")) return "pro";
  return null;
}

// Same pattern as lemon-webhook's setUserPlan() — writes app_metadata.plan
// (server-only field, the one source of truth read by every client and the
// save_ceremony()/get_office_plan() RPCs) so a user's plan stays consistent
// whether they purchased on web, iOS, or Android.
async function setUserPlan(
  supabaseUrl: string, serviceKey: string, userId: string,
  currentAppMeta: Record<string, unknown>, plan: string
): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
    body: JSON.stringify({ app_metadata: { ...currentAppMeta, plan } }),
  });
  return res.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const webhookAuth = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!webhookAuth) return new Response("REVENUECAT_WEBHOOK_AUTH not set", { status: 500 });
  if (!serviceKey)  return new Response("SUPABASE_SERVICE_ROLE_KEY not set", { status: 500 });

  const authHeader = req.headers.get("Authorization") || "";
  const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!provided || !timingSafeEqual(provided, webhookAuth)) {
    console.warn("Invalid RevenueCat webhook auth");
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(await req.text()); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const event = (payload.event as Record<string, unknown>) || {};
  const eventType = (event.type as string) || "";
  const appUserId = (event.app_user_id as string || "").trim();
  const entitlementIds = Array.isArray(event.entitlement_ids) ? (event.entitlement_ids as string[]) : [];

  console.log(`RevenueCat webhook: ${eventType} | app_user_id: ${appUserId || "none"} | entitlements: ${entitlementIds.join(",") || "none"}`);

  if (!appUserId) return new Response("OK", { status: 200 });

  // EXPIRATION = subscription actually lapsed → downgrade. CANCELLATION only
  // means auto-renew was turned off — access continues until period end, so
  // it must NOT downgrade immediately (mirrors lemon-webhook's caution around
  // subscription_payment_failed: don't act until the access genuinely ends).
  // BILLING_ISSUE is a retry-in-progress state, same reasoning — no action.
  let targetPlan: string | null = null;
  if (eventType === "EXPIRATION") {
    targetPlan = "free";
  } else if (["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION", "NON_RENEWING_PURCHASE"].includes(eventType)) {
    targetPlan = getPlanFromEntitlements(entitlementIds);
  }

  if (!targetPlan) {
    console.log(`No plan change needed for event: ${eventType}`);
    return new Response("OK", { status: 200 });
  }

  const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${appUserId}`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  if (!userRes.ok) {
    console.warn(`RevenueCat webhook: no Supabase user found for app_user_id ${appUserId}`);
    // Same reasoning as lemon-webhook's unmatched-user path: acknowledge with
    // 200 so RevenueCat doesn't retry forever on a permanently-unmatchable
    // id, but this should be rare since app_user_id is set via logIn() with
    // the real Supabase uuid, not a guest/anonymous RevenueCat id.
    return new Response("OK", { status: 200 });
  }
  const user = await userRes.json();
  const currentAppMeta = user.app_metadata || {};

  const ok = await setUserPlan(supabaseUrl, serviceKey, appUserId, currentAppMeta, targetPlan);
  console.log(`Plan update → ${targetPlan} for ${appUserId}: ${ok ? "OK" : "FAILED"}`);

  return new Response(JSON.stringify({ ok, plan: targetPlan }), {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
});
