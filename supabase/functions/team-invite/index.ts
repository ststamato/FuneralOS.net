// FuneralOS — Team Invite Edge Function
// POST { email: string, role: "admin" | "editor" }
// Auth: Bearer <user_access_token>
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//          RESEND_API_KEY, FROM_EMAIL (optional), APP_URL (optional)

// Capacitor's default WebView origins (iOS: capacitor://localhost, Android:
// https://localhost) — echoed back only when they match, so responses to the
// web app keep getting the plain funeralos.net origin. Computed per-request
// (never a shared module-level object) since concurrent requests in the same
// warm isolate would otherwise race on a mutable CORS value.
const ALLOWED_ORIGINS = ["https://funeralos.net", "https://www.funeralos.net", "capacitor://localhost", "https://localhost"];
function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "https://funeralos.net";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

Deno.serve(async (req: Request) => {
  const CORS = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const resendKey   = Deno.env.get("RESEND_API_KEY") || "";
  const fromEmail   = Deno.env.get("FROM_EMAIL") || "FuneralOS <team@funeralos.net>";

  // Authenticate caller
  const authHeader = req.headers.get("Authorization") || "";
  const callerToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!callerToken) return new Response("Unauthorized", { status: 401, headers: CORS });

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${callerToken}`, apikey: anonKey },
  });
  if (!userRes.ok) return new Response("Unauthorized", { status: 401, headers: CORS });
  const caller = await userRes.json();
  const callerId   = caller.id as string;

  // Determine the caller's TRUE office and role server-side by looking up
  // office_members — never trust user_metadata.office_id/office_role, which
  // the client can set directly via supabase.auth.updateUser() and which
  // previously let any authenticated user become "admin" of an arbitrary
  // office just by editing their own metadata (full cross-tenant access via
  // the self-membership insert below).
  const memberRes = await fetch(`${supabaseUrl}/rest/v1/office_members?user_id=eq.${callerId}&select=office_id,role`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  const memberRows = memberRes.ok ? await memberRes.json() : [];
  const membership = memberRows[0];

  // office_id = caller's own user_id (solo owner, no membership row) or the
  // real office they belong to per office_members.
  const officeId = membership?.office_id || callerId;
  const callerRole = membership?.role || "admin"; // solo users are implicitly admin of their own office
  if (callerRole !== "admin") {
    return new Response("Only admins can invite team members", { status: 403, headers: CORS });
  }

  // Server-side plan/team-size enforcement — the client (freemium.js) already
  // checks this, but a direct API call could bypass it entirely otherwise.
  const planUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${officeId}`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  const planUser = planUserRes.ok ? await planUserRes.json() : null;
  const plan = planUser?.app_metadata?.plan || planUser?.user_metadata?.plan || "free";

  if (plan === "free") {
    return new Response("Team members require a Pro or Business plan", { status: 403, headers: CORS });
  }
  if (plan === "pro") {
    const PRO_TEAM_LIMIT = 5;
    const countRes = await fetch(`${supabaseUrl}/rest/v1/office_members?office_id=eq.${officeId}&select=user_id`, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    });
    const members = countRes.ok ? await countRes.json() : [];
    if (members.length >= PRO_TEAM_LIMIT) {
      return new Response(`Pro plan limit reached (${PRO_TEAM_LIMIT} members). Upgrade to Business for unlimited.`, { status: 403, headers: CORS });
    }
  }

  // Parse body
  let email: string, role: string, lang: string;
  try {
    const body = await req.json();
    email = (body.email || "").toLowerCase().trim();
    role  = body.role || "editor";
    lang  = body.lang === "el" ? "el" : "en";
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: CORS });
  }
  if (!email) return new Response("email is required", { status: 400, headers: CORS });
  if (!["admin", "editor"].includes(role)) {
    return new Response("role must be admin or editor", { status: 400, headers: CORS });
  }

  const appUrl = Deno.env.get("APP_URL") || (lang === "el" ? "https://funeralos.net/app" : "https://funeralos.net/en/app");

  const svcHeaders = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
  };

  // Ensure the inviting admin is in office_members (idempotent)
  await fetch(`${supabaseUrl}/rest/v1/office_members`, {
    method: "POST",
    headers: { ...svcHeaders, Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ office_id: officeId, user_id: callerId, role: "admin", invited_by: callerId }),
  });

  // Create or refresh invite (merge-duplicates resets token + expiry on resend)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const inviteRes = await fetch(`${supabaseUrl}/rest/v1/office_invites`, {
    method: "POST",
    headers: { ...svcHeaders, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ office_id: officeId, email, role, invited_by: callerId, expires_at: expiresAt }),
  });
  if (!inviteRes.ok) {
    const err = await inviteRes.text();
    console.error("Failed to create invite", err);
    return new Response("Failed to create invite", { status: 500, headers: CORS });
  }
  const [invite] = await inviteRes.json();

  // Send invite email via Resend
  let emailSent = false;
  if (resendKey && invite?.token) {
    const inviteLink = `${appUrl}?invite=${invite.token}`;
    const roleLabelEl = role === "admin" ? "διαχειριστής" : "συντάκτης";
    const subject = lang === "el" ? "Προσκλήθηκες σε γραφείο στο FuneralOS" : "You've been invited to a FuneralOS office";
    const html = lang === "el"
      ? `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0f1523;color:#c8daf0;padding:32px;border-radius:12px;">
          <h1 style="color:#c8a96e;margin:0 0 4px;font-size:22px;">FuneralOS</h1>
          <h2 style="margin:0 0 20px;color:#fff;font-size:18px;">Προσκλήθηκες σε γραφείο</h2>
          <p style="margin:0 0 20px;">Προσκλήθηκες να συνεργαστείς στο FuneralOS ως <strong>${roleLabelEl}</strong>.</p>
          <a href="${inviteLink}" style="display:inline-block;padding:12px 28px;background:#c8a96e;color:#0f1523;border-radius:9px;text-decoration:none;font-weight:700;font-size:15px;">Αποδοχή πρόσκλησης →</a>
          <p style="margin-top:20px;color:#8899aa;font-size:12px;">Ο σύνδεσμος λήγει σε 7 ημέρες. Αν δεν έχεις ήδη λογαριασμό FuneralOS, θα σου ζητηθεί να δημιουργήσεις έναν πρώτα.</p>
          <p style="color:#8899aa;font-size:11px;margin-top:32px;border-top:1px solid rgba(255,255,255,.08);padding-top:16px;">FuneralOS — Επαγγελματικό λογισμικό διαχείρισης γραφείου τελετών</p>
        </div>`
      : `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0f1523;color:#c8daf0;padding:32px;border-radius:12px;">
          <h1 style="color:#c8a96e;margin:0 0 4px;font-size:22px;">FuneralOS</h1>
          <h2 style="margin:0 0 20px;color:#fff;font-size:18px;">You've been invited to join an office</h2>
          <p style="margin:0 0 20px;">You've been invited to collaborate on FuneralOS as <strong>${role}</strong>.</p>
          <a href="${inviteLink}" style="display:inline-block;padding:12px 28px;background:#c8a96e;color:#0f1523;border-radius:9px;text-decoration:none;font-weight:700;font-size:15px;">Accept Invitation →</a>
          <p style="margin-top:20px;color:#8899aa;font-size:12px;">This link expires in 7 days. If you don't have a FuneralOS account yet, you'll be asked to create one first.</p>
          <p style="color:#8899aa;font-size:11px;margin-top:32px;border-top:1px solid rgba(255,255,255,.08);padding-top:16px;">FuneralOS — Professional funeral management software</p>
        </div>`;
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromEmail, to: [email], subject, html }),
    });
    if (!emailRes.ok) console.warn(`Invite email failed: ${emailRes.status}`);
    else { emailSent = true; console.log(`Invite email sent to ${email}`); }
  }

  return new Response(
    JSON.stringify({ ok: true, office_id: officeId, role, token: invite?.token, emailSent, inviteLink: `${appUrl}?invite=${invite?.token}` }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
