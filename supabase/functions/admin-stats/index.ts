// FuneralOS — Admin Stats Edge Function
// Supabase Edge Function (Deno)
// Env vars needed: SUPABASE_SERVICE_ROLE_KEY  (SUPABASE_URL is auto-injected)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OWNER_EMAILS = ["ststamato@gmail.com", "funeralos.net@gmail.com"];

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

  // Read body once before branching on auth
  const body: Record<string, unknown> = req.method === "POST"
    ? await req.json().catch(() => ({}))
    : {};
  const action = (body.action as string) || "list";

  const authHeader = req.headers.get("Authorization") || "";

  const h = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json",
  };

  try {
    // ── SUBMIT SUPPORT (any authenticated user) ───────────────────────────────
    if (action === "submit_support") {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) return json({ error: "Unauthorized" }, 401);

      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
      });
      if (!userRes.ok) return json({ error: "Invalid token" }, 401);
      const user = await userRes.json();
      const userId    = user?.id as string | null;
      const userEmail = (user?.email as string) || "unknown";
      if (!userId) return json({ error: "Could not identify user" }, 401);

      const subject = String(body.subject || "").trim().slice(0, 100);
      const message = String(body.message || "").trim().slice(0, 1000);
      if (!subject || !message) return json({ error: "Subject and message required" }, 400);

      const insRes = await fetch(`${supabaseUrl}/rest/v1/support_requests`, {
        method: "POST",
        headers: { ...h, Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: userId, subject, message }),
      });
      if (!insRes.ok) {
        const txt = await insRes.text();
        return json({ error: "Failed to save: " + txt }, 500);
      }

      // Return immediately — background tasks run after response
      const resendKey    = Deno.env.get("RESEND_API_KEY");
      const fromEmail    = Deno.env.get("FROM_EMAIL") || "noreply@funeralos.net";
      const githubToken  = Deno.env.get("GITHUB_TOKEN");
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

      const background = async () => {
        // Email
        if (resendKey) {
          const now = new Date().toLocaleString("el-GR", { timeZone: "Europe/Athens" });
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `FuneralOS <${fromEmail}>`,
              to: ["funeralos.net@gmail.com"],
              subject: `[Support] ${subject} — ${userEmail}`,
              html: `<p><strong>Χρήστης:</strong> ${userEmail}</p><p><strong>Ημερομηνία:</strong> ${now}</p><p><strong>Μήνυμα:</strong></p><p>${message.replace(/\n/g, "<br>")}</p><p><a href="https://funeralos.net/admin.html">→ Δες το αίτημα</a></p>`,
            }),
          }).catch(e => console.error('[email]', e));
        }

        // GitHub issue + Claude comment
        if (!githubToken) return;
        const nowIso = new Date().toISOString();
        const issueBody = [
          `**User:** ${userEmail}`,
          `**user_id:** ${userId}`,
          `**Date:** ${nowIso}`,
          ``,
          `**Message:**`,
          message,
          ``,
          `---`,
          `*[Admin panel](https://funeralos.net/admin.html) · [CLAUDE.md](https://github.com/ststamato/karta-staurakaki/blob/main/CLAUDE.md)*`,
        ].join("\n");

        const issueRes = await fetch("https://api.github.com/repos/ststamato/karta-staurakaki/issues", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            "Content-Type": "application/json",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: JSON.stringify({
            title: `[Support] ${subject} — ${userEmail}`,
            body: issueBody,
            labels: ["support"],
          }),
        });

        if (!issueRes.ok) { console.error('[github]', await issueRes.text()); return; }
        if (!anthropicKey) return;

        const issueData   = await issueRes.json();
        const issueNumber = issueData.number as number;

        const claudeMdRes = await fetch(
          "https://raw.githubusercontent.com/ststamato/karta-staurakaki/main/CLAUDE.md",
          { headers: { Authorization: `Bearer ${githubToken}` } }
        );
        const claudeMd = claudeMdRes.ok ? await claudeMdRes.text() : "";

        const prompt = `Είσαι ο AI βοηθός διαχείρισης για το FuneralOS, ένα ελληνικό SaaS για γραφεία τελετών.

## Πλαίσιο project
${claudeMd}

## Αίτημα υποστήριξης
**Τίτλος:** [Support] ${subject} — ${userEmail}
**user_id:** ${userId}
**Μήνυμα:**
${message}

## Εργασία
Αναλύσε το αίτημα και απάντησε στα ελληνικά. Κάνε το εξής:

1. Πρώτα εξήγησε τι ζητά ο χρήστης με 1-2 προτάσεις.
2. Αν είναι **per-user αλλαγή** (plan, AI limit, notes): δώσε ακριβώς το API call που πρέπει να γίνει:
   \`\`\`
   POST https://rqklpnrgpiprttzsploe.supabase.co/functions/v1/admin-stats
   { "action": "...", "user_id": "${userId}", ... }
   \`\`\`
3. Αν είναι **bug ή feature** για όλους τους χρήστες: περίγραψε ποιο αρχείο πρέπει να αλλαχτεί και πώς.
4. Στο τέλος πρόσθεσε αν το αίτημα μπορεί να κλείσει αμέσως ή χρειάζεται PR.`;

        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-opus-5",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (claudeRes.ok) {
          const claudeData = await claudeRes.json();
          const reply = claudeData.content?.[0]?.text as string | undefined;
          if (reply) {
            await fetch(
              `https://api.github.com/repos/ststamato/karta-staurakaki/issues/${issueNumber}/comments`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${githubToken}`,
                  "Content-Type": "application/json",
                  "Accept": "application/vnd.github+json",
                  "X-GitHub-Api-Version": "2022-11-28",
                },
                body: JSON.stringify({ body: `🤖 **Claude:**\n\n${reply}` }),
              }
            ).catch(e => console.error('[github-comment]', e));
          }
        } else {
          console.error('[claude]', await claudeRes.text());
        }
      };

      // Run background work after response (avoids EarlyDrop timeout)
      (globalThis as Record<string, unknown> & { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } })
        .EdgeRuntime?.waitUntil(background());

      return json({ ok: true });
    }

    // All other actions require owner auth
    const ownerEmail = await verifyOwner(authHeader, supabaseUrl, serviceKey);
    if (!ownerEmail) return json({ error: "Unauthorized" }, 403);

    // ── LIST ALL USERS + stats ────────────────────────────────────────────────
    if (action === "list") {
      const [usersRes, aiRes, profilesRes, referralsRes, appStateRes] = await Promise.all([
        fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, { headers: h }),
        fetch(`${supabaseUrl}/rest/v1/ai_usage?select=user_id,calls_today,reset_date`, { headers: h }),
        fetch(`${supabaseUrl}/rest/v1/profiles?select=id,referral_code,referral_credits,referral_plan_until,admin_notes`, { headers: h }),
        fetch(`${supabaseUrl}/rest/v1/referrals?select=referrer_id&status=eq.rewarded`, { headers: h }),
        fetch(`${supabaseUrl}/rest/v1/app_state?select=id,payload`, { headers: h }),
      ]);

      const usersData    = await usersRes.json();
      const aiRows       = aiRes.ok        ? await aiRes.json()        : [];
      const profiles     = profilesRes.ok  ? await profilesRes.json()  : [];
      const referrals    = referralsRes.ok  ? await referralsRes.json() : [];
      const appStateRows = appStateRes.ok   ? await appStateRes.json()  : [];

      const aiMap: Record<string, { calls_today: number; reset_date: string }> = {};
      for (const r of aiRows) aiMap[r.user_id] = r;

      const profileMap: Record<string, {
        referral_code: string;
        referral_credits: number;
        referral_plan_until: string | null;
        admin_notes: string;
      }> = {};
      for (const p of profiles) profileMap[p.id] = p;

      const refCountMap: Record<string, number> = {};
      for (const r of referrals) {
        refCountMap[r.referrer_id] = (refCountMap[r.referrer_id] || 0) + 1;
      }

      // Build monthly breakdown for last 6 months
      const monthCounts: Record<string, number> = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthCounts[key] = 0;
      }

      const officeCountMap: Record<string, number> = {};
      let totalCeremonies = 0;

      for (const row of appStateRows) {
        const ceremonies: Array<{ date?: string }> = row.payload?.ceremonies || [];
        officeCountMap[row.id as string] = ceremonies.length;
        totalCeremonies += ceremonies.length;
        for (const c of ceremonies) {
          if (!c.date) continue;
          const monthKey = c.date.slice(0, 7);
          if (monthKey in monthCounts) monthCounts[monthKey]++;
        }
      }

      const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const ceremony_stats = {
        total:             totalCeremonies,
        this_month:        monthCounts[thisMonthKey] || 0,
        offices_with_data: appStateRows.length,
        monthly_breakdown: Object.entries(monthCounts).map(([month, count]) => ({ month, count })),
      };

      const today = new Date().toISOString().split("T")[0];

      const users = (usersData.users || []).map((u: Record<string, unknown>) => {
        const meta     = (u.raw_user_metadata as Record<string, unknown>) || {};
        const ai       = aiMap[u.id as string] || null;
        const officeId = (meta.office_id as string) || (u.id as string);
        const profile  = profileMap[u.id as string] || null;
        return {
          id:              u.id,
          email:           u.email,
          plan:            (meta.plan as string) || "free",
          office_name:     (meta.office_name as string) || "",
          created_at:      u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          ai_calls_today:  ai?.reset_date === today ? Number(ai.calls_today) : 0,
          ceremony_count:  officeCountMap[officeId] || 0,
          referral:        profile,
          referral_count:  refCountMap[u.id as string] || 0,
          admin_notes:     profile?.admin_notes || "",
        };
      });

      return json({ users, ceremony_stats });
    }

    // ── SET PLAN ──────────────────────────────────────────────────────────────
    if (action === "set_plan") {
      const { userId, plan } = body as { userId: string; plan: string };
      if (!userId || !plan) return json({ error: "Missing userId or plan" }, 400);

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

    // ── ADD FREE MONTHS ───────────────────────────────────────────────────────
    if (action === "add_credits") {
      const { userId, months } = body as { userId: string; months: number };
      if (!userId || !months) return json({ error: "Missing userId or months" }, 400);

      const profRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=referral_credits,referral_plan_until`,
        { headers: h }
      );
      const profs   = profRes.ok ? await profRes.json() : [];
      const current = profs[0] || {};

      const nowTs   = Date.now();
      const baseDate = current.referral_plan_until && new Date(current.referral_plan_until).getTime() > nowTs
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

    // ── DELETE USER ───────────────────────────────────────────────────────────
    if (action === "delete_user") {
      const { userId } = body as { userId: string };
      if (!userId) return json({ error: "Missing userId" }, 400);
      const del = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: h,
      });
      if (!del.ok) {
        const errText = await del.text();
        return json({ error: "Failed to delete user: " + errText }, 500);
      }
      return json({ ok: true });
    }

    // ── BAN USER ──────────────────────────────────────────────────────────────
    if (action === "ban_user") {
      const { userId } = body as { userId: string };
      if (!userId) return json({ error: "Missing userId" }, 400);
      const upd = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "PUT",
        headers: h,
        body: JSON.stringify({ ban_duration: "876600h" }),
      });
      if (!upd.ok) return json({ error: "Failed to ban user" }, 500);
      return json({ ok: true });
    }

    // ── UNBAN USER ────────────────────────────────────────────────────────────
    if (action === "unban_user") {
      const { userId } = body as { userId: string };
      if (!userId) return json({ error: "Missing userId" }, 400);
      const upd = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "PUT",
        headers: h,
        body: JSON.stringify({ ban_duration: "none" }),
      });
      if (!upd.ok) return json({ error: "Failed to unban user" }, 500);
      return json({ ok: true });
    }

    // ── AUDIT LOG ─────────────────────────────────────────────────────────────
    if (action === "audit_log") {
      const limit  = Number(body.limit)  || 100;
      const offset = Number(body.offset) || 0;

      const [eventsRes, usersRes] = await Promise.all([
        fetch(
          `${supabaseUrl}/rest/v1/office_events?select=id,user_id,event_type,payload,created_at&order=created_at.desc&limit=${limit}&offset=${offset}`,
          { headers: h }
        ),
        fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, { headers: h }),
      ]);

      const events    = eventsRes.ok ? await eventsRes.json()  : [];
      const usersData = usersRes.ok  ? await usersRes.json()   : {};
      const emailMap: Record<string, string> = {};
      for (const u of (usersData.users || [])) emailMap[u.id] = u.email;

      const enriched = (Array.isArray(events) ? events : []).map((e: Record<string, unknown>) => ({
        ...e,
        user_email: emailMap[e.user_id as string] || e.user_id,
      }));

      return json({ events: enriched });
    }

    // ── SUPPORT LIST ──────────────────────────────────────────────────────────
    if (action === "support_list") {
      const [reqsRes, usersRes] = await Promise.all([
        fetch(
          `${supabaseUrl}/rest/v1/support_requests?select=id,user_id,subject,message,status,created_at,resolved_at&order=created_at.desc`,
          { headers: h }
        ),
        fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, { headers: h }),
      ]);

      const reqs      = reqsRes.ok  ? await reqsRes.json()  : [];
      const usersData = usersRes.ok ? await usersRes.json() : {};
      const emailMap: Record<string, string> = {};
      for (const u of (usersData.users || [])) emailMap[u.id] = u.email;

      const enriched = (Array.isArray(reqs) ? reqs : []).map((r: Record<string, unknown>) => ({
        ...r,
        user_email: emailMap[r.user_id as string] || r.user_id,
      }));

      return json({ requests: enriched });
    }

    // ── SUPPORT RESOLVE ───────────────────────────────────────────────────────
    if (action === "support_resolve") {
      const { requestId } = body as { requestId: string };
      if (!requestId) return json({ error: "Missing requestId" }, 400);
      const upd = await fetch(`${supabaseUrl}/rest/v1/support_requests?id=eq.${requestId}`, {
        method: "PATCH",
        headers: { ...h, Prefer: "return=minimal" },
        body: JSON.stringify({ status: "resolved", resolved_at: new Date().toISOString() }),
      });
      if (!upd.ok) return json({ error: "Failed to resolve request" }, 500);
      return json({ ok: true });
    }

    // ── UPDATE ADMIN NOTES ────────────────────────────────────────────────────
    if (action === "update_notes") {
      const { userId, notes } = body as { userId: string; notes: string };
      if (!userId) return json({ error: "Missing userId" }, 400);
      const upd = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: { ...h, Prefer: "return=minimal" },
        body: JSON.stringify({ admin_notes: notes || "" }),
      });
      if (!upd.ok) return json({ error: "Failed to update notes" }, 500);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);

  } catch (e) {
    console.error("admin-stats error:", e);
    return json({ error: String(e) }, 500);
  }
});
