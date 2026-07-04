// FuneralOS — Accept Team Invite Edge Function
// POST { token: string }
// Auth: Bearer <user_access_token> (invitee must be logged in first)
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY") || "";

  // Authenticate caller (the invitee)
  const authHeader = req.headers.get("Authorization") || "";
  const callerToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!callerToken) return new Response("Unauthorized", { status: 401, headers: CORS });

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${callerToken}`, apikey: anonKey },
  });
  if (!userRes.ok) return new Response("Unauthorized", { status: 401, headers: CORS });
  const invitee     = await userRes.json();
  const inviteeId   = invitee.id as string;
  const inviteeMeta = (invitee.user_metadata || {}) as Record<string, unknown>;

  // Parse body
  let token: string;
  try { token = (await req.json()).token || ""; }
  catch { return new Response("Invalid JSON", { status: 400, headers: CORS }); }
  if (!token) return new Response("token is required", { status: 400, headers: CORS });

  const svcHeaders = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
  };

  // Look up invite
  const invRes = await fetch(
    `${supabaseUrl}/rest/v1/office_invites?token=eq.${encodeURIComponent(token)}&accepted_at=is.null&select=*`,
    { headers: svcHeaders }
  );
  if (!invRes.ok) return new Response("Failed to look up invite", { status: 500, headers: CORS });
  const invites = await invRes.json();
  const invite = invites[0];
  if (!invite) return new Response("Invite not found or already used", { status: 404, headers: CORS });

  // Check expiry
  if (new Date(invite.expires_at) < new Date()) {
    return new Response("Invite has expired", { status: 410, headers: CORS });
  }

  // Mark invite as accepted
  await fetch(`${supabaseUrl}/rest/v1/office_invites?id=eq.${invite.id}`, {
    method: "PATCH",
    headers: { ...svcHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ accepted_at: new Date().toISOString() }),
  });

  // Update invitee's user_metadata with office_id and role
  const metaRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${inviteeId}`, {
    method: "PUT",
    headers: svcHeaders,
    body: JSON.stringify({
      user_metadata: { ...inviteeMeta, office_id: invite.office_id, office_role: invite.role },
    }),
  });
  if (!metaRes.ok) {
    console.error("Failed to update user metadata", await metaRes.text());
    return new Response("Failed to update user", { status: 500, headers: CORS });
  }

  // Add to office_members (idempotent)
  await fetch(`${supabaseUrl}/rest/v1/office_members`, {
    method: "POST",
    headers: { ...svcHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      office_id: invite.office_id,
      user_id: inviteeId,
      role: invite.role,
      invited_by: invite.invited_by,
    }),
  });

  console.log(`Invite accepted: user=${inviteeId} office=${invite.office_id} role=${invite.role}`);

  return new Response(
    JSON.stringify({ ok: true, office_id: invite.office_id, role: invite.role }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
