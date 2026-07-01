// FuneralOS — Admin Stats Edge Function
// Supabase Edge Function (Deno)
// Env vars needed: SUPABASE_SERVICE_ROLE_KEY  (SUPABASE_URL is auto-injected)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OWNER_EMAILS = ["ststamato@gmail.com"];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function verifyOwner(
  authHeader: string,
  supabaseUrl: string,
  serviceKey: string
): Promise<string | null> {
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return OWNER_EMAILS.includes(user.email) ? (user.email as string) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const ownerEmail = await verifyOwner(authHeader, supabaseUrl, serviceKey);
  if (!ownerEmail) return json({ error: "Unauthorized" }, 403);

  const body: Record<string, unknown> = req.method === "POST"
    ? await req.json().catch(() => ({}))
    : {};
  const action = (body.action as string) || "list";

  const h = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
  };

  try {
    // ── LIST ALL USERS + stats ────────────────────────────────────────────────
    if (action === "list") {
      const [usersRes, aiRes, profilesRes, referralsRes] = await Promise.all([
        fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, { headers: h }),
        fetch(`${supabaseUrl}/rest/v1/ai_usage?select=user_id,calls_today,reset_date`, { headers: h }),
        fetch(`${supabaseUrl}/rest/v1/profiles?select=id,referral_code,referral_credits,referral_plan_until`, { headers: h }),
        fetch(`${supabaseUrl}/rest/v1/referrals?select=referrer_id&status=eq.rewarded`, { headers: h }),
      ]);

      const usersData   = await usersRes.json();
      const aiRows      = aiRes.ok      ? await aiRes.json()      : [];
      const profiles    = profilesRes.ok ? await profilesRes.json() : [];
      const referrals   = referralsRes.ok ? await referralsRes.json() : [];

      // Build lookup maps
      const aiMap: Record<string, { calls_today: number; reset_date: string }> = {};
      for (const r of aiRows) aiMap[r.user_id] = r;

      const profileMap: Record<string, {
        referral_code: string; referral_credits: number; referral_plan_until: string | null;
      }> = {};
      for (const p of profiles) profileMap[p.id] = p;

      const refCountMap: Record<string, number> = {};
      for (const r of referrals) {
        refCountMap[r.referrer_id] = (refCountMap[r.referrer_id] || 0) + 1;
      }

      const today = new Date().toISOString().split("T")[0];

      const users = (usersData.users || []).map((u: Record<string, unknown>) => {
        const meta = (u.raw_user_metadata as Record<string, unknown>) || {};
        const ai   = aiMap[u.id as string] || null;
        return {
          id:              u.id,
          email:           u.email,
          plan:            (meta.plan as string) || "free",
          office_name:     (meta.office_name as string) || "",
          created_at:      u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          ai_calls_today:  ai?.reset_date === today ? Number(ai.calls_today) : 0,
          referral:        profileMap[u.id as string] || null,
          referral_count:  refCountMap[u.id as string] || 0,
        };
      });

      return json({ users });
    }

    // ── SET PLAN ─────────────────────────────────────────────────────────────
    if (action === "set_plan") {
      const { userId, plan } = body as { userId: string; plan: string };
      if (!userId || !plan) return json({ error: "Missing userId or plan" }, 400);

      // Fetch current metadata so we only change the plan field
      const userRes  = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, { headers: h });
      const userData = await userRes.json();
      const meta     = userData.user_metadata || {};

      const upd = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "PUT",
        headers: h,
        body: JSON.stringify({ user_metadata: { ...meta, plan } }),
      });
      if (!upd.ok) return json({ error: "Failed to update plan" }, 500);
      return json({ ok: true });
    }

    // ── ADD FREE MONTHS (επιβράβευση) ────────────────────────────────────────
    if (action === "add_credits") {
      const { userId, months } = body as { userId: string; months: number };
      if (!userId || !months) return json({ error: "Missing userId or months" }, 400);

      // Read current profile
      const profRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=referral_credits,referral_plan_until`,
        { headers: h }
      );
      const profs = profRes.ok ? await profRes.json() : [];
      const current = profs[0] || {};

      const now = Date.now();
      const baseDate = current.referral_plan_until && new Date(current.referral_plan_until).getTime() > now
        ? new Date(current.referral_plan_until)
        : new Date();
      baseDate.setMonth(baseDate.getMonth() + months);

      const newCredits   = (Number(current.referral_credits) || 0) + months;
      const newPlanUntil = baseDate.toISOString();

      const upd = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ referral_credits: newCredits, referral_plan_until: newPlanUntil }),
      });
      if (!upd.ok) return json({ error: "Failed to update credits" }, 500);
      return json({ ok: true, new_credits: newCredits, plan_until: newPlanUntil });
    }

    // ── UPDATE OFFICE NAME ────────────────────────────────────────────────────
    if (action === "update_office") {
      const { userId, office_name } = body as { userId: string; office_name: string };
      if (!userId || !office_name) return json({ error: "Missing userId or office_name" }, 400);

      const userRes  = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, { headers: h });
      const userData = await userRes.json();
      const meta     = userData.user_metadata || {};

      const upd = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "PUT",
        headers: h,
        body: JSON.stringify({ user_metadata: { ...meta, office_name } }),
      });
      if (!upd.ok) return json({ error: "Failed to update office name" }, 500);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);

  } catch (e) {
    console.error("admin-stats error:", e);
    return json({ error: String(e) }, 500);
  }
});
