// FuneralOS — Team Invite Edge Function
// POST { email: string, role: "admin" | "editor" }
// Auth: Bearer <user_access_token>
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//          RESEND_API_KEY, FROM_EMAIL (optional), APP_URL (optional)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const resendKey   = Deno.env.get("RESEND_API_KEY") || "";
  const fromEmail   = Deno.env.get("FROM_EMAIL") || "FuneralOS <team@funeralos.net>";
  const appUrl      = Deno.env.get("APP_URL") || "https://funeralos.net/en/app.html";

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
  const callerMeta = (caller.user_metadata || {}) as Record<string, string>;

  // Only admins can invite (solo users are implicitly admin of their own office)
  const callerRole = callerMeta.office_role || "admin";
  if (callerRole !== "admin") {
    return new Response("Only admins can invite team members", { status: 403, headers: CORS });
  }

  // The office_id = caller's own user_id (for solo admin) or existing office_id
  const officeId = callerMeta.office_id || callerId;

  // Parse body
  let email: string, role: string;
  try {
    const body = await req.json();
    email = (body.email || "").toLowerCase().trim();
    role  = body.role || "editor";
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: CORS });
  }
  if (!email) return new Response("email is required", { status: 400, headers: CORS });
  if (!["admin", "editor"].includes(role)) {
    return new Response("role must be admin or editor", { status: 400, headers: CORS });
  }

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
  if (resendKey && invite?.token) {
    const inviteLink = `${appUrl}?invite=${invite.token}`;
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "You've been invited to a FuneralOS office",
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0f1523;color:#c8daf0;padding:32px;border-radius:12px;">
          <h1 style="color:#c8a96e;margin:0 0 4px;font-size:22px;">FuneralOS</h1>
          <h2 style="margin:0 0 20px;color:#fff;font-size:18px;">You've been invited to join an office</h2>
          <p style="margin:0 0 20px;">You've been invited to collaborate on FuneralOS as <strong>${role}</strong>.</p>
          <a href="${inviteLink}" style="display:inline-block;padding:12px 28px;background:#c8a96e;color:#0f1523;border-radius:9px;text-decoration:none;font-weight:700;font-size:15px;">Accept Invitation →</a>
          <p style="margin-top:20px;color:#8899aa;font-size:12px;">This link expires in 7 days. If you don't have a FuneralOS account yet, you'll be asked to create one first.</p>
          <p style="color:#8899aa;font-size:11px;margin-top:32px;border-top:1px solid rgba(255,255,255,.08);padding-top:16px;">FuneralOS — Professional funeral management software</p>
        </div>`,
      }),
    });
    if (!emailRes.ok) console.warn(`Invite email failed: ${emailRes.status}`);
    else console.log(`Invite email sent to ${email}`);
  }

  return new Response(
    JSON.stringify({ ok: true, office_id: officeId, role, token: invite?.token }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
