// Supabase Edge Function: ai-assistant
// V41.2 — Hermes AI Agent (Gemini function-calling, δωρεάν) για Τελετές Σταυρακάκη
// Cloud AI bridge. Υποστηρίζει:
// - ημερήσια αναφορά
// - ελεύθερη ερώτηση από το πεδίο "Ρώτα τον AI Βοηθό"
// - fallback χωρίς πληρωμένο AI key
//
// V41.0 — Free Brain Swap:
// - Δωρεάν μοντέλο Google Gemini (gemini-2.0-flash) ως πρώτη επιλογή.
//
// V41.2 — Agent Tools (ΝΕΟ, 100% backward compatible):
// - Ο βοηθός γίνεται AGENT: αντί να του στέλνουμε όλα τα δεδομένα ωμά,
//   του δίνουμε ΕΡΓΑΛΕΙΑ (read-only) και τα καλεί μόνος του όσες φορές χρειαστεί:
//     search_ceremonies, count_ceremonies, warehouse_alerts,
//     list_notes, list_missing, draft_supplier_message.
// - Πλεονεκτήματα: ακριβέστερες απαντήσεις, λιγότερα tokens, λιγότερα
//   προσωπικά δεδομένα προς το cloud (στέλνονται μόνο όσα ζητά το εργαλείο).
//
// Σειρά απάντησης (καμία αλλαγή στον client):
//   1) GEMINI_API_KEY -> Agent με εργαλεία (Gemini)
//   2) GEMINI_API_KEY -> απλό Gemini (αν αποτύχει ο agent loop)
//   3) OPENAI_API_KEY -> OpenAI (όπως πριν)
//   4) τοπική λογική (localFallback)
//
// ΧΡΥΣΟΙ ΚΑΝΟΝΕΣ (διατηρούνται):
// - Όλα τα εργαλεία είναι READ-ONLY: διαβάζουν, δεν αλλάζουν/δεν στέλνουν τίποτα.
// - Το draft_supplier_message ΜΟΝΟ ετοιμάζει κείμενο· δεν στέλνει.
// - Κανένα νέο Supabase query: τα εργαλεία δουλεύουν πάνω στο payload που ήρθε.
// - Ίδιο input payload, ίδια απάντηση { ok, answer }. Ο client (app.js) δεν αλλάζει.
// - Καμία κλήση στο μοντέλο δεν ρίχνει 500: αν αποτύχει, γυρνά τοπική απάντηση.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  question?: string;
  summary?: Record<string, unknown>;
  ceremonies?: Array<Record<string, unknown>>;
  warehouse?: Array<Record<string, unknown>>;
  setsWarehouse?: Array<Record<string, unknown>>;
  localAnalysis?: Record<string, unknown>;
};

function norm(v: unknown) {
  return String(v || "").trim().toLocaleUpperCase("el-GR");
}

function normSearch(v: unknown) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("el-GR");
}

function questionKeywords(question: unknown) {
  const stop = new Set([
    "ΠΟΣΕΣ", "ΠΟΣΟΙ", "ΠΟΣΑ", "ΠΟΙΑ", "ΠΟΙΕΣ", "ΠΟΙΟΣ",
    "ΕΧΟΥΜΕ", "ΕΧΕΙ", "ΕΙΝΑΙ", "ΑΠΟ", "ΣΤΟ", "ΣΤΗ", "ΣΤΗΝ", "ΣΤΟΝ", "ΣΤΑ", "ΣΕ", "ΓΙΑ", "ΜΕ",
    "ΠΑΡΑΛΑΒΗ", "ΠΑΡΑΛΑΒΕΣ", "ΠΑΡΑΛΑΒΩΝ", "ΠΑΡΑΛΑΒΗΣ",
    "ΝΟΣΟΚΟΜΕΙΟ", "ΝΟΣΟΚΟΜΕΙΟΥ", "ΝΟΣΟΚ", "ΚΛΙΝΙΚΗ", "ΚΛΙΝΙΚΗΣ",
    "ΤΕΛΕΤΕΣ", "ΤΕΛΕΤΗ", "ΣΗΜΕΡΑ", "ΑΥΡΙΟ"
  ]);
  return normSearch(question)
    .split(/[^A-ZΑ-Ω0-9]+/i)
    .map((x) => x.trim())
    .filter((x) => x.length >= 3 && !stop.has(x));
}

function fieldContainsAllKeywords(value: unknown, keywords: string[]) {
  const hay = normSearch(value);
  return keywords.every((k) => hay.includes(k));
}

function ceremonySearchBlob(c: Record<string, unknown>) {
  return [
    c.name, c.date, c.time, c.place, c.pickup, c.coldRoom, c.notes,
    c.responsible, c.secondPerson, c.pickupSecondPerson, c.burialType, c.coffin, c.set
  ].filter(Boolean).join(" ");
}


function safeDate(c: Record<string, unknown>) {
  if (!c?.date) return null;
  const d = new Date(String(c.date) + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateOnly(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getMonday(d0: Date) {
  const d = new Date(d0);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0,0,0,0);
  return d;
}

function timeFilter(question: unknown, ceremonies: Array<Record<string, unknown>>, payload: Payload) {
  const q = norm(question);
  const now = new Date();
  const today = String((payload as any).today || new Date().toISOString().slice(0, 10));
  const tomorrow = String((payload as any).tomorrow || (() => { const d = new Date(); d.setDate(d.getDate()+1); return dateOnly(d); })());
  let out = ceremonies.slice();
  if (q.includes("ΣΗΜΕΡ")) out = out.filter(c => String(c.date || "") === today);
  if (q.includes("ΑΥΡΙΟ")) out = out.filter(c => String(c.date || "") === tomorrow);
  if (q.includes("ΕΒΔΟΜΑΔ")) {
    const monday = getMonday(now); const sunday = new Date(monday); sunday.setDate(monday.getDate()+7);
    out = out.filter(c => { const d = safeDate(c); return d && d >= monday && d < sunday; });
  }
  if (q.includes("ΜΗΝΑ") || q.includes("ΜΗΝΟΣ") || q.includes("ΤΡΕΧΟΝ")) {
    const y = now.getFullYear(); const m = now.getMonth();
    out = out.filter(c => { const d = safeDate(c); return d && d.getFullYear() === y && d.getMonth() === m; });
  }
  if (q.includes("ΦΕΤΟΣ")) {
    const y = now.getFullYear();
    out = out.filter(c => { const d = safeDate(c); return d && d.getFullYear() === y; });
  }
  const ym = q.match(/20\d{2}/);
  if (ym) {
    const y = Number(ym[0]);
    out = out.filter(c => { const d = safeDate(c); return d && d.getFullYear() === y; });
  }
  const months: Array<[string, number]> = [["ΙΑΝΟΥΑΡ",0],["ΦΕΒΡΟΥΑΡ",1],["ΜΑΡΤ",2],["ΑΠΡΙΛ",3],["ΜΑΙ",4],["ΜΑΪ",4],["ΙΟΥΝ",5],["ΙΟΥΛ",6],["ΑΥΓΟΥΣ",7],["ΣΕΠΤ",8],["ΟΚΤ",9],["ΝΟΕΜ",10],["ΔΕΚ",11]];
  for (const [stem, mi] of months) if (q.includes(stem)) { out = out.filter(c => { const d = safeDate(c); return d && d.getMonth() === mi; }); break; }
  return out;
}

function questionScope(question: unknown) {
  const q = norm(question);
  if (q.includes("ΠΑΡΑΛΑΒ")) return "pickup";
  if (q.includes("ΣΗΜΕΙ") || q.includes("ΠΡΟΣΟΧ") || q.includes("ΙΔΙΑΙΤ")) return "notes";
  if (q.includes("ΨΥΚΤ") || q.includes("ΘΑΛΑΜ")) return "coldRoom";
  if (q.includes("ΦΕΡΕΤΡ")) return "coffin";
  if (q.includes("ΣΕΤ")) return "set";
  if (q.includes("ΥΠΕΥΘ") || q.includes("ΠΟΙΟΣ")) return "responsible";
  if (q.includes("ΑΠΟΤΕΦ")) return "cremation";
  if (q.includes("ΤΑΦ")) return "burial";
  if (q.includes("ΚΑΦΕ")) return "coffee";
  if (q.includes("ΣΤΟΛ")) return "decor";
  if (q.includes("ΦΡΑΓΚ")) return "pallbearers";
  return "all";
}

function fieldValue(c: Record<string, unknown>, scope: string) {
  if (scope === "pickup") return c.pickup || "";
  if (scope === "notes") return c.notes || "";
  if (scope === "coldRoom") return c.coldRoom || "";
  if (scope === "coffin") return c.coffin || "";
  if (scope === "set") return c.set || "";
  if (scope === "responsible") return c.responsible || "";
  if (scope === "cremation" || scope === "burial") return c.burialType || "";
  if (scope === "coffee") return [c.coffee, c.coffeePlace].filter(Boolean).join(" ");
  if (scope === "decor") return [c.decor, c.decorNote].filter(Boolean).join(" ");
  if (scope === "pallbearers") return c.pallbearers || "";
  return ceremonySearchBlob(c);
}

function groupCounts(list: Array<Record<string, unknown>>, getter: (c: Record<string, unknown>) => unknown) {
  const map = new Map<string, { label: string; count: number }>();
  for (const c of list) {
    const raw = String(getter(c) || "").trim() || "—";
    const key = normSearch(raw);
    if (!map.has(key)) map.set(key, { label: raw, count: 0 });
    map.get(key)!.count += 1;
  }
  return Array.from(map.values()).sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label,"el"));
}

function formatList(list: Array<Record<string, unknown>>, limit = 20) {
  if (!list.length) return "• Δεν βρέθηκαν τελετές.";
  const lines: string[] = [];
  list.sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")) || String(a.time||"").localeCompare(String(b.time||""))).slice(0, limit).forEach(c => {
    const extra = [
      c.pickup ? `Παραλαβή: ${c.pickup}` : "",
      c.place ? `Τόπος: ${c.place}` : "",
      c.responsible && c.responsible !== "-" ? `Υπ.: ${c.responsible}` : "",
      c.coffin ? `Φέρετρο: ${c.coffin}` : "",
      c.set ? `ΣΕΤ: ${c.set}` : "",
      c.notes ? `Σημ.: ${String(c.notes).slice(0,90)}${String(c.notes).length > 90 ? "…" : ""}` : "",
    ].filter(Boolean).join(" · ");
    lines.push(`• ${c.date || "-"} ${c.time || "-"} — ${c.name || "-"}${extra ? ` — ${extra}` : ""}`);
  });
  if (list.length > limit) lines.push(`• +${list.length - limit} ακόμη.`);
  return lines.join("\n");
}

function compactPayloadForPrompt(payload: Payload) {
  const ceremonies = (payload.ceremonies || []).slice(0, 100).map((c) => ({
    date: c.date,
    time: c.time,
    name: c.name,
    place: c.place,
    burialType: c.burialType,
    responsible: c.responsible,
    secondPerson: c.secondPerson,
    pickupSecondPerson: c.pickupSecondPerson,
    coffin: c.coffin,
    set: c.set,
    pickup: c.pickup,
    coldRoom: c.coldRoom,
    cremationEscortCount: c.cremationEscortCount,
    cremationParishNote: c.cremationParishNote,
    notes: c.notes,
  }));

  return {
    question: payload.question || "",
    summary: payload.summary || {},
    ceremonies,
    warehouse: payload.warehouse || [],
    setsWarehouse: payload.setsWarehouse || [],
    localAnalysis: payload.localAnalysis || {},
  };
}

function findCeremoniesByQuestion(payload: Payload, source?: Array<Record<string, unknown>>) {
  const keys = questionKeywords(payload.question);
  if (!keys.length) return [];
  const ceremonies = Array.isArray(source) ? source : (Array.isArray(payload.ceremonies) ? payload.ceremonies : []);
  return ceremonies.filter((c) => fieldContainsAllKeywords(ceremonySearchBlob(c), keys));
}

function answerSearchResults(payload: Payload, list: Array<Record<string, unknown>>) {
  const keys = questionKeywords(payload.question);
  const q = norm(payload.question);
  const wantsCount = q.includes("ΠΟΣ") || q.includes("ΜΕΤΡ") || q.includes("ΣΥΝΟΛ");
  const target = keys.length ? ` για ${keys.join(" ")}` : "";
  const lines: string[] = [];
  lines.push(`${wantsCount ? "Βρήκα" : "Σχετικά αποτελέσματα"}${target}: ${list.length}.`);
  if (!list.length) {
    lines.push("• Δεν βρέθηκε καταχώρηση με αυτά τα στοιχεία στην εφαρμογή.");
    return lines.join("\n");
  }

  list
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.time || "").localeCompare(String(b.time || "")))
    .slice(0, 20)
    .forEach((c) => {
      const extra = [
        c.pickup ? `Παραλαβή: ${c.pickup}` : "",
        c.place ? `Τόπος: ${c.place}` : "",
        c.coldRoom ? `Ψυκτικός: ${c.coldRoom}` : "",
        c.notes ? `Σημ.: ${String(c.notes).slice(0, 80)}${String(c.notes).length > 80 ? "…" : ""}` : "",
      ].filter(Boolean).join(" · ");
      lines.push(`• ${c.date || "-"} ${c.time || "-"} — ${c.name || "-"}${extra ? ` — ${extra}` : ""}`);
    });
  if (list.length > 20) lines.push(`• +${list.length - 20} ακόμη.`);
  return lines.join("\n");
}

function localQuestionAnswer(payload: Payload) {
  const q = norm(payload.question);
  const ceremonies = Array.isArray(payload.ceremonies) ? payload.ceremonies : [];
  const notes = Array.isArray((payload.localAnalysis as any)?.notes) ? (payload.localAnalysis as any).notes : [];
  const errors = Array.isArray((payload.localAnalysis as any)?.errors) ? (payload.localAnalysis as any).errors : [];
  const wh = Array.isArray((payload.localAnalysis as any)?.warehouseAlerts) ? (payload.localAnalysis as any).warehouseAlerts : [];
  const scopedByTime = timeFilter(payload.question, ceremonies, payload);
  const scope = questionScope(payload.question);
  const keys = questionKeywords(payload.question);
  const wantsMost = q.includes("ΠΕΡΙΣΣ") || q.includes("TOP") || q.includes("ΣΥΧΝ") || q.includes("ΠΙΟ ΠΟΛ");

  const filterByScopeAndKeys = (list: Array<Record<string, unknown>>) => {
    let out = list.slice();
    if (scope === "cremation") out = out.filter(c => norm(c.burialType).includes("ΑΠΟΤΕΦ"));
    if (scope === "burial") out = out.filter(c => !norm(c.burialType).includes("ΑΠΟΤΕΦ"));
    if (keys.length) {
      out = out.filter(c => fieldContainsAllKeywords(fieldValue(c, scope), keys));
      if (!out.length) out = list.filter(c => fieldContainsAllKeywords(ceremonySearchBlob(c), keys));
    }
    return out;
  };

  if (q.includes("ΣΗΜΕΙ") || q.includes("ΠΡΟΣΟΧ") || q.includes("ΙΔΙΑΙΤ")) {
    const list = notes.filter((n: any) => !keys.length || fieldContainsAllKeywords([n.ceremony, n.notes].join(" "), keys));
    const lines = [`Βρήκα ${list.length} σημειώσεις.`];
    for (const n of list.slice(0, 15)) lines.push(`• ${n.ceremony || "Τελετή"}: ${n.notes || ""}`);
    return lines.join("\n");
  }

  if (q.includes("ΛΕΙΠ") || q.includes("ΕΛΛΕΙ") || q.includes("ΛΑΘ")) {
    const lines = [`Τελετές με ελλείψεις: ${errors.length}.`];
    for (const e of errors.slice(0, 15)) lines.push(`• ${e.ceremony || "Τελετή"}: ${(e.missing || []).join(", ")}`);
    return lines.join("\n");
  }

  if (q.includes("ΑΠΟΘ") || q.includes("ΠΑΡΑΓΓ") || q.includes("ΑΠΟΘΕΜ")) {
    const lines = [`Ειδοποιήσεις αποθήκης: ${wh.length}.`];
    for (const w of wh.slice(0, 20)) lines.push(`• ${w.type || "Είδος"} ${w.name || ""}: απόθεμα ${w.qty ?? "-"}`);
    return lines.join("\n");
  }

  if (wantsMost || q.includes("ΑΝΑ ΥΠΕΥΘ") || q.includes("ΥΠΕΥΘΥΝ")) {
    let getter = (c: Record<string, unknown>) => c.responsible;
    let title = "Ανά υπεύθυνο";
    if (scope === "coffin") { getter = c => c.coffin; title = "Χρήση φερέτρων"; }
    if (scope === "set") { getter = c => c.set; title = "Χρήση ΣΕΤ"; }
    if (scope === "pickup") { getter = c => c.pickup; title = "Ανά τόπο παραλαβής"; }
    if (scope === "coldRoom") { getter = c => c.coldRoom; title = "Ανά ψυκτικό θάλαμο"; }
    if (scope === "decor") { getter = c => c.decor; title = "Ανά στολισμό"; }
    const counts = groupCounts(filterByScopeAndKeys(scopedByTime), getter).filter(x => x.label !== "—").slice(0, 20);
    return counts.length ? `${title}:\n` + counts.map(x => `• ${x.label}: ${x.count}`).join("\n") : `Δεν υπάρχουν αρκετά στοιχεία για ${title.toLowerCase()}.`;
  }

  const found = filterByScopeAndKeys(scopedByTime);
  if (keys.length || scope !== "all" || q.includes("ΣΗΜΕΡ") || q.includes("ΑΥΡΙΟ") || q.includes("ΕΒΔΟΜΑΔ") || q.match(/20\d{2}/)) {
    const labels: Record<string,string> = { pickup:"παραλαβές", coldRoom:"ψυκτικούς θαλάμους", notes:"σημειώσεις", coffin:"φέρετρα", set:"ΣΕΤ", responsible:"υπεύθυνους", cremation:"αποτεφρώσεις", burial:"ταφές", coffee:"καφέ", decor:"στολισμούς", pallbearers:"φραγκοφόρους", all:"τελετές" };
    const lines = [`Βρήκα ${found.length} ${labels[scope] || "τελετές"}${keys.length ? ` για ${keys.join(" ")}` : ""}.`];
    lines.push(formatList(found));
    if (found.length && scope === "pickup") {
      const byResp = groupCounts(found, c => c.responsible).filter(x => x.label !== "—").slice(0, 10);
      if (byResp.length) lines.push("\nΑνά υπεύθυνο:\n" + byResp.map(x => `• ${x.label}: ${x.count}`).join("\n"));
    }
    return lines.join("\n");
  }

  const summary = payload.summary || {};
  return [
    "Δεν βρήκα ακριβή τύπο ερώτησης, αλλά διάβασα τα δεδομένα της εφαρμογής.",
    `• Σήμερα: ${summary.todayCount ?? "-"} τελετές`,
    `• Αύριο: ${summary.tomorrowCount ?? "-"} τελετές`,
    `• Εβδομάδα: ${summary.weekCount ?? "-"} τελετές`,
    `• Σημαντικές σημειώσεις: ${summary.importantNotes ?? notes.length}`,
    `• Ελλείψεις: ${summary.errorCeremonies ?? errors.length}`,
    `• Αποθήκη: ${summary.warehouseAlerts ?? wh.length} ειδοποιήσεις`,
    "Ρώτα με όνομα, νοσοκομείο, παραλαβή, σημείωση, φέρετρο, ΣΕΤ, υπεύθυνο ή ημερομηνία."
  ].join("\n");
}

function localFallback(payload: Payload) {
  if (String(payload.question || "").trim()) return localQuestionAnswer(payload);

  const summary = payload.summary || {};
  const notes = Array.isArray((payload.localAnalysis as any)?.notes) ? (payload.localAnalysis as any).notes : [];
  const errors = Array.isArray((payload.localAnalysis as any)?.errors) ? (payload.localAnalysis as any).errors : [];
  const wh = Array.isArray((payload.localAnalysis as any)?.warehouseAlerts) ? (payload.localAnalysis as any).warehouseAlerts : [];

  const lines: string[] = [];
  lines.push("Σύνοψη Cloud AI");
  lines.push(`Σήμερα: ${summary.todayCount ?? "-"} τελετές`);
  lines.push(`Αύριο: ${summary.tomorrowCount ?? "-"} τελετές`);
  lines.push(`Σημαντικές σημειώσεις: ${summary.importantNotes ?? notes.length}`);
  lines.push(`Τελετές με ελλείψεις: ${summary.errorCeremonies ?? errors.length}`);
  lines.push(`Ειδοποιήσεις αποθήκης: ${summary.warehouseAlerts ?? wh.length}`);
  lines.push("");

  if (notes.length) {
    lines.push("Κρίσιμες σημειώσεις πρώτα:");
    for (const n of notes.slice(0, 8)) lines.push(`• ${n.ceremony || "Τελετή"}: ${n.notes || ""}`);
    lines.push("");
  }

  if (errors.length) {
    lines.push("Ελλείψεις:");
    for (const e of errors.slice(0, 8)) lines.push(`• ${e.ceremony || "Τελετή"}: ${(e.missing || []).join(", ")}`);
    lines.push("");
  }

  if (wh.length) {
    lines.push("Αποθήκη:");
    for (const w of wh.slice(0, 8)) lines.push(`• ${w.type || "Είδος"} ${w.name || ""}: απόθεμα ${w.qty ?? "-"}`);
  }

  return lines.join("\n");
}

// ----------------------------------------------------------------------------
// LLM bridge — V41.0
// Κοινό prompt για όλα τα μοντέλα. Ίδιο περιεχόμενο όπως πριν.
// ----------------------------------------------------------------------------
function buildPrompt(payload: Payload) {
  const question = String(payload.question || "").trim();
  return `
Είσαι επιχειρησιακός AI βοηθός για ελληνικό γραφείο τελετών.
Μίλα ελληνικά, πρακτικά και σύντομα.
ΚΑΝΟΝΑΣ: Οι σημειώσεις κάθε τελετής έχουν μεγαλύτερη προτεραιότητα από όλα τα άλλα πεδία.
${question ? `Απάντησε συγκεκριμένα στην ερώτηση: ${question}` : "Βγάλε κρίσιμες ενέργειες, ελλείψεις, σημειώσεις, αποθήκη και προτεραιότητες ημέρας."}

Δεδομένα JSON:
${JSON.stringify(compactPayloadForPrompt(payload), null, 2)}
`.trim();
}

const SYSTEM_INSTRUCTION =
  "Απάντα ως αυστηρός αλλά πρακτικός βοηθός γραφείου τελετών. Μην πλατειάζεις.";

// ============================================================================
// V41.2 — AGENT TOOLS (read-only). Δουλεύουν πάνω στο payload, χωρίς νέα queries.
// ============================================================================

function addDays(d0: Date, n: number) {
  const d = new Date(d0);
  d.setDate(d.getDate() + n);
  return d;
}

function byDateTime(a: Record<string, unknown>, b: Record<string, unknown>) {
  return String(a.date || "").localeCompare(String(b.date || "")) ||
    String(a.time || "").localeCompare(String(b.time || ""));
}

// Φιλτράρισμα λίστας τελετών με βάση ρητό χρονικό διάστημα από το εργαλείο.
function filterTimeframe(list: Array<Record<string, unknown>>, timeframe: unknown, payload: Payload) {
  const tf = String(timeframe || "all").trim().toLowerCase();
  if (!tf || tf === "all" || tf === "ολα" || tf === "ολες") return list.slice();
  const now = new Date();
  const today = String((payload as any).today || new Date().toISOString().slice(0, 10));
  const tomorrow = String((payload as any).tomorrow || dateOnly(addDays(new Date(), 1)));

  if (tf === "today" || tf === "σημερα") return list.filter(c => String(c.date || "") === today);
  if (tf === "tomorrow" || tf === "αυριο") return list.filter(c => String(c.date || "") === tomorrow);
  if (tf === "week" || tf === "εβδομαδα") {
    const monday = getMonday(now); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 7);
    return list.filter(c => { const d = safeDate(c); return d && d >= monday && d < sunday; });
  }
  if (tf === "month" || tf === "μηνας") {
    const y = now.getFullYear(); const m = now.getMonth();
    return list.filter(c => { const d = safeDate(c); return d && d.getFullYear() === y && d.getMonth() === m; });
  }
  if (tf === "year" || tf === "φετος") {
    const y = now.getFullYear();
    return list.filter(c => { const d = safeDate(c); return d && d.getFullYear() === y; });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(tf)) return list.filter(c => String(c.date || "") === tf);
  if (/^\d{4}$/.test(tf)) { const y = Number(tf); return list.filter(c => { const d = safeDate(c); return d && d.getFullYear() === y; }); }
  return list.slice();
}

function compactCeremony(c: Record<string, unknown>) {
  return {
    date: c.date || "", time: c.time || "", name: c.name || "",
    place: c.place || "", pickup: c.pickup || "", coldRoom: c.coldRoom || "",
    burialType: c.burialType || "", responsible: c.responsible || "",
    coffin: c.coffin || "", set: c.set || "",
    notes: c.notes ? String(c.notes).slice(0, 200) : "",
  };
}

const COUNT_GETTERS: Record<string, (c: Record<string, unknown>) => unknown> = {
  responsible: c => c.responsible, pickup: c => c.pickup, place: c => c.place,
  coldRoom: c => c.coldRoom, coffin: c => c.coffin, set: c => c.set,
  decor: c => c.decor, burialType: c => c.burialType,
};

function toolSearchCeremonies(payload: Payload, args: any) {
  const all = Array.isArray(payload.ceremonies) ? payload.ceremonies : [];
  let list = filterTimeframe(all, args?.timeframe, payload);
  const cat = String(args?.category || "all").toLowerCase();
  if (cat === "cremation") list = list.filter(c => norm(c.burialType).includes("ΑΠΟΤΕΦ"));
  if (cat === "burial") list = list.filter(c => !norm(c.burialType).includes("ΑΠΟΤΕΦ"));
  const kw = normSearch(args?.keywords || "").split(" ").filter((x: string) => x.length >= 2);
  if (kw.length) list = list.filter(c => fieldContainsAllKeywords(ceremonySearchBlob(c), kw));
  return { count: list.length, items: list.sort(byDateTime).slice(0, 30).map(compactCeremony) };
}

function toolCountCeremonies(payload: Payload, args: any) {
  const all = Array.isArray(payload.ceremonies) ? payload.ceremonies : [];
  const list = filterTimeframe(all, args?.timeframe, payload);
  const getter = COUNT_GETTERS[String(args?.groupBy || "responsible")] || COUNT_GETTERS.responsible;
  const groups = groupCounts(list, getter).filter(x => x.label !== "—").slice(0, 30);
  return { total: list.length, groupBy: args?.groupBy || "responsible", groups };
}

function toolWarehouseAlerts(payload: Payload) {
  const wh = Array.isArray((payload.localAnalysis as any)?.warehouseAlerts) ? (payload.localAnalysis as any).warehouseAlerts : [];
  return { count: wh.length, alerts: wh.slice(0, 40) };
}

function toolListNotes(payload: Payload, args: any) {
  const notes = Array.isArray((payload.localAnalysis as any)?.notes) ? (payload.localAnalysis as any).notes : [];
  const kw = normSearch(args?.keywords || "").split(" ").filter((x: string) => x.length >= 2);
  const list = kw.length ? notes.filter((n: any) => fieldContainsAllKeywords([n.ceremony, n.notes].join(" "), kw)) : notes;
  return { count: list.length, notes: list.slice(0, 40) };
}

function toolListMissing(payload: Payload) {
  const errors = Array.isArray((payload.localAnalysis as any)?.errors) ? (payload.localAnalysis as any).errors : [];
  return { count: errors.length, missing: errors.slice(0, 40) };
}

// READ-ONLY: ετοιμάζει ΜΟΝΟ κείμενο παραγγελίας. Δεν στέλνει τίποτα.
function toolDraftSupplierMessage(_payload: Payload, args: any) {
  const item = String(args?.item || "είδος").trim();
  const qty = (args?.quantity !== undefined && args?.quantity !== null && args?.quantity !== "") ? ` ${args.quantity} τεμ.` : "";
  const supplier = String(args?.supplier || "").trim();
  const draft =
    `Καλημέρα${supplier ? ` ${supplier}` : ""},\n` +
    `Θα ήθελα να παραγγείλω${qty} ${item}.\n` +
    `Ευχαριστώ,\nΤελετές Σταυρακάκη`;
  return { draft, note: "Πρόχειρο μήνυμα μόνο — ΔΕΝ στάλθηκε. Αντιγράψτε και στείλτε χειροκίνητα." };
}

function runTool(name: string, args: any, payload: Payload) {
  switch (name) {
    case "search_ceremonies": return toolSearchCeremonies(payload, args);
    case "count_ceremonies": return toolCountCeremonies(payload, args);
    case "warehouse_alerts": return toolWarehouseAlerts(payload);
    case "list_notes": return toolListNotes(payload, args);
    case "list_missing": return toolListMissing(payload);
    case "draft_supplier_message": return toolDraftSupplierMessage(payload, args);
    default: return { error: `Άγνωστο εργαλείο: ${name}` };
  }
}

// Δηλώσεις εργαλείων για το Gemini function-calling (OpenAPI-style schema).
const TOOL_DECLARATIONS = [
  {
    name: "search_ceremonies",
    description: "Βρίσκει τελετές με βάση λέξεις-κλειδιά (όνομα, νοσοκομείο, τόπος, σημείωση κ.λπ.), χρονικό διάστημα και είδος (ταφή/αποτέφρωση). Επιστρέφει τη λίστα και το πλήθος.",
    parameters: {
      type: "OBJECT",
      properties: {
        keywords: { type: "STRING", description: "Λέξεις-κλειδιά αναζήτησης, π.χ. όνομα ή νοσοκομείο. Κενό για όλες." },
        timeframe: { type: "STRING", description: "Χρονικό διάστημα: today, tomorrow, week, month, year, all, ή ημερομηνία YYYY-MM-DD, ή έτος YYYY." },
        category: { type: "STRING", description: "all, cremation (αποτέφρωση) ή burial (ταφή)." },
      },
    },
  },
  {
    name: "count_ceremonies",
    description: "Μετράει/ομαδοποιεί τελετές ανά πεδίο (υπεύθυνος, τόπος παραλαβής, τόπος, ψυκτικός θάλαμος, φέρετρο, ΣΕΤ, στολισμός, τύπος ταφής), προαιρετικά για συγκεκριμένο χρονικό διάστημα.",
    parameters: {
      type: "OBJECT",
      properties: {
        groupBy: { type: "STRING", description: "Ένα από: responsible, pickup, place, coldRoom, coffin, set, decor, burialType." },
        timeframe: { type: "STRING", description: "today, tomorrow, week, month, year, all, YYYY-MM-DD ή YYYY." },
      },
      required: ["groupBy"],
    },
  },
  {
    name: "warehouse_alerts",
    description: "Επιστρέφει τις ειδοποιήσεις χαμηλού αποθέματος της αποθήκης.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "list_notes",
    description: "Επιστρέφει τις σημαντικές σημειώσεις τελετών (έχουν τη μέγιστη προτεραιότητα), προαιρετικά φιλτραρισμένες με λέξεις-κλειδιά.",
    parameters: {
      type: "OBJECT",
      properties: { keywords: { type: "STRING", description: "Προαιρετικές λέξεις-κλειδιά." } },
    },
  },
  {
    name: "list_missing",
    description: "Επιστρέφει τις τελετές που έχουν ελλείψεις/κενά υποχρεωτικά πεδία.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "draft_supplier_message",
    description: "Ετοιμάζει ΠΡΟΧΕΙΡΟ κείμενο μηνύματος παραγγελίας προς προμηθευτή. ΔΕΝ στέλνει τίποτα — μόνο κείμενο για αντιγραφή.",
    parameters: {
      type: "OBJECT",
      properties: {
        item: { type: "STRING", description: "Το είδος προς παραγγελία." },
        quantity: { type: "INTEGER", description: "Ποσότητα τεμαχίων (προαιρετικό)." },
        supplier: { type: "STRING", description: "Όνομα προμηθευτή (προαιρετικό)." },
      },
      required: ["item"],
    },
  },
];

const SYSTEM_INSTRUCTION_AGENT = [
  "Είσαι ο Ερμής, επιχειρησιακός AI agent για ελληνικό γραφείο τελετών (Τελετές Σταυρακάκη).",
  "Μιλάς ελληνικά, πρακτικά και σύντομα. Δεν πλατειάζεις.",
  "ΚΑΝΟΝΑΣ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ: οι σημειώσεις κάθε τελετής υπερισχύουν όλων των άλλων πεδίων.",
  "Χρησιμοποίησε ΠΑΝΤΑ τα εργαλεία για να βρεις πραγματικά στοιχεία· μην εφευρίσκεις δεδομένα.",
  "Μπορείς να καλέσεις πολλά εργαλεία στη σειρά για να συνδυάσεις πληροφορίες.",
  "Είσαι READ-ONLY: δεν αλλάζεις, δεν διαγράφεις και δεν στέλνεις τίποτα. Το draft_supplier_message ετοιμάζει μόνο κείμενο για να το στείλει ο χρήστης χειροκίνητα.",
  "Όταν έχεις αρκετά στοιχεία, δώσε καθαρή τελική απάντηση με προτεραιότητες και, αν χρειάζεται, τι να προσέξει ο χρήστης.",
].join("\n");

function buildAgentPrompt(payload: Payload) {
  const question = String(payload.question || "").trim();
  const summary = payload.summary || {};
  const total = Array.isArray(payload.ceremonies) ? payload.ceremonies.length : 0;
  const context = [
    `Σύνοψη γραφείου: σήμερα ${summary.todayCount ?? "-"} τελετές, αύριο ${summary.tomorrowCount ?? "-"}, εβδομάδα ${summary.weekCount ?? "-"}.`,
    `Διαθέσιμες τελετές στο σύστημα: ${total}.`,
    "Έχεις εργαλεία για να ψάξεις/μετρήσεις τελετές, σημειώσεις, ελλείψεις και αποθήκη.",
  ].join("\n");
  const task = question
    ? `Ερώτηση χρήστη: ${question}`
    : "Δώσε πρωινή σύνοψη: κρίσιμες σημειώσεις, ελλείψεις, αποθήκη και προτεραιότητες ημέρας.";
  return `${context}\n\n${task}`;
}

const AGENT_MAX_STEPS = 6;

// V41.2 — Agent loop με Gemini function-calling.
async function callGeminiAgent(payload: Payload) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;

  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents: any[] = [{ role: "user", parts: [{ text: buildAgentPrompt(payload) }] }];

  for (let step = 0; step < AGENT_MAX_STEPS; step++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION_AGENT }] },
        contents,
        tools: [{ function_declarations: TOOL_DECLARATIONS }],
        tool_config: { function_calling_config: { mode: "AUTO" } },
        generationConfig: { temperature: 0.2 },
      }),
    });

    if (!res.ok) throw new Error(`Gemini agent error ${res.status}`);
    const data = await res.json();
    const parts: any[] = data?.candidates?.[0]?.content?.parts || [];
    const calls = parts.filter((p) => p && p.functionCall);

    if (!calls.length) {
      const text = parts.map((p) => p?.text || "").join("").trim();
      return text || null;
    }

    // Καταγραφή της απάντησης του μοντέλου (τα function calls)
    contents.push({ role: "model", parts });

    // Εκτέλεση εργαλείων (read-only) και επιστροφή αποτελεσμάτων
    const responseParts = calls.map((p) => {
      let result: unknown;
      try {
        result = runTool(p.functionCall.name, p.functionCall.args || {}, payload);
      } catch (e) {
        result = { error: String((e as any)?.message || e) };
      }
      return { functionResponse: { name: p.functionCall.name, response: { result } } };
    });
    contents.push({ role: "user", parts: responseParts });
  }

  // Ξεπεράστηκε το όριο βημάτων -> αφήνουμε το επόμενο μονοπάτι (απλό Gemini) να απαντήσει.
  return null;
}

// ΔΩΡΕΑΝ: Google Gemini (gemini-2.0-flash). Πρώτη επιλογή αν υπάρχει key.
async function callGemini(payload: Payload) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;

  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: buildPrompt(payload) }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text || "")
    .join("")
    .trim();
  return text || null;
}

// Παλιό μονοπάτι OpenAI — διατηρείται ως εφεδρεία (αν υπάρχει OPENAI_API_KEY).
async function callOpenAI(payload: Payload) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: buildPrompt(payload) },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || null;
}

// Δοκιμάζει με σειρά: Gemini Agent (εργαλεία) -> απλό Gemini -> OpenAI.
// Καμία αποτυχία δεν "σκάει": αν όλα αποτύχουν, επιστρέφει null και απαντά
// ο τοπικός localFallback.
async function callCloudAI(payload: Payload) {
  for (const provider of [callGeminiAgent, callGemini, callOpenAI]) {
    try {
      const answer = await provider(payload);
      if (answer) return answer;
    } catch (e) {
      console.warn("Cloud AI provider failed, trying next/local:", String((e as any)?.message || e));
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const payload = await req.json() as Payload;
    const aiAnswer = await callCloudAI(payload);
    const answer = aiAnswer || localFallback(payload);
    return new Response(JSON.stringify({ ok: true, answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String((error as any)?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  }
});
