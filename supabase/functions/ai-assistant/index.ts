// Funeral Office AI Assistant — xAI Grok + server-side rate limiting
// Supabase Edge Function (Deno)
// Env vars needed: XAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY (auto: SUPABASE_URL)

const XAI_API_URL = "https://api.x.ai/v1/chat/completions";
const XAI_MODEL = "grok-3-mini";
const MAX_TOKENS = 1200;
const AI_DAILY_LIMIT = 10;

const CORS = {
  "Access-Control-Allow-Origin": "https://funeralos.net",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const apiKey = Deno.env.get("XAI_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!apiKey) return json({ error: "XAI_API_KEY not configured" }, 500);
  if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, 500);

  // ── Verify the caller's identity from their JWT — never trust a client-
  // supplied userId. Without this, anyone could call this endpoint with a
  // forged userId, and the daily rate limit (keyed on that userId) would do
  // nothing to stop them from draining the xAI budget. Mirrors the
  // `submit_support` pattern in admin-stats/index.ts.
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);

  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
  });
  if (!authRes.ok) return json({ error: "Invalid token" }, 401);
  const authUser: any = await authRes.json();
  const userId = authUser?.id as string | null;
  if (!userId) return json({ error: "Could not identify user" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // ── Server-side rate limit check ────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const sbHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal",
  };

  const usageRes = await fetch(
    `${supabaseUrl}/rest/v1/ai_usage?user_id=eq.${encodeURIComponent(userId)}&select=calls_today,reset_date`,
    { headers: sbHeaders }
  );
  const usageRows: any[] = usageRes.ok ? await usageRes.json() : [];
  const usage = usageRows[0];
  const callsToday = usage?.reset_date === today ? Number(usage?.calls_today ?? 0) : 0;

  if (callsToday >= AI_DAILY_LIMIT) {
    return json({ error: "daily_limit_reached", used: callsToday, limit: AI_DAILY_LIMIT }, 429);
  }

  // ── Call xAI Grok ────────────────────────────────────────────────────────────
  const lang = payload.lang === "en" ? "en" : "el";
  const isQuestion = Boolean(payload.question);
  const systemPrompt = buildSystemPrompt(payload, lang);
  const userPrompt = isQuestion
    ? (lang === "en" ? `Question: ${payload.question}` : `Ερώτηση: ${payload.question}`)
    : (lang === "en"
        ? "Give me today's briefing, most urgent items first."
        : "Δώσε μου briefing για σήμερα με τα πιο επείγοντα πρώτα.");

  try {
    const grokRes = await fetch(XAI_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
      }),
    });

    if (!grokRes.ok) {
      const errText = await grokRes.text();
      console.error("Grok API error:", grokRes.status, errText);
      return json({ error: `Grok API error: ${grokRes.status}` }, 502);
    }

    const grokData: any = await grokRes.json();
    const answer = grokData.choices?.[0]?.message?.content?.trim()
      || (lang === "en" ? "No answer available." : "Δεν υπάρχει απάντηση.");

    // ── Increment counter after successful Grok call ────────────────────────
    await fetch(`${supabaseUrl}/rest/v1/ai_usage?on_conflict=user_id`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify({ user_id: userId, calls_today: callsToday + 1, reset_date: today }),
    });

    return json({ answer, used: callsToday + 1, limit: AI_DAILY_LIMIT });

  } catch (err) {
    console.error("Edge function error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function buildSystemPrompt(payload: Record<string, unknown>, lang: "el" | "en"): string {
  const today = String(payload.today || "").slice(0, 10);
  const tomorrow = String(payload.tomorrow || "").slice(0, 10);
  const ceremonies = Array.isArray(payload.ceremonies) ? payload.ceremonies as any[] : [];
  const warehouse = Array.isArray(payload.warehouse) ? payload.warehouse as any[] : [];
  const setsWarehouse = Array.isArray(payload.setsWarehouse) ? payload.setsWarehouse as any[] : [];
  const summary = (payload.summary as any) || {};
  const local = (payload.localAnalysis as any) || {};
  const officeName = String(payload.officeName || "").trim();

  const todayCer = ceremonies.filter((c) => c.date === today);
  const tomCer = ceremonies.filter((c) => c.date === tomorrow);

  const L = lang === "en"
    ? {
        intro: `You are the AI assistant for "${officeName || "this funeral home"}". Respond only in English. Be concise, practical and professional. Use bullet points.`,
        today: "Today", tomorrow: "Tomorrow", totalCases: "Total cases",
        todaySection: "📅 TODAY'S CASES:", tomorrowSection: "📅 TOMORROW'S CASES:",
        director: "Director", casket: "Casket", set: "Set",
        missingHeader: (n: number) => `⚠ MISSING ITEMS (${n} cases):`,
        notesHeader: (n: number) => `📝 IMPORTANT NOTES (${n}):`,
        lowStockHeader: "📦 LOW STOCK:",
        caskUnit: "units", setUnit: "units",
        footer: "Give a concise briefing. Start with the most urgent items. Don't repeat data. Maximum 350 words.",
      }
    : {
        intro: `Είσαι ο AI βοηθός του γραφείου κηδειών "${officeName || "αυτού του γραφείου"}". Απαντάς μόνο στα Ελληνικά. Είσαι σύντομος, πρακτικός και επαγγελματικός. Χρησιμοποιείς bullet points.`,
        today: "Σήμερα", tomorrow: "Αύριο", totalCases: "Σύνολο τελετών",
        todaySection: "📅 ΤΕΛΕΤΕΣ ΣΗΜΕΡΑ:", tomorrowSection: "📅 ΤΕΛΕΤΕΣ ΑΥΡΙΟ:",
        director: "Υπεύθ", casket: "Φέρετρο", set: "ΣΕΤ",
        missingHeader: (n: number) => `⚠ ΕΛΛΕΙΨΕΙΣ (${n} τελετές):`,
        notesHeader: (n: number) => `📝 ΣΗΜΑΝΤΙΚΕΣ ΣΗΜΕΙΩΣΕΙΣ (${n}):`,
        lowStockHeader: "📦 ΧΑΜΗΛΑ ΑΠΟΘΕΜΑΤΑ:",
        caskUnit: "τεμ.", setUnit: "τεμ.",
        footer: "Δώσε σύντομο briefing. Ξεκίνα με τα επείγοντα. Μην επαναλαμβάνεις δεδομένα. Μέγιστο 350 λέξεις.",
      };

  let p = `${L.intro}

${L.today}: ${today}
${L.tomorrow}: ${tomorrow}
${L.totalCases}: ${summary.totalCeremonies ?? ceremonies.length}
${L.today}: ${summary.todayCount ?? todayCer.length} | ${L.tomorrow}: ${summary.tomorrowCount ?? tomCer.length}
`;

  if (todayCer.length) {
    p += `\n${L.todaySection}\n`;
    todayCer.forEach((c) => {
      p += `• ${c.time || "?"} — ${c.name || "-"} | ${c.place || "-"}`;
      if (c.responsible) p += ` | ${L.director}: ${c.responsible}`;
      if (c.coffin) p += ` | ${L.casket}: ${c.coffin}`;
      if (c.set) p += ` | ${L.set}: ${c.set}`;
      if (c.notes) p += ` | ⚠ ${String(c.notes).slice(0, 120)}`;
      p += "\n";
    });
  }

  if (tomCer.length) {
    p += `\n${L.tomorrowSection}\n`;
    tomCer.forEach((c) => {
      p += `• ${c.time || "?"} — ${c.name || "-"} | ${c.place || "-"}`;
      if (c.responsible) p += ` | ${L.director}: ${c.responsible}`;
      if (c.notes) p += ` | ⚠ ${String(c.notes).slice(0, 80)}`;
      p += "\n";
    });
  }

  const errors: any[] = Array.isArray(local.errors) ? local.errors : [];
  if (errors.length) {
    p += `\n${L.missingHeader(errors.length)}\n`;
    errors.slice(0, 8).forEach((e) => {
      p += `• ${e.ceremony}: ${(e.missing || []).join(", ")}\n`;
    });
  }

  const notes: any[] = Array.isArray(local.notes) ? local.notes : [];
  const urgent = notes.filter((n) => n.priority === "high");
  if (urgent.length) {
    p += `\n${L.notesHeader(urgent.length)}\n`;
    urgent.slice(0, 8).forEach((n) => {
      p += `• ${n.ceremony}: ${n.notes}\n`;
    });
  }

  const lowCoffins = warehouse.filter((w) => Number(w.qty) <= 2);
  const lowSets = setsWarehouse.filter((w) => Number(w.qty) <= 2);
  if (lowCoffins.length || lowSets.length) {
    p += `\n${L.lowStockHeader}\n`;
    lowCoffins.forEach((w) => (p += `• ${L.casket} ${w.name}: ${w.qty} ${L.caskUnit}\n`));
    lowSets.forEach((w) => (p += `• ${L.set} ${w.name}: ${w.qty} ${L.setUnit}\n`));
  }

  p += `\n${L.footer}`;
  return p;
}
