// ================================
// ΤΕΛΕΤΕΣ ΣΤΑΥΡΑΚΑΚΗ — app.js (BIBLE)
// Χειρουργικές αλλαγές:
// 1) Αφαιρέθηκε Πελάτης
// 2) Αφαιρέθηκε Γραμματεία
// 3) Default τόπος ταφής = Τριετία
// 4) Διαγραφή ΣΕΤ = δεν επανέρχεται μόνο του
// 5) Στατιστικά τοποθεσιών case-insensitive
// 6) ΣΕΤ με κεφαλαία/μικρά ενοποιούνται αυτόματα
// 7) Αποθήκη: διαχείριση “2ο άτομο βοήθειας” με add/edit/delete/reorder
// 8) Νέο πεδίο τελετής: “2ο άτομο παραλαβής” κάτω από Παραλαβή
// 9) v38.2 Universal Case ID για κάθε τελετή + office_events Event Bus
// 10) v38.3 Hermes Event Log: ο Hermes διαβάζει τα τελευταία office_events
// 11) v38.4 Office DNA Memory Engine: ο Hermes καταγράφει μοτίβα γραφείου
// 12) v38.5 Action Center: ο Hermes βαθμολογεί προτεραιότητες read-only
// 13) v38.6 Case Bridge: πρώτη επικοινωνία Τελετές → Στεφάνια/Μνημόσυνα/Αγγελτήρια/Orders
// 14) v38.7 Module Bridge: κουμπιά γρήγορης αποστολής υπόθεσης σε Μνημόσυνα/Αγγελτήριο/Orders
// 15) v38.8.1 Registry Fix: Αγγελτήριο → v22, με βάση ακριβώς τη v38.7
// 16) v38.9 Hermes Stability + Completion Engine: τοπικός υπολογισμός, χωρίς office_dna cloud calls
// 17) v38.9.1 Πεδίο Αγγελτήριο: Δεν χρειάζεται / Εκκρεμεί / Ολοκληρώθηκε
// ================================

// ---------------- CLOUD CONFIG (Supabase) ----------------
const USE_CLOUD = true;

const SUPABASE_URL = "https://rqklpnrgpiprttzsploe.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxa2xwbnJncGlwcnR0enNwbG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMzA2NTgsImV4cCI6MjA5ODYwNjY1OH0.L9kumMt04wy0rlEfE79AwvGD8C2YWAyr_CIh9dDlBZQ";

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extra
  };
}

// ---------------- PWA / PUSH ----------------
const VAPID_PUBLIC_KEY =
  "BK7NS0ErC-xKQaTiBFm48qDEZE9IZZtbWvTqgAQCrZMGTjzxZtZ2eDvVsJAL7jIvga47TZyc6c-fAtOgijKOLKM";

const SW_PATH = "./sw.js";
const EDGE_FUNCTION_PUSH_SENDER = "push_sender";
const EDGE_PUSH_URL = `${SUPABASE_URL}/functions/v1/${EDGE_FUNCTION_PUSH_SENDER}`;

const PUSH_PREF_KEY = "staurakaki_push_pref_v2";
const LAST_PUSH_TS_KEY = "staurakaki_last_push_ts_v2";
const PUSH_SUB_LOCAL_KEY = "staurakaki_push_sub_v1";

const EDGE_PUSH_DEBOUNCE_MS = 2500;
let edgePushTimer = null;

// ---------------- AI Cloud Bridge V3 ----------------
// Η εφαρμογή συνεχίζει να δουλεύει με τον τοπικό AI V1.
// Αν αργότερα ενεργοποιηθεί Supabase Edge Function `ai-assistant`, το κουμπί Cloud AI θα στέλνει ασφαλές snapshot.
const AI_EDGE_FUNCTION_NAME = "ai-assistant";
const AI_EDGE_URL = `${SUPABASE_URL}/functions/v1/${AI_EDGE_FUNCTION_NAME}`;
const AI_CLOUD_TIMEOUT_MS = 18000;
const AI_CLOUD_DAILY_LIMIT = 10;

function aiCloudUsageKey() {
  return "fos_ai_cloud_" + getTodayStr();
}

function aiGetCloudUsage() {
  const used = parseInt(localStorage.getItem(aiCloudUsageKey()) || "0", 10);
  return { used, limit: AI_CLOUD_DAILY_LIMIT, remaining: Math.max(0, AI_CLOUD_DAILY_LIMIT - used) };
}

function aiIncrementCloudUsage() {
  const key = aiCloudUsageKey();
  const current = parseInt(localStorage.getItem(key) || "0", 10);
  localStorage.setItem(key, String(current + 1));
  aiUpdateCloudUsageBadge();
}

function aiUpdateCloudUsageBadge() {
  const el = document.getElementById("aiCloudUsage");
  if (!el) return;
  const { used, limit, remaining } = aiGetCloudUsage();
  if (remaining === 0) {
    el.innerHTML = `<span class="ai-usage-badge ai-usage-full">☁ Cloud AI: ${used}/${limit} — Όριο ημέρας. Επαναφέρεται αύριο.</span>`;
  } else {
    el.innerHTML = `<span class="ai-usage-badge">☁ Cloud AI: ${used}/${limit} χρήσεις σήμερα</span>`;
  }
}

let edgePushQueue = [];

// ---------------- Safe DOM helpers ----------------
const $ = (id) => document.getElementById(id);
const val = (id) => ($(id)?.value ?? "");
const setVal = (id, v) => { const el = $(id); if (el) el.value = v ?? ""; };
const on = (el, ev, fn) => { if (el) el.addEventListener(ev, fn); };
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Returns `en` string when running in English app, `gr` otherwise.
function t(gr, en) { return window.__appLang === "en" ? en : gr; }

// ---------------- Dropdown επιλογές ----------------
const RESPONSIBLE_OPTIONS = ["-"];
const DEFAULT_SECOND_HELPERS = ["Κανένας"];
const SUITCASE_OPTIONS = ["-"];

// ---------------- Πλήρης Αποθήκη Επιλογών για όλα τα dropdowns ----------------
const DEFAULT_OPTIONS = {
  responsiblePeople: ["-"],
  secondPeople: ["Κανένας"],
  pickupSecondPeople: [],
  suitcasePeople: ["-"],
  decorators: [],
  pallbearersOptions: [],
  coffeeOptions: [],
  graveZones: []
};

const DEFAULT_OPTIONS_EN = {
  responsiblePeople: [],
  secondPeople: [],
  pickupSecondPeople: [],
  suitcasePeople: [],
  decorators: [],
  pallbearersOptions: [],
  coffeeOptions: [],
  graveZones: []
};

const OPTION_LISTS = [
  { key: "responsiblePeople", bodyId: "responsiblePeopleBody", label: "Υπεύθυνος τελετής" },
  { key: "secondPeople", bodyId: "secondPeopleBody", label: "2ο άτομο βοήθειας" },
  { key: "pickupSecondPeople", bodyId: "pickupSecondPeopleBody", label: "2ο άτομο παραλαβής" },
  { key: "suitcasePeople", bodyId: "suitcasePeopleBody", label: "Βαλίτσα" },
  { key: "decorators", bodyId: "decoratorsBody", label: "Στολισμός" },
  { key: "pallbearersOptions", bodyId: "pallbearersOptionsBody", label: "Φραγκοφόροι" },
  { key: "coffeeOptions", bodyId: "coffeeOptionsBody", label: "Καφές" },
  { key: "graveZones", bodyId: "graveZonesBody", label: "Ζώνη Τριετίας" }
];

// ---------------- ΣΤΑΘΕΡΑ ----------------
const COFFINS = [
  "ΦΛΩΡΙΝΑ ΜΑΥΡΟ ΜΑΤ 35ΑΡΙ ΚΑΥΣΗΣ",
  "ΦΛΩΡΙΝΑ ΜΕΛΙ ΜΑΤ 35ΑΡΙ ΚΑΥΣΗΣ",
  "ΦΛΩΡΙΝΑ ΜΕΛΙ ΛΑΚΑ 35ΑΡΙ",
  "ΦΛΩΡΙΝΑ ΜΑΥΡΟ ΛΑΚΑ 35ΑΡΙ",
  "ΦΛΩΡΙΝΑ ΚΑΡΥΔΙ ΛΑΚΑ 40ΑΡΙ",
  "ΦΛΩΡΙΝΑ ΚΕΡΑΣΙ ΛΑΚΑ 40ΑΡΙ",
  "ΦΛΩΡΙΝΑ ΜΕΛΙ ΛΑΚΑ 40ΑΡΙ",
  "ΦΛΩΡΙΝΑ ΜΑΥΡΟ ΛΑΚΑ 40ΑΡΙ",
  "ΦΛΩΡΙΝΑ ΜΑΥΡΟ ΜΑΤ 40ΑΡΙ",
  "ΦΛΩΡΙΝΑ ΜΕΛΙ ΜΑΤ 40ΑΡΙ",
  "ΚΩΣΤΑΚΗ ΝΕΟΝ ΛΑΚΑ",
  "ΚΩΣΤΑΚΗ ΝΕΟΝ ΜΑΤ",
  "ΚΩΣΤΑΚΗ ΣΚΑΦΗ ΛΑΚΑ",
  "ΚΩΣΤΑΚΗ ΣΚΑΦΗ ΜΑΤ",
  "ΚΩΣΤΑΚΗ ΑΤΛΑΣ ΜΑΤ",
  "ΑΜΠΑΖΟ ΜΑΥΡΟ ΛΑΚΑ",
  "ΑΜΠΑΖΟ ΛΕΥΚΟ",
  "ΣΙΝΑΝΗΣ ΜΠΟΛΕΡΟ SATINE",
  "ΚΟΣΜΑΣ ΣΠΑΝΙΟ",
  "ΚΑΡΑΜΠΙΝΗΣ ΦΟΥΣΚΑ ΔΡΥΣ",
  "ΚΑΡΑΜΠΙΝΗΣ ΦΟΥΣΚΑ ΚΑΦΕ",
  "ΚΑΡΑΜΠΙΝΗΣ ΦΟΥΣΚΑ ΧΩΡΙΣ ΒΕΛΟΥΔΟ",
  "ΚΑΡΑΜΠΙΝΗΣ ΜΠΟΤΣΗ ΜΑΥΡΟ ΛΑΚΑ",
  "ΚΑΡΑΜΠΙΝΗΣ ΜΠΟΤΣΗ ΚΑΦΕ ΛΑΚΑ",
  "ΔΗΜΟΥ ΑΠΟΤΕΦΡΩΤΙΚΟ",
  "ΚΟΣΜΑΣ ΓΟΡΙΛΑ",
  "ΚΟΣΜΑΣ ΓΟΡΙΛΑ ΛΕΥΚΟ",
  "ΚΟΣΜΑΣ ΓΟΡΙΛΑ ΚΑΦΕ",
  "ΚΟΣΜΑΣ ΓΟΡΙΛΑ ΑΠΟΤΕΦΡΩΤΙΚΟ",
  "ΠΑΝΤΕΛΙΟΣ 1,80*0,50 ΣΚΑΦΑΚΙ",
  "ΠΑΝΤΕΛΙΟΣ 1,80*0,60 ΣΚΑΦΑΚΙ",
  "ΔΗΜΟΥ ΣΚΑΦΗ ΑΠΟΤΕΦΡΩΣΗΣ ΑΛΛΗ",
  "ΚΑΡΑΜΠΙΝΗΣ ΑΥΓΟΥΛΑΤΗ ΜΑΥΡΗ ΚΟΚΚ. ΒΕΛΟΥΔΟ",
  "ΚΑΡΑΜΠΙΝΗΣ ΑΥΓΟΥΛΑΤΗ ΜΑΥΡΗ ΜΠΛΕ ΒΕΛΟΥΔΟ",
  "ΚΑΡΑΜΠΙΝΗΣ ΣΚΑΦΗ ΚΑΛΗ ΜΠΛΕ ΒΕΛΟΥΔΟ",
  "ΚΑΡΑΜΠΙΝΗΣ ΣΚΑΦΗ ΚΑΛΗ ΚΟΚΚ. ΒΕΛΟΥΔΟ",
  "ΚΑΡΑΜΠΙΝΗΣ ΚΑΜΠΙΝΑ ΜΑΥΡΗ ΚΟΚΚΙΝΟ ΒΕΛΟΥΔΟ",
  "ΕΛΥΤΗΣ ΚΑΦΕ",
  "ΕΛΥΤΗΣ ΜΑΥΡΟ",
  "ΑΡΜΟΝΙΑ ΚΑΦΕ ΜΑΤ ΝΕΡΑ",
  "ΚΑΡΑΜΠΙΝΗΣ ΔΡΥΣ",
  "ΤΙΡΑΜΟΛΑ ΚΑΦΕ",
  "ΚΑΦΕ ΧΩΡΙΣ ΣΤΑΥΡΟ",
  "ΚΟΣΜΑΣ ΛΑΚΑ ΜΕ ΧΑΡΑΚΤΟ ΣΤΑΥΡΟ"
];

const DEFAULT_SETS = ["ΓΚΡΙ", "ΛΕΥΚΟ", "ΚΟΚΚΙΝΟ", "ΜΠΛΕ"];

// ---------------- State ----------------
let ceremonies = [];
let warehouse = [];
let setsWarehouse = [];
let secondHelpers = [];
let changeLog = [];
let pushSubs = [];
let optionWarehouse = window.__appLang === "en" ? {} : JSON.parse(JSON.stringify(DEFAULT_OPTIONS));
let aiSeenNotes = [];
let aiSeenAlerts = [];
let aiChatHistory = [];
let customFields = [];
let customLists = [];
let sectionData = {};

// ---------------- LocalStorage Keys ----------------
const CEREMONIES_KEY = "staurakaki_ceremonies_v8";
const WAREHOUSE_KEY  = "staurakaki_warehouse_v8";
const SETS_KEY       = "staurakaki_sets_v8";
const SECOND_HELPERS_KEY = "staurakaki_second_helpers_v1";
const CHANGELOG_KEY  = "staurakaki_changes_v8";
const BACKUP_KEY     = "staurakaki_backup_v8";
const DEVICE_LABEL_KEY = "staurakaki_device_label_v1";
const LAST_SEEN_CHANGE_TS = "staurakaki_last_seen_change_ts_v1";
const OPTIONS_KEY = "staurakaki_option_warehouse_v2";
const AI_SEEN_NOTES_KEY = "staurakaki_ai_seen_notes_v1";
const AI_SEEN_ALERTS_KEY = "staurakaki_ai_seen_alerts_v1";
const AI_CHAT_HISTORY_KEY = "staurakaki_ai_chat_history_v1";
const CUSTOM_FIELDS_KEY = "staurakaki_custom_fields_v36";
const CUSTOM_LISTS_KEY = "staurakaki_custom_lists_v1";
const SECTION_DATA_KEY = "funeralos_section_data_v1";
const OFFICE_EVENTS_LOCAL_KEY = "staurakaki_office_events_v1";
const OFFICE_DNA_LOCAL_KEY = "staurakaki_office_dna_v1";

// ---------------- Helpers ----------------
function nowTs() { return Date.now(); }

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}


function compactDateForCaseId(dateStr = "") {
  const raw = String(dateStr || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/-/g, "");
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function createUniversalCaseId(dateStr = "", seed = "") {
  const datePart = compactDateForCaseId(dateStr);
  const safeSeed = String(seed || nowTs()).replace(/\D/g, "").slice(-6).padStart(6, "0");
  return `CASE-${datePart}-${safeSeed}`;
}

function ensureCeremonyCaseId(c) {
  if (!c) return createUniversalCaseId();
  return c.case_id || c.caseId || createUniversalCaseId(c.date || "", c.id || nowTs());
}

function loadLocalOfficeEvents() {
  try { return JSON.parse(localStorage.getItem(OFFICE_EVENTS_LOCAL_KEY)) || []; } catch { return []; }
}

function saveLocalOfficeEvent(event) {
  try {
    const list = loadLocalOfficeEvents();
    list.unshift(event);
    localStorage.setItem(OFFICE_EVENTS_LOCAL_KEY, JSON.stringify(list.slice(0, 500)));
  } catch (e) {
    console.warn("Local office event save skipped", e);
  }
}

function loadLocalOfficeDna() {
  try { return JSON.parse(localStorage.getItem(OFFICE_DNA_LOCAL_KEY)) || []; } catch { return []; }
}

function saveLocalOfficeDna(list) {
  try { localStorage.setItem(OFFICE_DNA_LOCAL_KEY, JSON.stringify((list || []).slice(0, 300))); } catch (e) { console.warn("Local office DNA save skipped", e); }
}

function officeDnaKey(category, keyName) {
  return `${category}::${keyName}`;
}

function mergeOfficeDnaMemories(memories) {
  const existing = loadLocalOfficeDna();
  const map = new Map(existing.map(m => [officeDnaKey(m.category, m.key_name), m]));
  let changed = false;
  (memories || []).forEach((m) => {
    if (!m?.category || !m?.key_name) return;
    const k = officeDnaKey(m.category, m.key_name);
    const old = map.get(k);
    const next = {
      ...(old || {}),
      ...m,
      created_at: old?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (JSON.stringify(old || {}) !== JSON.stringify(next)) changed = true;
    map.set(k, next);
  });
  const list = [...map.values()].sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));
  if (changed) saveLocalOfficeDna(list);
  return list;
}

let lastOfficeDnaSyncHash = "";
async function syncOfficeDnaToCloud(memories) {
  // v38.9 Stability: προσωρινά ΔΕΝ γράφουμε office_dna στο Supabase.
  // Ο Hermes δουλεύει τοπικά από τις τελετές/localStorage ώστε να μη δημιουργούνται 401/RLS σφάλματα.
  return;
}

function emitOfficeEvent(type, ceremony, extra = {}) {
  const event = {
    case_id: ceremony?.case_id || ensureCeremonyCaseId(ceremony),
    app: "teletes",
    type,
    title: extra.title || (type === "ceremony_created" ? "Νέα τελετή" : "Ενημέρωση τελετής"),
    payload: {
      ceremony_id: ceremony?.id || "",
      name: ceremony?.name || "",
      date: ceremony?.date || "",
      time: ceremony?.time || "",
      place: ceremony?.place || "",
      burialType: ceremony?.burialType || "Ταφή",
      ...extra.payload
    },
    created_at: new Date().toISOString()
  };

  saveLocalOfficeEvent(event);

  if (!USE_CLOUD) return;
  fetch(`${SUPABASE_URL}/rest/v1/office_events`, {
    method: "POST",
    headers: supabaseHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(event)
  }).catch((e) => console.warn("office_events insert skipped", e));
}


// ---------------- V38.6 Case Bridge — πρώτη επικοινωνία εφαρμογών ----------------
const OFFICE_MODULE_URLS = {
  wreaths: "https://stefania14.pages.dev/",
  memorials: "https://mnimo1.pages.dev/",
  announcements: "https://aggeltirio22.pages.dev/",
  orders: "https://order1-3hn.pages.dev/"
};

const OFFICE_MODULE_LABELS = {
  wreaths: "Στεφάνια",
  memorials: "Μνημόσυνα",
  announcements: "Αγγελτήριο",
  orders: "Orders"
};

function buildCaseBridgePayload(c) {
  return {
    case_id: ensureCeremonyCaseId(c),
    ceremony_id: c?.id || "",
    name: c?.name || "",
    customer: c?.customer || c?.client || "",
    date: c?.date || "",
    time: c?.time || "",
    place: c?.place || "",
    burial_type: c?.burialType || "Ταφή",
    responsible: c?.responsible || "",
    source: "teletes_v38_7"
  };
}

function buildCaseBridgeUrl(moduleKey, c) {
  const base = OFFICE_MODULE_URLS[moduleKey];
  if (!base) return "#";
  const payload = buildCaseBridgePayload(c);
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([k, v]) => { if (v !== undefined && v !== null && String(v).trim() !== "") params.set(k, String(v)); });
  return `${base}?${params.toString()}`;
}

function buildCaseBridgeText(c) {
  const p = buildCaseBridgePayload(c);
  return [
    `Υπόθεση: ${p.case_id}`,
    p.name ? `Όνομα: ${p.name}` : "",
    p.date ? `Ημερομηνία: ${formatDate(p.date)}${p.time ? ` • ${p.time}` : ""}` : "",
    p.place ? `Τοποθεσία: ${p.place}` : "",
    p.burial_type ? `Τρόπος: ${p.burial_type}` : "",
    p.responsible ? `Υπεύθυνος: ${p.responsible}` : ""
  ].filter(Boolean).join("\n");
}

async function openCaseBridge(moduleKey, c) {
  const label = OFFICE_MODULE_LABELS[moduleKey] || moduleKey;
  const url = buildCaseBridgeUrl(moduleKey, c);
  emitOfficeEvent("case_bridge_opened", c, {
    title: `Άνοιγμα ${label}`,
    payload: { module: moduleKey, module_label: label, bridge_url: url }
  });
  window.open(url, "_blank", "noopener,noreferrer");
}

async function copyCaseBridge(c) {
  const text = buildCaseBridgeText(c);
  try {
    await navigator.clipboard.writeText(text);
    alert("Αντιγράφηκαν τα στοιχεία της υπόθεσης.");
  } catch {
    prompt("Αντιγραφή στοιχείων υπόθεσης", text);
  }
  emitOfficeEvent("case_bridge_copied", c, { title: "Αντιγραφή υπόθεσης", payload: { text } });
}

function normalizeTextKey(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("el-GR");
}

function normalizeSetName(text) {
  return normalizeTextKey(text);
}

function normalizeNameLabel(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

function normalizeSearchText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("el-GR");
}

function aiQuestionKeywords(question) {
  const stop = new Set([
    "ΠΟΣΕΣ", "ΠΟΣΟΙ", "ΠΟΣΑ", "ΠΟΙΑ", "ΠΟΙΕΣ", "ΠΟΙΟΣ",
    "ΕΧΟΥΜΕ", "ΕΧΕΙ", "ΕΙΝΑΙ", "ΑΠΟ", "ΣΤΟ", "ΣΤΗ", "ΣΤΗΝ", "ΣΤΟΝ", "ΣΤΑ", "ΣΕ", "ΓΙΑ", "ΜΕ",
    "ΠΑΡΑΛΑΒΗ", "ΠΑΡΑΛΑΒΕΣ", "ΠΑΡΑΛΑΒΩΝ", "ΠΑΡΑΛΑΒΗΣ",
    "ΝΟΣΟΚΟΜΕΙΟ", "ΝΟΣΟΚΟΜΕΙΟΥ", "ΝΟΣΟΚ", "ΚΛΙΝΙΚΗ", "ΚΛΙΝΙΚΗΣ",
    "ΤΕΛΕΤΕΣ", "ΤΕΛΕΤΗ", "ΣΗΜΕΡΑ", "ΑΥΡΙΟ"
  ]);
  return normalizeSearchText(question)
    .split(/[^A-ZΑ-Ω0-9]+/i)
    .map(x => x.trim())
    .filter(x => x.length >= 3 && !stop.has(x));
}

function aiFieldHasAllKeywords(value, keywords) {
  const hay = normalizeSearchText(value);
  return keywords.every(k => hay.includes(k));
}

function aiCeremonySearchBlob(c) {
  return [
    c.name, c.date, c.time, c.place, c.pickup, c.coldRoom, c.notes,
    c.responsible, c.secondPerson, c.pickupSecondPerson, c.burialType, c.coffin, c.set
  ].filter(Boolean).join(" ");
}

function aiSimpleHash(text) {
  const str = String(text || "");
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function aiNoteKey(c) {
  const idPart = String(c?.id || `${c?.date || ""}|${c?.time || ""}|${c?.name || ""}`);
  return `${idPart}::${aiSimpleHash(c?.notes || "")}`;
}

function aiIsNoteSeen(c) {
  const key = typeof c === "string" ? c : aiNoteKey(c);
  return Array.isArray(aiSeenNotes) && aiSeenNotes.includes(key);
}

function aiFindCeremonyForCloudNote(n) {
  const note = String(n?.notes || "").trim();
  const name = normalizeTextKey(n?.name || "");
  const date = String(n?.date || "");
  const time = String(n?.time || "");
  return (ceremonies || []).find(c =>
    String(c.notes || "").trim() === note &&
    (!name || normalizeTextKey(c.name) === name) &&
    (!date || String(c.date || "") === date) &&
    (!time || String(c.time || "") === time)
  ) || null;
}

function aiMarkNoteSeen(key) {
  if (!key) return;
  if (!Array.isArray(aiSeenNotes)) aiSeenNotes = [];
  if (!aiSeenNotes.includes(key)) aiSeenNotes.push(key);
  addChange("ai_note_seen", t("AI σημείωση σημειώθηκε ως διαβασμένη","AI note marked as seen"));
  saveData();
  updateHomeDashboard();
  if (aiLastMode === "cloud") aiRunCloud();
  else aiRun(aiLastMode || "briefing");
}

function aiAlertKey(type, raw) {
  return `${String(type || "alert")}::${aiSimpleHash(String(raw || ""))}`;
}

function aiErrorKey(item) {
  const c = item?.ceremony || item || {};
  const idPart = String(c.id || `${c.date || ""}|${c.time || ""}|${c.name || ""}`);
  const miss = Array.isArray(item?.missing) ? item.missing.join("|") : aiMissingForCeremony(c).join("|");
  return aiAlertKey("error", `${idPart}|${miss}`);
}

function aiWarehouseAlertKey(item) {
  return aiAlertKey("warehouse", `${item?.type || ""}|${item?.name || ""}|${item?.qty ?? ""}`);
}

function aiIsAlertSeen(keyOrType, raw = null) {
  const key = raw === null ? String(keyOrType || "") : aiAlertKey(keyOrType, raw);
  return Array.isArray(aiSeenAlerts) && aiSeenAlerts.includes(key);
}

function aiMarkAlertSeen(key) {
  if (!key) return;
  if (!Array.isArray(aiSeenAlerts)) aiSeenAlerts = [];
  if (!Array.isArray(customFields)) customFields = [];
  if (!aiSeenAlerts.includes(key)) aiSeenAlerts.push(key);
  addChange("ai_alert_seen", t("AI ειδοποίηση σημειώθηκε ως διαβασμένη","AI alert marked as seen"));
  saveData();
  updateHomeDashboard();
  if (aiLastMode === "cloud") aiRunCloud();
  else aiRun(aiLastMode || "briefing");
}

function aiSeenButton(key) {
  return `<div class="ai-note-actions"><button type="button" class="ai-seen-btn" data-ai-seen-alert="${esc(key)}">Το είδα</button></div>`;
}

function getDeviceLabel() { return localStorage.getItem(DEVICE_LABEL_KEY) || ""; }

function setDeviceLabel(label) {
  const clean = (label || "").trim();
  if (!clean) return;
  localStorage.setItem(DEVICE_LABEL_KEY, clean);
}

function ensureDeviceLabel() {
  let label = getDeviceLabel();
  if (!label) {
    const msg = window.__appLang === "en"
      ? "Enter a device name (e.g. Office iPhone, Front Desk Mac):"
      : "Δώσε όνομα συσκευής (π.χ. iPhone Σταύρου, iMac γραφείου):";
    label = window.prompt(msg, "");
    if (label) setDeviceLabel(label);
  }
}

function saveBackup(reason = "") {
  try {
    localStorage.setItem(
      BACKUP_KEY,
      JSON.stringify({ ceremonies, warehouse, setsWarehouse, secondHelpers, optionWarehouse, changeLog, pushSubs, aiSeenNotes, aiSeenAlerts, aiChatHistory, customFields, ts: nowTs(), reason, deviceLabel: getDeviceLabel() })
    );
  } catch (e) {
    console.error("saveBackup error", e);
  }
}

function getTodayStr() {
  const n = new Date();
  const yyyy = n.getFullYear();
  const mm = String(n.getMonth() + 1).padStart(2, "0");
  const dd = String(n.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateToStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysStr(yyyyMmDd, daysToAdd) {
  const d = new Date(yyyyMmDd);
  d.setDate(d.getDate() + daysToAdd);
  return dateToStr(d);
}

function formatDate(dStr) {
  if (!dStr) return "";
  const d = new Date(dStr);
  if (Number.isNaN(d.getTime())) return dStr;
  const days = t(
    ["Κυριακή","Δευτέρα","Τρίτη","Τετάρτη","Πέμπτη","Παρασκευή","Σάββατο"],
    ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  );
  const dayName = days[d.getDay()];
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dayName} · ${yyyy}-${mm}-${dd}`;
}

// ---------------- Change log ----------------
function getLastSeenChangeTs() {
  return Number(localStorage.getItem(LAST_SEEN_CHANGE_TS) || "0") || 0;
}

function setLastSeenChangeTs(ts) {
  localStorage.setItem(LAST_SEEN_CHANGE_TS, String(ts || 0));
}

function queueEdgePush(changeEntry) {
  try {
    edgePushQueue.push(changeEntry);
    if (edgePushTimer) clearTimeout(edgePushTimer);
    edgePushTimer = setTimeout(() => {
      const batch = edgePushQueue.slice();
      edgePushQueue = [];
      edgePushTimer = null;
      sendEdgePushBatch(batch).catch(() => {});
    }, EDGE_PUSH_DEBOUNCE_MS);
  } catch {}
}

async function sendEdgePushBatch(batch) {
  if (!Array.isArray(batch) || batch.length === 0) return;
  // Only send push notifications in production to avoid alerting the real office during dev
  if (window.location.hostname !== "funeralos.net") return;

  const me = getDeviceLabel() || t("Άγνωστη συσκευή", "Unknown device");
  const title = t("Σταυρακάκη — Νέα αλλαγή", "FuneralOS — New update");
  let body = "";

  if (batch.length === 1) {
    const c = batch[0];
    body = `${c.device || me}: ${c.summary || t("Αλλαγή", "Update")}`;
  } else {
    body = `${me}: ${batch.length} ${t("αλλαγές", "changes")}`;
  }

  const payload = {
    app_id: "main",
    title,
    body,
    changes: batch.slice(-20)
  };

  try {
    await fetch(EDGE_PUSH_URL, {
      method: "POST",
      headers: supabaseHeaders(),
      body: JSON.stringify(payload)
    });
  } catch {
    console.warn("Edge push sender call failed (ignored until function exists).");
  }
}

function addChange(action, summary) {
  const entry = {
    ts: nowTs(),
    action: action || "update",
    summary: summary || "",
    device: getDeviceLabel() || "Άγνωστη συσκευή"
  };
  ensureOptionWarehouse();

  if (!Array.isArray(changeLog)) changeLog = [];
  changeLog.push(entry);
  if (changeLog.length > 200) changeLog = changeLog.slice(-200);
  queueEdgePush(entry);
}

function unreadChangesCount() {
  const seen = getLastSeenChangeTs();
  const me = getDeviceLabel() || "";
  return (changeLog || []).filter(c => (c.ts || 0) > seen && (c.device || "") !== me).length;
}

function markAllChangesRead() {
  const maxTs = Math.max(0, ...(changeLog || []).map(c => Number(c.ts) || 0));
  setLastSeenChangeTs(maxTs);
  renderUpdatesBadge();
}

// ---------------- Updates UI ----------------
function ensureUpdatesUI() {
  const topBar = document.querySelector(".top-bar");
  if (!topBar) return;

  if (!$("updatesBtn")) {
    const btn = document.createElement("button");
    btn.id = "updatesBtn";
    btn.type = "button";
    btn.textContent = "Updates";
    btn.style.marginLeft = "10px";
    btn.style.borderRadius = "999px";
    btn.style.border = "none";
    btn.style.padding = "6px 12px";
    btn.style.fontSize = "12px";
    btn.style.fontWeight = "800";
    btn.style.cursor = "pointer";
    btn.style.background = "#e3d7c5";
    btn.style.color = "#1f2430";

    const badge = document.createElement("span");
    badge.id = "updatesBadge";
    badge.textContent = "0";
    badge.style.marginLeft = "8px";
    badge.style.padding = "2px 8px";
    badge.style.borderRadius = "999px";
    badge.style.background = "#111827";
    badge.style.color = "#f9fafb";
    badge.style.fontSize = "11px";
    badge.style.display = "none";

    btn.appendChild(badge);
    btn.onclick = () => openUpdatesModal();

    const brand = topBar.querySelector(".brand-pill");
    if (brand && brand.parentNode) brand.parentNode.insertBefore(btn, brand.nextSibling);
    else topBar.appendChild(btn);
  }

  if (!$("updatesModal")) {
    const modal = document.createElement("div");
    modal.id = "updatesModal";
    modal.className = "modal hidden";

    const content = document.createElement("div");
    content.className = "modal-content";

    const h2 = document.createElement("h2");
    h2.textContent = t("Updates / Αλλαγές", "Updates");

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.flexWrap = "wrap";
    actions.style.margin = "10px 0";

    const btnPush = document.createElement("button");
    btnPush.textContent = "🔔 Push (Option B)";
    btnPush.style.borderRadius = "999px";
    btnPush.style.border = "none";
    btnPush.style.padding = "7px 14px";
    btnPush.style.cursor = "pointer";
    btnPush.style.background = "#e3d7c5";
    btnPush.onclick = () => setupPushOptB();

    const btnRead = document.createElement("button");
    btnRead.textContent = "Σημείωση ως διαβασμένα";
    btnRead.style.borderRadius = "999px";
    btnRead.style.border = "none";
    btnRead.style.padding = "7px 14px";
    btnRead.style.cursor = "pointer";
    btnRead.style.background = "#e5e7eb";
    btnRead.onclick = () => { markAllChangesRead(); renderUpdatesList(); };

    const btnClose = document.createElement("button");
    btnClose.textContent = "Κλείσιμο";
    btnClose.style.borderRadius = "999px";
    btnClose.style.border = "none";
    btnClose.style.padding = "7px 14px";
    btnClose.style.cursor = "pointer";
    btnClose.style.background = "#111827";
    btnClose.style.color = "#fff";
    btnClose.onclick = () => closeUpdatesModal();

    actions.append(btnPush, btnRead, btnClose);

    const note = document.createElement("div");
    note.style.fontSize = "12px";
    note.style.color = "#6b7280";
    note.style.marginBottom = "8px";
    note.innerHTML = `
      <div><b>Σημείωση:</b> Για να έρθει push στο iPhone όταν η εφαρμογή είναι κλειστή, πρέπει να είναι εγκατεστημένη (Add to Home Screen).</div>
    `;

    const list = document.createElement("div");
    list.id = "updatesList";
    list.style.fontSize = "13px";
    list.style.color = "#1f2430";

    content.append(h2, actions, note, list);
    modal.appendChild(content);
    document.body.appendChild(modal);
  }

  renderUpdatesBadge();
}

function renderUpdatesBadge() {
  const badge = $("updatesBadge");
  const btn = $("updatesBtn");
  if (!badge || !btn) return;

  const n = unreadChangesCount();
  badge.textContent = String(n);

  if (n > 0) {
    badge.style.display = "inline-block";
    btn.style.background = "#111827";
    btn.style.color = "#f9fafb";
  } else {
    badge.style.display = "none";
    btn.style.background = "#e3d7c5";
    btn.style.color = "#1f2430";
  }
}

function renderUpdatesList() {
  const el = $("updatesList");
  if (!el) return;

  const seen = getLastSeenChangeTs();
  const me = getDeviceLabel() || "";

  const items = (changeLog || [])
    .slice()
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .slice(0, 60);

  if (!items.length) {
    el.innerHTML = `<p style="color:#6b7280;">Δεν υπάρχουν καταγεγραμμένες αλλαγές.</p>`;
    return;
  }

  el.innerHTML = items.map(c => {
    const unread = (c.ts || 0) > seen && (c.device || "") !== me;
    const dot = unread ? "🟢" : "⚪️";
    const t = formatTimestamp(c.ts);
    const summary = esc(c.summary || "");
    const dev = esc(c.device || "");
    return `
      <div style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
        <div style="display:flex;justify-content:space-between;gap:10px;">
          <div><b>${dot} ${dev}</b></div>
          <div style="color:#6b7280;font-size:12px;">${t}</div>
        </div>
        <div style="margin-top:4px;">${summary || "<span style='color:#6b7280;'>—</span>"}</div>
      </div>
    `;
  }).join("");
}

function openUpdatesModal() {
  const modal = $("updatesModal");
  if (!modal) return;
  renderUpdatesList();
  modal.classList.remove("hidden");
}

function closeUpdatesModal() {
  $("updatesModal")?.classList.add("hidden");
}

// ---------------- Cloud load/save ----------------
async function getCloudSession() {
  try {
    if (window.__sb) {
      const { data: { session } } = await window.__sb.auth.getSession();
      if (session?.user?.id) return { rowId: session.user.id, token: session.access_token };
    }
  } catch {}
  return null;
}

async function cloudLoadData() {
  const base = `${SUPABASE_URL}/rest/v1`;
  const session = await getCloudSession();
  if (!session) throw new Error("No authenticated user for cloud load");
  const res = await fetch(`${base}/app_state?id=eq.${session.rowId}&select=payload`, {
    headers: { ...supabaseHeaders(), Authorization: `Bearer ${session.token}` }
  });
  if (!res.ok) throw new Error("Failed to load app_state from cloud");
  const rows = await res.json();
  if (rows.length && rows[0].payload) {
    const p = rows[0].payload;
    if (Array.isArray(p.ceremonies)) ceremonies = p.ceremonies;
    if (Array.isArray(p.warehouse)) warehouse = p.warehouse;
    if (Array.isArray(p.setsWarehouse)) setsWarehouse = p.setsWarehouse;
    if (Array.isArray(p.secondHelpers)) secondHelpers = p.secondHelpers;
    if (Array.isArray(p.changeLog)) changeLog = p.changeLog;
    if (Array.isArray(p.pushSubs)) pushSubs = p.pushSubs;
    if (p.optionWarehouse && typeof p.optionWarehouse === "object") optionWarehouse = p.optionWarehouse;
    if (Array.isArray(p.aiSeenNotes)) aiSeenNotes = p.aiSeenNotes;
    if (Array.isArray(p.aiSeenAlerts)) aiSeenAlerts = p.aiSeenAlerts;
    if (Array.isArray(p.aiChatHistory)) aiChatHistory = p.aiChatHistory;
    if (Array.isArray(p.customFields)) customFields = p.customFields;
    if (Array.isArray(p.customLists)) customLists = p.customLists;
  }
}

async function cloudSaveAll() {
  if (window.__DEMO_MODE) return;
  const base = `${SUPABASE_URL}/rest/v1`;
  const session = await getCloudSession();
  if (!session) { console.error("No authenticated user for cloud save"); return; }
  const payload = { ceremonies, warehouse, setsWarehouse, secondHelpers, optionWarehouse, changeLog, pushSubs, aiSeenNotes, aiSeenAlerts, aiChatHistory, customFields, customLists };
  try {
    await fetch(`${base}/app_state`, {
      method: "POST",
      headers: { ...supabaseHeaders({ Prefer: "resolution=merge-duplicates" }), Authorization: `Bearer ${session.token}` },
      body: JSON.stringify([{ id: session.rowId, payload }])
    });
  } catch (e) {
    console.error("Cloud save failed", e);
  }
}

function normalizeSetsWarehouseList(list) {
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach((item) => {
    const rawName = typeof item === "string" ? item : item?.name;
    const name = normalizeSetName(rawName);
    if (!name) return;
    const qty = Number(typeof item === "string" ? 0 : item?.qty) || 0;
    if (!map.has(name)) map.set(name, { name, qty: 0 });
    map.get(name).qty += qty;
  });
  return Array.from(map.values());
}

function normalizeSecondHelpersList(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((raw) => {
    const name = normalizeNameLabel(typeof raw === "string" ? raw : raw?.name);
    if (!name) return;
    const key = normalizeTextKey(name);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  });
  return out;
}

function dedupeTextArray(arr) {
  const map = new Map();
  (arr || []).forEach((v) => {
    const str = String(v ?? "").trim().replace(/\s+/g, " ");
    if (str === "" && !map.has("__EMPTY__")) {
      map.set("__EMPTY__", "");
      return;
    }
    if (!str) return;
    const key = normalizeTextKey(str);
    if (!map.has(key)) map.set(key, str);
  });
  return Array.from(map.values());
}

function ensureOptionWarehouse() {
  if (!optionWarehouse || typeof optionWarehouse !== "object") optionWarehouse = {};

  if (window.__appLang === "en") {
    // EN: only preserve user-saved data — no Greek defaults injected
    for (const key of Object.keys(DEFAULT_OPTIONS_EN)) {
      if (!Array.isArray(optionWarehouse[key])) optionWarehouse[key] = [];
    }
    secondHelpers = normalizeSecondHelpersList(optionWarehouse.secondPeople || []);
    return;
  }

  const migratedSecondHelpers = normalizeSecondHelpersList(secondHelpers || []);

  const migration = {
    responsiblePeople: RESPONSIBLE_OPTIONS,
    secondPeople: migratedSecondHelpers.length ? migratedSecondHelpers : DEFAULT_OPTIONS.secondPeople,
    pickupSecondPeople: migratedSecondHelpers.length ? ["", ...migratedSecondHelpers.filter(x => normalizeTextKey(x) !== normalizeTextKey("Κανένας"))] : DEFAULT_OPTIONS.pickupSecondPeople,
    suitcasePeople: SUITCASE_OPTIONS,
    decorators: DEFAULT_OPTIONS.decorators,
    pallbearersOptions: DEFAULT_OPTIONS.pallbearersOptions,
    coffeeOptions: DEFAULT_OPTIONS.coffeeOptions,
    graveZones: DEFAULT_OPTIONS.graveZones
  };

  for (const key of Object.keys(DEFAULT_OPTIONS)) {
    const current = Array.isArray(optionWarehouse[key]) ? optionWarehouse[key] : [];
    optionWarehouse[key] = dedupeTextArray([...(migration[key] || []), ...DEFAULT_OPTIONS[key], ...current]);
  }

  secondHelpers = normalizeSecondHelpersList(optionWarehouse.secondPeople || DEFAULT_OPTIONS.secondPeople);
}

function migrateOptionWarehouseToCustomLists() {
  if (Array.isArray(customLists) && customLists.length > 0) return;
  if (!Array.isArray(customLists)) customLists = [];
  const OW = optionWarehouse || {};
  const entries = [
    [t("Υπεύθυνος τελετής", "Ceremony coordinator"), OW.responsiblePeople],
    [t("2ο άτομο βοήθειας", "2nd assistant"), OW.secondPeople],
    [t("2ο άτομο παραλαβής", "2nd pickup person"), OW.pickupSecondPeople],
    [t("Βαλίτσα", "Luggage"), OW.suitcasePeople],
    [t("Στολισμός", "Decoration"), OW.decorators],
    [t("Φραγκοφόροι", "Pallbearers"), OW.pallbearersOptions],
    [t("Καφές", "Wake / reception"), OW.coffeeOptions],
    [t("Ζώνες τριετίας", "Grave zones"), OW.graveZones]
  ];
  let any = false;
  entries.forEach(([name, arr], idx) => {
    const items = (Array.isArray(arr) ? arr : []).filter(x => x !== "" && x !== "-" && x !== "Κανένας" && x !== "None");
    if (items.length > 0) {
      customLists.push({ id: "cl_migrated_" + idx, name, items });
      any = true;
    }
  });
  if (any) saveData();
}

function getAllCustomListItems() {
  const seen = new Set();
  const out = [];
  (customLists || []).forEach(list => {
    (list.items || []).forEach(item => {
      const key = normalizeTextKey(item);
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(item);
      }
    });
  });
  return out;
}

function getOptions(key) {
  ensureOptionWarehouse();
  return optionWarehouse[key] || [];
}

function optionLabelForPrompt(key) {
  return (OPTION_LISTS.find(x => x.key === key)?.label || key);
}

function addOption(key) {
  ensureOptionWarehouse();
  const label = optionLabelForPrompt(key);
  const value = prompt(`Νέα επιλογή για ${label}:`, "");
  if (value === null) return;
  const clean = String(value).trim().replace(/\s+/g, " ");
  if (!clean && key !== "pickupSecondPeople" && key !== "graveZones") return alert("Γράψε τιμή.");
  if (getOptions(key).some(x => normalizeTextKey(x) === normalizeTextKey(clean))) return alert("Υπάρχει ήδη αυτή η επιλογή.");
  optionWarehouse[key].push(clean);
  if (key === "secondPeople") secondHelpers = normalizeSecondHelpersList(optionWarehouse[key]);
  addChange("option_add", `Νέα επιλογή (${label}): ${clean || "κενή επιλογή"}`);
  saveBackup("addOption");
  saveData();
  renderAll();
}

function editOption(key, idx) {
  ensureOptionWarehouse();
  const label = optionLabelForPrompt(key);
  const oldValue = optionWarehouse[key][idx] ?? "";
  const value = prompt(`Αλλαγή επιλογής για ${label}:`, oldValue);
  if (value === null) return;
  const clean = String(value).trim().replace(/\s+/g, " ");
  if (!clean && key !== "pickupSecondPeople" && key !== "graveZones") return alert("Γράψε τιμή.");
  if (optionWarehouse[key].some((x, i) => i !== idx && normalizeTextKey(x) === normalizeTextKey(clean))) return alert("Υπάρχει ήδη αυτή η επιλογή.");
  optionWarehouse[key][idx] = clean;
  updateCeremonyOptionReferences(key, oldValue, clean);
  if (key === "secondPeople") secondHelpers = normalizeSecondHelpersList(optionWarehouse[key]);
  addChange("option_edit", `Αλλαγή επιλογής (${label}): ${oldValue || "κενή"} → ${clean || "κενή"}`);
  saveBackup("editOption");
  saveData();
  renderAll();
}

function deleteOption(key, idx) {
  ensureOptionWarehouse();
  const label = optionLabelForPrompt(key);
  const oldValue = optionWarehouse[key][idx] ?? "";
  if (!confirm(t(`Διαγραφή επιλογής "${oldValue || "κενή επιλογή"}" από ${label};`, `Delete option "${oldValue || "empty"}" from ${label}?`))) return;
  optionWarehouse[key].splice(idx, 1);
  clearCeremonyOptionReferences(key, oldValue);
  if (key === "secondPeople") secondHelpers = normalizeSecondHelpersList(optionWarehouse[key]);
  addChange("option_delete", `Διαγραφή επιλογής (${label}): ${oldValue || "κενή επιλογή"}`);
  saveBackup("deleteOption");
  saveData();
  renderAll();
}

function moveOption(key, fromIdx, toIdx) {
  ensureOptionWarehouse();
  const arr = optionWarehouse[key];
  moveItem(arr, fromIdx, toIdx);
  if (key === "secondPeople") secondHelpers = normalizeSecondHelpersList(arr);
  addChange("option_reorder", `Αλλαγή σειράς: ${optionLabelForPrompt(key)}`);
  saveData();
  renderCustomLists();
}

function updateCeremonyOptionReferences(key, oldValue, newValue) {
  ceremonies.forEach(c => {
    if (key === "responsiblePeople" && c.responsible === oldValue) c.responsible = newValue;
    if (key === "secondPeople" && c.secondPerson === oldValue) c.secondPerson = newValue;
    if (key === "pickupSecondPeople" && c.pickupSecondPerson === oldValue) c.pickupSecondPerson = newValue;
    if (key === "suitcasePeople" && c.suitcase === oldValue) c.suitcase = newValue;
    if (key === "decorators" && c.decor === oldValue) c.decor = newValue;
    if (key === "pallbearersOptions" && c.pallbearers === oldValue) c.pallbearers = newValue;
    if (key === "coffeeOptions" && c.coffee === oldValue) c.coffee = newValue;
    if (key === "graveZones" && c.graveZone === oldValue) c.graveZone = newValue;
  });
}

function clearCeremonyOptionReferences(key, oldValue) {
  ceremonies.forEach(c => {
    if (key === "responsiblePeople" && c.responsible === oldValue) c.responsible = "-";
    if (key === "secondPeople" && c.secondPerson === oldValue) c.secondPerson = "Κανένας";
    if (key === "pickupSecondPeople" && c.pickupSecondPerson === oldValue) c.pickupSecondPerson = "";
    if (key === "suitcasePeople" && c.suitcase === oldValue) c.suitcase = "-";
    if (key === "decorators" && c.decor === oldValue) c.decor = "";
    if (key === "pallbearersOptions" && c.pallbearers === oldValue) c.pallbearers = "";
    if (key === "coffeeOptions" && c.coffee === oldValue) c.coffee = "";
    if (key === "graveZones" && c.graveZone === oldValue) c.graveZone = "";
  });
}

// ---------------- Demo Mode ----------------
function loadDemoData() {
  const d = (n) => { const dt = new Date(); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };

  if (window.__appLang === "en") {
    const base = { sheet: '', set: '', flowers: '', announcementStatus: 'Not needed', decor: '', decorNote: '', secondPerson: 'None', pickupSecondPerson: '', suitcase: '-', coffee: '', coffeePlace: '', pickup: '', pickupDate: '', coldRoom: '', cremationEscortCount: 0, cremationParishNote: '', graveNumber: '', graveZone: '', customValues: {} };
    ceremonies = [
      { ...base, id: 'demo_1', case_id: 'DEMO-2026-001', name: 'Johnson Michael', date: d(0), time: '10:00', place: 'St. Nicholas Cathedral', burialType: 'Ταφή', responsible: 'Thomas', coffin: 'VICTORIA BLACK GLOSS 43"', pallbearers: '6 bearers', graveType: 'Τριετία', announcementStatus: 'Pending', notes: '⚠️ Cemetery plot NOT confirmed — call municipality ASAP. Pallbearers unconfirmed. Family insisting on full church service.' },
      { ...base, id: 'demo_2', case_id: 'DEMO-2026-002', name: 'Williams Elizabeth', date: d(1), time: '11:30', place: 'Holy Trinity Church', burialType: 'Ταφή', responsible: 'Andrew', coffin: 'ROYAL NEON HIGH GLOSS', pallbearers: '8 bearers', graveType: 'Οικογενειακός', announcementStatus: 'Pending', notes: 'White flowers only — NO wreaths. 8 pallbearers requested but only 4 confirmed. Hearse reservation unconfirmed.' },
      { ...base, id: 'demo_3', case_id: 'DEMO-2026-003', name: 'Davis Robert', date: d(3), time: '09:00', place: 'Hatherley Crematorium', burialType: 'Αποτεφρωση', responsible: 'Thomas', coffin: 'HAMILTON CREMATION CASKET', cremationEscortCount: 2, graveType: '', notes: 'Family arriving from abroad' },
      { ...base, id: 'demo_4', case_id: 'DEMO-2026-004', name: 'Thompson James', date: d(5), time: '10:30', place: 'St. Mary\'s Cathedral', burialType: 'Ταφή', responsible: 'Andrew', coffin: 'VICTORIA HONEY OAK GLOSS 43"', pallbearers: '6 bearers', graveType: 'Τριετία', notes: '' },
      { ...base, id: 'demo_5', case_id: 'DEMO-2026-005', name: 'Anderson Patricia', date: d(7), time: '12:00', place: 'Christ Church', burialType: 'Ταφή', responsible: 'Christine', coffin: 'CAMEO WHITE', pallbearers: '', graveType: 'Οικογενειακός', notes: 'Pallbearers pending confirmation' },
      { ...base, id: 'demo_6', case_id: 'DEMO-2026-006', name: 'Clark George', date: d(10), time: '09:30', place: 'Hatherley Crematorium', burialType: 'Αποτεφρωση', responsible: 'Thomas', coffin: 'HAMILTON CREMATION CASKET', cremationEscortCount: 1, graveType: '', notes: '' },
      { ...base, id: 'demo_7', case_id: 'DEMO-2026-007', name: 'Harris Dorothy', date: d(-3), time: '10:00', place: 'St. Paul\'s Church', burialType: 'Ταφή', responsible: 'Andrew', coffin: 'VICTORIA BLACK GLOSS 38"', pallbearers: '6 bearers', graveType: 'Τριετία', notes: '' },
      { ...base, id: 'demo_8', case_id: 'DEMO-2026-008', name: 'Lewis Richard', date: d(-6), time: '11:00', place: 'All Saints Chapel', burialType: 'Ταφή', responsible: 'Christine', coffin: 'ROYAL TROUGH GLOSS', pallbearers: '8 bearers', graveType: 'Τριετία', notes: '' },
      { ...base, id: 'demo_9', case_id: 'DEMO-2026-009', name: 'Robinson Helen', date: d(-8), time: '09:00', place: 'Hatherley Crematorium', burialType: 'Αποτεφρωση', responsible: 'Thomas', coffin: 'HAMILTON CREMATION CASKET', cremationEscortCount: 3, graveType: '', notes: '' },
      { ...base, id: 'demo_10', case_id: 'DEMO-2026-010', name: 'Walker Arthur', date: d(-12), time: '10:30', place: 'St. Nicholas Cathedral', burialType: 'Ταφή', responsible: 'Andrew', coffin: 'VICTORIA MAHOGANY GLOSS 43"', pallbearers: '6 bearers', graveType: 'Οικογενειακός', notes: '' },
      { ...base, id: 'demo_11', case_id: 'DEMO-2026-011', name: 'Mitchell Catherine', date: d(-15), time: '12:00', place: 'Christ Church', burialType: 'Ταφή', responsible: 'Christine', coffin: 'CAMEO BLACK GLOSS', pallbearers: '4 bearers', graveType: 'Τριετία', notes: '' },
      { ...base, id: 'demo_12', case_id: 'DEMO-2026-012', name: 'Campbell William', date: d(-18), time: '10:00', place: 'Holy Trinity Church', burialType: 'Ταφή', responsible: 'Andrew', coffin: 'ROYAL ATLAS MATTE', pallbearers: '6 bearers', graveType: 'Τριετία', notes: '' },
      { ...base, id: 'demo_13', case_id: 'DEMO-2026-013', name: 'Johnson Michael — 40-day memorial', date: d(2), time: '08:30', place: 'St. Nicholas Cathedral', burialType: 'Μνημόσυνο', responsible: 'Andrew', coffin: '', pallbearers: '', graveType: '', notes: 'Koliva provided by family' },
      { ...base, id: 'demo_14', case_id: 'DEMO-2026-014', name: 'Williams E. — 6-month memorial', date: d(6), time: '09:00', place: 'Christ Church', burialType: 'Μνημόσυνο', responsible: 'Christine', coffin: '', pallbearers: '', graveType: '', notes: '' },
      { ...base, id: 'demo_15', case_id: 'DEMO-2026-015', name: 'Davis R. — 40-day memorial', date: d(-3), time: '10:30', place: 'Holy Trinity Church', burialType: 'Μνημόσυνο', responsible: 'Thomas', coffin: '', pallbearers: '', graveType: '', notes: '' },
      { ...base, id: 'demo_16', case_id: 'DEMO-2026-016', name: 'Harris D. — annual memorial', date: d(-7), time: '08:30', place: 'All Saints Chapel', burialType: 'Μνημόσυνο', responsible: 'Andrew', coffin: '', pallbearers: '', graveType: '', notes: '' },
      { ...base, id: 'demo_17', case_id: 'DEMO-2026-017', name: 'Lewis R. — 40-day memorial', date: d(-20), time: '09:00', place: 'St. Nicholas Cathedral', burialType: 'Μνημόσυνο', responsible: 'Christine', coffin: '', pallbearers: '', graveType: '', notes: '' },
    ];
    warehouse = [
      { name: 'VICTORIA BLACK GLOSS 43"', qty: 4 }, { name: 'VICTORIA BLACK GLOSS 38"', qty: 3 },
      { name: 'VICTORIA MAHOGANY GLOSS 43"', qty: 3 }, { name: 'VICTORIA HONEY OAK GLOSS 43"', qty: 3 },
      { name: 'ROYAL NEON HIGH GLOSS', qty: 2 }, { name: 'ROYAL TROUGH GLOSS', qty: 3 },
      { name: 'ROYAL ATLAS MATTE', qty: 3 }, { name: 'CAMEO BLACK GLOSS', qty: 3 },
      { name: 'CAMEO WHITE', qty: 2 }, { name: 'HAMILTON CREMATION CASKET', qty: 3 },
    ];
    setsWarehouse = [{ name: 'GREY', qty: 8 }, { name: 'WHITE', qty: 6 }, { name: 'BEIGE', qty: 5 }];
    customLists = [{ id: 'demo_cl_1', name: 'Staff', items: ['Thomas', 'Andrew', 'Christine', 'Mary'] }];
    secondHelpers = ['None', 'Thomas', 'Andrew', 'Christine'];
    changeLog = [];
    optionWarehouse = {};
    return;
  }

  const base = { sheet: '', set: '', flowers: '', announcementStatus: 'Δεν χρειάζεται', decor: '', decorNote: '', secondPerson: 'Κανένας', pickupSecondPerson: '', suitcase: '-', coffee: '', coffeePlace: '', pickup: '', pickupDate: '', coldRoom: '', cremationEscortCount: 0, cremationParishNote: '', graveNumber: '', graveZone: '', customValues: {} };
  ceremonies = [
    { ...base, id: 'demo_1', case_id: 'DEMO-2026-001', name: 'Παπαδόπουλος Γεώργιος', date: d(0), time: '10:00', place: 'Ι.Ν. Αγ. Νικολάου Κηφισιάς', burialType: 'Ταφή', responsible: 'Θανάσης', coffin: 'ΦΛΩΡΙΝΑ ΜΑΥΡΟ ΛΑΚΑ 40ΑΡΙ', pallbearers: '6άδα', graveType: 'Τριετία', announcementStatus: 'Εκκρεμεί', notes: '⚠️ ΕΚΚΡΕΜΕΙ επιβεβαίωση νεκροταφείου — επείγει! Φραγκοφόροι ανεπιβεβαίωτοι. Οικογένεια επιμένει για πλήρη ακολουθία.' },
    { ...base, id: 'demo_2', case_id: 'DEMO-2026-002', name: 'Ζαφειρίου Αγγελική', date: d(1), time: '11:30', place: 'Ι.Ν. Κοιμήσεως Θεοτόκου Αμαρουσίου', burialType: 'Ταφή', responsible: 'Σταύρος', coffin: 'ΚΩΣΤΑΚΗ ΝΕΟΝ ΛΑΚΑ', pallbearers: '8άδα', graveType: 'Οικογενειακός', announcementStatus: 'Εκκρεμεί', notes: 'Μόνο λευκά λουλούδια — χωρίς στεφάνια. 8 φραγκοφόροι ζητήθηκαν αλλά μόνο 4 επιβεβαιωμένοι. Νεκροφόρα αδέσμευτη.' },
    { ...base, id: 'demo_3', case_id: 'DEMO-2026-003', name: 'Κωνσταντίνου Δημήτρης', date: d(3), time: '09:00', place: 'Αποτεφρωτήριο Ριτσώνας', burialType: 'Αποτεφρωση', responsible: 'Θανάσης', coffin: 'ΔΗΜΟΥ ΑΠΟΤΕΦΡΩΤΙΚΟ', cremationEscortCount: 2, graveType: '', notes: 'Συγγενείς από Θεσσαλονίκη' },
    { ...base, id: 'demo_4', case_id: 'DEMO-2026-004', name: 'Νικολάου Σταύρος', date: d(5), time: '10:30', place: 'Ι.Ν. Αγ. Παντελεήμονος Ιλίου', burialType: 'Ταφή', responsible: 'Σταύρος', coffin: 'ΦΛΩΡΙΝΑ ΜΕΛΙ ΛΑΚΑ 40ΑΡΙ', pallbearers: '6άδα', graveType: 'Τριετία', notes: '' },
    { ...base, id: 'demo_5', case_id: 'DEMO-2026-005', name: 'Παναγιωτίδου Ελένη', date: d(7), time: '12:00', place: 'Ι.Ν. Αγ. Τριάδος Χολαργού', burialType: 'Ταφή', responsible: 'Χρήστος', coffin: 'ΑΜΠΑΖΟ ΛΕΥΚΟ', pallbearers: '', graveType: 'Οικογενειακός', notes: 'Φραγκοφόροι εκκρεμούν' },
    { ...base, id: 'demo_6', case_id: 'DEMO-2026-006', name: 'Βασιλείου Ανδρέας', date: d(10), time: '09:30', place: 'Αποτεφρωτήριο Ριτσώνας', burialType: 'Αποτεφρωση', responsible: 'Θανάσης', coffin: 'ΚΟΣΜΑΣ ΓΟΡΙΛΑ ΑΠΟΤΕΦΡΩΤΙΚΟ', cremationEscortCount: 1, graveType: '', notes: '' },
    { ...base, id: 'demo_7', case_id: 'DEMO-2026-007', name: 'Χριστοδούλου Μαρία', date: d(-3), time: '10:00', place: 'Ι.Ν. Αγ. Σπυρίδωνος Πειραιά', burialType: 'Ταφή', responsible: 'Σταύρος', coffin: 'ΦΛΩΡΙΝΑ ΜΑΥΡΟ ΛΑΚΑ 35ΑΡΙ', pallbearers: '6άδα', graveType: 'Τριετία', notes: '' },
    { ...base, id: 'demo_8', case_id: 'DEMO-2026-008', name: 'Σπηλιώτης Κώστας', date: d(-6), time: '11:00', place: 'Ι.Ν. Αγ. Δημητρίου Αμπελοκήπων', burialType: 'Ταφή', responsible: 'Χρήστος', coffin: 'ΚΩΣΤΑΚΗ ΣΚΑΦΗ ΛΑΚΑ', pallbearers: '8άδα', graveType: 'Τριετία', notes: '' },
    { ...base, id: 'demo_9', case_id: 'DEMO-2026-009', name: 'Αλεξίου Φωτεινή', date: d(-8), time: '09:00', place: 'Αποτεφρωτήριο Ριτσώνας', burialType: 'Αποτεφρωση', responsible: 'Θανάσης', coffin: 'ΔΗΜΟΥ ΑΠΟΤΕΦΡΩΤΙΚΟ', cremationEscortCount: 3, graveType: '', notes: '' },
    { ...base, id: 'demo_10', case_id: 'DEMO-2026-010', name: 'Παπαδάκης Νίκος', date: d(-12), time: '10:30', place: 'Ι.Ν. Αγ. Νικολάου Κηφισιάς', burialType: 'Ταφή', responsible: 'Σταύρος', coffin: 'ΦΛΩΡΙΝΑ ΚΑΡΥΔΙ ΛΑΚΑ 40ΑΡΙ', pallbearers: '6άδα', graveType: 'Οικογενειακός', notes: '' },
    { ...base, id: 'demo_11', case_id: 'DEMO-2026-011', name: 'Δημητρίου Χρυσούλα', date: d(-15), time: '12:00', place: 'Ι.Ν. Αγ. Τριάδος Χολαργού', burialType: 'Ταφή', responsible: 'Χρήστος', coffin: 'ΑΜΠΑΖΟ ΜΑΥΡΟ ΛΑΚΑ', pallbearers: '4άδα', graveType: 'Τριετία', notes: '' },
    { ...base, id: 'demo_12', case_id: 'DEMO-2026-012', name: 'Μπέης Σωκράτης', date: d(-18), time: '10:00', place: 'Ι.Ν. Αγ. Παντελεήμονος Ιλίου', burialType: 'Ταφή', responsible: 'Σταύρος', coffin: 'ΚΩΣΤΑΚΗ ΑΤΛΑΣ ΜΑΤ', pallbearers: '6άδα', graveType: 'Τριετία', notes: '' },
    { ...base, id: 'demo_13', case_id: 'DEMO-2026-013', name: 'Παπαδόπουλος Αντώνης — 40ήμερο', date: d(2), time: '08:30', place: 'Ι.Ν. Αγ. Νικολάου Κηφισιάς', burialType: 'Μνημόσυνο', responsible: 'Σταύρος', coffin: '', pallbearers: '', graveType: '', notes: 'Κόλλυβα από οικογένεια' },
    { ...base, id: 'demo_14', case_id: 'DEMO-2026-014', name: 'Θεοδωρίδου Βάσω — 6μηνο', date: d(6), time: '09:00', place: 'Ι.Ν. Αγ. Τριάδος Χολαργού', burialType: 'Μνημόσυνο', responsible: 'Χρήστος', coffin: '', pallbearers: '', graveType: '', notes: '' },
    { ...base, id: 'demo_15', case_id: 'DEMO-2026-015', name: 'Αλεξίου Χαράλαμπος — 40ήμερο', date: d(-3), time: '10:30', place: 'Ι.Ν. Αγ. Παντελεήμονος Ιλίου', burialType: 'Μνημόσυνο', responsible: 'Θανάσης', coffin: '', pallbearers: '', graveType: '', notes: '' },
    { ...base, id: 'demo_16', case_id: 'DEMO-2026-016', name: 'Χαλκιάς Ιωάννης — ετήσιο', date: d(-7), time: '08:30', place: 'Ι.Ν. Αγ. Δημητρίου Αμπελοκήπων', burialType: 'Μνημόσυνο', responsible: 'Σταύρος', coffin: '', pallbearers: '', graveType: '', notes: '' },
    { ...base, id: 'demo_17', case_id: 'DEMO-2026-017', name: 'Κατσαρός Βασίλης — 40ήμερο', date: d(-20), time: '09:00', place: 'Ι.Ν. Αγ. Νικολάου Κηφισιάς', burialType: 'Μνημόσυνο', responsible: 'Χρήστος', coffin: '', pallbearers: '', graveType: '', notes: '' },
  ];
  // 30 φέρετρα — 2 with critical low stock to trigger alerts
  warehouse = [
    { name: 'ΦΛΩΡΙΝΑ ΜΑΥΡΟ ΛΑΚΑ 40ΑΡΙ', qty: 4 },
    { name: 'ΦΛΩΡΙΝΑ ΜΕΛΙ ΛΑΚΑ 40ΑΡΙ', qty: 3 },
    { name: 'ΦΛΩΡΙΝΑ ΚΑΡΥΔΙ ΛΑΚΑ 40ΑΡΙ', qty: 3 },
    { name: 'ΦΛΩΡΙΝΑ ΜΑΥΡΟ ΛΑΚΑ 35ΑΡΙ', qty: 4 },
    { name: 'ΚΩΣΤΑΚΗ ΝΕΟΝ ΛΑΚΑ', qty: 2 },
    { name: 'ΚΩΣΤΑΚΗ ΣΚΑΦΗ ΛΑΚΑ', qty: 3 },
    { name: 'ΚΩΣΤΑΚΗ ΑΤΛΑΣ ΜΑΤ', qty: 3 },
    { name: 'ΑΜΠΑΖΟ ΜΑΥΡΟ ΛΑΚΑ', qty: 3 },
    { name: 'ΑΜΠΑΖΟ ΛΕΥΚΟ', qty: 2 },
    { name: 'ΔΗΜΟΥ ΑΠΟΤΕΦΡΩΤΙΚΟ', qty: 3 },
  ];
  setsWarehouse = [
    { name: 'ΓΚΡΙ', qty: 8 },
    { name: 'ΛΕΥΚΟ', qty: 6 },
    { name: 'ΜΠΕΖ', qty: 5 },
  ];
  customLists = [
    { id: 'demo_cl_1', name: 'Προσωπικό', items: ['Θανάσης', 'Σταύρος', 'Χρήστος', 'Μαρία'] },
  ];
  secondHelpers = ['Κανένας', 'Θανάσης', 'Σταύρος', 'Χρήστος'];
  changeLog = [];
  optionWarehouse = {};
}

// ---------------- Load / Save ----------------
async function loadData() {
  if (window.__DEMO_MODE) {
    loadDemoData();
    return;
  }
  if (USE_CLOUD) {
    try {
      await cloudLoadData();
      localStorage.setItem(CEREMONIES_KEY, JSON.stringify(ceremonies));
      localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(warehouse));
      localStorage.setItem(SETS_KEY, JSON.stringify(setsWarehouse));
      localStorage.setItem(SECOND_HELPERS_KEY, JSON.stringify(secondHelpers));
      localStorage.setItem(CHANGELOG_KEY, JSON.stringify(changeLog));
      localStorage.setItem(PUSH_SUB_LOCAL_KEY, JSON.stringify(pushSubs || []));
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(optionWarehouse || {}));
      localStorage.setItem(AI_SEEN_NOTES_KEY, JSON.stringify(aiSeenNotes || []));
    localStorage.setItem(AI_SEEN_ALERTS_KEY, JSON.stringify(aiSeenAlerts || []));
      localStorage.setItem(AI_SEEN_ALERTS_KEY, JSON.stringify(aiSeenAlerts || []));
      localStorage.setItem(AI_CHAT_HISTORY_KEY, JSON.stringify(aiChatHistory || []));
  localStorage.setItem(CUSTOM_FIELDS_KEY, JSON.stringify(customFields || []));
      localStorage.setItem(CUSTOM_FIELDS_KEY, JSON.stringify(customFields || []));
      localStorage.setItem(CUSTOM_LISTS_KEY, JSON.stringify(customLists || []));
    } catch (e) {
      console.error("Cloud load error, falling back to local", e);
      try { ceremonies = JSON.parse(localStorage.getItem(CEREMONIES_KEY)) || []; } catch { ceremonies = []; }
      try { warehouse = JSON.parse(localStorage.getItem(WAREHOUSE_KEY)) || []; } catch { warehouse = []; }
      try { setsWarehouse = JSON.parse(localStorage.getItem(SETS_KEY)) || []; } catch { setsWarehouse = []; }
      try { secondHelpers = JSON.parse(localStorage.getItem(SECOND_HELPERS_KEY)) || []; } catch { secondHelpers = []; }
      try { changeLog = JSON.parse(localStorage.getItem(CHANGELOG_KEY)) || []; } catch { changeLog = []; }
      try { pushSubs = JSON.parse(localStorage.getItem(PUSH_SUB_LOCAL_KEY)) || []; } catch { pushSubs = []; }
      try { optionWarehouse = JSON.parse(localStorage.getItem(OPTIONS_KEY)) || {}; } catch { optionWarehouse = {}; }
      try { aiSeenNotes = JSON.parse(localStorage.getItem(AI_SEEN_NOTES_KEY)) || []; } catch { aiSeenNotes = []; }
      try { aiSeenAlerts = JSON.parse(localStorage.getItem(AI_SEEN_ALERTS_KEY)) || []; } catch { aiSeenAlerts = []; }
    try { aiChatHistory = JSON.parse(localStorage.getItem(AI_CHAT_HISTORY_KEY)) || []; } catch { aiChatHistory = []; }
      try { customFields = JSON.parse(localStorage.getItem(CUSTOM_FIELDS_KEY)) || []; } catch { customFields = []; }
      try { aiChatHistory = JSON.parse(localStorage.getItem(AI_CHAT_HISTORY_KEY)) || []; } catch { aiChatHistory = []; }
      try { customFields = JSON.parse(localStorage.getItem(CUSTOM_FIELDS_KEY)) || []; } catch { customFields = []; }
      try { customLists = JSON.parse(localStorage.getItem(CUSTOM_LISTS_KEY)) || []; } catch { customLists = []; }
      try { sectionData = JSON.parse(localStorage.getItem(SECTION_DATA_KEY)) || {}; } catch { sectionData = {}; }
    }
  } else {
    try { ceremonies = JSON.parse(localStorage.getItem(CEREMONIES_KEY)) || []; } catch { ceremonies = []; }
    try { warehouse = JSON.parse(localStorage.getItem(WAREHOUSE_KEY)) || []; } catch { warehouse = []; }
    try { setsWarehouse = JSON.parse(localStorage.getItem(SETS_KEY)) || []; } catch { setsWarehouse = []; }
    try { secondHelpers = JSON.parse(localStorage.getItem(SECOND_HELPERS_KEY)) || []; } catch { secondHelpers = []; }
    try { changeLog = JSON.parse(localStorage.getItem(CHANGELOG_KEY)) || []; } catch { changeLog = []; }
    try { pushSubs = JSON.parse(localStorage.getItem(PUSH_SUB_LOCAL_KEY)) || []; } catch { pushSubs = []; }
    try { optionWarehouse = JSON.parse(localStorage.getItem(OPTIONS_KEY)) || {}; } catch { optionWarehouse = {}; }
    try { aiSeenNotes = JSON.parse(localStorage.getItem(AI_SEEN_NOTES_KEY)) || []; } catch { aiSeenNotes = []; }
    try { aiSeenAlerts = JSON.parse(localStorage.getItem(AI_SEEN_ALERTS_KEY)) || []; } catch { aiSeenAlerts = []; }
    try { customFields = JSON.parse(localStorage.getItem(CUSTOM_FIELDS_KEY)) || []; } catch { customFields = []; }
    try { customLists = JSON.parse(localStorage.getItem(CUSTOM_LISTS_KEY)) || []; } catch { customLists = []; }
    try { sectionData = JSON.parse(localStorage.getItem(SECTION_DATA_KEY)) || {}; } catch { sectionData = {}; }
  }

  ceremonies = (ceremonies || []).map((c) => ({
    id: c.id || String(nowTs()),
    case_id: ensureCeremonyCaseId(c),
    date: c.date || "",
    time: c.time || "",
    name: c.name ?? "",
    place: c.place ?? "",
    burialType: c.burialType ?? "Ταφή",

    cremationEscortCount: Number(c.cremationEscortCount ?? 0) || 0,
    cremationParishNote: c.cremationParishNote ?? "",

    responsible: c.responsible ?? "-",
    secondPerson: c.secondPerson ?? "Κανένας",
    pickupSecondPerson: c.pickupSecondPerson ?? "",
    suitcase: c.suitcase ?? "-",

    coffin: c.coffin ?? "",
    set: c.set ? normalizeSetName(c.set) : "",
    flowers: c.flowers ?? "",
    announcementStatus: c.announcementStatus ?? "Δεν χρειάζεται",
    decor: c.decor ?? "",
    decorNote: c.decorNote ?? "",
    pallbearers: c.pallbearers ?? "",
    coffee: c.coffee ?? "",
    coffeePlace: c.coffeePlace ?? "",
    pickup: c.pickup ?? "",
    pickupDate: c.pickupDate ?? "",
    coldRoom: c.coldRoom ?? "",
    graveType: c.graveType ?? "Τριετία",
    graveNumber: c.graveNumber ?? "",
    graveZone: c.graveZone ?? "",
    notes: c.notes ?? "",
    customValues: c.customValues && typeof c.customValues === "object" ? c.customValues : {}
  }));

  if (!Array.isArray(warehouse)) {
    warehouse = [];
  }

  setsWarehouse = normalizeSetsWarehouseList(setsWarehouse);

  secondHelpers = normalizeSecondHelpersList(secondHelpers);

  ensureOptionWarehouse();
  migrateOptionWarehouseToCustomLists();

  if (!Array.isArray(changeLog)) changeLog = [];
  if (!Array.isArray(pushSubs)) pushSubs = [];
  if (!Array.isArray(aiSeenNotes)) aiSeenNotes = [];
  if (!Array.isArray(aiSeenAlerts)) aiSeenAlerts = [];
}

async function saveData() {
  if (window.__DEMO_MODE) return;
  localStorage.setItem(CEREMONIES_KEY, JSON.stringify(ceremonies));
  localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(warehouse));
  localStorage.setItem(SETS_KEY, JSON.stringify(setsWarehouse));
  localStorage.setItem(SECOND_HELPERS_KEY, JSON.stringify(secondHelpers));
  localStorage.setItem(CHANGELOG_KEY, JSON.stringify(changeLog));
  localStorage.setItem(PUSH_SUB_LOCAL_KEY, JSON.stringify(pushSubs || []));
  localStorage.setItem(OPTIONS_KEY, JSON.stringify(optionWarehouse || {}));
  localStorage.setItem(AI_SEEN_NOTES_KEY, JSON.stringify(aiSeenNotes || []));
  localStorage.setItem(AI_SEEN_ALERTS_KEY, JSON.stringify(aiSeenAlerts || []));
  localStorage.setItem(AI_CHAT_HISTORY_KEY, JSON.stringify(aiChatHistory || []));
  localStorage.setItem(CUSTOM_FIELDS_KEY, JSON.stringify(customFields || []));
  localStorage.setItem(CUSTOM_LISTS_KEY, JSON.stringify(customLists || []));
  localStorage.setItem(SECTION_DATA_KEY, JSON.stringify(sectionData || {}));
  if (USE_CLOUD) cloudSaveAll().catch((e) => console.error("Cloud save error (ignored)", e));
}

// ---------------- Green highlight rule ----------------
function parseTimeToMinutes(t) {
  if (!t || typeof t !== "string") return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function shouldHighlightGreen(c, now = new Date()) {
  if (!c?.date) return false;
  const todayStr = getTodayStr();
  const tomorrowStr = addDaysStr(todayStr, 1);

  const todays = ceremonies.filter((x) => x.date === todayStr && x.time);
  let lastMin = null;
  for (const x of todays) {
    const mins = parseTimeToMinutes(x.time);
    if (mins !== null) lastMin = lastMin === null ? mins : Math.max(lastMin, mins);
  }

  // V36.1: Οι σημερινές τελετές πρασινίζουν μέχρι να περάσει η ώρα
  // της τελευταίας τελετής της ημέρας. Μετά πρασινίζουν μόνο οι αυριανές.
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dayFinished = lastMin !== null ? nowMin >= lastMin : true;
  return dayFinished ? c.date === tomorrowStr : c.date === todayStr;
}

// ---------------- Weekly helpers ----------------
function getMondayOfWeek(dateObj) {
  const d = new Date(dateObj);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekKeyFromDateStr(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return dateToStr(getMondayOfWeek(d));
}

function weekLabel(weekOffset, mondayStr) {
  if (weekOffset === 0) return "ΑΥΤΗ Η ΕΒΔΟΜΑΔΑ";
  if (weekOffset === 1) return "ΕΠΟΜΕΝΗ ΕΒΔΟΜΑΔΑ";
  if (weekOffset === 2) return "ΜΕΘΕΠΟΜΕΝΗ ΕΒΔΟΜΑΔΑ";
  return `ΕΒΔΟΜΑΔΑ · από ${mondayStr}`;
}

// ---------------- WhatsApp + Share ----------------
function buildWhatsAppMessage(c) {
  const lines = [];
  lines.push(`🪦 Τελετή — ΣΤΑΥΡΑΚΑΚΗ`);

  if (c.date || c.time) {
    const dline = c.date ? formatDate(c.date) : "—";
    lines.push(`Ημερομηνία: ${dline}${c.time ? ` • ${c.time}` : ""}`);
  }

  if (c.name) lines.push(`Όνομα θανόντα: ${c.name}`);
  if (c.place) lines.push(`Τοποθεσία: ${c.place}`);

  const method = (c.burialType || "Ταφή").trim();
  lines.push(`Τρόπος: ${method}`);

  if (method === "Αποτεφρωση") {
    lines.push(`Συνοδοί αίθουσας: ${Number(c.cremationEscortCount || 0)}`);
    if (c.cremationParishNote) lines.push(`Ενορία πριν (σημ.): ${c.cremationParishNote}`);
  } else {
    if (c.graveType) lines.push(`Τάφος: ${c.graveType}`);
    if (c.graveType === "Οικογενειακός" && c.graveNumber) lines.push(`Αριθμός τάφου: ${c.graveNumber}`);
    if (c.graveType === "Τριετία" && c.graveZone) lines.push(`Ζώνη: ${c.graveZone}`);
  }

  if (c.responsible && c.responsible !== "-") lines.push(`Υπεύθυνος τελετής: ${c.responsible}`);
  if (c.secondPerson && c.secondPerson !== "Κανένας") lines.push(`2ο άτομο: ${c.secondPerson}`);
  if (c.suitcase && c.suitcase !== "-") lines.push(`Βαλίτσα: ${c.suitcase}`);

  if (c.coffin) lines.push(`Φέρετρο: ${c.coffin}`);
  if (c.set) lines.push(`ΣΕΤ: ${c.set}`);
  if (c.flowers) lines.push(`Στεφάνια/Λουλούδια: ${c.flowers}`);

  const decorLine = c.decor ? `${c.decor}${c.decorNote ? ` – ${c.decorNote}` : ""}` : "";
  if (decorLine) lines.push(`Στολισμός: ${decorLine}`);

  if (c.pallbearers) lines.push(`Φραγκοφόροι: ${c.pallbearers}`);
  if (c.coffee) lines.push(`Καφές: ${c.coffee}${c.coffeePlace ? ` – ${c.coffeePlace}` : ""}`);

  if (c.pickup) lines.push(`Παραλαβή: ${c.pickup}`);
  if (c.pickupSecondPerson) lines.push(`2ο άτομο παραλαβής: ${c.pickupSecondPerson}`);
  if (c.pickupDate) lines.push(`Ημερομηνία παραλαβής: ${formatDate(c.pickupDate)}`);
  if (c.coldRoom) lines.push(`Ψυκτικός θάλαμος: ${c.coldRoom}`);
  if (c.notes) lines.push(`Σημειώσεις: ${c.notes}`);

  return lines.join("\n");
}

function openWhatsApp(c) {
  const msg = buildWhatsAppMessage(c);
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
}

async function shareCeremony(c) {
  const text = buildWhatsAppMessage(c);
  const title = `Τελετή ${c.name || ""}`.trim() || "Τελετή";
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return;
    }
  } catch {}

  let copied = false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {}
  }

  if (copied) alert("Αντιγράφηκε στο πρόχειρο (clipboard).");
  else window.prompt("Αντέγραψε το κείμενο:", text);
}

// ---------------- Stock rules ----------------
function isPriorityCoffin(name) {
  if (!name) return false;
  const upper = name.toUpperCase();
  return upper.startsWith("ΦΛΩΡΙΝΑ") || upper.startsWith("ΚΩΣΤΑΚΗ");
}

function checkLowStockCoffin(item) {
  if (!item) return;
  const qty = Number(item.qty) || 0;
  const name = item.name || "";
  if (isPriorityCoffin(name)) {
    if (qty <= 2) alert(`Προσοχή: Το "${name}" έχει απομείνει με ${qty} τεμάχια.`);
  } else if (qty === 0) {
    alert(`Προσοχή: Το "${name}" έχει μηδενικό απόθεμα.`);
  }
}

function checkLowStockSet(item) {
  if (!item) return;
  const qty = Number(item.qty) || 0;
  const name = normalizeSetName(item.name || "");
  if ((name === "ΓΚΡΙ" || name === "ΛΕΥΚΟ") && qty < 5) {
    alert(`Παραγγελία: Το ΣΕΤ "${name}" έχει πέσει στα ${qty} τεμ. (min 5).`);
  }
}

function adjustCoffinStock(oldCoffin, newCoffin) {
  if (oldCoffin === newCoffin) return;
  if (oldCoffin) {
    const oldItem = warehouse.find((w) => w.name === oldCoffin);
    if (oldItem) oldItem.qty = (Number(oldItem.qty) || 0) + 1;
  }
  if (newCoffin) {
    const newItem = warehouse.find((w) => w.name === newCoffin);
    if (newItem) {
      const prevQty = Number(newItem.qty) || 0;
      newItem.qty = Math.max(0, prevQty - 1);
      checkLowStockCoffin(newItem);
    }
  }
}

function adjustSetStock(oldSet, newSet) {
  const oldNorm = normalizeSetName(oldSet);
  const newNorm = normalizeSetName(newSet);
  if (oldNorm === newNorm) return;
  if (oldNorm) {
    const oldItem = setsWarehouse.find((s) => normalizeSetName(s.name) === oldNorm);
    if (oldItem) oldItem.qty = (Number(oldItem.qty) || 0) + 1;
  }
  if (newNorm) {
    const newItem = setsWarehouse.find((s) => normalizeSetName(s.name) === newNorm);
    if (newItem) {
      const prevQty = Number(newItem.qty) || 0;
      newItem.qty = Math.max(0, prevQty - 1);
      checkLowStockSet(newItem);
    }
  }
}

// ---------------- Cremation / Grave UI ----------------
function toggleCremationUI() {
  const type = (val("burialType") || "Ταφή").trim();
  const cremationBox = $("cremationBox");
  const graveBox = $("graveBox");
  if (cremationBox) cremationBox.classList.toggle("hidden", type !== "Αποτεφρωση");
  if (graveBox) graveBox.classList.toggle("hidden", type === "Αποτεφρωση");
}

function fillSelect(el, options, selectedValue) {
  if (!el) return;
  el.innerHTML = "";
  options.forEach((optVal) => {
    const opt = document.createElement("option");
    opt.value = optVal;
    opt.textContent = optVal;
    if ((selectedValue ?? "") === optVal) opt.selected = true;
    el.appendChild(opt);
  });
}

function helperOptions(includeEmpty = false) {
  const list = normalizeSecondHelpersList(secondHelpers);
  const out = includeEmpty ? ["", ...list] : list;
  return out;
}

// ---------------- Ceremony modal ----------------
let editingId = null;

function openCeremonyModal(id = null) {
  editingId = id;

  const modal = $("ceremonyModal");
  if (!modal) return alert("Λείπει το ceremonyModal από το index.html");

  const titleEl = $("modalTitle");
  if (titleEl) titleEl.textContent = id ? t("Επεξεργασία τελετής", "Edit ceremony") : t("Νέα τελετή", "New ceremony");

  const c = id ? (ceremonies.find(x => x.id === id) || {}) : {};

  setVal("ceremonyDate", c.date || "");
  setVal("ceremonyTime", c.time || "");
  setVal("deceasedName", c.name || "");
  setVal("ceremonyPlace", c.place || "");
  setVal("burialType", c.burialType || "Ταφή");

  setVal("cremationEscortCount", Number(c.cremationEscortCount || 0));
  setVal("cremationParishNote", c.cremationParishNote || "");

  fillSelect($("responsiblePerson"), RESPONSIBLE_OPTIONS, c.responsible ?? "-");
  fillSelect($("secondPerson"), helperOptions(false), c.secondPerson ?? "Κανένας");
  fillSelect($("pickupSecondPerson"), helperOptions(true), c.pickupSecondPerson ?? "");
  fillSelect($("suitcase"), SUITCASE_OPTIONS, c.suitcase ?? "-");

  const selectCoffin = $("ceremonyCoffin");
  if (selectCoffin) {
    selectCoffin.innerHTML = "";
    warehouse.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.name;
      opt.textContent = item.name;
      if (item.name === c.coffin) opt.selected = true;
      selectCoffin.appendChild(opt);
    });
    if (!c.coffin && warehouse[0]?.name) selectCoffin.value = warehouse[0].name;
  }
  setVal("ceremonySheet", c.sheet || "");

  const setSel = $("ceremonySet");
  if (setSel) {
    setSel.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "-";
    setSel.appendChild(empty);
    setsWarehouse.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.name;
      opt.textContent = item.name;
      if (normalizeSetName(item.name) === normalizeSetName(c.set)) opt.selected = true;
      setSel.appendChild(opt);
    });
  }

  setVal("ceremonyFlowers", c.flowers || "");
  setVal("ceremonyAnnouncementStatus", c.announcementStatus || "Δεν χρειάζεται");
  setVal("ceremonyDecor", c.decor || "");
  setVal("ceremonyDecorNote", c.decorNote || "");
  setVal("ceremonyPallbearers", c.pallbearers || "");
  setVal("ceremonyCoffee", c.coffee || "");
  setVal("ceremonyCoffeePlace", c.coffeePlace || "");
  setVal("ceremonyPickup", c.pickup || "");
  setVal("pickupDate", c.pickupDate || "");
  setVal("ceremonyColdRoom", c.coldRoom || "");
  setVal("ceremonyGraveNumber", c.graveNumber || "");
  setVal("ceremonyGraveZone", c.graveZone || "");
  setVal("ceremonyNotes", c.notes || "");

  const familyRadio = $("graveTypeFamily");
  const triennialRadio = $("graveTypeTriennial");
  if (familyRadio && triennialRadio) {
    familyRadio.checked = (c.graveType || "") === "Οικογενειακός";
    triennialRadio.checked = (c.graveType || "Τριετία") !== "Οικογενειακός";
  }

  toggleCremationUI();
  modal.classList.remove("hidden");
}

function closeCeremonyModal() {
  $("ceremonyModal")?.classList.add("hidden");
}

function saveCeremony(e) {
  e.preventDefault();

  const name = val("deceasedName").trim();
  const place = val("ceremonyPlace").trim();

  if (!name && !place) {
    alert("Θέλω τουλάχιστον ένα από: Όνομα θανόντα ή Τοποθεσία.");
    return;
  }

  const selectedGraveType =
    document.querySelector('input[name="graveType"]:checked')?.value || "Τριετία";

  const payload = {
    date: val("ceremonyDate") || "",
    time: val("ceremonyTime") || "",
    name,
    place,

    burialType: (val("burialType") || "Ταφή").trim(),

    cremationEscortCount: Number(val("cremationEscortCount") || 0) || 0,
    cremationParishNote: val("cremationParishNote").trim(),

    responsible: val("responsiblePerson") || "-",
    secondPerson: val("secondPerson") || "Κανένας",
    pickupSecondPerson: val("pickupSecondPerson") || "",
    suitcase: val("suitcase") || "-",

    coffin: val("ceremonyCoffin") || "",
    sheet: val("ceremonySheet").trim(),
    set: normalizeSetName(val("ceremonySet") || ""),
    flowers: val("ceremonyFlowers").trim(),
    announcementStatus: val("ceremonyAnnouncementStatus") || "Δεν χρειάζεται",
    decor: val("ceremonyDecor") || "",
    decorNote: val("ceremonyDecorNote").trim(),
    pallbearers: val("ceremonyPallbearers") || "",
    coffee: val("ceremonyCoffee") || "",
    coffeePlace: val("ceremonyCoffeePlace").trim(),
    pickup: val("ceremonyPickup").trim(),
    pickupDate: val("pickupDate") || "",
    coldRoom: val("ceremonyColdRoom").trim(),

    graveType: selectedGraveType,
    graveNumber: val("ceremonyGraveNumber").trim(),
    graveZone: val("ceremonyGraveZone") || "",

    notes: val("ceremonyNotes").trim()
  };

  if (payload.burialType === "Αποτεφρωση") {
    payload.graveType = "";
    payload.graveNumber = "";
    payload.graveZone = "";
  } else {
    payload.cremationEscortCount = 0;
    payload.cremationParishNote = "";

    if (payload.graveType === "Οικογενειακός") {
      payload.graveZone = "";
    } else {
      payload.graveType = "Τριετία";
      payload.graveNumber = "";
    }
  }

  if (editingId) {
    const idx = ceremonies.findIndex(c => c.id === editingId);
    if (idx !== -1) {
      const old = ceremonies[idx];
      ceremonies[idx] = { ...old, ...payload };

      adjustCoffinStock(old.coffin || "", payload.coffin);
      adjustSetStock(old.set || "", payload.set);

      addChange("ceremony_edit", `${t("Επεξεργασία τελετής","Edit case")}: ${payload.name || "-"} (${payload.date || t("χωρίς ημ/νία","no date")} ${payload.time || ""})`);
    }
  } else {
    const id = nowTs().toString();
    ceremonies.push({ id, ...payload });

    adjustCoffinStock("", payload.coffin);
    adjustSetStock("", payload.set);

    addChange("ceremony_add", `${t("Νέα τελετή","New case")}: ${payload.name || "-"} (${payload.date || t("χωρίς ημ/νία","no date")} ${payload.time || ""})`);
  }

  saveBackup("saveCeremony");
  saveData();
  closeCeremonyModal();
  renderAll();
}

function deleteCeremony(id) {
  if (!confirm("Να διαγραφεί η τελετή;")) return;
  const c = ceremonies.find(x => x.id === id);
  if (c) {
    adjustCoffinStock(c.coffin || "", "");
    adjustSetStock(c.set || "", "");
    emitOfficeEvent("ceremony_deleted", { ...c, case_id: ensureCeremonyCaseId(c) });
    addChange("ceremony_delete", `${t("Διαγραφή τελετής","Delete case")}: ${c.name || "-"} (${c.date || t("χωρίς ημ/νία","no date")} ${c.time || ""})`);
  }
  ceremonies = ceremonies.filter(c => c.id !== id);
  saveBackup("deleteCeremony");
  saveData();
  renderAll();
}

// ---------------- Warehouse reorder helper ----------------
function moveItem(arr, fromIdx, toIdx) {
  if (!Array.isArray(arr)) return;
  if (fromIdx < 0 || fromIdx >= arr.length) return;
  if (toIdx < 0 || toIdx >= arr.length) return;
  if (fromIdx === toIdx) return;
  const [it] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, it);
}

// ---------------- Warehouse render ----------------
function openReceiveStockModal(type, idx) {
  const arr = type === "coffin" ? warehouse : setsWarehouse;
  const item = arr[idx];
  if (!item) return;

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99990;display:flex;align-items:center;justify-content:center;padding:20px;";

  const box = document.createElement("div");
  box.style.cssText = "background:#1e2a42;border:1px solid rgba(100,220,130,.25);border-radius:14px;padding:28px 24px;max-width:360px;width:100%;";
  box.innerHTML = [
    '<h3 style="font-size:15px;font-weight:800;color:#fff;margin-bottom:6px;">Receive delivery</h3>',
    '<p style="font-size:13px;color:#6b7a99;margin-bottom:18px;">' + esc(item.name) + ' &nbsp;·&nbsp; Current stock: <b style="color:#c8daf0;">' + (item.qty ?? 0) + '</b></p>',
    '<label style="display:block;font-size:12px;font-weight:700;color:#6b7a99;margin-bottom:4px;">Units received</label>',
    '<input id="stockQtyInput" type="number" min="1" value="1" style="width:100%;padding:9px 12px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#0f1523;color:#fff;font-size:16px;margin-bottom:20px;box-sizing:border-box;" />',
    '<div style="display:flex;gap:10px;justify-content:flex-end;">',
    '  <button id="stockCancelBtn" style="border:1px solid rgba(255,255,255,.15);background:transparent;color:#6b7a99;border-radius:8px;padding:9px 18px;font-size:13px;cursor:pointer;">Cancel</button>',
    '  <button id="stockSaveBtn" style="border:none;background:#6dca8a;color:#0f1523;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:800;cursor:pointer;">+ Add to stock</button>',
    '</div>'
  ].join("");

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const input = box.querySelector("#stockQtyInput");
  overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
  box.querySelector("#stockCancelBtn").addEventListener("click", function () { overlay.remove(); });
  box.querySelector("#stockSaveBtn").addEventListener("click", function () {
    const qty = parseInt(input.value, 10);
    if (!qty || qty < 1) { input.focus(); return; }
    arr[idx].qty = (arr[idx].qty ?? 0) + qty;
    addChange(type === "coffin" ? "warehouse_restock" : "set_restock",
      "Παραλαβή αποθέματος: " + item.name + " +" + qty);
    saveData();
    overlay.remove();
    if (type === "coffin") renderWarehouse(); else renderSets();
    renderUpdatesBadge();
  });

  setTimeout(function () { input.select(); }, 50);
}

function renderWarehouse() {
  const body = $("warehouseBody");
  if (!body) return;
  body.innerHTML = "";

  warehouse.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.className = "draggable-row";
    tr.draggable = true;
    tr.dataset.index = String(idx);

    const nameTd = document.createElement("td");
    nameTd.className = "drag-name";
    nameTd.title = t("Κράτα πατημένο και σύρε για αλλαγή σειράς", "Hold and drag to reorder");
    nameTd.innerHTML = `<span class="drag-handle">☰</span><span>${esc(item.name)}</span>`;

    const qtyTd = document.createElement("td");
    qtyTd.textContent = item.qty ?? 0;

    const actionsTd = document.createElement("td");
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "warehouse-actions compact-actions";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.textContent = "↑";
    upBtn.onclick = () => {
      moveItem(warehouse, idx, idx - 1);
      addChange("warehouse_reorder", "Αλλαγή σειράς φερέτρων");
      saveData();
      renderWarehouse();
      renderUpdatesBadge();
    };

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.textContent = "↓";
    downBtn.onclick = () => {
      moveItem(warehouse, idx, idx + 1);
      addChange("warehouse_reorder", "Αλλαγή σειράς φερέτρων");
      saveData();
      renderWarehouse();
      renderUpdatesBadge();
    };

    const editBtn = document.createElement("button");
    editBtn.className = "edit";
    editBtn.textContent = t("Επεξεργασία", "Edit");
    editBtn.onclick = () => openWarehouseModal(idx);

    const delBtn = document.createElement("button");
    delBtn.className = "delete";
    delBtn.textContent = "✕";
    delBtn.onclick = () => {
      if (confirm(t("Διαγραφή φέρετρου;", "Delete coffin?"))) {
        const removed = warehouse[idx];
        warehouse.splice(idx, 1);
        addChange("warehouse_delete", `Διαγραφή φέρετρου: ${removed?.name || ""}`);
        saveData();
        renderWarehouse();
        renderCeremonies();
        renderUpdatesBadge();
      }
    };

    const stockBtn = document.createElement("button");
    stockBtn.type = "button";
    stockBtn.textContent = "+Stock";
    stockBtn.title = "Receive delivery — add units";
    stockBtn.style.cssText = "background:rgba(100,220,130,.15);color:#6dca8a;border:1px solid rgba(100,220,130,.25);";
    stockBtn.onclick = () => openReceiveStockModal("coffin", idx);

    actionsDiv.append(upBtn, downBtn, stockBtn, editBtn, delBtn);
    actionsTd.appendChild(actionsDiv);
    tr.append(nameTd, qtyTd, actionsTd);
    body.appendChild(tr);
  });

  bindWarehouseDragAndDrop();
}

function bindWarehouseDragAndDrop() {
  const body = $("warehouseBody");
  if (!body) return;
  let draggedIndex = null;

  body.querySelectorAll("tr.draggable-row").forEach((row) => {
    row.addEventListener("dragstart", (e) => {
      draggedIndex = Number(row.dataset.index);
      row.classList.add("dragging");
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", row.dataset.index || "");
      }
    });

    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      body.querySelectorAll("tr.drag-over").forEach(r => r.classList.remove("drag-over"));
    });

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      row.classList.add("drag-over");
    });

    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));

    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("drag-over");
      const targetIndex = Number(row.dataset.index);
      const from = Number.isFinite(draggedIndex) ? draggedIndex : Number(e.dataTransfer?.getData("text/plain"));
      if (!Number.isFinite(from) || !Number.isFinite(targetIndex) || from === targetIndex) return;
      moveItem(warehouse, from, targetIndex);
      addChange("warehouse_reorder", "Αλλαγή σειράς φερέτρων με drag & drop");
      saveBackup("warehouseDragReorder");
      saveData();
      renderWarehouse();
      renderUpdatesBadge();
    });
  });
}

function renderSets() {
  const body = $("setsBody");
  if (!body) return;
  body.innerHTML = "";

  setsWarehouse = normalizeSetsWarehouseList(setsWarehouse);

  setsWarehouse.forEach((item, idx) => {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = item.name;

    const qtyTd = document.createElement("td");
    qtyTd.textContent = item.qty ?? 0;

    const actionsTd = document.createElement("td");
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "warehouse-actions";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.textContent = "↑";
    upBtn.onclick = () => {
      moveItem(setsWarehouse, idx, idx - 1);
      addChange("set_reorder", "Αλλαγή σειράς ΣΕΤ");
      saveData();
      renderSets();
      renderUpdatesBadge();
    };

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.textContent = "↓";
    downBtn.onclick = () => {
      moveItem(setsWarehouse, idx, idx + 1);
      addChange("set_reorder", "Αλλαγή σειράς ΣΕΤ");
      saveData();
      renderSets();
      renderUpdatesBadge();
    };

    const editBtn = document.createElement("button");
    editBtn.className = "edit";
    editBtn.textContent = t("Επεξεργασία", "Edit");
    editBtn.onclick = () => openSetModal(idx);

    const delBtn = document.createElement("button");
    delBtn.className = "delete";
    delBtn.textContent = "✕";
    delBtn.onclick = () => {
      if (confirm(t("Διαγραφή ΣΕΤ;", "Delete burial set?"))) {
        const removed = setsWarehouse[idx];
        setsWarehouse.splice(idx, 1);

        ceremonies.forEach((c) => {
          if (normalizeSetName(c.set) === normalizeSetName(removed?.name)) c.set = "";
        });

        addChange("set_delete", `Διαγραφή ΣΕΤ: ${removed?.name || ""}`);
        saveData();
        renderSets();
        renderCeremonies();
        renderUpdatesBadge();
      }
    };

    const stockBtn = document.createElement("button");
    stockBtn.type = "button";
    stockBtn.textContent = "+Stock";
    stockBtn.title = "Receive delivery — add units";
    stockBtn.style.cssText = "background:rgba(100,220,130,.15);color:#6dca8a;border:1px solid rgba(100,220,130,.25);";
    stockBtn.onclick = () => openReceiveStockModal("set", idx);

    actionsDiv.append(upBtn, downBtn, stockBtn, editBtn, delBtn);
    actionsTd.appendChild(actionsDiv);

    tr.append(nameTd, qtyTd, actionsTd);
    body.appendChild(tr);
  });
}

function renderSecondHelpers() {
  const body = $("secondHelpersBody");
  if (!body) return;
  body.innerHTML = "";

  secondHelpers = normalizeSecondHelpersList(secondHelpers);

  secondHelpers.forEach((name, idx) => {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = name;

    const actionsTd = document.createElement("td");
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "warehouse-actions";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.textContent = "↑";
    upBtn.onclick = () => {
      moveItem(secondHelpers, idx, idx - 1);
      addChange("second_helper_reorder", "Αλλαγή σειράς 2ου ατόμου βοήθειας");
      saveData();
      renderSecondHelpers();
      renderUpdatesBadge();
    };

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.textContent = "↓";
    downBtn.onclick = () => {
      moveItem(secondHelpers, idx, idx + 1);
      addChange("second_helper_reorder", "Αλλαγή σειράς 2ου ατόμου βοήθειας");
      saveData();
      renderSecondHelpers();
      renderUpdatesBadge();
    };

    const editBtn = document.createElement("button");
    editBtn.className = "edit";
    editBtn.textContent = t("Επεξεργασία", "Edit");
    editBtn.onclick = () => openSecondHelperModal(idx);

    const delBtn = document.createElement("button");
    delBtn.className = "delete";
    delBtn.textContent = "✕";
    delBtn.onclick = () => {
      if (confirm(t("Διαγραφή ατόμου βοήθειας;", "Delete assistant?"))) {
        const removed = secondHelpers[idx];
        secondHelpers.splice(idx, 1);

        ceremonies.forEach((c) => {
          if (normalizeTextKey(c.secondPerson) === normalizeTextKey(removed)) c.secondPerson = "Κανένας";
          if (normalizeTextKey(c.pickupSecondPerson) === normalizeTextKey(removed)) c.pickupSecondPerson = "";
        });

        if (!secondHelpers.some(x => normalizeTextKey(x) === normalizeTextKey("Κανένας"))) {
          secondHelpers.unshift("Κανένας");
        }

        addChange("second_helper_delete", `Διαγραφή 2ου ατόμου βοήθειας: ${removed || ""}`);
        saveData();
        renderSecondHelpers();
        renderCeremonies();
        renderUpdatesBadge();
      }
    };

    actionsDiv.append(upBtn, downBtn, editBtn, delBtn);
    actionsTd.appendChild(actionsDiv);

    tr.append(nameTd, actionsTd);
    body.appendChild(tr);
  });
}


function renderCustomLists() {
  const container = $("customListsContainer");
  if (!container) return;
  container.innerHTML = "";

  if (!Array.isArray(customLists) || customLists.length === 0) {
    container.innerHTML = `<p style="color:#8899aa;font-size:13px;margin:16px 0;">${t("Δεν υπάρχουν λίστες ακόμα. Πάτησε «+ Νέα λίστα» για να ξεκινήσεις.", "No lists yet. Press «+ New list» to get started.")}</p>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "option-grid";

  customLists.forEach((list, listIdx) => {
    const box = document.createElement("section");
    box.className = "option-box";

    const head = document.createElement("div");
    head.className = "option-head";

    const title = document.createElement("h4");
    title.textContent = list.name;
    title.style.flex = "1";

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "edit";
    renameBtn.textContent = "✎";
    renameBtn.title = t("Μετονομασία", "Rename");
    renameBtn.style.cssText = "font-size:11px;padding:2px 7px;";
    renameBtn.onclick = () => renameCustomList(listIdx);

    const delListBtn = document.createElement("button");
    delListBtn.type = "button";
    delListBtn.className = "delete";
    delListBtn.textContent = "×";
    delListBtn.title = t("Διαγραφή λίστας", "Delete list");
    delListBtn.style.cssText = "font-size:14px;padding:2px 7px;";
    delListBtn.onclick = () => deleteCustomList(listIdx);

    head.append(title, renameBtn, delListBtn);
    box.appendChild(head);

    const table = document.createElement("table");
    table.className = "warehouse-table compact-table";
    const tbody = document.createElement("tbody");

    (list.items || []).forEach((item, itemIdx) => {
      const tr = document.createElement("tr");
      const nameTd = document.createElement("td");
      nameTd.textContent = item;
      const actionsTd = document.createElement("td");
      const div = document.createElement("div");
      div.className = "warehouse-actions";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "edit";
      editBtn.textContent = t("Επεξεργασία", "Edit");
      editBtn.onclick = () => editCustomListItem(listIdx, itemIdx);
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "delete";
      delBtn.textContent = "×";
      delBtn.onclick = () => deleteCustomListItem(listIdx, itemIdx);
      div.append(editBtn, delBtn);
      actionsTd.appendChild(div);
      tr.append(nameTd, actionsTd);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    box.appendChild(table);

    const addRow = document.createElement("div");
    addRow.style.cssText = "display:flex;gap:6px;margin-top:8px;";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = t("Νέο στοιχείο...", "New item...");
    input.style.cssText = "flex:1;padding:5px 8px;background:#1a2640;border:1px solid #2a3a50;color:#c8daf0;border-radius:6px;font-size:12px;";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "add-option-btn";
    addBtn.textContent = "+";
    addBtn.style.cssText = "padding:5px 12px;font-size:14px;line-height:1;";
    addBtn.onclick = () => {
      const v = input.value.trim();
      if (!v) return;
      addCustomListItem(listIdx, v);
      input.value = "";
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addBtn.click(); }
    });
    addRow.append(input, addBtn);
    box.appendChild(addRow);

    grid.appendChild(box);
  });

  container.appendChild(grid);
}

function openNewCustomListModal() {
  const name = window.prompt(t("Όνομα νέας λίστας:", "New list name:"), "");
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  if (!Array.isArray(customLists)) customLists = [];
  customLists.push({ id: "cl_" + nowTs(), name: trimmed, items: [] });
  saveData();
  renderCustomLists();
  fillDynamicDropdowns({});
}

function renameCustomList(idx) {
  const list = customLists[idx];
  if (!list) return;
  const name = window.prompt(t("Νέο όνομα λίστας:", "New list name:"), list.name);
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  customLists[idx].name = trimmed;
  saveData();
  renderCustomLists();
}

function deleteCustomList(idx) {
  const list = customLists[idx];
  if (!list) return;
  if (!window.confirm(t(`Διαγραφή λίστας «${list.name}»;`, `Delete list "${list.name}"?`))) return;
  customLists.splice(idx, 1);
  saveData();
  renderCustomLists();
  fillDynamicDropdowns({});
}

function addCustomListItem(listIdx, value) {
  const list = customLists[listIdx];
  if (!list) return;
  const trimmed = String(value).trim();
  if (!trimmed) return;
  if (!Array.isArray(list.items)) list.items = [];
  list.items.push(trimmed);
  saveBackup("addCustomListItem");
  saveData();
  renderCustomLists();
  fillDynamicDropdowns({});
}

function editCustomListItem(listIdx, itemIdx) {
  const list = customLists[listIdx];
  if (!list) return;
  const oldVal = list.items[itemIdx];
  const newVal = window.prompt(t("Επεξεργασία:", "Edit:"), oldVal);
  if (newVal === null) return;
  const trimmed = newVal.trim();
  if (!trimmed) return;
  list.items[itemIdx] = trimmed;
  saveData();
  renderCustomLists();
  fillDynamicDropdowns({});
}

function deleteCustomListItem(listIdx, itemIdx) {
  const list = customLists[listIdx];
  if (!list) return;
  list.items.splice(itemIdx, 1);
  saveData();
  renderCustomLists();
  fillDynamicDropdowns({});
}

// ---------------- Warehouse / Set / Helper modals ----------------
let warehouseEditingIndex = null;
let setEditingIndex = null;
let secondHelperEditingIndex = null;

function openWarehouseModal(index = null) {
  warehouseEditingIndex = index;
  const modal = $("warehouseModal");
  const title = $("warehouseModalTitle");
  const nameInput = $("warehouseName");
  const qtyInput = $("warehouseQty");
  if (!modal || !title || !nameInput || !qtyInput) return;

  if (index === null) {
    title.textContent = t("Νέο φέρετρο", "New coffin");
    nameInput.value = "";
    qtyInput.value = 0;
  } else {
    title.textContent = t("Επεξεργασία φέρετρου", "Edit coffin");
    const item = warehouse[index];
    nameInput.value = item.name || "";
    qtyInput.value = item.qty ?? 0;
  }
  modal.classList.remove("hidden");
}

function closeWarehouseModal() {
  $("warehouseModal")?.classList.add("hidden");
}

function saveWarehouseItem(event) {
  event.preventDefault();
  const name = val("warehouseName").trim();
  const qty = Number(val("warehouseQty")) || 0;
  if (!name) return alert("Γράψε όνομα.");

  if (warehouseEditingIndex === null) {
    warehouse.push({ name, qty });
    addChange("warehouse_add", `Νέο φέρετρο: ${name} (qty ${qty})`);
  } else {
    const oldName = warehouse[warehouseEditingIndex].name;
    warehouse[warehouseEditingIndex] = { name, qty };
    if (oldName !== name) {
      ceremonies.forEach((c) => { if (c.coffin === oldName) c.coffin = name; });
    }
    addChange("warehouse_edit", `Αλλαγή φέρετρου: ${name} (qty ${qty})`);
  }

  saveBackup("saveWarehouseItem");
  saveData();
  checkLowStockCoffin({ name, qty });
  closeWarehouseModal();
  renderAll();
}

function openSetModal(index = null) {
  setEditingIndex = index;
  const modal = $("setModal");
  const title = $("setModalTitle");
  const nameInput = $("setName");
  const qtyInput = $("setQty");
  if (!modal || !title || !nameInput || !qtyInput) return;

  if (index === null) {
    title.textContent = t("Νέο σετ", "New burial set");
    nameInput.value = "";
    qtyInput.value = 0;
  } else {
    title.textContent = t("Επεξεργασία σετ", "Edit burial set");
    const item = setsWarehouse[index];
    nameInput.value = item.name || "";
    qtyInput.value = item.qty ?? 0;
  }
  modal.classList.remove("hidden");
}

function closeSetModal() {
  $("setModal")?.classList.add("hidden");
}

function saveSetItem(event) {
  event.preventDefault();
  const name = normalizeSetName(val("setName"));
  const qty = Number(val("setQty")) || 0;
  if (!name) return alert("Γράψε ΣΕΤ.");

  const existingIndex = setsWarehouse.findIndex(s => normalizeSetName(s.name) === name);

  if (setEditingIndex === null) {
    if (existingIndex !== -1) {
      setsWarehouse[existingIndex].qty = (Number(setsWarehouse[existingIndex].qty) || 0) + qty;
      addChange("set_merge", `Το ΣΕΤ υπήρχε ήδη και ενώθηκε: ${name} (qty +${qty})`);
    } else {
      setsWarehouse.push({ name, qty });
      addChange("set_add", `Νέο ΣΕΤ: ${name} (qty ${qty})`);
    }
  } else {
    const oldName = setsWarehouse[setEditingIndex].name;

    if (existingIndex !== -1 && existingIndex !== setEditingIndex) {
      setsWarehouse[existingIndex].qty = (Number(setsWarehouse[existingIndex].qty) || 0) + qty;
      setsWarehouse.splice(setEditingIndex, 1);
    } else {
      setsWarehouse[setEditingIndex] = { name, qty };
    }

    if (normalizeSetName(oldName) !== name) {
      ceremonies.forEach((c) => { if (normalizeSetName(c.set) === normalizeSetName(oldName)) c.set = name; });
    }
    addChange("set_edit", `Αλλαγή ΣΕΤ: ${name} (qty ${qty})`);
  }

  setsWarehouse = normalizeSetsWarehouseList(setsWarehouse);
  saveBackup("saveSetItem");
  saveData();
  checkLowStockSet({ name, qty });
  closeSetModal();
  renderAll();
}

function openSecondHelperModal(index = null) {
  secondHelperEditingIndex = index;
  const modal = $("secondHelperModal");
  const title = $("secondHelperModalTitle");
  const nameInput = $("secondHelperName");
  if (!modal || !title || !nameInput) return;

  if (index === null) {
    title.textContent = t("Νέο άτομο βοήθειας", "New assistant");
    nameInput.value = "";
  } else {
    title.textContent = t("Επεξεργασία ατόμου βοήθειας", "Edit assistant");
    nameInput.value = secondHelpers[index] || "";
  }
  modal.classList.remove("hidden");
}

function closeSecondHelperModal() {
  $("secondHelperModal")?.classList.add("hidden");
}

function saveSecondHelperItem(event) {
  event.preventDefault();
  const name = normalizeNameLabel(val("secondHelperName"));
  if (!name) return alert("Γράψε όνομα.");

  const newKey = normalizeTextKey(name);
  const existingIndex = secondHelpers.findIndex(x => normalizeTextKey(x) === newKey);

  if (secondHelperEditingIndex === null) {
    if (existingIndex === -1) {
      secondHelpers.push(name);
      addChange("second_helper_add", `Νέο 2ο άτομο βοήθειας: ${name}`);
    }
  } else {
    const oldName = secondHelpers[secondHelperEditingIndex];
    if (existingIndex !== -1 && existingIndex !== secondHelperEditingIndex) {
      secondHelpers.splice(secondHelperEditingIndex, 1);
    } else {
      secondHelpers[secondHelperEditingIndex] = name;
    }

    if (normalizeTextKey(oldName) !== newKey) {
      ceremonies.forEach((c) => {
        if (normalizeTextKey(c.secondPerson) === normalizeTextKey(oldName)) c.secondPerson = name;
        if (normalizeTextKey(c.pickupSecondPerson) === normalizeTextKey(oldName)) c.pickupSecondPerson = name;
      });
    }
    addChange("second_helper_edit", `Αλλαγή 2ου ατόμου βοήθειας: ${name}`);
  }

  secondHelpers = normalizeSecondHelpersList(secondHelpers);
  if (!secondHelpers.some(x => normalizeTextKey(x) === normalizeTextKey("Κανένας"))) {
    secondHelpers.unshift("Κανένας");
  }

  saveBackup("saveSecondHelperItem");
  saveData();
  closeSecondHelperModal();
  renderAll();
}

// ---------------- Tabs ----------------
function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;

      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      if (tab === "ceremonies") $("ceremoniesTab")?.classList.add("active");
      if (tab === "warehouse") $("warehouseTab")?.classList.add("active");
      if (tab === "stats") $("statsTab")?.classList.add("active");
      if (tab === "history") $("historyTab")?.classList.add("active");
      if (tab === "settings") $("settingsTab")?.classList.add("active");
      if (tab === "hermes") $("hermesTab")?.classList.add("active");
    });
  });
}

// ---------------- Ceremonies render ----------------
function renderCeremonies() {
  const container = $("ceremoniesList");
  if (!container) return;
  container.innerHTML = "";

  const now = new Date();
  const todayStr = getTodayStr();
  const day = now.getDay();

  const undated = ceremonies.filter(c => !c.date);

  let datedVisible = [];
  if (day === 0) {
    datedVisible = ceremonies.filter((c) => c.date && c.date >= todayStr);
  } else {
    const monday = getMondayOfWeek(now);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    const weekStartStr = dateToStr(monday);
    const weekEndStr = dateToStr(saturday);

    datedVisible = ceremonies.filter((c) => {
      if (!c.date) return false;
      if (c.date >= weekStartStr && c.date <= weekEndStr) return true;
      if (c.date > weekEndStr) return true;
      return false;
    });
  }

  const visible = [...undated, ...datedVisible];

  if (!visible.length) {
    container.innerHTML = `<p>${t("Δεν υπάρχουν προγραμματισμένες τελετές για αυτή την περίοδο.", "No scheduled ceremonies for this period.")}</p>`;
    updateStats();
    return;
  }

  const undatedSorted = [...undated].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  const datedSorted = [...datedVisible].sort(
    (a, b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || "")
  );

  if (undatedSorted.length) {
    const div = document.createElement("div");
    div.className = "week-divider";
    div.textContent = "ΧΩΡΙΣ ΗΜΕΡΟΜΗΝΙΑ";
    container.appendChild(div);
    undatedSorted.forEach(c => container.appendChild(renderCeremonyCard(c, now)));
  }

  if (datedSorted.length) {
    const currentMondayStr = weekKeyFromDateStr(todayStr);
    const groups = new Map();

    for (const c of datedSorted) {
      const key = weekKeyFromDateStr(c.date);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }

    const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

    for (const mondayStr of keys) {
      const offsetWeeks = (() => {
        if (!currentMondayStr) return 99;
        const d1 = new Date(currentMondayStr);
        const d2 = new Date(mondayStr);
        const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        return Math.floor(diff / 7);
      })();

      if (offsetWeeks >= 1) {
        const div = document.createElement("div");
        div.className = "week-divider";
        div.textContent = weekLabel(offsetWeeks, mondayStr);
        container.appendChild(div);
      }

      const list = groups.get(mondayStr) || [];
      for (const c of list) container.appendChild(renderCeremonyCard(c, now));
    }
  }

  updateStats();
}

function renderCeremonyCard(c, now) {
  const card = document.createElement("div");
  card.className = "ceremony-card";
  card.dataset.id = c.id;

  if (shouldHighlightGreen(c, now)) card.classList.add("green-frame");

  const header = document.createElement("div");
  header.className = "ceremony-header";

  const nm = document.createElement("div");
  nm.className = "ceremony-name";
  nm.textContent = c.name || "-";

  const dt = document.createElement("div");
  dt.className = "ceremony-date";
  dt.textContent = (c.date ? formatDate(c.date) : "—") + (c.time ? ` • ${c.time}` : "");

  header.append(nm, dt);

  const place = document.createElement("div");
  place.className = "ceremony-place";
  place.textContent = c.place || "";

  const cardAiWarning = document.createElement("div");
  const notePriority = aiNotePriority(c.notes || "");
  if (notePriority === "high") {
    const fullNote = String(c.notes || "").trim();
    const shortNote = fullNote.slice(0, 140);
    cardAiWarning.className = "ceremony-ai-warning";
    cardAiWarning.innerHTML = `🔴 ΚΡΙΣΙΜΗ ΣΗΜΕΙΩΣΗ<span>${esc(shortNote)}${fullNote.length > 140 ? "…" : ""}</span>`;
  }

  const rows = document.createElement("div");
  const makeRow = (label, value) => {
    if (!value) return;
    const r = document.createElement("div");
    r.className = "ceremony-row";
    r.innerHTML = `<span class="ceremony-label">${esc(label)}:</span> ${esc(value)}`;
    rows.appendChild(r);
  };

  if (c.responsible && c.responsible !== "-") makeRow("Υπεύθυνος", c.responsible);
  if (c.secondPerson && c.secondPerson !== "Κανένας") makeRow("2ο άτομο", c.secondPerson);
  if (c.suitcase && c.suitcase !== "-") makeRow("Βαλίτσα", c.suitcase);

  makeRow("Τρόπος", c.burialType || "Ταφή");

  if ((c.burialType || "Ταφή") === "Αποτεφρωση") {
    makeRow("Συνοδοί αίθουσας", String(Number(c.cremationEscortCount || 0)));
    makeRow("Ενορία πριν (σημ.)", c.cremationParishNote);
  } else {
    makeRow("Τάφος", c.graveType);
    if (c.graveType === "Οικογενειακός") makeRow("Αριθμός τάφου", c.graveNumber);
    if (c.graveType === "Τριετία") makeRow("Ζώνη", c.graveZone);
  }

  makeRow("Φέρετρο", c.coffin);
  makeRow("ΣΕΤ", c.set);
  makeRow("Στεφάνια / Λουλούδια", c.flowers);

  const decorLine = c.decor ? `${c.decor}${c.decorNote ? ` – ${c.decorNote}` : ""}` : "";
  makeRow("Στολισμός", decorLine);

  makeRow("Φραγκοφόροι", c.pallbearers);
  if (c.coffee) makeRow("Καφές", `${c.coffee}${c.coffeePlace ? ` – ${c.coffeePlace}` : ""}`);

  makeRow("Παραλαβή", c.pickup);
  makeRow("2ο άτομο παραλαβής", c.pickupSecondPerson);
  if (c.pickupDate) makeRow("Ημερομηνία παραλαβής", formatDate(c.pickupDate));
  makeRow("Ψυκτικός θάλαμος", c.coldRoom);
  makeRow("Σημειώσεις", c.notes);

  const buttons = document.createElement("div");
  buttons.className = "card-buttons";

  const editBtn = document.createElement("button");
  editBtn.className = "edit";
  editBtn.textContent = t("Επεξεργασία", "Edit");
  editBtn.dataset.action = "edit";

  const waBtn = document.createElement("button");
  waBtn.type = "button";
  waBtn.dataset.action = "wa";
  waBtn.title = "WhatsApp";
  waBtn.style.width = "36px";
  waBtn.style.height = "36px";
  waBtn.style.borderRadius = "999px";
  waBtn.style.border = "none";
  waBtn.style.display = "inline-flex";
  waBtn.style.alignItems = "center";
  waBtn.style.justifyContent = "center";
  waBtn.style.background = "#25d366";
  waBtn.style.cursor = "pointer";
  waBtn.style.color = "#fff";
  waBtn.style.fontWeight = "900";
  waBtn.textContent = "WA";

  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.textContent = "Share";
  shareBtn.dataset.action = "share";
  shareBtn.style.borderRadius = "999px";
  shareBtn.style.border = "none";
  shareBtn.style.padding = "6px 14px";
  shareBtn.style.fontSize = "13px";
  shareBtn.style.cursor = "pointer";
  shareBtn.style.background = "#e5e7eb";

  const delBtn = document.createElement("button");
  delBtn.className = "delete";
  delBtn.textContent = t("Διαγραφή", "Delete");
  delBtn.dataset.action = "delete";

  buttons.append(editBtn, waBtn, shareBtn, delBtn);
  if (cardAiWarning.className) card.append(header, place, cardAiWarning, rows, buttons);
  else card.append(header, place, rows, buttons);

  return card;
}

function bindCeremoniesActions() {
  const list = $("ceremoniesList");
  if (!list || list.dataset.bound === "1") return;
  list.dataset.bound = "1";

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    if (!action) return;

    const card = btn.closest(".ceremony-card");
    const id = card?.dataset?.id;
    if (!id) return;

    const c = ceremonies.find(x => x.id === id);
    if (!c) return;

    if (action === "edit") openCeremonyModal(id);
    if (action === "wa") openWhatsApp(c);
    if (action === "share") shareCeremony(c);
    if (action === "bridge-wreaths") openCaseBridge("wreaths", c);
    if (action === "bridge-memorials") openCaseBridge("memorials", c);
    if (action === "bridge-announcements") openCaseBridge("announcements", c);
    if (action === "bridge-orders") openCaseBridge("orders", c);
    if (action === "bridge-copy") copyCaseBridge(c);
    if (action === "delete") deleteCeremony(id);
  });
}

// ---------------- History ----------------
let historyQuery = "";

function ensureHistorySearchUI() {
  const controls = $("historyControls");
  if (!controls || controls.dataset.ready === "1") return;

  const wrap = document.createElement("div");
  wrap.className = "history-search";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Αναζήτηση στο ιστορικό (όνομα, τοποθεσία, φέρετρο...)";
  input.addEventListener("input", () => {
    historyQuery = input.value || "";
    renderHistory();
  });

  wrap.appendChild(input);
  controls.appendChild(wrap);
  controls.dataset.ready = "1";
}

function renderHistory() {
  ensureHistorySearchUI();
  const container = $("historyList");
  if (!container) return;
  container.innerHTML = "";

  if (!ceremonies.length) {
    container.innerHTML = `<p style="font-size:13px;color:#6b7280;">${t("Δεν υπάρχουν καταχωρημένες τελετές.", "No ceremonies recorded yet.")}</p>`;
    return;
  }

  const q = (historyQuery || "").trim().toLowerCase();
  const filtered = ceremonies.filter((c) => {
    if (!q) return true;
    const blob = [
      c.case_id, c.name, c.place, c.burialType,
      c.responsible, c.secondPerson, c.pickupSecondPerson, c.suitcase,
      c.coffin, c.set, c.flowers, c.announcementStatus, c.decor, c.decorNote,
      c.pallbearers, c.coffee, c.coffeePlace,
      c.pickup, c.pickupDate, c.coldRoom,
      c.graveType, c.graveNumber, c.graveZone,
      c.notes, c.date, c.time,
      c.cremationEscortCount, c.cremationParishNote
    ].filter(Boolean).join(" ").toLowerCase();

    return blob.includes(q);
  });

  const sorted = [...filtered].sort(
    (a, b) => (b.date || "").localeCompare(a.date || "") || (b.time || "").localeCompare(a.time || "")
  );

  if (!sorted.length) {
    container.innerHTML = '<p style="font-size:13px;color:#6b7280;">Δεν βρέθηκαν αποτελέσματα.</p>';
    return;
  }

  for (const c of sorted) {
    const card = document.createElement("div");
    card.className = "ceremony-card history-card-clickable";
    card.dataset.id = c.id;
    card.title = "Πάτησε για να ανοίξει η καρτέλα";

    const header = document.createElement("div");
    header.className = "ceremony-header";

    const name = document.createElement("div");
    name.className = "ceremony-name";
    name.textContent = c.name || "-";

    const date = document.createElement("div");
    date.className = "ceremony-date";
    date.textContent = (c.date ? formatDate(c.date) : "—") + (c.time ? ` • ${c.time}` : "");

    header.append(name, date);

    const place = document.createElement("div");
    place.className = "ceremony-place";
    place.textContent = c.place || "";

    const mini = document.createElement("div");
    mini.className = "history-mini";
    mini.textContent = [
      c.pickup ? `Παραλαβή: ${c.pickup}` : "",
      c.coffin ? `Φέρετρο: ${c.coffin}` : "",
      c.set ? `ΣΕΤ: ${c.set}` : ""
    ].filter(Boolean).join(" · ");

    card.append(header, place, mini);
    card.addEventListener("click", () => openCeremonyModal(c.id));
    container.appendChild(card);
  }
}

// ---------------- Stats ----------------
function ensureStatsMoreContainer() {
  const stats = $("statsContent");
  if (!stats) return null;
  let more = $("statsMore");
  if (!more) {
    more = document.createElement("div");
    more.id = "statsMore";
    more.style.marginTop = "14px";
    stats.appendChild(more);
  }
  return more;
}

function updateStats() {
  const more = $("statsMore") || ensureStatsMoreContainer();
  if (!more) return;

  const isPro = window.__authPlan === "pro";
  const noData = t("Δεν υπάρχουν ακόμα δεδομένα.", "No data yet");

  const addCount = (map, rawValue) => {
    const raw = String(rawValue || "").trim().replace(/\s+/g, " ");
    if (!raw || raw === "-") return;
    const key = normalizeTextKey(raw);
    if (!map.has(key)) map.set(key, { label: raw, count: 0 });
    map.get(key).count += 1;
  };

  const topN = (map, n = 8) =>
    Array.from(map.values())
      .filter(x => String(x.label || "").trim() !== "" && String(x.label || "").trim() !== "-")
      .sort((a, b) => b.count - a.count)
      .slice(0, n);

  const rowsHtml = (arr) => arr.length
    ? arr.map(x => `<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px solid rgba(0,0,0,.04);"><span>${esc(x.label)}</span><b>${x.count}</b></div>`).join("")
    : `<div style="color:#9ca3af;font-size:12px;">${noData}</div>`;

  const card = (title, bodyHtml, accent = "#c8a96e") =>
    `<div style="background:#1e2a42;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;margin:0 0 12px;">` +
    `<div style="font-size:13px;font-weight:800;color:${accent};margin-bottom:10px;letter-spacing:.3px;">${title}</div>` +
    `<div style="font-size:13px;color:#c8daf0;">${bodyHtml}</div></div>`;

  const pillRow = (items) =>
    `<div style="display:flex;flex-wrap:wrap;gap:8px;">${items.map(([label, count]) =>
      `<div style="background:rgba(200,169,110,.15);border:1px solid rgba(200,169,110,.2);border-radius:999px;padding:5px 12px;font-size:13px;"><b>${count}</b> ${esc(String(label))}</div>`
    ).join("")}</div>`;

  const DAYS = t(
    ["Κυριακή","Δευτέρα","Τρίτη","Τετάρτη","Πέμπτη","Παρασκευή","Σάββατο"],
    ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  );

  const now = new Date();
  const monday = getMondayOfWeek(now);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 7);
  const thisMonthKey = now.toISOString().slice(0, 7);

  let total = 0, thisWeek = 0, thisMonth = 0, burials = 0, cremations = 0;
  const monthlyCounts = {};
  const placeMap = new Map(), coffinMap = new Map(), coordMap = new Map(), dayMap = new Map();
  const setMap = new Map(), assistantMap = new Map(), pallbearersMap = new Map();
  const decorMap = new Map(), luggageMap = new Map(), pickupMap = new Map();
  let coffeeYes = 0, coffeeNo = 0, coffeeOther = 0;

  ceremonies.forEach((c) => {
    total++;
    const bt = String(c.burialType || "").trim().toLowerCase();
    if (bt === "cremation" || bt === "αποτεφρωση") cremations++;
    else burials++;

    if (c.date) {
      const d = new Date(c.date);
      if (!Number.isNaN(d.getTime())) {
        if (d >= monday && d < sunday) thisWeek++;
        const mk = c.date.slice(0, 7);
        if (mk === thisMonthKey) thisMonth++;
        monthlyCounts[mk] = (monthlyCounts[mk] || 0) + 1;
        addCount(dayMap, DAYS[d.getDay()]);
      }
    }

    addCount(placeMap, c.place);
    addCount(coffinMap, c.coffin);
    addCount(coordMap, c.responsible);

    if (isPro) {
      addCount(setMap, c.set);
      addCount(assistantMap, c.secondPerson);
      addCount(pallbearersMap, c.pallbearers);
      addCount(decorMap, c.decor);
      addCount(luggageMap, c.suitcase);
      addCount(pickupMap, c.pickupSecondPerson);
      const cv = String(c.coffee || "").toLowerCase();
      if (cv.includes("yes") || cv.includes("ναι")) coffeeYes++;
      else if (cv.includes("no") || cv.includes("όχι") || cv.includes("oxi")) coffeeNo++;
      else if (cv && cv !== "-") coffeeOther++;
    }
  });

  // Custom fields stats
  const customStats = [];
  if (Array.isArray(customFields) && customFields.length) {
    customFields.forEach((f) => {
      if (f.enabled === false) return;
      const key = f.id || f.label;
      if (f.type === "select" || f.type === "dropdown") {
        const map = new Map();
        ceremonies.forEach((c) => addCount(map, (c.customValues || {})[key]));
        if (map.size) customStats.push(card(`📊 ${esc(f.label)}`, rowsHtml(topN(map, 10))));
      } else if (f.type === "number") {
        const nums = ceremonies.map(c => { const v = String((c.customValues || {})[key] || "").trim(); return v ? Number(v) : NaN; }).filter(n => !Number.isNaN(n));
        if (nums.length) {
          const avg = (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1);
          const mn = Math.min(...nums), mx = Math.max(...nums);
          customStats.push(card(`📊 ${esc(f.label)}`,
            `<div style="display:flex;gap:16px;flex-wrap:wrap;">` +
            `<span>${t("Μ.Ο.","Avg")} <b>${avg}</b></span><span>${t("Ελ.","Min")} <b>${mn}</b></span><span>${t("Μεγ.","Max")} <b>${mx}</b></span>` +
            `<span>${t("Συμπλ.","Filled")} <b>${nums.length}/${total}</b></span></div>`));
        }
      } else if (f.type === "text") {
        const filled = ceremonies.filter(c => String((c.customValues || {})[key] || "").trim()).length;
        if (filled) customStats.push(card(`📊 ${esc(f.label)}`,
          t(`<span>Συμπληρώθηκε σε <b>${filled}</b> από <b>${total}</b> τελετές</span>`,
            `<span>Filled in <b>${filled}</b> of <b>${total}</b> ceremonies</span>`)));
      }
    });
  }

  // Monthly list
  const monthKeys = Object.keys(monthlyCounts).sort().reverse();
  const monthHtml = monthKeys.length
    ? monthKeys.map(k => `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05);"><span>${k}</span><b>${monthlyCounts[k]}</b></div>`).join("")
    : `<div style="color:#9ca3af;font-size:12px;">${noData}</div>`;

  // Render
  let html = "";

  html += card(t("Επισκόπηση","Overview"),
    pillRow([[t("Σύνολο","total"), total], [t("Εβδομάδα","this week"), thisWeek], [t("Μήνας","this month"), thisMonth]]),
    "#c8daf0");

  html += card(t("Τύπος","Burial type"),
    pillRow([[t("Ταφή","Burial"), burials], [t("Αποτεφρωση","Cremation"), cremations]]));

  html += card(t("Ανά μήνα","By month"), monthHtml);
  html += card(t("Φέρετρα","Coffin usage"), rowsHtml(topN(coffinMap, 15)));
  html += card(t("Τοποθεσίες","Top ceremony locations"), rowsHtml(topN(placeMap, 10)));
  html += card(t("Υπεύθυνος","Ceremony coordinator"), rowsHtml(topN(coordMap, 8)));

  const orderedDays = DAYS.map(d => ({ label: d, count: (dayMap.get(normalizeTextKey(d)) || { count: 0 }).count })).filter(x => x.count > 0);
  html += card(t("Ημέρα","Day of week"),
    orderedDays.length
      ? orderedDays.map(x => `<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px solid rgba(0,0,0,.04);"><span>${esc(x.label)}</span><b>${x.count}</b></div>`).join("")
      : `<div style="color:#9ca3af;font-size:12px;">${noData}</div>`);

  if (isPro) {
    html += card(t("ΣΕΤ","Burial set usage"), rowsHtml(topN(setMap, 10)));
    html += card(t("2ο άτομο","2nd assistant"), rowsHtml(topN(assistantMap, 8)));
    html += card(t("2ο παραλαβής","2nd pickup person"), rowsHtml(topN(pickupMap, 8)));
    html += card(t("Βαλίτσα","Luggage"), rowsHtml(topN(luggageMap, 8)));
    html += card(t("Στολισμός","Decoration"), rowsHtml(topN(decorMap, 10)));
    html += card(t("Φραγκοφόροι","Pallbearers"), rowsHtml(topN(pallbearersMap, 8)));
    html += card(t("Καφές","Wake / Reception"),
      pillRow([[t("Ναι","Yes"), coffeeYes], [t("Όχι","No"), coffeeNo], [t("Άλλο","Other"), coffeeOther]]));
  }

  html += customStats.join("");
  more.innerHTML = html;
}



// ---------------- Hermes Center V38.1 — read-only ----------------
function hermesSetText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function hermesFormatCeremonyName(c) {
  const name = String(c?.name || "").trim();
  const place = String(c?.place || "").trim();
  if (name && place) return `${name} · ${place}`;
  return name || place || t("Χωρίς όνομα/τοποθεσία","No name/location");
}

function hermesMissingFields(c) {
  const missing = [];
  if (!String(c?.date || "").trim()) missing.push(t("ημερομηνία","date"));
  if (!String(c?.time || "").trim()) missing.push(t("ώρα","time"));
  if (!String(c?.place || "").trim()) missing.push(t("τοποθεσία","location"));
  if (!String(c?.responsible || "").trim() || String(c?.responsible || "").trim() === "-") missing.push(t("υπεύθυνος","coordinator"));
  if (!String(c?.secondPerson || "").trim() || String(c?.secondPerson || "").trim() === "Κανένας" || String(c?.secondPerson || "").trim() === "None") missing.push(t("2ο άτομο","2nd person"));
  if (String(c?.burialType || "").trim() === "Αποτεφρωση" && !Number(c?.cremationEscortCount || 0)) missing.push(t("συνοδοί αποτέφρωσης","cremation escorts"));
  return missing;
}

function hermesBuildAlerts() {
  const today = getTodayStr();
  const tomorrow = typeof aiTomorrowStr === "function" ? aiTomorrowStr() : "";
  const focusDates = new Set([today, tomorrow].filter(Boolean));
  const alerts = [];

  (ceremonies || []).forEach((c) => {
    const missing = hermesMissingFields(c);
    if (!missing.length) return;
    if (c.date && !focusDates.has(c.date)) return;
    alerts.push({
      title: hermesFormatCeremonyName(c),
      text: `Λείπει: ${missing.join(", ")}.`,
      type: "alert"
    });
  });

  try {
    const warehouseAlerts = typeof aiAnalyzeWarehouse === "function" ? aiAnalyzeWarehouse() : [];
    (warehouseAlerts || []).slice(0, 4).forEach((a) => {
      alerts.push({
        title: t("Αποθήκη","Warehouse"),
        text: typeof a === "string" ? a : (a.text || a.message || t("Χρειάζεται έλεγχος αποθήκης.","Warehouse needs attention.")),
        type: "alert"
      });
    });
  } catch (e) {
    console.warn("Hermes warehouse check skipped", e);
  }

  return alerts.slice(0, 8);
}


// ---------------- Hermes Action Center V38.5 — read-only priorities ----------------
function hermesDateOnly(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function hermesDaysUntil(dateStr) {
  const target = hermesDateOnly(dateStr);
  const today = hermesDateOnly(getTodayStr());
  if (!target || !today) return null;
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function hermesPriorityLabel(score) {
  if (score >= 90) return t("Υψηλή","High");
  if (score >= 65) return t("Μεσαία","Medium");
  return t("Χαμηλή","Low");
}

function hermesPriorityClass(score) {
  if (score >= 90) return "high";
  if (score >= 65) return "medium";
  return "low";
}

function hermesDateContext(c) {
  const days = hermesDaysUntil(c?.date || "");
  if (days === 0) return t("σήμερα","today");
  if (days === 1) return t("αύριο","tomorrow");
  if (days === null) return t("χωρίς ημερομηνία","no date");
  if (days > 1) return t(`σε ${days} ημέρες`,`in ${days} days`);
  return t("παλαιότερη","past");
}

function hermesBuildActionCenter() {
  const actions = [];

  (ceremonies || []).forEach((c) => {
    const days = hermesDaysUntil(c?.date || "");
    const missing = hermesMissingFields(c);
    const name = hermesFormatCeremonyName(c);

    if (days !== null && days < 0) return;
    if (days !== null && days > 7 && !missing.length) return;

    if (!String(c?.date || "").trim()) {
      actions.push({
        score: 75,
        title: t("Υπόθεση χωρίς ημερομηνία","Case without a date"),
        text: `${name}. ${t("Χρειάζεται ημερομηνία για να μπει σωστά στο πρόγραμμα.","Needs a date to be scheduled correctly.")}`,
        case_id: ensureCeremonyCaseId(c),
        kind: "ceremony_missing_date"
      });
    }

    if (missing.length && (days === 0 || days === 1 || days === null)) {
      let score = days === 0 ? 95 : days === 1 ? 90 : 70;
      if (missing.includes(t("υπεύθυνος","coordinator")) || missing.includes(t("2ο άτομο","2nd person"))) score += 5;
      if (missing.includes(t("συνοδοί αποτέφρωσης","cremation escorts"))) score += 3;
      actions.push({
        score: Math.min(score, 100),
        title: `${days === 0 ? t("Σήμερα","Today") : days === 1 ? t("Αύριο","Tomorrow") : t("Εκκρεμής","Pending")} — ${t("τελετή με ελλείψεις","ceremony with missing fields")}`,
        text: `${name}. ${t("Λείπει","Missing")}: ${missing.join(", ")}.`,
        case_id: ensureCeremonyCaseId(c),
        kind: "ceremony_missing_fields"
      });
    }

    if ((days === 0 || days === 1) && !String(c?.pickupDate || "").trim()) {
      actions.push({
        score: days === 0 ? 78 : 68,
        title: t("Έλεγχος παραλαβής","Check pickup date"),
        text: `${name}. ${t("Δεν έχει συμπληρωθεί ημερομηνία παραλαβής.","Pickup date has not been filled in.")}`,
        case_id: ensureCeremonyCaseId(c),
        kind: "pickup_date_missing"
      });
    }
  });

  try {
    const warehouseAlerts = typeof aiAnalyzeWarehouse === "function" ? aiAnalyzeWarehouse() : [];
    (warehouseAlerts || []).slice(0, 5).forEach((a) => {
      actions.push({
        score: 35,
        title: t("Έλεγχος αποθήκης","Warehouse check"),
        text: typeof a === "string" ? a : (a.text || a.message || t("Χαμηλό απόθεμα ή ανάγκη ελέγχου.","Low stock or needs attention.")),
        kind: "warehouse"
      });
    });
  } catch (e) {
    console.warn("Hermes action warehouse check skipped", e);
  }

  const seen = new Set();
  return actions
    .filter((a) => {
      const key = `${a.kind}|${a.case_id || ""}|${a.title}|${a.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 10)
    .map((a) => ({
      ...a,
      label: hermesPriorityLabel(a.score),
      level: hermesPriorityClass(a.score)
    }));
}

function hermesBuildNotes() {
  const notes = [];
  const places = new Map();
  const cremations = (ceremonies || []).filter(c => String(c?.burialType || "").trim() === "Αποτεφρωση").length;

  (ceremonies || []).forEach((c) => {
    const place = String(c?.place || "").trim();
    if (!place) return;
    places.set(place, (places.get(place) || 0) + 1);
  });

  const topPlace = [...places.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topPlace && topPlace[1] >= 3) {
    notes.push({ title: t("Μοτίβο τοποθεσίας","Location pattern"), text: t(`Η τοποθεσία «${topPlace[0]}» εμφανίζεται ${topPlace[1]} φορές. Αργότερα μπορεί να γίνει κανόνας γραφείου.`,`Location "${topPlace[0]}" appears ${topPlace[1]} times. Could become an office default.`) });
  }

  if (cremations >= 3) {
    notes.push({ title: t("Μοτίβο αποτέφρωσης","Cremation pattern"), text: t(`Υπάρχουν ${cremations} αποτεφρώσεις στο ιστορικό. Ο Hermes θα μπορεί να προτείνει προεπιλογές.`,`${cremations} cremations in history. Hermes can suggest defaults for escorts.`) });
  }

  notes.push({ title: t("Read-only λειτουργία","Read-only mode"), text: t("Αυτή η έκδοση μόνο διαβάζει. Δεν αποθηκεύει, δεν διαγράφει και δεν στέλνει τίποτα.","This version is read-only. It does not save, delete or send anything.") });
  return notes.slice(0, 6);
}


function topEntryFromMap(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1])[0] || null;
}

function addCount(map, key) {
  const clean = String(key || "").trim();
  if (!clean || clean === "-" || clean === "Κανένας") return;
  map.set(clean, (map.get(clean) || 0) + 1);
}

function confidenceFromCount(count, total = 1) {
  const ratio = total ? count / total : 0;
  return Math.max(50, Math.min(99, Math.round(45 + count * 8 + ratio * 30)));
}

function hermesLearnOfficeDna() {
  const memories = [];
  const byPlace = new Map();
  const responsibleMap = new Map();
  const secondMap = new Map();

  (ceremonies || []).forEach((c) => {
    const place = String(c?.place || "").trim();
    if (!place) return;
    if (!byPlace.has(place)) byPlace.set(place, []);
    byPlace.get(place).push(c);
    addCount(responsibleMap, c?.responsible);
    addCount(secondMap, c?.secondPerson);
  });

  byPlace.forEach((list, place) => {
    if (list.length < 2) return;
    const burialTypes = new Map();
    const responsibles = new Map();
    const seconds = new Map();
    list.forEach((c) => {
      addCount(burialTypes, c?.burialType || "Ταφή");
      addCount(responsibles, c?.responsible);
      addCount(seconds, c?.secondPerson);
    });
    const topBurial = topEntryFromMap(burialTypes);
    const topResponsible = topEntryFromMap(responsibles);
    const topSecond = topEntryFromMap(seconds);
    const key = `place_${normalizeTextKey(place).toLowerCase().replace(/[^a-z0-9α-ωάέήίόύώϊϋΐΰ]+/gi, "_").slice(0, 80)}`;
    memories.push({
      category: "temple_place",
      key_name: key,
      confidence: confidenceFromCount(list.length, ceremonies.length || 1),
      value: {
        label: place,
        appearances: list.length,
        usual_burial_type: topBurial ? topBurial[0] : "",
        usual_responsible: topResponsible ? topResponsible[0] : "",
        usual_second_person: topSecond ? topSecond[0] : "",
        last_seen: list.map(c => c.date).filter(Boolean).sort().pop() || ""
      }
    });
  });

  const cremationList = (ceremonies || []).filter(c => String(c?.burialType || "").trim() === "Αποτεφρωση");
  if (cremationList.length >= 2) {
    const escortCounts = new Map();
    const cremationPlaces = new Map();
    cremationList.forEach((c) => {
      addCount(escortCounts, c?.cremationEscortCount ? String(c.cremationEscortCount) : "");
      addCount(cremationPlaces, c?.place);
    });
    const topEscort = topEntryFromMap(escortCounts);
    const topCremationPlace = topEntryFromMap(cremationPlaces);
    memories.push({
      category: "habit",
      key_name: "cremation_pattern",
      confidence: confidenceFromCount(cremationList.length, ceremonies.length || 1),
      value: {
        label: t("Αποτεφρώσεις","Cremations"),
        appearances: cremationList.length,
        usual_place: topCremationPlace ? topCremationPlace[0] : "",
        usual_escort_count: topEscort ? topEscort[0] : "",
        suggestion: topEscort ? t(`Στις αποτεφρώσεις εμφανίζονται συχνά ${topEscort[0]} συνοδοί.`,`Cremations usually have ${topEscort[0]} escorts.`) : t("Οι αποτεφρώσεις έχουν επαναλαμβανόμενο μοτίβο.","Cremations show a repeating pattern.")
      }
    });
  }

  const topResponsible = topEntryFromMap(responsibleMap);
  if (topResponsible && topResponsible[1] >= 3) {
    memories.push({
      category: "collaborator",
      key_name: `responsible_${normalizeTextKey(topResponsible[0]).toLowerCase().replace(/[^a-z0-9α-ωάέήίόύώϊϋΐΰ]+/gi, "_").slice(0, 80)}`,
      confidence: confidenceFromCount(topResponsible[1], ceremonies.length || 1),
      value: {
        label: topResponsible[0],
        role: t("Υπεύθυνος τελετής","Ceremony coordinator"),
        appearances: topResponsible[1]
      }
    });
  }

  const merged = mergeOfficeDnaMemories(memories);
  syncOfficeDnaToCloud(merged).catch(() => {});
  return merged;
}

function hermesBuildDnaList() {
  const dna = hermesLearnOfficeDna();
  return (dna || []).slice(0, 8).map((m) => {
    const v = m.value || {};
    let title = v.label || m.key_name || t("Μνήμη γραφείου","Office memory");
    let text = "";
    if (m.category === "temple_place") {
      text = `${v.appearances || 0} ${t("εμφανίσεις","appearances")}${v.usual_burial_type ? ` · ${t("συνήθως","usually")}: ${v.usual_burial_type}` : ""}${v.usual_responsible ? ` · ${t("υπεύθυνος","coordinator")}: ${v.usual_responsible}` : ""}`;
    } else if (m.category === "habit") {
      text = v.suggestion || `${v.appearances || 0} ${t("εμφανίσεις","appearances")}`;
    } else if (m.category === "collaborator") {
      text = `${v.role || t("Συνεργάτης","Collaborator")} · ${v.appearances || 0} ${t("εμφανίσεις","appearances")}`;
    } else {
      text = `${m.category || t("Μνήμη","Memory")} · ${t("εμπιστοσύνη","confidence")} ${m.confidence || 0}%`;
    }
    return { title, text: `${text} · ${t("εμπιστοσύνη","confidence")} ${m.confidence || 0}%` };
  });
}

function hermesEventTypeLabel(type) {
  const map = {
    ceremony_created: t("Νέα τελετή","New ceremony"),
    ceremony_updated: t("Ενημέρωση τελετής","Ceremony updated"),
    ceremony_deleted: t("Διαγραφή τελετής","Ceremony deleted"),
    warehouse_updated: t("Ενημέρωση αποθήκης","Warehouse updated"),
    memory_learned: t("Νέα μνήμη","New memory")
  };
  return map[type] || String(type || t("Γεγονός","Event"));
}

function hermesFormatEventDate(iso) {
  const d = new Date(iso || "");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("el-GR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function hermesBuildEventLog() {
  const events = loadLocalOfficeEvents();
  return (events || []).slice(0, 8).map((ev) => {
    const p = ev.payload || {};
    const name = p.name || ev.title || hermesEventTypeLabel(ev.type);
    const details = [
      ev.case_id ? `${t("Υπόθεση","Case")}: ${ev.case_id}` : "",
      p.date ? `${t("Ημ/νία","Date")}: ${p.date}` : "",
      p.place ? `${t("Τόπος","Location")}: ${p.place}` : "",
      ev.created_at ? hermesFormatEventDate(ev.created_at) : ""
    ].filter(Boolean).join(" · ");
    return {
      title: `${hermesEventTypeLabel(ev.type)}${name ? ` — ${name}` : ""}`,
      text: details || t("Καταγράφηκε κίνηση στο γραφείο.","Activity recorded."),
      type: ev.type || "event"
    };
  });
}

function renderHermesDashboard() {
  const tab = $("hermesTab");
  if (!tab) return;

  const today = getTodayStr();
  const tomorrow = typeof aiTomorrowStr === "function" ? aiTomorrowStr() : "";
  const todayList = (ceremonies || []).filter(c => c.date === today);
  const tomorrowList = (ceremonies || []).filter(c => c.date === tomorrow);
  const alerts = hermesBuildAlerts();
  const actions = hermesBuildActionCenter();
  const notes = hermesBuildNotes();
  const dnaList = hermesBuildDnaList();

  hermesSetText("hermesTodayCount", String(todayList.length));
  hermesSetText("hermesTomorrowCount", String(tomorrowList.length));
  hermesSetText("hermesIssuesCount", String(alerts.length));
  hermesSetText("hermesActionCount", String(actions.length));
  hermesSetText("hermesMemoryCount", String(dnaList.length));

  const pill = $("hermesStatusPill");
  if (pill) {
    pill.classList.remove("ok", "warn", "danger");
    if (alerts.length === 0) {
      pill.textContent = t("Όλα ήρεμα","All clear");
      pill.classList.add("ok");
    } else if (alerts.length <= 3) {
      pill.textContent = t("Θέλει ματιά","Needs attention");
      pill.classList.add("warn");
    } else {
      pill.textContent = t("Προσοχή","Warning");
      pill.classList.add("danger");
    }
  }

  const alertsBox = $("hermesAlertsList");
  if (alertsBox) {
    alertsBox.innerHTML = alerts.length
      ? alerts.map(a => `<div class="hermes-item alert"><strong>${esc(a.title)}</strong>${esc(a.text)}</div>`).join("")
      : `<div class="hermes-item empty"><strong>${t("Καθαρό τοπίο","All clear")}</strong>${t("Δεν βρέθηκαν άμεσες εκκρεμότητες για σήμερα/αύριο.","No immediate issues for today/tomorrow.")}</div>`;
  }

  const actionBox = $("hermesActionList");
  if (actionBox) {
    actionBox.innerHTML = actions.length
      ? actions.map(a => `<div class="hermes-item action ${esc(a.level)}"><div class="hermes-action-top"><strong>${esc(a.title)}</strong><span>${esc(a.label)} · ${Number(a.score || 0)}</span></div><p>${esc(a.text)}</p>${a.case_id ? `<small>${esc(a.case_id)}</small>` : ""}</div>`).join("")
      : `<div class="hermes-item empty"><strong>${t("Δεν υπάρχει άμεση ενέργεια","No immediate actions")}</strong>${t("Ο Hermes δεν βρήκε κάτι που να χρειάζεται προτεραιότητα τώρα.","Hermes found nothing requiring priority right now.")}</div>`;
  }

  const notesBox = $("hermesNotesList");
  if (notesBox) {
    notesBox.innerHTML = notes.map(n => `<div class="hermes-item"><strong>${esc(n.title)}</strong>${esc(n.text)}</div>`).join("");
  }

  const dnaBox = $("hermesDnaList");
  if (dnaBox) {
    dnaBox.innerHTML = dnaList.length
      ? dnaList.map(m => `<div class="hermes-item memory"><strong>${esc(m.title)}</strong>${esc(m.text)}</div>`).join("")
      : `<div class="hermes-item empty"><strong>${t("Η μνήμη χτίζεται","Memory building")}</strong>${t("Μόλις υπάρχουν αρκετές επαναλήψεις, ο Hermes θα τις κρατά εδώ.","Once enough patterns emerge, Hermes will store them here.")}</div>`;
  }

  hermesRenderCompletionList();
  hermesRenderQuickFixes();

  const eventsBox = $("hermesEventsList");
  if (eventsBox) {
    const events = hermesBuildEventLog();
    eventsBox.innerHTML = events.length
      ? events.map(e => `<div class="hermes-item event"><strong>${esc(e.title)}</strong>${esc(e.text)}</div>`).join("")
      : `<div class="hermes-item empty"><strong>${t("Δεν υπάρχουν ακόμη γεγονότα","No events yet")}</strong>${t("Μόλις αποθηκεύσεις ή επεξεργαστείς τελετή, θα εμφανιστεί εδώ.","Once you save or edit a ceremony, it will appear here.")}</div>`;
  }
}

// ---------------- Render all ----------------
function renderAll() {
  updateHomeDashboard();
  renderCeremonies();
  renderWarehouse();
  renderSets();
  renderSecondHelpers();
  renderCustomLists();
  renderCustomFieldsSettings();
  renderAllSectionPanels();
  renderHistory();
  try { renderHermesDashboard(); } catch (e) { console.warn("Hermes render skipped", e); }
  updateStats();
  ensureUpdatesUI();
  renderUpdatesBadge();
  bindCeremoniesActions();
}

// ---------------- Push subscribe ----------------
function pushPref() { return localStorage.getItem(PUSH_PREF_KEY) || ""; }
function setPushPref(v) { localStorage.setItem(PUSH_PREF_KEY, v || ""); }
function getLastPushTs() { return Number(localStorage.getItem(LAST_PUSH_TS_KEY) || "0") || 0; }
function setLastPushTs(ts) { localStorage.setItem(LAST_PUSH_TS_KEY, String(ts || 0)); }

function isStandalonePWA() {
  return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
    || (window.navigator && window.navigator.standalone === true);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "./" });
    return reg;
  } catch (e) {
    console.error("SW register failed", e);
    return null;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

function compactSubscription(sub) {
  try {
    const j = sub.toJSON ? sub.toJSON() : sub;
    return {
      endpoint: j.endpoint,
      keys: j.keys || {},
      device: getDeviceLabel() || "Άγνωστη συσκευή",
      ts: nowTs()
    };
  } catch {
    return null;
  }
}

async function savePushSubscriptionToCloud(compactSub) {
  if (!compactSub) return;

  if (!Array.isArray(pushSubs)) pushSubs = [];
  if (!Array.isArray(aiSeenNotes)) aiSeenNotes = [];
  const me = getDeviceLabel() || "";
  const idx = pushSubs.findIndex(s => (s.device || "") === me);
  if (idx !== -1) pushSubs[idx] = compactSub;
  else pushSubs.push(compactSub);

  if (pushSubs.length > 50) pushSubs = pushSubs.slice(-50);

  saveData();
}

async function subscribePush(reg) {
  if (!reg) throw new Error("No service worker registration");

  if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.includes("PASTE_")) {
    alert("Λείπει το VAPID PUBLIC KEY.");
    return;
  }

  if (!("Notification" in window)) {
    alert("Η συσκευή/Browser δεν υποστηρίζει Notifications.");
    return;
  }

  if (Notification.permission === "denied") {
    alert("Τα Notifications είναι μπλοκαρισμένα. Θέλει άδεια από τις ρυθμίσεις Safari/iOS.");
    return;
  }

  if (Notification.permission !== "granted") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setPushPref("off");
      alert("Push: ΑΠΕΝΕΡΓΟ (δεν δόθηκε άδεια).");
      return;
    }
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  const compact = compactSubscription(sub);
  await savePushSubscriptionToCloud(compact);

  setPushPref("on");

  try {
    new Notification("Σταυρακάκη — Push ενεργό ✅", {
      body: "Έγινε εγγραφή στο Push. (Για πραγματικό push θέλει sender Edge Function)"
    });
  } catch {}

  alert("Push (Option B): ΕΝΕΡΓΟ ✅");
}

async function setupPushOptB() {
  try {
    const reg = await registerServiceWorker();
    if (!reg) {
      alert("Δεν μπόρεσα να ενεργοποιήσω Service Worker.");
      return;
    }

    if (!isStandalonePWA()) {
      alert("Σημείωση: Στο iPhone για push όταν είναι κλειστή, πρέπει Add to Home Screen.");
    }

    await subscribePush(reg);
  } catch (e) {
    console.error(e);
    alert("Δεν μπόρεσα να ενεργοποιήσω Push.");
  }
}

// ---------------- Fallback local notifications ----------------
function newestForeignChange() {
  const me = getDeviceLabel() || "";
  let best = null;
  for (const c of (changeLog || [])) {
    if (!c) continue;
    if ((c.device || "") === me) continue;
    const ts = Number(c.ts) || 0;
    if (!best || ts > (Number(best.ts) || 0)) best = c;
  }
  return best;
}

function maybeNotifyForChanges_LocalOnly() {
  try {
    if (pushPref() !== "on") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const newest = newestForeignChange();
    if (!newest) return;

    const last = getLastPushTs();
    const nts = Number(newest.ts) || 0;
    if (nts <= last) return;

    const title = "Σταυρακάκη — Νέα αλλαγή";
    const body = `${newest.device || "Άλλη συσκευή"}: ${newest.summary || "Update"}`;
    new Notification(title, { body });

    setLastPushTs(nts);
  } catch {}
}

async function refreshFromCloudForPush() {
  if (!USE_CLOUD) return;
  try {
    await cloudLoadData();
    setsWarehouse = normalizeSetsWarehouseList(setsWarehouse);
    secondHelpers = normalizeSecondHelpersList(secondHelpers);
    localStorage.setItem(CHANGELOG_KEY, JSON.stringify(changeLog));
    localStorage.setItem(SETS_KEY, JSON.stringify(setsWarehouse));
    localStorage.setItem(SECOND_HELPERS_KEY, JSON.stringify(secondHelpers));
    localStorage.setItem(AI_SEEN_NOTES_KEY, JSON.stringify(aiSeenNotes || []));
    renderUpdatesBadge();
    maybeNotifyForChanges_LocalOnly();
  } catch {}
}





// ---------------- V38.9 Hermes Completion Engine — local/read-only ----------------
function hermesIsFilled(value) {
  const s = String(value ?? "").trim();
  return !!s && s !== "-" && s !== "Κανένας";
}

function hermesHasModuleEvent(caseId, moduleKey) {
  const id = String(caseId || "").trim();
  if (!id) return false;
  return loadLocalOfficeEvents().some(ev => {
    const p = ev?.payload || {};
    return String(ev?.case_id || "") === id && String(p?.module || "") === moduleKey;
  });
}

function hermesAnnouncementStatus(c) {
  return String(c?.announcementStatus || "Δεν χρειάζεται").trim();
}

function hermesAnnouncementIsNeeded(c) {
  const s = hermesAnnouncementStatus(c);
  return s !== "Δεν χρειάζεται" && s !== "Not needed";
}

function hermesAnnouncementIsDone(c) {
  const status = hermesAnnouncementStatus(c);
  return status === "Ολοκληρώθηκε" || status === "Done" || hermesHasModuleEvent(ensureCeremonyCaseId(c), "announcements");
}

function hermesCompletionItems(c) {
  const burial = String(c?.burialType || "Ταφή").trim();
  const isCremation = burial === "Αποτεφρωση";
  const items = [
    { key: "name", label: t("Όνομα","Name"), weight: 10, ok: hermesIsFilled(c?.name), quick: false },
    { key: "date", label: t("Ημερομηνία","Date"), weight: 10, ok: hermesIsFilled(c?.date), quick: true },
    { key: "time", label: t("Ώρα","Time"), weight: 5, ok: hermesIsFilled(c?.time), quick: true },
    { key: "place", label: t("Τοποθεσία","Location"), weight: 10, ok: hermesIsFilled(c?.place), quick: true },
    { key: "responsible", label: t("Υπεύθυνος","Coordinator"), weight: 12, ok: hermesIsFilled(c?.responsible), quick: true },
    { key: "burialType", label: t("Τρόπος","Type"), weight: 5, ok: hermesIsFilled(c?.burialType), quick: true },
    { key: "coffin", label: t("Φέρετρο","Coffin"), weight: 9, ok: hermesIsFilled(c?.coffin), quick: true },
    { key: "set", label: t("ΣΕΤ","SET"), weight: 6, ok: hermesIsFilled(c?.set), quick: true },
    { key: "pickup", label: t("Παραλαβή","Pickup"), weight: 8, ok: hermesIsFilled(c?.pickup), quick: true },
    { key: "pickupDate", label: t("Ημ/νία παραλαβής","Pickup date"), weight: 7, ok: hermesIsFilled(c?.pickupDate), quick: true },
    { key: "secondPerson", label: t("2ο άτομο","2nd person"), weight: 8, ok: hermesIsFilled(c?.secondPerson), quick: true },
    isCremation
      ? { key: "cremationEscortCount", label: t("Συνοδοί αποτέφρωσης","Cremation escorts"), weight: 6, ok: hermesIsFilled(c?.cremationEscortCount), quick: true }
      : { key: "pallbearers", label: t("Φραγκοφόροι","Pallbearers"), weight: 6, ok: hermesIsFilled(c?.pallbearers), quick: true },
    { key: "announcement", label: t("Αγγελτήριο","Announcement"), weight: 4, ok: hermesAnnouncementIsDone(c), quick: true, optional: !hermesAnnouncementIsNeeded(c) }
  ];
  return items.filter(x => !x.optional);
}

function hermesCompletionForCeremony(c) {
  const items = hermesCompletionItems(c);
  const total = items.reduce((sum, x) => sum + Number(x.weight || 0), 0) || 1;
  const done = items.filter(x => x.ok).reduce((sum, x) => sum + Number(x.weight || 0), 0);
  const score = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  const missing = items.filter(x => !x.ok);
  return { score, missing, items, case_id: ensureCeremonyCaseId(c) };
}

function hermesCompletionLevel(score) {
  if (score >= 90) return "ok";
  if (score >= 70) return "warn";
  return "danger";
}

function hermesTodayAndTomorrowSorted() {
  const today = getTodayStr();
  const tomorrow = typeof aiTomorrowStr === "function" ? aiTomorrowStr() : addDaysStr(today, 1);
  return (ceremonies || [])
    .filter(c => c.date === today || c.date === tomorrow)
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || ""));
}

function hermesBuildCompletionRows() {
  return hermesTodayAndTomorrowSorted().map(c => ({ ceremony: c, ...hermesCompletionForCeremony(c) }));
}

function hermesAverageScore(rows) {
  if (!rows || !rows.length) return 100;
  return Math.round(rows.reduce((sum, r) => sum + Number(r.score || 0), 0) / rows.length);
}


function hermesEstimatedMinutes(rows){
  return (rows || []).reduce((sum,r)=>sum + ((r.missing || []).length),0);
}

function hermesFirstPriorityText(rows) {
  const minutes = hermesEstimatedMinutes(rows);
  const bad = (rows || []).filter(r => r.missing && r.missing.length).sort((a,b)=>a.score-b.score)[0];

  if (!bad){
    return t(`🟢 Ήρεμη μέρα · ${minutes} λεπτά δουλειάς`, `🟢 Quiet day · ${minutes} min workload`);
  }

  const name = bad.ceremony?.name || t("Τελετή", "Ceremony");
  const miss = bad.missing[0]?.label || t("εκκρεμότητα", "pending");

  return `🔥 ${name} · ${miss} · ${t(`${minutes} λεπτά δουλειάς`, `${minutes} min`)}` ;
}

function hermesRenderCompletionList() {
  const box = $("hermesCompletionList");
  if (!box) return;
  const rows = hermesBuildCompletionRows().filter(r => r.score < 100).sort((a,b)=>a.score-b.score).slice(0, 8);
  if (!rows.length) {
    box.innerHTML = `<div class="hermes-item empty"><strong>${t("Όλα στο 100%","All at 100%")}</strong>${t("Δεν βρέθηκε κάτι που να λείπει σε σημερινές/αυριανές τελετές.","Nothing missing in today's/tomorrow's ceremonies.")}</div>`;
    return;
  }
  box.innerHTML = rows.map(r => {
    const c = r.ceremony || {};
    const missing = r.missing.slice(0, 6).map(m => `<span>☐ ${esc(m.label)}</span>`).join("");
    const when = [c.date ? formatDate(c.date) : "", c.time || ""].filter(Boolean).join(" · ");
    return `<div class="hermes-completion-item ${hermesCompletionLevel(r.score)}">
      <div class="completion-top"><div><strong>${esc(c.name || t("Χωρίς όνομα","No name"))}</strong><small>${esc(when)}</small></div><b>${r.score}%</b></div>
      <div class="completion-missing"><em>${t("Λείπουν:","Missing:")}</em>${missing}</div>
      <small class="completion-case">${esc(r.case_id || "")}</small>
    </div>`;
  }).join("");
}

function hermesRenderQuickFixes() {
  const box = $("hermesQuickFixList");
  if (!box) return;
  const fixes = [];
  hermesBuildCompletionRows().forEach(r => {
    (r.missing || []).filter(m => m.quick).slice(0, 3).forEach(m => {
      fixes.push({ name: r.ceremony?.name || t("Τελετή","Ceremony"), label: m.label, score: r.score, id: r.case_id });
    });
  });
  const top = fixes.slice(0, 6);
  if (!top.length) {
    box.innerHTML = `<div class="hermes-item empty"><strong>${t("Δεν έχει γρήγορες διορθώσεις","No quick fixes")}</strong>${t("Οι βασικές εκκρεμότητες φαίνονται τακτοποιημένες.","The main items appear to be in order.")}</div>`;
    return;
  }
  box.innerHTML = top.map(f => `<div class="hermes-quick-item"><strong>${esc(f.label)}</strong><span>${esc(f.name)}</span><small>${esc(f.id || "")}</small></div>`).join("");
}

function updateHermesMiniBrief() {
  const today = getTodayStr();
  const tomorrow = typeof aiTomorrowStr === "function" ? aiTomorrowStr() : addDaysStr(today, 1);
  const todayList = (ceremonies || []).filter(c => c.date === today);
  const tomorrowList = (ceremonies || []).filter(c => c.date === tomorrow);
  const rows = hermesBuildCompletionRows();
  const avg = hermesAverageScore(rows);
  const issues = rows.reduce((sum, r) => sum + (r.missing?.length ? 1 : 0), 0);
  setText("miniTodayCount", String(todayList.length));
  setText("miniTomorrowCount", String(tomorrowList.length));
  setText("miniIssuesCount", String(issues));
  setText("miniReadinessScore", `${avg}%`);
  setText("miniPriorityText", hermesFirstPriorityText(rows));
}

// ---------------- V27.2 Home Dashboard ----------------
function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function updateHomeDashboard() {
  const today = getTodayStr();
  const tomorrow = aiTomorrowStr();
  const todayList = (ceremonies || []).filter(c => c.date === today);
  const tomorrowList = (ceremonies || []).filter(c => c.date === tomorrow);
  const cremationsToday = todayList.filter(c => String(c.burialType || "").trim() === "Αποτεφρωση").length;
  const highNotes = aiAnalyzeNotes(todayList).filter(x => x.priority === "high");
  const todayErrors = aiAnalyzeErrors(todayList);
  const warehouseAlerts = aiAnalyzeWarehouse();
  const issues = highNotes.length + todayErrors.length + warehouseAlerts.length;

  setText("dashTodayCount", String(todayList.length));
  setText("dashTomorrowCount", String(tomorrowList.length));
  setText("dashCremationsCount", String(cremationsToday));
  setText("dashIssuesCount", String(issues));
  setText("dashTodayMeta", todayList.length === 1 ? t("τελετή", "ceremony") : t("τελετές", "ceremonies"));
  setText("dashTomorrowMeta", tomorrowList.length === 1 ? t("τελετή", "ceremony") : t("τελετές", "ceremonies"));

  updateHermesMiniBrief();

  // V36.1: Δεν εμφανίζουμε πλέον το πλαίσιο "AI ΠΡΟΣΟΧΗ" στην αρχική.
  // Οι λεπτομέρειες παραμένουν μέσα στον AI Βοηθό.
}

// ---------------- AI Βοηθός V1 — Cloudflare/Supabase, χωρίς LM Studio ----------------
let aiLastReportText = "";
let aiLastMode = "full";

function aiSafeDate(c) {
  if (!c?.date) return null;
  const d = new Date(c.date + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function aiDateOnlyStr(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function aiTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return aiDateOnlyStr(d);
}

function aiCeremonyTitle(c) {
  const name = c?.name || t("Χωρίς όνομα","No name");
  const when = [c?.date ? formatDate(c.date) : t("χωρίς ημερομηνία","no date"), c?.time || ""].filter(Boolean).join(" • ");
  return `${name} — ${when}`;
}

function aiIsBlank(v) {
  const s = String(v ?? "").trim();
  return !s || s === "-" || s === "Κανένας" || s === "None";
}

function aiCurrentWeekCeremonies() {
  const now = new Date();
  const monday = getMondayOfWeek(now);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  return ceremonies.filter(c => {
    const d = aiSafeDate(c);
    return d && d >= monday && d < sunday;
  }).sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || ""));
}

function aiTodayCeremonies() {
  const today = getTodayStr();
  return ceremonies.filter(c => c.date === today).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

function aiTomorrowCeremonies() {
  const tomorrow = aiTomorrowStr();
  return ceremonies.filter(c => c.date === tomorrow).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

function aiNoteSignals(notes) {
  const text = normalizeTextKey(notes);
  const signals = [];

  const groups = [
    { label: "ΕΠΕΙΓΟΝ", words: ["ΕΠΕΙΓ", "ΑΜΕΣΑ", "ΣΗΜΕΡΑ", "ΟΠΩΣΔΗΠΟΤΕ", "SOS"] },
    { label: "ΠΡΟΣΟΧΗ", words: ["ΠΡΟΣΟΧ", "ΣΗΜΑΝΤ", "ΙΔΙΑΙΤ", "ΜΗΝ", "ΠΡΕΠΕΙ"] },
    { label: "ΟΙΚΟΓΕΝΕΙΑ", words: ["ΓΙΟΣ", "ΚΟΡΗ", "ΣΥΖΥΓ", "ΑΔΕΡΦ", "ΑΔΕΛΦ", "ΠΑΤΕΡ", "ΜΗΤΕΡ", "ΟΙΚΟΓΕΝ"] },
    { label: "ΚΑΘΥΣΤΕΡΗΣΗ/ΑΝΑΜΟΝΗ", words: ["ΠΕΡΙΜΕΝ", "ΚΑΘΥΣΤ", "ΑΡΓ", "ΝΑ ΜΗ ΦΥΓ", "ΝΑ ΜΗΝ ΦΥΓ", "ΑΝΑΜΟΝ"] },
    { label: "ΝΟΣΟΚΟΜΕΙΟ", words: ["ΝΟΣΟΚ", "ΕΥΑΓΓΕΛ", "ΛΑΙΚ", "ΓΕΝΝΗΜΑΤ", "ΣΩΤΗΡ", "ΙΑΣΩ", "ΥΓΕΙΑ", "ΜΗΤΕΡΑ"] },
    { label: "ΜΕΤΑΚΙΝΗΣΗ", words: ["ΑΕΡΟΔ", "ΛΙΜΑΝ", "ΤΑΞΙ", "ΜΕΤΑΦ", "ΠΑΡΑΛΑΒ", "ΠΕΡΑΣ", "ΝΑ ΠΑΕΙ"] },
    { label: "ΕΞΩΤΕΡΙΚΟ", words: ["ΑΥΣΤΡΑΛ", "ΚΑΝΑΔ", "ΑΜΕΡΙΚ", "ΓΕΡΜΑΝ", "ΑΓΓΛ", "ΕΞΩΤΕΡΙΚ"] },
    { label: "ΟΙΚΟΝΟΜΙΚΟ/ΣΥΝΕΝΝΟΗΣΗ", words: ["ΠΛΗΡ", "ΧΡΗΜ", "ΤΙΜ", "ΟΦΕΙΛ", "ΣΥΝΕΝΝ", "ΜΙΛΗΣ"] }
  ];

  groups.forEach(g => {
    if (g.words.some(w => text.includes(w))) signals.push(g.label);
  });

  return [...new Set(signals)];
}

function aiNotePriority(notes) {
  const signals = aiNoteSignals(notes);
  if (!String(notes || "").trim()) return "none";
  if (signals.includes("ΕΠΕΙΓΟΝ") || signals.includes("ΠΡΟΣΟΧΗ") || signals.includes("ΚΑΘΥΣΤΕΡΗΣΗ/ΑΝΑΜΟΝΗ")) return "high";
  if (signals.length >= 2) return "medium";
  return "normal";
}

function aiAnalyzeNotes(sourceList = ceremonies, includeSeen = false) {
  return sourceList
    .filter(c => String(c.notes || "").trim())
    .filter(c => includeSeen || !aiIsNoteSeen(c))
    .map(c => ({
      ceremony: c,
      key: aiNoteKey(c),
      priority: aiNotePriority(c.notes),
      signals: aiNoteSignals(c.notes),
      notes: String(c.notes || "").trim()
    }))
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, normal: 2, none: 3 };
      return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || (a.ceremony.date || "").localeCompare(b.ceremony.date || "") || (a.ceremony.time || "").localeCompare(b.ceremony.time || "");
    });
}

function aiMissingForCeremony(c) {
  const missing = [];
  if (aiIsBlank(c.name)) missing.push("όνομα θανόντα");
  if (aiIsBlank(c.place)) missing.push("τοποθεσία τελετής");
  if (aiIsBlank(c.responsible)) missing.push("υπεύθυνος");
  if (aiIsBlank(c.coffin)) missing.push("φέρετρο");
  if (aiIsBlank(c.set)) missing.push("ΣΕΤ");
  if (aiIsBlank(c.pickup)) missing.push("παραλαβή");

  const method = String(c.burialType || "Ταφή").trim();
  if (method === "Αποτεφρωση") {
    if (!Number(c.cremationEscortCount || 0)) missing.push("συνοδοί αίθουσας αποτέφρωσης");
    if (aiIsBlank(c.cremationParishNote)) missing.push("σημείωση ενορίας πριν την αποτέφρωση");
  } else {
    if (aiIsBlank(c.graveType)) missing.push("τύπος τάφου");
    if (c.graveType === "Οικογενειακός" && aiIsBlank(c.graveNumber)) missing.push("αριθμός οικογενειακού τάφου");
    if (c.graveType === "Τριετία" && aiIsBlank(c.graveZone)) missing.push("ζώνη τριετίας");
  }

  return missing;
}

function aiAnalyzeErrors(sourceList = ceremonies) {
  return sourceList
    .map(c => ({ ceremony: c, missing: aiMissingForCeremony(c) }))
    .filter(x => x.missing.length > 0)
    .sort((a, b) => b.missing.length - a.missing.length || (a.ceremony.date || "").localeCompare(b.ceremony.date || "") || (a.ceremony.time || "").localeCompare(b.ceremony.time || ""));
}

function aiAnalyzeWarehouse() {
  const coffinAlerts = (warehouse || [])
    .filter(item => {
      const qty = Number(item.qty) || 0;
      const name = item.name || "";
      if (isPriorityCoffin(name)) return qty <= 2;
      return qty === 0;
    })
    .map(item => ({ type: "Φέρετρο", name: item.name || "-", qty: Number(item.qty) || 0, critical: isPriorityCoffin(item.name) || Number(item.qty) === 0 }));

  const setAlerts = (setsWarehouse || [])
    .filter(item => {
      const qty = Number(item.qty) || 0;
      const key = normalizeTextKey(item.name);
      return (key === "ΓΚΡΙ" || key === "ΛΕΥΚΟ") && qty < 5;
    })
    .map(item => ({ type: "ΣΕΤ", name: item.name || "-", qty: Number(item.qty) || 0, critical: true }));

  return [...coffinAlerts, ...setAlerts].sort((a, b) => Number(a.qty) - Number(b.qty) || a.name.localeCompare(b.name, "el"));
}

function aiStaffLoad(sourceList = aiCurrentWeekCeremonies()) {
  const map = new Map();
  const inc = (name, role) => {
    const clean = String(name || "").trim();
    if (!clean || clean === "-" || clean === "Κανένας") return;
    if (!map.has(clean)) map.set(clean, { name: clean, total: 0, roles: {} });
    const item = map.get(clean);
    item.total += 1;
    item.roles[role] = (item.roles[role] || 0) + 1;
  };

  sourceList.forEach(c => {
    inc(c.responsible, "Υπεύθυνος");
    inc(c.secondPerson, "2ο άτομο");
    inc(c.pickupSecondPerson, "Παραλαβή");
    inc(c.suitcase, "Βαλίτσα");
  });

  return Array.from(map.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "el"));
}

function aiCountsBy(list, getter) {
  const map = new Map();
  list.forEach(c => {
    const raw = String(getter(c) || "").trim();
    if (!raw || raw === "-") return;
    const key = normalizeTextKey(raw);
    if (!map.has(key)) map.set(key, { label: raw, count: 0 });
    map.get(key).count += 1;
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "el"));
}

function aiHtmlSection(title, inner) {
  return `<div class="ai-section"><div class="ai-section-title">${esc(title)}</div>${inner}</div>`;
}

function aiHtmlCard(title, body, level = "") {
  const cls = level ? ` ai-${level}` : "";
  return `<div class="ai-card${cls}"><div class="ai-card-title">${esc(title)}</div>${body}</div>`;
}

function aiRenderBriefing() {
  const today = aiTodayCeremonies();
  const tomorrow = aiTomorrowCeremonies();
  const week = aiCurrentWeekCeremonies();
  const todayNotes = aiAnalyzeNotes(today);
  const todayErrors = aiAnalyzeErrors(today).filter(x => !aiIsAlertSeen(aiErrorKey(x)));
  const warehouseAlerts = aiAnalyzeWarehouse().filter(x => !aiIsAlertSeen(aiWarehouseAlertKey(x)));
  const cremationsToday = today.filter(c => String(c.burialType || "").trim() === "Αποτεφρωση").length;
  const burialsToday = today.length - cremationsToday;
  const pickups = aiCountsBy(today, c => c.pickup).slice(0, 6);
  const staff = aiStaffLoad(today).slice(0, 6);

  let html = "";
  html += aiHtmlSection("Σήμερα", aiHtmlCard(`${today.length} τελετές`, `
    <div class="ai-line"><span>Ταφές</span><b>${burialsToday}</b></div>
    <div class="ai-line"><span>Αποτεφρώσεις</span><b>${cremationsToday}</b></div>
    <div class="ai-line"><span>Κρίσιμες σημειώσεις</span><b>${todayNotes.filter(x => x.priority === "high").length}</b></div>
    <div class="ai-line"><span>Τελετές με ελλείψεις</span><b>${todayErrors.length}</b></div>
  `, todayErrors.length || todayNotes.some(x => x.priority === "high") ? "warning" : "ok"));

  html += aiHtmlSection("Αύριο", aiHtmlCard(`${tomorrow.length} τελετές`, `
    <div class="ai-meta">Γρήγορη εικόνα επόμενης ημέρας.</div>
    ${tomorrow.slice(0, 5).map(c => `<div class="ai-line"><span>${esc(c.name || "-")}</span><b>${esc(c.time || "-")}</b></div>`).join("") || `<div class="ai-empty">Δεν υπάρχουν τελετές για αύριο.</div>`}
  `));

  html += aiHtmlSection("Παραλαβές σήμερα", pickups.length ? pickups.map(x => `<div class="ai-line"><span>${esc(x.label)}</span><b>${x.count}</b></div>`).join("") : `<div class="ai-empty">Δεν έχουν δηλωθεί παραλαβές για σήμερα.</div>`);

  html += aiHtmlSection("Φόρτος προσωπικού σήμερα", staff.length ? staff.map(x => `<div class="ai-line"><span>${esc(x.name)}</span><b>${x.total}</b></div>`).join("") : `<div class="ai-empty">Δεν υπάρχουν αρκετά στοιχεία προσωπικού για σήμερα.</div>`);

  if (todayNotes.length) html += aiRenderNotes(today, true);
  if (todayErrors.length) html += aiRenderErrors(today, true);
  if (warehouseAlerts.length) html += aiRenderWarehouse(true);

  return html;
}

function aiRenderNotes(sourceList = ceremonies, embedded = false) {
  const notes = aiAnalyzeNotes(sourceList);
  const body = notes.length ? notes.map(item => {
    const level = item.priority === "high" ? "danger" : item.priority === "medium" ? "warning" : "";
    const badges = item.signals.length ? `<div class="ai-badge-row">${item.signals.map(s => `<span class="ai-badge">${esc(s)}</span>`).join("")}</div>` : `<div class="ai-badge-row"><span class="ai-badge">ΣΗΜΕΙΩΣΗ</span></div>`;
    return aiHtmlCard(aiCeremonyTitle(item.ceremony), `
      <div class="ai-meta">Προτεραιότητα: <b>${item.priority === "high" ? "ΥΨΗΛΗ" : item.priority === "medium" ? "ΜΕΣΑΙΑ" : "ΚΑΝΟΝΙΚΗ"}</b></div>
      <div class="ai-note-text">${esc(item.notes)}</div>
      ${badges}
      <div class="ai-note-actions"><button type="button" class="ai-seen-btn" data-ai-seen-note="${esc(item.key)}">Το είδα</button></div>
    `, level);
  }).join("") : `<div class="ai-empty">Δεν βρέθηκαν ενεργές σημειώσεις. Όσες πάτησες “Το είδα” μένουν στην καρτέλα της τελετής, απλώς δεν εμφανίζονται ξανά εδώ.</div>`;

  return aiHtmlSection(embedded ? "Σημαντικές σημειώσεις" : "Ανάλυση σημειώσεων", body);
}

function aiRenderErrors(sourceList = ceremonies, embedded = false) {
  const errors = aiAnalyzeErrors(sourceList).filter(item => !aiIsAlertSeen(aiErrorKey(item)));
  const body = errors.length ? errors.map(item => {
    const key = aiErrorKey(item);
    return aiHtmlCard(aiCeremonyTitle(item.ceremony), `
      <div class="ai-meta">Λείπουν / θέλουν έλεγχο:</div>
      <div class="ai-badge-row">${item.missing.map(m => `<span class="ai-badge">${esc(m)}</span>`).join("")}</div>
      ${aiSeenButton(key)}
    `, item.missing.length >= 3 ? "danger" : "warning");
  }).join("") : `<div class="ai-card ai-ok"><div class="ai-card-title">Καθαρό</div><div class="ai-empty">Δεν βρέθηκαν ενεργές βασικές ελλείψεις. Όσα πάτησες “Το είδα” δεν εμφανίζονται ξανά εδώ.</div></div>`;

  return aiHtmlSection(embedded ? "Ελλείψεις σήμερα" : "Έλεγχος ελλείψεων", body);
}

function aiRenderWarehouse(embedded = false) {
  const alerts = aiAnalyzeWarehouse().filter(item => !aiIsAlertSeen(aiWarehouseAlertKey(item)));
  const body = alerts.length ? alerts.map(item => {
    const key = aiWarehouseAlertKey(item);
    return aiHtmlCard(`${item.type}: ${item.name}`, `
      <div class="ai-line"><span>Απόθεμα</span><b>${item.qty}</b></div>
      <div class="ai-meta">${item.type === "ΣΕΤ" ? "Κάτω από το όριο ασφαλείας." : "Χρειάζεται προσοχή στο απόθεμα."}</div>
      ${aiSeenButton(key)}
    `, item.qty === 0 ? "danger" : "warning");
  }).join("") : `<div class="ai-card ai-ok"><div class="ai-card-title">Αποθήκη ΟΚ</div><div class="ai-empty">Δεν βρέθηκαν ενεργά χαμηλά κρίσιμα αποθέματα. Όσα πάτησες “Το είδα” δεν εμφανίζονται ξανά εδώ.</div></div>`;

  return aiHtmlSection(embedded ? "Αποθήκη" : "Έλεγχος αποθήκης", body);
}

function aiRenderFull() {
  const week = aiCurrentWeekCeremonies();
  let html = aiRenderBriefing();
  html += aiHtmlSection("Εβδομάδα", aiHtmlCard(`${week.length} τελετές αυτή την εβδομάδα`, `
    <div class="ai-line"><span>Με σημειώσεις</span><b>${aiAnalyzeNotes(week).length}</b></div>
    <div class="ai-line"><span>Με ελλείψεις</span><b>${aiAnalyzeErrors(week).length}</b></div>
    <div class="ai-line"><span>Αποτεφρώσεις</span><b>${week.filter(c => String(c.burialType || "").trim() === "Αποτεφρωση").length}</b></div>
  `));
  html += aiHtmlSection("Φόρτος προσωπικού εβδομάδας", aiStaffLoad(week).length ? aiStaffLoad(week).map(x => `<div class="ai-line"><span>${esc(x.name)}</span><b>${x.total}</b></div>`).join("") : `<div class="ai-empty">Δεν υπάρχουν στοιχεία προσωπικού.</div>`);
  return html;
}


function aiBuildCloudPayload() {
  const today = getTodayStr();
  const tomorrow = aiTomorrowStr();
  const week = aiCurrentWeekCeremonies();

  const compactCeremonies = (ceremonies || []).map(c => ({
    id: c.id || "",
    date: c.date || "",
    time: c.time || "",
    name: c.name || "",
    place: c.place || "",
    burialType: c.burialType || "Ταφή",
    responsible: c.responsible || "",
    secondPerson: c.secondPerson || "",
    pickupSecondPerson: c.pickupSecondPerson || "",
    suitcase: c.suitcase || "",
    coffin: c.coffin || "",
    set: c.set || "",
    flowers: c.flowers || "",
    decor: c.decor || "",
    decorNote: c.decorNote || "",
    pallbearers: c.pallbearers || "",
    coffee: c.coffee || "",
    coffeePlace: c.coffeePlace || "",
    pickup: c.pickup || "",
    pickupDate: c.pickupDate || "",
    coldRoom: c.coldRoom || "",
    graveType: c.graveType || "",
    graveNumber: c.graveNumber || "",
    graveZone: c.graveZone || "",
    cremationEscortCount: Number(c.cremationEscortCount || 0),
    cremationParishNote: c.cremationParishNote || "",
    notes: aiIsNoteSeen(c) ? "" : (c.notes || "")
  }));

  return {
    app: "Τελετές Σταυρακάκη",
    version: "v27.3",
    generatedAt: new Date().toISOString(),
    device: getDeviceLabel() || "",
    userId: window.__authUser?.id || null,
    today,
    tomorrow,
    summary: {
      totalCeremonies: ceremonies.length,
      todayCount: aiTodayCeremonies().length,
      tomorrowCount: aiTomorrowCeremonies().length,
      weekCount: week.length,
      importantNotes: aiAnalyzeNotes(ceremonies).filter(x => x.priority === "high").length,
      errorCeremonies: aiAnalyzeErrors(ceremonies).length,
      warehouseAlerts: aiAnalyzeWarehouse().length
    },
    ceremonies: compactCeremonies,
    warehouse: (warehouse || []).map(w => ({ name: w.name || "", qty: Number(w.qty || 0) })),
    setsWarehouse: (setsWarehouse || []).map(w => ({ name: w.name || "", qty: Number(w.qty || 0) })),
    hiddenNoteKeys: aiSeenNotes || [],
    localAnalysis: {
      notes: aiAnalyzeNotes(ceremonies).slice(0, 60).map(x => ({
        ceremony: aiCeremonyTitle(x.ceremony),
        priority: x.priority,
        signals: x.signals,
        notes: x.notes
      })),
      errors: aiAnalyzeErrors(ceremonies).slice(0, 60).map(x => ({
        ceremony: aiCeremonyTitle(x.ceremony),
        missing: x.missing
      })),
      warehouseAlerts: aiAnalyzeWarehouse()
    }
  };
}

function aiCloudFallbackHtml(errorText = "") {
  const local = aiRenderFull();
  const warning = aiHtmlSection("Cloud AI", aiHtmlCard("Δεν έχει ενεργοποιηθεί ακόμα το Supabase Edge AI", `
    <div class="ai-meta">Η εφαρμογή δεν σταματάει. Τρέχει αμέσως ο τοπικός AI V1.</div>
    ${errorText ? `<div class="ai-note-text">${esc(errorText)}</div>` : ""}
    <div class="ai-badge-row">
      <span class="ai-badge">Cloudflare OK</span>
      <span class="ai-badge">Supabase OK</span>
      <span class="ai-badge">Fallback V1 ενεργό</span>
    </div>
  `, "warning"));
  return warning + local;
}


function aiFindCeremoniesByQuestion(question, sourceList = ceremonies) {
  const keys = aiQuestionKeywords(question);
  if (!keys.length) return [];
  return (sourceList || []).filter(c => aiFieldHasAllKeywords(aiCeremonySearchBlob(c), keys));
}

function aiAnswerSearchResults(question, list) {
  const keys = aiQuestionKeywords(question);
  const target = keys.length ? ` για ${keys.join(" ")}` : "";
  const wantsCount = normalizeTextKey(question).includes("ΠΟΣ") || normalizeTextKey(question).includes("ΜΕΤΡ") || normalizeTextKey(question).includes("ΣΥΝΟΛ");
  const lines = [];
  lines.push(`${wantsCount ? "Βρήκα" : "Σχετικά αποτελέσματα"}${target}: ${list.length}.`);
  if (!list.length) {
    lines.push("• Δεν βρέθηκε καταχώρηση με αυτά τα στοιχεία στην εφαρμογή.");
    return lines.join("\n");
  }
  list
    .sort((a,b)=>(a.date||"").localeCompare(b.date||"") || (a.time||"").localeCompare(b.time||""))
    .slice(0, 20)
    .forEach(c => {
      const extra = [
        c.pickup ? `Παραλαβή: ${c.pickup}` : "",
        c.place ? `Τόπος: ${c.place}` : "",
        c.coldRoom ? `Ψυκτικός: ${c.coldRoom}` : "",
        c.notes ? `Σημ.: ${String(c.notes).slice(0, 80)}${String(c.notes).length > 80 ? "…" : ""}` : ""
      ].filter(Boolean).join(" · ");
      lines.push(`• ${c.date || "-"} ${c.time || "-"} — ${c.name || "-"}${extra ? ` — ${extra}` : ""}`);
    });
  if (list.length > 20) lines.push(`• +${list.length - 20} ακόμη.`);
  return lines.join("\n");
}

function aiQuestionTimeFilter(question, list = ceremonies) {
  const q = normalizeTextKey(question);
  const now = new Date();
  const today = getTodayStr();
  const tomorrow = aiTomorrowStr();
  const monthNames = [
    ["ΙΑΝΟΥΑΡ", 0], ["ΦΕΒΡΟΥΑΡ", 1], ["ΜΑΡΤ", 2], ["ΑΠΡΙΛ", 3], ["ΜΑΙ", 4], ["ΜΑΪ", 4], ["ΙΟΥΝ", 5],
    ["ΙΟΥΛ", 6], ["ΑΥΓΟΥΣ", 7], ["ΣΕΠΤ", 8], ["ΟΚΤ", 9], ["ΝΟΕΜ", 10], ["ΔΕΚ", 11]
  ];
  let out = Array.isArray(list) ? list.slice() : [];
  if (q.includes("ΣΗΜΕΡ")) out = out.filter(c => c.date === today);
  if (q.includes("ΑΥΡΙΟ")) out = out.filter(c => c.date === tomorrow);
  if (q.includes("ΕΒΔΟΜΑΔ")) {
    const monday = getMondayOfWeek(now);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 7);
    out = out.filter(c => { const d = aiSafeDate(c); return d && d >= monday && d < sunday; });
  }
  if (q.includes("ΜΗΝΑ") || q.includes("ΜΗΝΟΣ") || q.includes("ΤΡΕΧΟΝ")) {
    const y = now.getFullYear(); const m = now.getMonth();
    out = out.filter(c => { const d = aiSafeDate(c); return d && d.getFullYear() === y && d.getMonth() === m; });
  }
  if (q.includes("ΦΕΤΟΣ")) {
    const y = now.getFullYear();
    out = out.filter(c => { const d = aiSafeDate(c); return d && d.getFullYear() === y; });
  }
  const yearMatch = q.match(/20\d{2}/);
  if (yearMatch) {
    const y = Number(yearMatch[0]);
    out = out.filter(c => { const d = aiSafeDate(c); return d && d.getFullYear() === y; });
  }
  for (const [stem, monthIndex] of monthNames) {
    if (q.includes(stem)) {
      out = out.filter(c => { const d = aiSafeDate(c); return d && d.getMonth() === monthIndex; });
      break;
    }
  }
  return out;
}

function aiQuestionScope(question) {
  const q = normalizeTextKey(question);
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

function aiQuestionFieldValue(c, scope) {
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
  return aiCeremonySearchBlob(c);
}

function aiGroupCounts(list, getter) {
  const map = new Map();
  (list || []).forEach(c => {
    const raw = String(getter(c) || "").trim() || "—";
    const key = normalizeSearchText(raw);
    if (!map.has(key)) map.set(key, { label: raw, count: 0 });
    map.get(key).count += 1;
  });
  return Array.from(map.values()).sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label,"el"));
}

function aiFormatCeremonyList(list, limit = 20) {
  if (!list.length) return "• Δεν βρέθηκαν τελετές.";
  const lines = [];
  list
    .sort((a,b)=>(a.date||"").localeCompare(b.date||"") || (a.time||"").localeCompare(b.time||""))
    .slice(0, limit)
    .forEach(c => {
      const extra = [
        c.pickup ? `Παραλαβή: ${c.pickup}` : "",
        c.place ? `Τόπος: ${c.place}` : "",
        c.responsible && c.responsible !== "-" ? `Υπ.: ${c.responsible}` : "",
        c.coffin ? `Φέρετρο: ${c.coffin}` : "",
        c.set ? `ΣΕΤ: ${c.set}` : "",
        c.notes ? `Σημ.: ${String(c.notes).slice(0, 90)}${String(c.notes).length > 90 ? "…" : ""}` : ""
      ].filter(Boolean).join(" · ");
      lines.push(`• ${c.date || "-"} ${c.time || "-"} — ${c.name || "-"}${extra ? ` — ${extra}` : ""}`);
    });
  if (list.length > limit) lines.push(`• +${list.length - limit} ακόμη.`);
  return lines.join("\n");
}

function aiAnswerSearchResults(question, list) {
  const keys = aiQuestionKeywords(question);
  const scope = aiQuestionScope(question);
  const q = normalizeTextKey(question);
  const wantsCount = q.includes("ΠΟΣ") || q.includes("ΜΕΤΡ") || q.includes("ΣΥΝΟΛ");
  const target = keys.length ? ` για ${keys.join(" ")}` : "";
  const lines = [];
  lines.push(`${wantsCount ? "Βρήκα" : "Σχετικά αποτελέσματα"}${target}: ${list.length}.`);
  if (!list.length) {
    lines.push("• Δεν βρέθηκε καταχώρηση με αυτά τα στοιχεία στην εφαρμογή.");
    return lines.join("\n");
  }
  lines.push(aiFormatCeremonyList(list));
  if (scope === "pickup") {
    const byResponsible = aiGroupCounts(list, c => c.responsible).slice(0, 8);
    if (byResponsible.length) lines.push("\nΑνά υπεύθυνο:\n" + byResponsible.map(x => `• ${x.label}: ${x.count}`).join("\n"));
  }
  return lines.join("\n");
}

function aiLocalQuestionAnswer(question) {
  const q = normalizeTextKey(question);
  const scopedByTime = aiQuestionTimeFilter(question, ceremonies);
  const scope = aiQuestionScope(question);
  const keys = aiQuestionKeywords(question);
  const wantsCount = q.includes("ΠΟΣ") || q.includes("ΜΕΤΡ") || q.includes("ΣΥΝΟΛ");
  const wantsMost = q.includes("ΠΕΡΙΣΣ") || q.includes("TOP") || q.includes("ΣΥΧΝ") || q.includes("ΠΙΟ ΠΟΛ");
  const wantsList = q.includes("ΠΟΙ") || q.includes("ΔΕΙΞ") || q.includes("ΛΙΣΤ") || !wantsCount;

  const filterByScopeAndKeys = (list) => {
    let out = list.slice();
    if (scope === "cremation") out = out.filter(c => normalizeTextKey(c.burialType).includes("ΑΠΟΤΕΦ"));
    if (scope === "burial") out = out.filter(c => !normalizeTextKey(c.burialType).includes("ΑΠΟΤΕΦ"));
    if (keys.length) {
      out = out.filter(c => aiFieldHasAllKeywords(aiQuestionFieldValue(c, scope), keys));
      if (!out.length) out = list.filter(c => aiFieldHasAllKeywords(aiCeremonySearchBlob(c), keys));
    }
    return out;
  };

  if (q.includes("ΣΗΜΕΙ") || q.includes("ΠΡΟΣΟΧ") || q.includes("ΙΔΙΑΙΤ")) {
    const notes = aiAnalyzeNotes(filterByScopeAndKeys(scopedByTime));
    const activeNotes = notes.filter(x => !aiIsNoteSeen(x.ceremony));
    const list = activeNotes.length ? activeNotes : notes;
    const lines = [`Βρήκα ${list.length} σημειώσεις${activeNotes.length !== notes.length ? " (μαζί με όσες έχουν πατηθεί ως Το είδα)" : ""}.`];
    list.slice(0, 15).forEach(x => lines.push(`• ${aiCeremonyTitle(x.ceremony)}: ${x.notes}`));
    return lines.join("\n");
  }

  if (q.includes("ΛΕΙΠ") || q.includes("ΕΛΛΕΙ") || q.includes("ΛΑΘ")) {
    const errors = aiAnalyzeErrors(filterByScopeAndKeys(scopedByTime));
    const lines = [`Τελετές με ελλείψεις: ${errors.length}.`];
    errors.slice(0, 15).forEach(e => lines.push(`• ${aiCeremonyTitle(e.ceremony)}: ${e.missing.join(", ")}`));
    return lines.join("\n");
  }

  if (q.includes("ΑΠΟΘ") || q.includes("ΠΑΡΑΓΓ") || q.includes("ΑΠΟΘΕΜ")) {
    const wh = aiAnalyzeWarehouse();
    if (wantsMost || q.includes("ΦΕΡΕΤΡ")) {
      const used = aiGroupCounts(scopedByTime, c => c.coffin).filter(x => x.label !== "—").slice(0, 15);
      return used.length ? "Χρήση φερέτρων:\n" + used.map(x => `• ${x.label}: ${x.count}`).join("\n") : "Δεν υπάρχουν στοιχεία χρήσης φερέτρων.";
    }
    const lines = [`Ειδοποιήσεις αποθήκης: ${wh.length}.`];
    wh.slice(0, 20).forEach(w => lines.push(`• ${w.type} ${w.name}: απόθεμα ${w.qty}`));
    return lines.join("\n");
  }

  if (wantsMost || q.includes("ΑΝΑ ΥΠΕΥΘ") || q.includes("ΥΠΕΥΘΥΝ")) {
    let getter = c => c.responsible;
    let title = "Ανά υπεύθυνο";
    if (scope === "coffin") { getter = c => c.coffin; title = "Χρήση φερέτρων"; }
    if (scope === "set") { getter = c => c.set; title = "Χρήση ΣΕΤ"; }
    if (scope === "pickup") { getter = c => c.pickup; title = "Ανά τόπο παραλαβής"; }
    if (scope === "coldRoom") { getter = c => c.coldRoom; title = "Ανά ψυκτικό θάλαμο"; }
    if (scope === "decor") { getter = c => c.decor; title = "Ανά στολισμό"; }
    const counts = aiGroupCounts(filterByScopeAndKeys(scopedByTime), getter).filter(x => x.label !== "—").slice(0, 20);
    return counts.length ? `${title}:\n` + counts.map(x => `• ${x.label}: ${x.count}`).join("\n") : `Δεν υπάρχουν αρκετά στοιχεία για ${title.toLowerCase()}.`;
  }

  const found = filterByScopeAndKeys(scopedByTime);
  if (keys.length || scope !== "all" || q.includes("ΣΗΜΕΡ") || q.includes("ΑΥΡΙΟ") || q.includes("ΕΒΔΟΜΑΔ") || q.match(/20\d{2}/)) {
    const scopeLabel = {
      pickup: "παραλαβές",
      coldRoom: "ψυκτικούς θαλάμους",
      notes: "σημειώσεις",
      coffin: "φέρετρα",
      set: "ΣΕΤ",
      responsible: "υπεύθυνους",
      cremation: "αποτεφρώσεις",
      burial: "ταφές",
      coffee: "καφέ",
      decor: "στολισμούς",
      pallbearers: "φραγκοφόρους",
      all: "τελετές"
    }[scope] || "τελετές";
    const lines = [`Βρήκα ${found.length} ${scopeLabel}${keys.length ? ` για ${keys.join(" ")}` : ""}.`];
    if (wantsList || found.length <= 30) lines.push(aiFormatCeremonyList(found));
    if (found.length && scope === "pickup") {
      const byPickup = aiGroupCounts(found, c => c.pickup).filter(x => x.label !== "—").slice(0, 10);
      if (byPickup.length) lines.push("\nΑνά παραλαβή:\n" + byPickup.map(x => `• ${x.label}: ${x.count}`).join("\n"));
    }
    return lines.join("\n");
  }

  const today = aiTodayCeremonies();
  const tomorrow = aiTomorrowCeremonies();
  const week = aiCurrentWeekCeremonies();
  return [
    "Δεν βρήκα ακριβή τύπο ερώτησης, αλλά διάβασα τα δεδομένα της εφαρμογής.",
    `• Σήμερα: ${today.length} τελετές`,
    `• Αύριο: ${tomorrow.length} τελετές`,
    `• Εβδομάδα: ${week.length} τελετές`,
    `• Ενεργές σημειώσεις: ${aiAnalyzeNotes(ceremonies).length}`,
    `• Ελλείψεις: ${aiAnalyzeErrors(ceremonies).length}`,
    `• Αποθήκη: ${aiAnalyzeWarehouse().length} ειδοποιήσεις`,
    "",
    "Ρώτα π.χ. “πόσες παραλαβές από Γεννηματά το 2026”, “ποια φέρετρα χρησιμοποιήθηκαν περισσότερο”, “ποιες τελετές έχει αύριο ο Σταύρος”, “ποιες σημειώσεις έχουν Καναδά”."
  ].join("\n");
}


function aiSaveChat(question, answer, source = "AI") {
  if (!Array.isArray(aiChatHistory)) aiChatHistory = [];
  aiChatHistory.push({ ts: nowTs(), question: String(question || ""), answer: String(answer || ""), source });
  if (aiChatHistory.length > 80) aiChatHistory = aiChatHistory.slice(-80);
  saveData();
  aiRenderChatHistory();
}

function aiRenderChatHistory() {
  const box = $("aiChatHistoryBox");
  if (!box) return;
  const items = (aiChatHistory || []).slice(-8).reverse();
  if (!items.length) {
    box.innerHTML = `<div class="ai-empty">Δεν υπάρχει ακόμα ιστορικό ερωτήσεων.</div>`;
    return;
  }
  box.innerHTML = items.map(x => `
    <div class="ai-chat-item">
      <div class="ai-chat-q">${esc(x.question)}</div>
      <div class="ai-chat-a">${esc(String(x.answer || "").slice(0, 280))}${String(x.answer || "").length > 280 ? "…" : ""}</div>
      <div class="ai-meta">${formatTimestamp(x.ts)} · ${esc(x.source || "AI")}</div>
    </div>
  `).join("");
}

function aiEnsureChatHistoryUI() {
  const modal = $("aiAssistantModal");
  const output = $("aiAssistantOutput");
  if (!modal || !output || $("aiChatHistoryBox")) return;
  const wrap = document.createElement("div");
  wrap.className = "ai-chat-history-wrap";
  wrap.innerHTML = `
    <div class="ai-section-title">Ιστορικό ερωτήσεων AI</div>
    <div id="aiChatHistoryBox" class="ai-chat-history"></div>
  `;
  output.parentNode.insertBefore(wrap, output.nextSibling);
  aiRenderChatHistory();
}

async function aiAskQuestion() {
  const input = $("aiQuestionInput");
  const out = $("aiAssistantOutput");
  const question = String(input?.value || "").trim();
  if (!question) return alert("Γράψε πρώτα την ερώτηση.");
  if (!out) return;

  const { remaining, used, limit } = aiGetCloudUsage();
  if (remaining === 0) {
    out.innerHTML = aiHtmlSection("Cloud AI", aiHtmlCard("Όριο ημερήσιων χρήσεων", `
      <div class="ai-meta">Έχεις χρησιμοποιήσει ${used}/${limit} Cloud AI κλήσεις για σήμερα. Επαναφέρεται αύριο.</div>
    `, "warning"));
    return;
  }

  aiLastMode = "question";
  out.innerHTML = aiHtmlSection("Ερώτηση", aiHtmlCard(question, `<div class="ai-meta">Ρωτάω τον βοηθό AI…</div>`));

  const payload = aiBuildCloudPayload();
  payload.question = question;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_CLOUD_TIMEOUT_MS);

  try {
    const res = await fetch(AI_EDGE_URL, {
      method: "POST",
      headers: supabaseHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.status === 429) {
      const limitData = await res.json().catch(() => ({}));
      out.innerHTML = aiHtmlSection("Cloud AI", aiHtmlCard("Όριο ημερήσιων χρήσεων", `
        <div class="ai-meta">Έχεις χρησιμοποιήσει ${limitData.used ?? AI_CLOUD_DAILY_LIMIT}/${limitData.limit ?? AI_CLOUD_DAILY_LIMIT} Cloud AI κλήσεις για σήμερα. Επαναφέρεται αύριο.</div>
      `, "warning"));
      aiUpdateCloudUsageBadge();
      return;
    }
    if (!res.ok) throw new Error(`Edge Function απάντησε ${res.status}`);
    const data = await res.json();
    aiIncrementCloudUsage();
    const answer = String(data.answer || data.report || "").trim() || aiLocalQuestionAnswer(question);
    const html = aiHtmlSection("Απάντηση AI", aiHtmlCard(question, `
      <div class="ai-note-text">${esc(answer)}</div>
      <div class="ai-badge-row"><span class="ai-badge">Ερώτηση</span><span class="ai-badge">Cloud/Local AI</span></div>
    `, "ok"));
    out.innerHTML = html;
    aiLastReportText = `Ερώτηση: ${question}\n\n${answer}`;
  } catch (e) {
    clearTimeout(timer);
    const answer = aiLocalQuestionAnswer(question);
    const html = aiHtmlSection("Απάντηση AI", aiHtmlCard(question, `
      <div class="ai-meta">Δεν απάντησε το Cloud AI, οπότε απαντά ο τοπικός βοηθός.</div>
      <div class="ai-note-text">${esc(answer)}</div>
    `, "warning"));
    out.innerHTML = html;
    aiLastReportText = `Ερώτηση: ${question}\n\n${answer}`;
  }
}

async function aiRunCloud() {
  aiLastMode = "cloud";
  const out = $("aiAssistantOutput");
  if (!out) return;

  const { remaining, used, limit } = aiGetCloudUsage();
  if (remaining === 0) {
    out.innerHTML = aiHtmlSection("Cloud AI", aiHtmlCard("Όριο ημερήσιων χρήσεων", `
      <div class="ai-meta">Έχεις χρησιμοποιήσει ${used}/${limit} Cloud AI κλήσεις για σήμερα. Επαναφέρεται αύριο.</div>
      <div class="ai-badge-row"><span class="ai-badge">Τοπικός AI διαθέσιμος</span></div>
    `, "warning"));
    return;
  }

  out.innerHTML = aiHtmlSection("Cloud AI", aiHtmlCard("Στέλνω snapshot στο Supabase Edge Function…", `
    <div class="ai-meta">Σύνδεση με Supabase Cloud AI.</div>
  `));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_CLOUD_TIMEOUT_MS);

  try {
    const res = await fetch(AI_EDGE_URL, {
      method: "POST",
      headers: supabaseHeaders(),
      body: JSON.stringify(aiBuildCloudPayload()),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (res.status === 429) {
      const limitData = await res.json().catch(() => ({}));
      out.innerHTML = aiHtmlSection("Cloud AI", aiHtmlCard("Όριο ημερήσιων χρήσεων", `
        <div class="ai-meta">Έχεις χρησιμοποιήσει ${limitData.used ?? AI_CLOUD_DAILY_LIMIT}/${limitData.limit ?? AI_CLOUD_DAILY_LIMIT} Cloud AI κλήσεις για σήμερα. Επαναφέρεται αύριο.</div>
        <div class="ai-badge-row"><span class="ai-badge">Τοπικός AI διαθέσιμος</span></div>
      `, "warning"));
      aiUpdateCloudUsageBadge();
      return;
    }
    if (!res.ok) throw new Error(`Edge Function απάντησε ${res.status}`);

    const data = await res.json();
    aiIncrementCloudUsage();

    // Υποστηρίζει και τις 2 εκδόσεις Edge Function:
    // 1) answer/report (ελεύθερο κείμενο)
    // 2) structured cloud-v1 JSON: briefing, importantNotes, missing, lowStock, summary
    const directAnswer = String(data.answer || data.report || "").trim();

    let html = "";
    let textReport = "";

    if (directAnswer) {
      html = aiHtmlSection("Cloud AI Αναφορά", aiHtmlCard("Απάντηση Supabase Edge AI", `
        <div class="ai-note-text">${esc(directAnswer)}</div>
        <div class="ai-badge-row"><span class="ai-badge">Cloud AI ενεργό</span><span class="ai-badge">Supabase Edge Function</span></div>
      `, "ok"));
      textReport = directAnswer;
    } else {
      const briefing = Array.isArray(data.briefing) ? data.briefing : [];
      const notes = (Array.isArray(data.importantNotes) ? data.importantNotes : []).filter(n => {
        const c = aiFindCeremonyForCloudNote(n);
        return !c || !aiIsNoteSeen(c);
      });
      const missing = (Array.isArray(data.missing) ? data.missing : []).filter(m => !aiIsAlertSeen(aiAlertKey("cloud_missing", `${m.name || ""}|${m.date || ""}|${m.time || ""}|${(m.missing || []).join("|")}`)));
      const lowCoffins = (Array.isArray(data.lowStock?.coffins) ? data.lowStock.coffins : []).filter(x => !aiIsAlertSeen(aiAlertKey("cloud_stock", `Φέρετρο ${x}`)));
      const lowSets = (Array.isArray(data.lowStock?.sets) ? data.lowStock.sets : []).filter(x => !aiIsAlertSeen(aiAlertKey("cloud_stock", `ΣΕΤ ${x}`)));
      const summary = data.summary || {};

      const briefingHtml = briefing.length
        ? briefing.map(x => `<div class="ai-line"><span>${esc(x)}</span></div>`).join("")
        : `<div class="ai-empty">Το Cloud AI απάντησε, αλλά δεν έστειλε briefing.</div>`;

      const notesHtml = notes.length
        ? notes.slice(0, 30).map(n => {
            const c = aiFindCeremonyForCloudNote(n);
            const key = c ? aiNoteKey(c) : "";
            return aiHtmlCard(`${n.name || "-"} ${n.time ? "• " + n.time : ""}`, `
              <div class="ai-meta">${esc(n.date || "χωρίς ημερομηνία")}</div>
              <div class="ai-note-text">${esc(n.notes || "")}</div>
              ${key ? `<div class="ai-note-actions"><button type="button" class="ai-seen-btn" data-ai-seen-note="${esc(key)}">Το είδα</button></div>` : ""}
            `, "warning");
          }).join("")
        : `<div class="ai-card ai-ok"><div class="ai-card-title">Σημειώσεις</div><div class="ai-empty">Δεν βρέθηκαν ειδικές σημειώσεις.</div></div>`;

      const missingHtml = missing.length
        ? missing.slice(0, 30).map(m => {
            const key = aiAlertKey("cloud_missing", `${m.name || ""}|${m.date || ""}|${m.time || ""}|${(m.missing || []).join("|")}`);
            return aiHtmlCard(`${m.name || "-"} ${m.time ? "• " + m.time : ""}`, `
              <div class="ai-meta">${esc(m.date || "χωρίς ημερομηνία")}</div>
              <div class="ai-badge-row">${(m.missing || []).map(x => `<span class="ai-badge">${esc(x)}</span>`).join("")}</div>
              ${aiSeenButton(key)}
            `, "danger");
          }).join("")
        : `<div class="ai-card ai-ok"><div class="ai-card-title">Ελλείψεις</div><div class="ai-empty">Δεν βρέθηκαν ενεργές βασικές ελλείψεις.</div></div>`;

      const stockItems = [...lowCoffins.map(x => `Φέρετρο ${x}`), ...lowSets.map(x => `ΣΕΤ ${x}`)];
      const stockHtml = stockItems.length
        ? stockItems.map(x => {
            const key = aiAlertKey("cloud_stock", x);
            return `<div class="ai-card ai-warning"><div class="ai-line"><span>${esc(x)}</span></div>${aiSeenButton(key)}</div>`;
          }).join("")
        : `<div class="ai-empty">Δεν βρέθηκαν ενεργά χαμηλά αποθέματα.</div>`;

      html = `
        ${aiHtmlSection("Cloud AI Αναφορά", aiHtmlCard("Σύνοψη", `
          <div class="ai-line"><span>Σύνολο τελετών</span><b>${summary.totalCeremonies ?? 0}</b></div>
          <div class="ai-line"><span>Σήμερα</span><b>${summary.todayCeremonies ?? 0}</b></div>
          <div class="ai-line"><span>Σημειώσεις</span><b>${summary.notesFound ?? 0}</b></div>
          <div class="ai-line"><span>Ελλείψεις</span><b>${summary.missingItems ?? 0}</b></div>
          <div class="ai-badge-row"><span class="ai-badge">Cloud AI ενεργό</span><span class="ai-badge">Supabase Edge Function</span></div>
        `, "ok"))}
        ${aiHtmlSection("Briefing", briefingHtml)}
        ${aiHtmlSection("Σημειώσεις", notesHtml)}
        ${aiHtmlSection("Ελλείψεις", missingHtml)}
        ${aiHtmlSection("Αποθήκη", stockHtml)}
      `;

      textReport = aiStripHtmlToText(html);
    }

    out.innerHTML = html;
    aiLastReportText = `Cloud AI Βοηθός Σταυρακάκη — ${formatTimestamp(nowTs())}\n\n${textReport}`;
  } catch (e) {
    clearTimeout(timer);
    const msg = e?.name === "AbortError" ? "Χρονικό όριο σύνδεσης με Cloud AI." : (e?.message || "Άγνωστο σφάλμα Cloud AI.");
    const html = aiCloudFallbackHtml(msg);
    out.innerHTML = html;
    aiLastReportText = `AI Βοηθός Σταυρακάκη — fallback V1 — ${formatTimestamp(nowTs())}\n\n${aiStripHtmlToText(html)}`;
  }
}

function aiStripHtmlToText(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").replace(/\n{3,}/g, "\n\n").trim();
}

function aiRun(mode = "full") {
  aiLastMode = mode;
  const out = $("aiAssistantOutput");
  if (!out) return;

  let html = "";
  if (mode === "briefing") html = aiRenderBriefing();
  else if (mode === "notes") html = aiRenderNotes(ceremonies);
  else if (mode === "errors") html = aiRenderErrors(ceremonies);
  else if (mode === "warehouse") html = aiRenderWarehouse();
  else html = aiRenderFull();

  out.innerHTML = html;
  aiLastReportText = `AI Βοηθός Σταυρακάκη — ${formatTimestamp(nowTs())}\n\n${aiStripHtmlToText(html)}`;
}

function openAIAssistant() {
  $("aiAssistantModal")?.classList.remove("hidden");
  aiEnsureChatHistoryUI();
  aiUpdateCloudUsageBadge();
  aiRun("briefing");
  aiRenderChatHistory();
}

function closeAIAssistant() {
  $("aiAssistantModal")?.classList.add("hidden");
}

async function copyAIReport() {
  if (!aiLastReportText) aiRun(aiLastMode || "full");
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(aiLastReportText || "");
      alert("Η αναφορά AI αντιγράφηκε.");
      return;
    }
  } catch {}
  window.prompt("Αντέγραψε την αναφορά:", aiLastReportText || "");
}

function bindAIAssistantActions() {
  const btn = $("aiAssistantBtn");
  if (btn && btn.dataset.bound !== "1") {
    btn.dataset.bound = "1";
    btn.onclick = openAIAssistant;
  }

  const bindings = [
    ["aiCloseBtn", closeAIAssistant],
    ["aiBriefingBtn", () => aiRun("briefing")],
    ["aiNotesBtn", () => aiRun("notes")],
    ["aiErrorsBtn", () => aiRun("errors")],
    ["aiWarehouseBtn", () => aiRun("warehouse")],
    ["aiFullBtn", () => aiRun("full")],
    ["aiCloudBtn", aiRunCloud],
    ["aiAskBtn", aiAskQuestion],
    ["aiCopyBtn", copyAIReport],
    ["aiRefreshBtn", () => aiRun(aiLastMode || "full")]
  ];

  bindings.forEach(([id, fn]) => {
    const el = $(id);
    if (el && el.dataset.bound !== "1") {
      el.dataset.bound = "1";
      el.onclick = fn;
    }
  });

  const q = $("aiQuestionInput");
  if (q && q.dataset.bound !== "1") {
    q.dataset.bound = "1";
    q.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        aiAskQuestion();
      }
    });
  }

  const output = $("aiAssistantOutput");
  if (output && output.dataset.bound !== "1") {
    output.dataset.bound = "1";
    output.addEventListener("click", (e) => {
      const seenBtn = e.target.closest("[data-ai-seen-note]");
      if (seenBtn) { aiMarkNoteSeen(seenBtn.dataset.aiSeenNote); return; }
      const seenAlertBtn = e.target.closest("[data-ai-seen-alert]");
      if (seenAlertBtn) { aiMarkAlertSeen(seenAlertBtn.dataset.aiSeenAlert); return; }
    });
  }
}


// ---------------- Dropdowns από Προσαρμοσμένες Λίστες ----------------
function fillDynamicDropdowns(c = {}) {
  if (window.__appLang === "en") {
    // EN/USA app: populate responsiblePerson from USA staff; clear hidden GR dropdowns
    const usaStaff = (() => {
      try { return JSON.parse(localStorage.getItem("funeralos_usa_staff_v2") || "[]"); } catch { return []; }
    })();
    const directorNames = usaStaff.filter(s => s && s.name).map(s => s.name);
    fillSelect($("responsiblePerson"), ["-", ...directorNames], c.responsible ?? "-");
    // Clear hidden dropdowns so iOS native picker never shows Greek options
    ["secondPerson","pickupSecondPerson","suitcase","ceremonyDecor","ceremonyPallbearers","ceremonyCoffee","ceremonyGraveZone"].forEach(id => {
      const el = $(id);
      if (el && el.tagName === "SELECT") el.innerHTML = '<option value="">-</option>';
    });
    return;
  }
  const items = getAllCustomListItems();
  fillSelect($("responsiblePerson"), ["-", ...items], c.responsible ?? "-");
  fillSelect($("secondPerson"), [t("Κανένας", "None"), ...items], c.secondPerson ?? t("Κανένας", "None"));
  fillSelect($("pickupSecondPerson"), ["", ...items], c.pickupSecondPerson ?? "");
  fillSelect($("suitcase"), ["-", ...items], c.suitcase ?? "-");
  fillSelect($("ceremonyDecor"), ["", ...items], c.decor ?? "");
  fillSelect($("ceremonyPallbearers"), ["", ...items], c.pallbearers ?? "");
  fillSelect($("ceremonyCoffee"), ["", ...items], c.coffee ?? "");
  fillSelect($("ceremonyGraveZone"), ["", ...items], c.graveZone ?? "");
}

// Override: κρατάμε τη φόρμα ίδια, αλλά γεμίζει όλα τα dropdowns από Αποθήκη Επιλογών.
function openCeremonyModal(id = null) {
  editingId = id;

  const modal = $("ceremonyModal");
  if (!modal) return alert("Λείπει το ceremonyModal από το index.html");

  const titleEl = $("modalTitle");
  if (titleEl) titleEl.textContent = id ? t("Επεξεργασία τελετής", "Edit ceremony") : t("Νέα τελετή", "New ceremony");

  const c = id ? (ceremonies.find(x => x.id === id) || {}) : {};

  setVal("ceremonyDate", c.date || "");
  setVal("ceremonyTime", c.time || "");
  setVal("deceasedName", c.name || "");
  setVal("ceremonyPlace", c.place || "");
  setVal("burialType", c.burialType || "Ταφή");

  setVal("cremationEscortCount", Number(c.cremationEscortCount || 0));
  setVal("cremationParishNote", c.cremationParishNote || "");

  fillDynamicDropdowns(c);

  const selectCoffin = $("ceremonyCoffin");
  if (selectCoffin) {
    selectCoffin.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "-";
    selectCoffin.appendChild(empty);
    warehouse.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.name;
      opt.textContent = item.name;
      if (item.name === c.coffin) opt.selected = true;
      selectCoffin.appendChild(opt);
    });
  }
  setVal("ceremonySheet", c.sheet || "");

  const setSel = $("ceremonySet");
  if (setSel) {
    setSel.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "-";
    setSel.appendChild(empty);
    setsWarehouse.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.name;
      opt.textContent = item.name;
      if (normalizeSetName(item.name) === normalizeSetName(c.set)) opt.selected = true;
      setSel.appendChild(opt);
    });
  }

  setVal("ceremonyFlowers", c.flowers || "");
  setVal("ceremonyAnnouncementStatus", c.announcementStatus || "Δεν χρειάζεται");
  setVal("ceremonyDecorNote", c.decorNote || "");
  setVal("ceremonyCoffeePlace", c.coffeePlace || "");
  setVal("ceremonyPickup", c.pickup || "");
  setVal("pickupDate", c.pickupDate || "");
  setVal("ceremonyColdRoom", c.coldRoom || "");
  setVal("ceremonyGraveNumber", c.graveNumber || "");
  setVal("ceremonyNotes", c.notes || "");

  const familyRadio = $("graveTypeFamily");
  const triennialRadio = $("graveTypeTriennial");
  if (familyRadio && triennialRadio) {
    familyRadio.checked = (c.graveType || "") === "Οικογενειακός";
    triennialRadio.checked = (c.graveType || "Τριετία") !== "Οικογενειακός";
  }

  toggleCremationUI();
  modal.classList.remove("hidden");
}

// ---------------- Init ----------------
document.addEventListener("DOMContentLoaded", async () => {
  if (window.__DEMO_MODE) {
    const banner = document.createElement("div");
    banner.id = "demoBanner";
    banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(90deg,#c8a96e,#e8d5b0);color:#0f1523;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:700;box-shadow:0 2px 12px rgba(0,0,0,.3);";
    banner.innerHTML = '<span>⚱️ DEMO OFFICE — Δοκιμαστικά δεδομένα · Καμία αλλαγή δεν αποθηκεύεται</span><a href="./login.html?tab=register" style="background:#0f1523;color:#c8a96e;padding:6px 14px;border-radius:6px;text-decoration:none;font-size:12px;white-space:nowrap;">Ξεκίνα δωρεάν →</a>';
    document.body.prepend(banner);
    document.body.style.paddingTop = "42px";
  }
  try {
    ensureDeviceLabel();
    await loadData();

    await registerServiceWorker();

    if ($("graveTypeFamily") && $("graveTypeTriennial")) {
      $("graveTypeFamily").checked = false;
      $("graveTypeTriennial").checked = true;
    }

    fillDynamicDropdowns({});

    setupTabs();
    renderAll();
    bindAIAssistantActions();
    aiEnsureChatHistoryUI();

    if ($("addCustomListBtn")) $("addCustomListBtn").onclick = openNewCustomListModal;

    if ($("newCeremonyBtn")) $("newCeremonyBtn").onclick = () => openCeremonyModal(null);
    if ($("addCustomFieldBtn")) $("addCustomFieldBtn").onclick = () => openCustomFieldModal(null);
    on($("customFieldForm"), "submit", saveCustomField);
    if ($("cancelCustomFieldBtn")) $("cancelCustomFieldBtn").onclick = closeCustomFieldModal;
    if ($("newCeremonyHeroBtn")) $("newCeremonyHeroBtn").onclick = () => openCeremonyModal(null);

    if ($("cancelModalBtn")) $("cancelModalBtn").onclick = closeCeremonyModal;
    on($("ceremonyForm"), "submit", saveCeremony);
    on($("burialType"), "change", () => toggleCremationUI());

    if ($("addCoffinBtn")) $("addCoffinBtn").onclick = () => openWarehouseModal(null);
    on($("warehouseForm"), "submit", saveWarehouseItem);
    if ($("cancelWarehouseBtn")) $("cancelWarehouseBtn").onclick = closeWarehouseModal;

    if ($("addSetBtn")) $("addSetBtn").onclick = () => openSetModal(null);
    on($("setForm"), "submit", saveSetItem);
    if ($("cancelSetBtn")) $("cancelSetBtn").onclick = closeSetModal;

    if ($("addSecondHelperBtn")) $("addSecondHelperBtn").onclick = () => openSecondHelperModal(null);
    on($("secondHelperForm"), "submit", saveSecondHelperItem);
    if ($("cancelSecondHelperBtn")) $("cancelSecondHelperBtn").onclick = closeSecondHelperModal;

    setInterval(() => {
      renderCeremonies();
      renderUpdatesBadge();
    }, 60000);

    setInterval(() => {
      refreshFromCloudForPush();
    }, 45000);

  } catch (e) {
    console.error(e);
    alert("Σφάλμα φόρτωσης app.js. Άνοιξε Console για λεπτομέρειες.");
  }
});


// ================================
// V36 — Ρυθμίσεις δυναμικών πεδίων καρτέλας
// Προσθετική αρχιτεκτονική: δεν αφαιρεί υπάρχοντα πεδία, προσθέτει customValues ανά τελετή.
// ================================
let customFieldEditingIndex = null;

function normalizeCustomFieldsList(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : []).map((f, idx) => {
    const label = normalizeNameLabel(f?.label || "");
    if (!label) return null;
    let key = String(f?.key || "").trim();
    if (!key) key = `cf_${aiSimpleHash(label + "_" + idx + "_" + nowTs())}`;
    key = key.replace(/[^a-zA-Z0-9_\-]/g, "_");
    if (seen.has(key)) key = `${key}_${idx}`;
    seen.add(key);
    const type = ["text","textarea","select","yesno","date","time","number","checkbox"].includes(f?.type) ? f.type : "text";
    const options = Array.isArray(f?.options) ? f.options.map(x => String(x || "").trim()).filter(Boolean) : [];
    return {
      key,
      label,
      type,
      placeholder: String(f?.placeholder || ""),
      options,
      required: !!f?.required,
      showCard: f?.showCard !== false,
      showShare: f?.showShare !== false,
      enabled: f?.enabled !== false,
      ts: Number(f?.ts || nowTs()) || nowTs(),
      section: ["ceremony","home","inventory","stats","history"].includes(f?.section) ? f.section : "ceremony"
    };
  }).filter(Boolean);
}

function ensureCustomFields() {
  customFields = normalizeCustomFieldsList(customFields);
  ceremonies.forEach(c => {
    if (!c.customValues || typeof c.customValues !== "object") c.customValues = {};
  });
}

function customFieldTypeLabel(type) {
  return ({ text:"Κείμενο", textarea:"Μεγάλο κείμενο", select:"Λίστα", yesno:"Ναι/Όχι", date:"Ημερομηνία", time:"Ώρα", number:"Αριθμός", checkbox:"Τικ ✓" })[type] || "Κείμενο";
}

function customFieldValue(c, field) {
  return c?.customValues?.[field.key] ?? "";
}

function customFieldValueDisplay(value, field) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  if (field.type === "date") return formatDate(String(value));
  if (field.type === "checkbox") return value === "true" ? "✓" : "✗";
  return String(value);
}

function renderCustomFieldsForm(c = {}) {
  ensureCustomFields();
  const box = $("customFieldsFormBox");
  if (!box) return;
  const active = customFields.filter(f => f.enabled !== false && (f.section || "ceremony") === "ceremony");
  if (!active.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML = active.map(f => {
    const value = customFieldValue(c, f);
    const req = f.required ? "required" : "";
    const ph = esc(f.placeholder || "");
    const label = `${esc(f.label)}${f.required ? " *" : ""}`;
    let control = "";
    if (f.type === "textarea") {
      control = `<textarea data-custom-field="${esc(f.key)}" rows="2" placeholder="${ph}" ${req}>${esc(value)}</textarea>`;
    } else if (f.type === "select") {
      const opts = ["", ...(f.options || [])];
      control = `<select data-custom-field="${esc(f.key)}" ${req}>${opts.map(o => `<option value="${esc(o)}" ${String(value) === String(o) ? "selected" : ""}>${esc(o || "—")}</option>`).join("")}</select>`;
    } else if (f.type === "yesno") {
      const opts = ["", t("Ναι","Yes"), t("Όχι","No"), t("Άλλο","Other")];
      control = `<select data-custom-field="${esc(f.key)}" ${req}>${opts.map(o => `<option value="${esc(o)}" ${String(value) === String(o) ? "selected" : ""}>${esc(o || "—")}</option>`).join("")}</select>`;
    } else if (f.type === "checkbox") {
      control = `<input type="checkbox" data-custom-field="${esc(f.key)}" ${value === "true" ? "checked" : ""} style="width:auto;margin-top:4px;" />`;
    } else {
      const inputType = f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "time" ? "time" : "text";
      control = `<input type="${inputType}" data-custom-field="${esc(f.key)}" value="${esc(value)}" placeholder="${ph}" ${req} />`;
    }
    return `<label>${label}${control}</label>`;
  }).join("");
}

function collectCustomFieldValues() {
  ensureCustomFields();
  const values = {};
  document.querySelectorAll("[data-custom-field]").forEach(el => {
    const key = el.dataset.customField;
    if (!key) return;
    values[key] = el.type === "checkbox" ? (el.checked ? "true" : "false") : (el.value || "");
  });
  return values;
}

function openCustomFieldModal(index = null) {
  ensureCustomFields();
  customFieldEditingIndex = index;
  const modal = $("customFieldModal");
  if (!modal) return;
  const f = index === null ? {} : (customFields[index] || {});
  setText("customFieldModalTitle", index === null ? t("Νέο πεδίο","New field") : t("Επεξεργασία πεδίου","Edit field"));
  setVal("customFieldLabel", f.label || "");
  setVal("customFieldType", f.type || "text");
  setVal("customFieldPlaceholder", f.placeholder || "");
  setVal("customFieldOptions", Array.isArray(f.options) ? f.options.join("\n") : "");
  const sectionSel = $("customFieldSection");
  if (sectionSel) sectionSel.value = f.section || currentCsSection || "ceremony";
  const req = $("customFieldRequired"); if (req) req.checked = !!f.required;
  const showCard = $("customFieldShowCard"); if (showCard) showCard.checked = f.showCard !== false;
  const showShare = $("customFieldShowShare"); if (showShare) showShare.checked = f.showShare !== false;
  modal.classList.remove("hidden");
}

function closeCustomFieldModal() {
  $("customFieldModal")?.classList.add("hidden");
}

function saveCustomField(e) {
  e.preventDefault();
  ensureCustomFields();
  const label = normalizeNameLabel(val("customFieldLabel"));
  if (!label) return alert("Γράψε όνομα πεδίου.");
  const type = val("customFieldType") || "text";
  const placeholder = val("customFieldPlaceholder").trim();
  const options = val("customFieldOptions").split(/\n+/).map(x => x.trim()).filter(Boolean);
  if (type === "select" && options.length === 0) return alert("Για λίστα επιλογών γράψε τουλάχιστον μία επιλογή.");

  const existing = customFieldEditingIndex === null ? null : customFields[customFieldEditingIndex];
  const field = {
    key: existing?.key || `cf_${aiSimpleHash(label + "_" + nowTs())}`,
    label,
    type,
    placeholder,
    options,
    required: !!$("customFieldRequired")?.checked,
    showCard: !!$("customFieldShowCard")?.checked,
    showShare: !!$("customFieldShowShare")?.checked,
    enabled: existing?.enabled !== false,
    ts: existing?.ts || nowTs(),
    section: val("customFieldSection") || "ceremony"
  };

  if (customFieldEditingIndex === null) {
    customFields.push(field);
    addChange("custom_field_add", `${t("Νέο πεδίο ρυθμίσεων","New custom field")}: ${label}`);
  } else {
    customFields[customFieldEditingIndex] = field;
    addChange("custom_field_edit", `${t("Αλλαγή πεδίου ρυθμίσεων","Edit custom field")}: ${label}`);
  }

  saveBackup("saveCustomField");
  saveData();
  closeCustomFieldModal();
  renderAll(); // includes renderCustomFieldsSettings + renderAllSectionPanels
}

function deleteCustomField(index) {
  ensureCustomFields();
  const f = customFields[index];
  if (!f) return;
  if (!confirm(`Διαγραφή πεδίου "${f.label}"; Θα αφαιρεθεί και η τιμή του από τις τελετές.`)) return;
  customFields.splice(index, 1);
  ceremonies.forEach(c => { if (c.customValues) delete c.customValues[f.key]; });
  addChange("custom_field_delete", `${t("Διαγραφή πεδίου ρυθμίσεων","Delete custom field")}: ${f.label}`);
  saveBackup("deleteCustomField");
  saveData();
  renderAll();
}

function toggleCustomField(index) {
  ensureCustomFields();
  const f = customFields[index];
  if (!f) return;
  f.enabled = f.enabled === false ? true : false;
  addChange("custom_field_toggle", `${f.enabled ? t("Ενεργό","Enabled") : t("Ανενεργό","Disabled")} ${t("πεδίο","field")}: ${f.label}`);
  saveData();
  renderAll();
}

function moveCustomField(fromIdx, toIdx) {
  ensureCustomFields();
  moveItem(customFields, fromIdx, toIdx);
  addChange("custom_field_reorder", t("Αλλαγή σειράς πεδίων ρυθμίσεων", "Reordered custom fields"));
  saveData();
  renderCustomFieldsSettings();
  renderAllSectionPanels();
}

let currentCsSection = "ceremony";

function renderCustomFieldsSettings() {
  ensureCustomFields();
  const body = $("customFieldsBody");
  if (!body) return;
  body.innerHTML = "";

  const sectionFields = customFields
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => (f.section || "ceremony") === currentCsSection);

  if (!sectionFields.length) {
    const msg = t("Δεν υπάρχουν πεδία για αυτήν την ενότητα. Πάτα \"+ Νέο πεδίο\".", "No fields for this section yet. Click \"+ New field\".");
    body.innerHTML = `<tr><td colspan="4" class="custom-field-muted">${msg}</td></tr>`;
    return;
  }

  sectionFields.forEach(({ f, i: idx }, sIdx) => {
    const prevIdx = sIdx > 0 ? sectionFields[sIdx - 1].i : -1;
    const nextIdx = sIdx < sectionFields.length - 1 ? sectionFields[sIdx + 1].i : -1;
    const tr = document.createElement("tr");
    if (f.enabled === false) tr.className = "custom-field-disabled";
    const show = [f.showCard !== false ? t("Κάρτα","Card") : "", f.showShare !== false ? "Share" : "", f.required ? t("Υποχρ.","Req.") : ""].filter(Boolean);
    tr.innerHTML = `
      <td><b>${esc(f.label)}</b><div class="custom-field-muted">${esc(f.placeholder || "")}</div></td>
      <td>${esc(customFieldTypeLabel(f.type))}</td>
      <td>${show.length ? show.map(x => `<span class="custom-field-badge">${esc(x)}</span>`).join("") : "—"}</td>
      <td><div class="warehouse-actions compact-actions">
        <button type="button" onclick="moveCustomField(${idx}, ${prevIdx})" ${prevIdx === -1 ? "disabled" : ""}>↑</button>
        <button type="button" onclick="moveCustomField(${idx}, ${nextIdx})" ${nextIdx === -1 ? "disabled" : ""}>↓</button>
        <button type="button" class="edit" onclick="openCustomFieldModal(${idx})">${t("Επεξεργασία","Edit")}</button>
        <button type="button" onclick="toggleCustomField(${idx})">${f.enabled === false ? t("Ενεργό","Enable") : t("Κρύψε","Hide")}</button>
        <button type="button" class="delete" onclick="deleteCustomField(${idx})">×</button>
      </div></td>
    `;
    body.appendChild(tr);
  });
}

// ========================
// SECTION PANELS
// ========================
const CS_SECTION_NOTES_GR = {
  ceremony: "Πεδία φόρμας τελετής — εμφανίζονται και στην κάρτα.",
  home: "Πεδία που εμφανίζονται στο Dashboard πάνω από τον AI Βοηθό.",
  inventory: "Πεδία που εμφανίζονται στην ενότητα Αποθήκης.",
  stats: "Πεδία που εμφανίζονται στα Στατιστικά.",
  history: "Πεδία που εμφανίζονται στο Ιστορικό."
};
const CS_SECTION_NOTES_EN = {
  ceremony: "Case form fields — also shown on the case card.",
  home: "Fields shown in the dashboard above the AI Assistant.",
  inventory: "Fields shown in the Inventory section.",
  stats: "Fields shown in the Stats section.",
  history: "Fields shown in History."
};

function setCsSection(section) {
  currentCsSection = section;
  document.querySelectorAll("#csSectionFilter button").forEach(b => {
    b.classList.toggle("active", (b.dataset.csSection || "") === section);
  });
  const noteEl = $("csSectionNote");
  if (noteEl) {
    const notes = window.__appLang === "en" ? CS_SECTION_NOTES_EN : CS_SECTION_NOTES_GR;
    noteEl.textContent = notes[section] || notes.ceremony;
  }
  renderCustomFieldsSettings();
}

function setCsSectionAndSettings(sectionId) {
  v38SwitchTab ? v38SwitchTab("settings") : (document.querySelector('[data-tab="settings"]')?.click());
  setTimeout(() => setCsSection(sectionId), 50);
}

function renderSectionPanel(sectionId) {
  const panel = $(`sectionPanel_${sectionId}`);
  if (!panel) return;

  const fields = (customFields || []).filter(f => (f.section || "ceremony") === sectionId && f.enabled !== false);
  if (!fields.length) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  panel.classList.remove("hidden");
  const data = (sectionData[sectionId] || {});
  const isEn = window.__appLang === "en";

  const fieldsHtml = fields.map(f => {
    const value = String(data[f.key] ?? "");
    const req = f.required ? "required" : "";
    const ph = esc(f.placeholder || "");
    const labelText = `${esc(f.label)}${f.required ? " *" : ""}`;
    let control = "";
    if (f.type === "textarea") {
      control = `<textarea data-sp-field="${esc(f.key)}" rows="2" placeholder="${ph}" ${req}>${esc(value)}</textarea>`;
    } else if (f.type === "select") {
      const opts = ["", ...(f.options || [])];
      control = `<select data-sp-field="${esc(f.key)}" ${req}>${opts.map(o => `<option value="${esc(o)}" ${value === o ? "selected" : ""}>${esc(o || "—")}</option>`).join("")}</select>`;
    } else if (f.type === "yesno") {
      const opts = ["", isEn ? "Yes" : "Ναι", isEn ? "No" : "Όχι", isEn ? "Other" : "Άλλο"];
      control = `<select data-sp-field="${esc(f.key)}" ${req}>${opts.map(o => `<option value="${esc(o)}" ${value === o ? "selected" : ""}>${esc(o || "—")}</option>`).join("")}</select>`;
    } else if (f.type === "checkbox") {
      control = `<input type="checkbox" data-sp-field="${esc(f.key)}" ${value === "true" ? "checked" : ""} />`;
    } else {
      const inputType = f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "time" ? "time" : "text";
      control = `<input type="${inputType}" data-sp-field="${esc(f.key)}" value="${esc(value)}" placeholder="${ph}" ${req} />`;
    }
    return `<label>${labelText}${control}</label>`;
  }).join("");

  const editLabel = isEn ? "Edit fields" : "Επεξεργασία";
  const saveLabel = isEn ? "Save" : "Αποθήκευση";
  const panelTitle = isEn ? "CUSTOM FIELDS" : "ΕΠΙΠΛΕΟΝ ΣΤΟΙΧΕΙΑ";

  panel.innerHTML = `
    <div class="section-panel-head">
      <span class="section-panel-title">${panelTitle}</span>
      <button type="button" class="section-panel-edit-btn" onclick="setCsSectionAndSettings('${esc(sectionId)}')">${editLabel}</button>
    </div>
    <div class="section-panel-fields">${fieldsHtml}</div>
    <button type="button" class="section-panel-save" onclick="saveSectionPanelData('${esc(sectionId)}')">${saveLabel}</button>
  `;
}

function saveSectionPanelData(sectionId) {
  const panel = $(`sectionPanel_${sectionId}`);
  if (!panel) return;
  if (!sectionData[sectionId]) sectionData[sectionId] = {};
  panel.querySelectorAll("[data-sp-field]").forEach(el => {
    const key = el.dataset.spField;
    if (!key) return;
    sectionData[sectionId][key] = el.type === "checkbox" ? (el.checked ? "true" : "false") : (el.value || "");
  });
  localStorage.setItem(SECTION_DATA_KEY, JSON.stringify(sectionData));
  const btn = panel.querySelector(".section-panel-save");
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = window.__appLang === "en" ? "✓ Saved" : "✓ Αποθηκεύτηκε";
    setTimeout(() => { if (btn) btn.textContent = orig; }, 1500);
  }
}

function renderAllSectionPanels() {
  ["home", "inventory", "stats", "history"].forEach(s => renderSectionPanel(s));
}

// Override v36: γεμίζει φόρμα + δυναμικά πεδία
function openCeremonyModal(id = null) {
  editingId = id;
  const modal = $("ceremonyModal");
  if (!modal) return alert("Λείπει το ceremonyModal από το index.html");
  const titleEl = $("modalTitle");
  if (titleEl) titleEl.textContent = id
    ? t("Επεξεργασία τελετής", "Edit Case")
    : t("Νέα τελετή", "New Case");
  const c = id ? (ceremonies.find(x => x.id === id) || {}) : {};

  setVal("ceremonyDate", c.date || "");
  setVal("ceremonyTime", c.time || "");
  setVal("deceasedName", c.name || "");
  setVal("ceremonyPlace", c.place || "");
  setVal("burialType", c.burialType || "Ταφή");
  setVal("cremationEscortCount", Number(c.cremationEscortCount || 0));
  setVal("cremationParishNote", c.cremationParishNote || "");
  fillDynamicDropdowns(c);

  const selectCoffin = $("ceremonyCoffin");
  if (selectCoffin) {
    selectCoffin.innerHTML = "";
    const empty = document.createElement("option"); empty.value = ""; empty.textContent = "-"; selectCoffin.appendChild(empty);
    warehouse.forEach((item) => {
      const opt = document.createElement("option"); opt.value = item.name; opt.textContent = item.name;
      if (item.name === c.coffin) opt.selected = true;
      selectCoffin.appendChild(opt);
    });
  }
  setVal("ceremonySheet", c.sheet || "");
  const setSel = $("ceremonySet");
  if (setSel) {
    setSel.innerHTML = "";
    const empty = document.createElement("option"); empty.value = ""; empty.textContent = "-"; setSel.appendChild(empty);
    setsWarehouse.forEach((item) => {
      const opt = document.createElement("option"); opt.value = item.name; opt.textContent = item.name;
      if (normalizeSetName(item.name) === normalizeSetName(c.set)) opt.selected = true;
      setSel.appendChild(opt);
    });
  }

  setVal("ceremonyFlowers", c.flowers || "");
  setVal("ceremonyAnnouncementStatus", c.announcementStatus || "Δεν χρειάζεται");
  setVal("ceremonyDecorNote", c.decorNote || "");
  setVal("ceremonyCoffeePlace", c.coffeePlace || "");
  setVal("ceremonyPickup", c.pickup || "");
  setVal("pickupDate", c.pickupDate || "");
  setVal("ceremonyColdRoom", c.coldRoom || "");
  setVal("ceremonyGraveNumber", c.graveNumber || "");
  setVal("ceremonyNotes", c.notes || "");

  const familyRadio = $("graveTypeFamily");
  const triennialRadio = $("graveTypeTriennial");
  if (familyRadio && triennialRadio) {
    familyRadio.checked = (c.graveType || "") === "Οικογενειακός";
    triennialRadio.checked = (c.graveType || "Τριετία") !== "Οικογενειακός";
  }
  renderCustomFieldsForm(c);
  toggleCremationUI();
  modal.classList.remove("hidden");
}

// Override v36: σώζει και customValues
function saveCeremony(e) {
  e.preventDefault();
  const name = val("deceasedName").trim();
  const place = val("ceremonyPlace").trim();
  if (!name && !place) { alert("Θέλω τουλάχιστον ένα από: Όνομα θανόντα ή Τοποθεσία."); return; }
  const selectedGraveType = document.querySelector('input[name="graveType"]:checked')?.value || "Τριετία";
  const payload = {
    date: val("ceremonyDate") || "", time: val("ceremonyTime") || "", name, place,
    burialType: (val("burialType") || "Ταφή").trim(),
    cremationEscortCount: Number(val("cremationEscortCount") || 0) || 0,
    cremationParishNote: val("cremationParishNote").trim(),
    responsible: val("responsiblePerson") || "-", secondPerson: val("secondPerson") || "Κανένας",
    pickupSecondPerson: val("pickupSecondPerson") || "", suitcase: val("suitcase") || "-",
    coffin: val("ceremonyCoffin") || "", sheet: val("ceremonySheet").trim(), set: normalizeSetName(val("ceremonySet") || ""),
    flowers: val("ceremonyFlowers").trim(), announcementStatus: val("ceremonyAnnouncementStatus") || "Δεν χρειάζεται", decor: val("ceremonyDecor") || "", decorNote: val("ceremonyDecorNote").trim(),
    pallbearers: val("ceremonyPallbearers") || "", coffee: val("ceremonyCoffee") || "", coffeePlace: val("ceremonyCoffeePlace").trim(),
    pickup: val("ceremonyPickup").trim(), pickupDate: val("pickupDate") || "", coldRoom: val("ceremonyColdRoom").trim(),
    graveType: selectedGraveType, graveNumber: val("ceremonyGraveNumber").trim(), graveZone: val("ceremonyGraveZone") || "",
    notes: val("ceremonyNotes").trim(), customValues: collectCustomFieldValues()
  };
  if (payload.burialType === "Αποτεφρωση") { payload.graveType = ""; payload.graveNumber = ""; payload.graveZone = ""; }
  else { payload.cremationEscortCount = 0; payload.cremationParishNote = ""; if (payload.graveType === "Οικογενειακός") payload.graveZone = ""; else { payload.graveType = "Τριετία"; payload.graveNumber = ""; } }

  if (editingId) {
    const idx = ceremonies.findIndex(c => c.id === editingId);
    if (idx !== -1) {
      const old = ceremonies[idx];
      const updatedCeremony = { ...old, ...payload, case_id: old.case_id || ensureCeremonyCaseId(old) };
      ceremonies[idx] = updatedCeremony;
      emitOfficeEvent("ceremony_updated", updatedCeremony, { payload: { previous_date: old.date || "", previous_place: old.place || "" } });
      adjustCoffinStock(old.coffin || "", payload.coffin);
      adjustSetStock(old.set || "", payload.set);
      addChange("ceremony_edit", `${t("Επεξεργασία τελετής","Edit case")}: ${payload.name || "-"} (${payload.date || t("χωρίς ημ/νία","no date")} ${payload.time || ""})`);
    }
  } else {
    const id = nowTs().toString();
    const newCeremony = { id, case_id: createUniversalCaseId(payload.date, id), ...payload };
    ceremonies.push(newCeremony);
    emitOfficeEvent("ceremony_created", newCeremony);
    adjustCoffinStock("", payload.coffin);
    adjustSetStock("", payload.set);
    addChange("ceremony_add", `${t("Νέα τελετή","New case")}: ${payload.name || "-"} (${payload.date || t("χωρίς ημ/νία","no date")} ${payload.time || ""})`);
  }
  saveBackup("saveCeremonyV36");
  saveData();
  closeCeremonyModal();
  renderAll();
}

// Override v36: εμφανίζει custom fields στην κάρτα
function renderCeremonyCard(c, now) {
  const card = document.createElement("div");
  card.className = "ceremony-card";
  card.dataset.id = c.id;
  if (shouldHighlightGreen(c, now)) card.classList.add("green-frame");

  const header = document.createElement("div"); header.className = "ceremony-header";
  const nm = document.createElement("div"); nm.className = "ceremony-name"; nm.textContent = c.name || "-";
  const dt = document.createElement("div"); dt.className = "ceremony-date"; dt.textContent = (c.date ? formatDate(c.date) : "—") + (c.time ? ` • ${c.time}` : "");
  header.append(nm, dt);
  const place = document.createElement("div"); place.className = "ceremony-place"; place.textContent = c.place || "";
  const caseBadge = document.createElement("div"); caseBadge.className = "case-id-badge";
  caseBadge.textContent = c.case_id ? `Case: ${c.case_id}` : "";
  const cardAiWarning = document.createElement("div");
  const notePriority = aiNotePriority(c.notes || "");
  if (notePriority === "high") {
    const fullNote = String(c.notes || "").trim();
    const shortNote = fullNote.slice(0, 140);
    cardAiWarning.className = "ceremony-ai-warning";
    cardAiWarning.innerHTML = `🔴 ${t("ΚΡΙΣΙΜΗ ΣΗΜΕΙΩΣΗ","CRITICAL NOTE")}<span>${esc(shortNote)}${fullNote.length > 140 ? "…" : ""}</span>`;
  }
  const rows = document.createElement("div");
  const makeRow = (label, value) => { if (!value) return; const r = document.createElement("div"); r.className = "ceremony-row"; r.innerHTML = `<span class="ceremony-label">${esc(label)}:</span> ${esc(value)}`; rows.appendChild(r); };
  const btDisplay = bt => bt === "Αποτεφρωση" ? t("Αποτεφρωση","Cremation") : bt === "Μνημόσυνο" ? t("Μνημόσυνο","Memorial") : t("Ταφή","Burial");

  ensureCustomFields();

  if (window.__appLang === "en") {
    // EN/USA Edition — show only relevant fields
    makeRow("Disposition", btDisplay(c.burialType || "Ταφή"));
    if (c.pickupDate) makeRow("Date of death", formatDate(c.pickupDate));
    if (c.coldRoom) makeRow("Place of death", c.coldRoom);
    if (c.flowers) makeRow("Facility", c.flowers);
    if (c.pickup) makeRow("Caller / NOK", c.pickup);
    if (c.sheet) makeRow("Phone", c.sheet);
    if (c.decorNote) makeRow("Embalmer", c.decorNote);
    if (c.responsible && c.responsible !== "-") makeRow("Director", c.responsible);
    if ((c.burialType || "") === "Αποτεφρωση") {
      if (Number(c.cremationEscortCount)) makeRow("Cremation escorts", String(c.cremationEscortCount));
      if (c.cremationParishNote) makeRow("Chapel note", c.cremationParishNote);
    }
    customFields.filter(f => f.enabled !== false && f.showCard !== false && f.section === "ceremony").forEach(f => makeRow(f.label, customFieldValueDisplay(customFieldValue(c, f), f)));
    if (c.notes) makeRow("Notes", c.notes);
  } else {
    // GR Edition
    const gtDisplay = gt => gt === "Οικογενειακός" ? "Οικογενειακός" : gt === "Τριετία" ? "Τριετία" : (gt || "");
    if (c.responsible && c.responsible !== "-") makeRow("Υπεύθυνος", c.responsible);
    if (c.secondPerson && c.secondPerson !== "Κανένας" && c.secondPerson !== "None") makeRow("2ο άτομο", c.secondPerson);
    if (c.suitcase && c.suitcase !== "-") makeRow("Βαλίτσα", c.suitcase);
    makeRow("Τρόπος", btDisplay(c.burialType || "Ταφή"));
    if ((c.burialType || "Ταφή") === "Αποτεφρωση") { makeRow("Συνοδοί αίθουσας", String(Number(c.cremationEscortCount || 0))); makeRow("Ενορία πριν (σημ.)", c.cremationParishNote); }
    else { makeRow("Τάφος", gtDisplay(c.graveType)); if (c.graveType === "Οικογενειακός") makeRow("Αριθμός τάφου", c.graveNumber); if (c.graveType === "Τριετία") makeRow("Ζώνη", c.graveZone); }
    makeRow("Φέρετρο", c.coffin); makeRow("ΣΕΤ", c.set); makeRow("Στεφάνια / Λουλούδια", c.flowers); makeRow("Αγγελτήριο", c.announcementStatus);
    const decorLine = c.decor ? `${c.decor}${c.decorNote ? ` – ${c.decorNote}` : ""}` : ""; makeRow("Στολισμός", decorLine);
    makeRow("Φραγκοφόροι", c.pallbearers);
    if (c.coffee) makeRow("Καφές", `${c.coffee}${c.coffeePlace ? ` – ${c.coffeePlace}` : ""}`);
    makeRow("Παραλαβή", c.pickup); makeRow("2ο άτομο παραλαβής", c.pickupSecondPerson);
    if (c.pickupDate) makeRow("Ημερομηνία παραλαβής", formatDate(c.pickupDate));
    makeRow("Ψυκτικός θάλαμος", c.coldRoom);
    customFields.filter(f => f.enabled !== false && f.showCard !== false && f.section === "ceremony").forEach(f => makeRow(f.label, customFieldValueDisplay(customFieldValue(c, f), f)));
    makeRow("Σημειώσεις", c.notes);
  }

  const buttons = document.createElement("div"); buttons.className = "card-buttons";
  const editBtn = document.createElement("button"); editBtn.className = "edit"; editBtn.textContent = t("Επεξεργασία", "Edit"); editBtn.dataset.action = "edit";
  const waBtn = document.createElement("button"); waBtn.type = "button"; waBtn.dataset.action = "wa"; waBtn.title = "WhatsApp"; waBtn.style.cssText = "width:36px;height:36px;border-radius:999px;border:none;display:inline-flex;align-items:center;justify-content:center;background:#25d366;cursor:pointer;color:#fff;font-weight:900;"; waBtn.textContent = "WA";
  const shareBtn = document.createElement("button"); shareBtn.type = "button"; shareBtn.textContent = "Share"; shareBtn.dataset.action = "share"; shareBtn.style.cssText = "border-radius:999px;border:none;padding:6px 14px;font-size:13px;cursor:pointer;background:#e5e7eb;";
  const delBtn = document.createElement("button"); delBtn.className = "delete"; delBtn.textContent = t("Διαγραφή", "Delete"); delBtn.dataset.action = "delete";
  buttons.append(editBtn, waBtn, shareBtn, delBtn);
  if (cardAiWarning.className) card.append(header, place, caseBadge, cardAiWarning, rows, buttons); else card.append(header, place, caseBadge, rows, buttons);
  return card;
}

// Override v36: WhatsApp/Share με custom fields
function buildWhatsAppMessage(c) {
  const lines = [];
  const btDisplay = bt => bt === "Αποτεφρωση" ? t("Αποτεφρωση","Cremation") : bt === "Μνημόσυνο" ? t("Μνημόσυνο","Memorial") : t("Ταφή","Burial");
  const gtDisplay = gt => gt === "Οικογενειακός" ? t("Οικογενειακός","Family plot") : gt === "Τριετία" ? t("Τριετία","3-year plot") : (gt || "");
  lines.push(t("🪦 Τελετή — ΣΤΑΥΡΑΚΑΚΗ","🪦 Ceremony — STAURAKAKIS"));
  if (c.date || c.time) { const dline = c.date ? formatDate(c.date) : "—"; lines.push(`${t("Ημερομηνία","Date")}: ${dline}${c.time ? ` • ${c.time}` : ""}`); }
  if (c.name) lines.push(`${t("Όνομα θανόντα","Deceased")}: ${c.name}`);
  if (c.place) lines.push(`${t("Τοποθεσία","Location")}: ${c.place}`);
  const method = (c.burialType || "Ταφή").trim(); lines.push(`${t("Τρόπος","Type")}: ${btDisplay(method)}`);
  if (method === "Αποτεφρωση") { lines.push(`${t("Συνοδοί αίθουσας","Cremation escorts")}: ${Number(c.cremationEscortCount || 0)}`); if (c.cremationParishNote) lines.push(`${t("Ενορία πριν (σημ.)","Parish before (note)")}: ${c.cremationParishNote}`); }
  else { if (c.graveType) lines.push(`${t("Τάφος","Grave")}: ${gtDisplay(c.graveType)}`); if (c.graveType === "Οικογενειακός" && c.graveNumber) lines.push(`${t("Αριθμός τάφου","Grave number")}: ${c.graveNumber}`); if (c.graveType === "Τριετία" && c.graveZone) lines.push(`${t("Ζώνη","Zone")}: ${c.graveZone}`); }
  if (c.responsible && c.responsible !== "-") lines.push(`${t("Υπεύθυνος τελετής","Coordinator")}: ${c.responsible}`);
  if (c.secondPerson && c.secondPerson !== "Κανένας" && c.secondPerson !== "None") lines.push(`${t("2ο άτομο","2nd person")}: ${c.secondPerson}`);
  if (c.suitcase && c.suitcase !== "-") lines.push(`${t("Βαλίτσα","Suitcase")}: ${c.suitcase}`);
  if (c.coffin) lines.push(`${t("Φέρετρο","Coffin")}: ${c.coffin}`); if (c.set) lines.push(`${t("ΣΕΤ","SET")}: ${c.set}`); if (c.flowers) lines.push(`${t("Στεφάνια/Λουλούδια","Wreaths/Flowers")}: ${c.flowers}`); if (c.announcementStatus) lines.push(`${t("Αγγελτήριο","Announcement")}: ${c.announcementStatus}`);
  const decorLine = c.decor ? `${c.decor}${c.decorNote ? ` – ${c.decorNote}` : ""}` : ""; if (decorLine) lines.push(`${t("Στολισμός","Decoration")}: ${decorLine}`);
  if (c.pallbearers) lines.push(`${t("Φραγκοφόροι","Pallbearers")}: ${c.pallbearers}`); if (c.coffee) lines.push(`${t("Καφές","Wake/Reception")}: ${c.coffee}${c.coffeePlace ? ` – ${c.coffeePlace}` : ""}`);
  if (c.pickup) lines.push(`${t("Παραλαβή","Pickup")}: ${c.pickup}`); if (c.pickupSecondPerson) lines.push(`${t("2ο άτομο παραλαβής","2nd pickup person")}: ${c.pickupSecondPerson}`); if (c.pickupDate) lines.push(`${t("Ημερομηνία παραλαβής","Pickup date")}: ${formatDate(c.pickupDate)}`); if (c.coldRoom) lines.push(`${t("Ψυκτικός θάλαμος","Cold room")}: ${c.coldRoom}`);
  ensureCustomFields();
  customFields.filter(f => f.enabled !== false && f.showShare !== false).forEach(f => { const v = customFieldValueDisplay(customFieldValue(c, f), f); if (v) lines.push(`${f.label}: ${v}`); });
  if (c.notes) lines.push(`${t("Σημειώσεις","Notes")}: ${c.notes}`);
  return lines.join("\n");
}

// Override v36: ιστορικό ψάχνει και στα custom fields
function renderHistory() {
  ensureHistorySearchUI();
  const container = $("historyList"); if (!container) return; container.innerHTML = "";
  if (!ceremonies.length) { container.innerHTML = `<p style="font-size:13px;color:#6b7280;">${t("Δεν υπάρχουν καταχωρημένες τελετές.","No ceremonies registered.")}</p>`; return; }
  ensureCustomFields();
  const q = (historyQuery || "").trim().toLowerCase();
  const filtered = ceremonies.filter((c) => {
    if (!q) return true;
    const customBlob = customFields.map(f => customFieldValue(c, f)).filter(Boolean).join(" ");
    const blob = [c.case_id, c.name, c.place, c.burialType, c.responsible, c.secondPerson, c.pickupSecondPerson, c.suitcase, c.coffin, c.set, c.flowers, c.announcementStatus, c.decor, c.decorNote, c.pallbearers, c.coffee, c.coffeePlace, c.pickup, c.pickupDate, c.coldRoom, c.graveType, c.graveNumber, c.graveZone, c.notes, c.date, c.time, c.cremationEscortCount, c.cremationParishNote, customBlob].filter(Boolean).join(" ").toLowerCase();
    return blob.includes(q);
  });
  const sorted = [...filtered].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.time || "").localeCompare(a.time || ""));
  if (!sorted.length) { container.innerHTML = `<p style="font-size:13px;color:#6b7280;">${t("Δεν βρέθηκαν αποτελέσματα.","No results found.")}</p>`; return; }
  for (const c of sorted) {
    const card = document.createElement("div"); card.className = "ceremony-card history-card-clickable"; card.dataset.id = c.id; card.title = t("Πάτησε για να ανοίξει η καρτέλα","Click to open ceremony");
    const header = document.createElement("div"); header.className = "ceremony-header";
    const name = document.createElement("div"); name.className = "ceremony-name"; name.textContent = c.name || "-";
    const date = document.createElement("div"); date.className = "ceremony-date"; date.textContent = (c.date ? formatDate(c.date) : "—") + (c.time ? ` • ${c.time}` : "");
    header.append(name, date);
    const place = document.createElement("div"); place.className = "ceremony-place"; place.textContent = c.place || "";
    const caseBadge = document.createElement("div");
    caseBadge.className = "case-id-badge";
    caseBadge.textContent = c.case_id ? `${t("Υπόθεση","Case")}: ${c.case_id}` : "";
    const mini = document.createElement("div"); mini.className = "history-mini"; mini.textContent = [c.pickup ? `${t("Παραλαβή","Pickup")}: ${c.pickup}` : "", c.coffin ? `${t("Φέρετρο","Coffin")}: ${c.coffin}` : "", c.set ? `${t("ΣΕΤ","SET")}: ${c.set}` : ""].filter(Boolean).join(" · ");
    card.append(header, place, caseBadge, mini); card.addEventListener("click", () => openCeremonyModal(c.id)); container.appendChild(card);
  }
}


// =========================================================
// V38 PREMIUM — Universal Search / Spotlight
// Προσθετικό: δεν πειράζει τη Βίβλο, μόνο προσθέτει αναζήτηση.
// =========================================================
function v38Norm(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ")
    .replace(/Σ/g, "Σ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("el-GR");
}

function v38SwitchTab(tabName) {
  const btn = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
  if (btn) { btn.click(); return; }
  document.querySelectorAll(".tab-button").forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  const map = { ceremonies:"ceremoniesTab", warehouse:"warehouseTab", stats:"statsTab", history:"historyTab", settings:"settingsTab", hermes:"hermesTab" };
  if (map[tabName]) $(map[tabName])?.classList.add("active");
}

function v38SearchBlob(parts) {
  return v38Norm((parts || []).filter(Boolean).join(" "));
}

function v38BuildSearchItems() {
  const items = [];
  (ceremonies || []).forEach(c => {
    items.push({
      type:"Τελετή",
      title:c.name || "Χωρίς όνομα",
      meta:[c.date ? formatDate(c.date) : "Χωρίς ημερομηνία", c.time || "", c.place || "", c.responsible ? `Υπ.: ${c.responsible}` : "", c.pickup ? `Παραλαβή: ${c.pickup}` : ""].filter(Boolean).join(" · "),
      blob:v38SearchBlob([c.name,c.date,c.time,c.place,c.burialType,c.responsible,c.secondPerson,c.pickupSecondPerson,c.suitcase,c.coffin,c.set,c.flowers,c.decor,c.decorNote,c.pallbearers,c.coffee,c.coffeePlace,c.pickup,c.pickupDate,c.coldRoom,c.graveType,c.graveNumber,c.graveZone,c.notes, ...(customFields || []).map(f => c.customValues?.[f.key])]),
      action:() => { v38CloseSearch(); v38SwitchTab("ceremonies"); openCeremonyModal(c.id); }
    });
  });
  (warehouse || []).forEach(w => items.push({
    type:"Φέρετρο", title:w.name || "Φέρετρο", meta:`Απόθεμα: ${Number(w.qty || 0)}`, blob:v38SearchBlob([w.name,w.qty,"φέρετρο αποθήκη"]), action:()=>{ v38CloseSearch(); v38SwitchTab("warehouse"); }
  }));
  (setsWarehouse || []).forEach(s => items.push({
    type:"ΣΕΤ", title:s.name || "ΣΕΤ", meta:`Απόθεμα: ${Number(s.qty || 0)}`, blob:v38SearchBlob([s.name,s.qty,"σετ αποθήκη"]), action:()=>{ v38CloseSearch(); v38SwitchTab("warehouse"); }
  }));
  (customFields || []).forEach(f => items.push({
    type:"Ρύθμιση", title:f.label || "Πεδίο", meta:`Τύπος: ${customFieldTypeLabel ? customFieldTypeLabel(f.type) : (f.type || "")}`, blob:v38SearchBlob([f.label,f.type,f.placeholder,(f.options || []).join(" "),"ρυθμίσεις πεδίο"]), action:()=>{ v38CloseSearch(); v38SwitchTab("settings"); }
  }));
  (changeLog || []).slice(-80).forEach(ch => items.push({
    type:"Update", title:ch.summary || "Αλλαγή", meta:[formatTimestamp(ch.ts), ch.device || ""].filter(Boolean).join(" · "), blob:v38SearchBlob([ch.summary,ch.device,ch.action,formatTimestamp(ch.ts),"updates αλλαγές"]), action:()=>{ v38CloseSearch(); openUpdatesModal(); }
  }));
  items.push(
    {type:"Ενέργεια", title:"Νέα τελετή", meta:"Άνοιγμα φόρμας νέας τελετής", blob:v38SearchBlob(["νέα τελετή προσθήκη καταχώρηση"]), action:()=>{ v38CloseSearch(); v38SwitchTab("ceremonies"); openCeremonyModal(null); }},
    {type:"Ενέργεια", title:"AI Βοηθός", meta:"Briefing, σημειώσεις, ελλείψεις, αποθήκη", blob:v38SearchBlob(["ai βοηθός briefing σημειώσεις ελλείψεις αποθήκη"]), action:()=>{ v38CloseSearch(); openAIAssistant(); }},
    {type:"Ενέργεια", title:"Στατιστικά", meta:"Άνοιγμα στατιστικών", blob:v38SearchBlob(["στατιστικά μήνας φέρετρα στολισμός"]), action:()=>{ v38CloseSearch(); v38SwitchTab("stats"); }},
    {type:"Ενέργεια", title:"Ιστορικό", meta:"Άνοιγμα ιστορικού τελετών", blob:v38SearchBlob(["ιστορικό αναζήτηση παλιές τελετές"]), action:()=>{ v38CloseSearch(); v38SwitchTab("history"); }},
    {type:"Ενέργεια", title:"Ρυθμίσεις", meta:"Πεδία καρτέλας τελετής", blob:v38SearchBlob(["ρυθμίσεις πεδία καρτέλας"]), action:()=>{ v38CloseSearch(); v38SwitchTab("settings"); }}
  );
  return items;
}

function v38Search(query) {
  const q = v38Norm(query);
  const words = q.split(/\s+/).filter(Boolean);
  let items = v38BuildSearchItems();
  if (!words.length) return items.slice(0, 12);
  return items
    .map(item => {
      let score = 0;
      const title = v38Norm(item.title);
      for (const w of words) {
        if (title.includes(w)) score += 7;
        if (item.blob.includes(w)) score += 3;
      }
      if (title.startsWith(q)) score += 10;
      return { item, score };
    })
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score || String(a.item.title).localeCompare(String(b.item.title), "el"))
    .slice(0, 40)
    .map(x => x.item);
}

function v38RenderSearchResults() {
  const input = $("v38SearchInput");
  const box = $("v38SearchResults");
  if (!input || !box) return;
  const results = v38Search(input.value || "");
  if (!results.length) {
    box.innerHTML = `<div class="v38-search-empty">Δεν βρέθηκε κάτι. Δοκίμασε όνομα, ναό, φέρετρο, παραλαβή, υπεύθυνο ή “AI”.</div>`;
    return;
  }
  box.innerHTML = results.map((r, i) => `
    <button type="button" class="v38-result${i === 0 ? " active" : ""}" data-v38-result="${i}">
      <div class="v38-result-title"><span class="v38-result-type">${esc(r.type)}</span>${esc(r.title)}</div>
      <div class="v38-result-meta">${esc(r.meta || "")}</div>
    </button>
  `).join("");
  box.querySelectorAll("[data-v38-result]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.v38Result);
      const r = results[idx];
      if (r?.action) r.action();
    });
  });
}

function v38OpenSearch() {
  ensureUniversalSearchUI();
  const overlay = $("v38Spotlight");
  const input = $("v38SearchInput");
  if (!overlay || !input) return;
  overlay.classList.remove("hidden");
  input.value = "";
  v38RenderSearchResults();
  setTimeout(() => input.focus(), 30);
}

function v38CloseSearch() {
  $("v38Spotlight")?.classList.add("hidden");
}

function ensureUniversalSearchUI() {
  if (!$("v38SearchTrigger")) {
    const btn = document.createElement("button");
    btn.id = "v38SearchTrigger";
    btn.type = "button";
    btn.className = "v38-search-trigger";
    btn.innerHTML = `🔎 Αναζήτηση <kbd>⌘K</kbd>`;
    btn.onclick = v38OpenSearch;
    const topBar = document.querySelector(".top-bar");
    topBar?.appendChild(btn);
  }
  if (!$("v38Spotlight")) {
    const overlay = document.createElement("div");
    overlay.id = "v38Spotlight";
    overlay.className = "v38-spotlight hidden";
    overlay.innerHTML = `
      <div class="v38-spotlight-panel" role="dialog" aria-label="Universal Search">
        <div class="v38-search-head">
          <div class="v38-search-icon">🔎</div>
          <input id="v38SearchInput" class="v38-search-input" type="search" autocomplete="off" placeholder="Ψάξε τελετή, ναό, φέρετρο, παραλαβή, υπεύθυνο, ρύθμιση…" />
          <button type="button" id="v38SearchClose" class="v38-search-close" aria-label="Κλείσιμο">×</button>
        </div>
        <div id="v38SearchResults" class="v38-search-results"></div>
      </div>`;
    document.body.appendChild(overlay);
    $("v38SearchClose")?.addEventListener("click", v38CloseSearch);
    $("v38SearchInput")?.addEventListener("input", v38RenderSearchResults);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) v38CloseSearch(); });
  }
}

document.addEventListener("keydown", (e) => {
  const key = String(e.key || "").toLowerCase();
  if ((e.metaKey || e.ctrlKey) && key === "k") { e.preventDefault(); v38OpenSearch(); }
  if (key === "escape") v38CloseSearch();
  if (key === "enter" && !$("v38Spotlight")?.classList.contains("hidden") && document.activeElement?.id === "v38SearchInput") {
    const first = document.querySelector(".v38-result.active");
    if (first) { e.preventDefault(); first.click(); }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  ensureUniversalSearchUI();
  setTimeout(v38RenderSearchResults, 200);
});

// V38: κρατάει πραγματικό ιστορικό ερωτήσεων AI χωρίς να αλλάζει το UI.
const v38OriginalAiAskQuestion = typeof aiAskQuestion === "function" ? aiAskQuestion : null;
if (v38OriginalAiAskQuestion) {
  aiAskQuestion = async function() {
    const input = $("aiQuestionInput");
    const beforeQuestion = String(input?.value || "").trim();
    await v38OriginalAiAskQuestion();
    if (beforeQuestion && aiLastReportText) {
      const answer = String(aiLastReportText || "").replace(/^Ερώτηση:.*?\n\n/s, "").trim();
      aiSaveChat(beforeQuestion, answer, aiLastMode === "cloud" ? "Cloud AI" : "AI");
    }
  };
}

/* V39.1 Office Knowledge Engine */
const OFFICE_KNOWLEDGE_KEY="officeKnowledgeV1";

function getOfficeKnowledge(){
 return JSON.parse(localStorage.getItem(OFFICE_KNOWLEDGE_KEY)||'{"rules":[],"probabilities":[],"suggestions":[]}');
}

function saveOfficeKnowledge(data){
 localStorage.setItem(OFFICE_KNOWLEDGE_KEY,JSON.stringify(data));
}

function seedOfficeKnowledge(){
 const db=getOfficeKnowledge();
 if(db.rules.length) return;
 db.rules=[
  {name:'ΦΛΩΡΙΝΑ',target:3},
  {name:'ΓΚΡΙ ΣΕΤ',target:5}
 ];
 saveOfficeKnowledge(db);
}

document.addEventListener('DOMContentLoaded',seedOfficeKnowledge);



/* =========================================================
   V39.2 — Hermes Smart Suggestions
   Προσθετικό layer: διαβάζει υπάρχουσες τελετές και προτείνει πιθανότητες.
   Δεν αλλάζει δεδομένα μόνο του.
   ========================================================= */
(function(){
  const STYLE_ID = "v392-smart-suggestions-style";

  function v392AllCeremonies(){
    try{
      if (Array.isArray(window.ceremonies)) return window.ceremonies;
      const keys = ["ceremonies","staurakakiCeremonies","funeralCeremonies"];
      for (const k of keys){
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }catch(e){}
    return [];
  }

  function v392Text(v){
    return String(v || "").trim();
  }

  function v392Field(c, names){
    for (const n of names){
      if (c && c[n] !== undefined && c[n] !== null && String(c[n]).trim() !== "") return String(c[n]).trim();
    }
    return "";
  }

  function v392CurrentCandidate(){
    const rows = v392AllCeremonies();
    const today = new Date();
    today.setHours(0,0,0,0);

    const upcoming = rows
      .map(c => ({ c, d: new Date(v392Field(c, ["date","ceremonyDate","ceremony_date"]) || c.date || 0) }))
      .filter(x => !isNaN(x.d.getTime()))
      .sort((a,b)=>a.d-b.d);

    return (upcoming.find(x => x.d >= today)?.c) || rows[0] || null;
  }

  function v392BuildProbability(rows, target){
    const map = {};
    rows.forEach(c=>{
      const place = v392Field(c, ["place","ceremonyPlace","location","ceremony_location"]);
      const value = v392Field(c, target.names);
      if (!place || !value || value === "-") return;
      const key = place.toLowerCase();
      if (!map[key]) map[key] = { place, total:0, values:{} };
      map[key].total++;
      map[key].values[value] = (map[key].values[value] || 0) + 1;
    });

    return Object.values(map)
      .filter(x => x.total >= 2)
      .map(x => {
        const best = Object.entries(x.values).sort((a,b)=>b[1]-a[1])[0];
        return {
          place: x.place,
          label: target.label,
          value: best[0],
          count: best[1],
          total: x.total,
          pct: Math.round((best[1] / x.total) * 100)
        };
      })
      .filter(x => x.pct >= 60)
      .sort((a,b)=>b.pct-a.pct || b.total-a.total)
      .slice(0, 6);
  }

  function v392Suggestions(){
    const rows = v392AllCeremonies();
    const targets = [
      { label:"Στολισμός", names:["decor","ceremonyDecor","decoration"] },
      { label:"Φραγκοφόροι", names:["pallbearers","ceremonyPallbearers"] },
      { label:"Καφές", names:["coffee","ceremonyCoffee"] },
      { label:"ΣΕΤ", names:["set","ceremonySet"] }
    ];

    let all = [];
    targets.forEach(t => all = all.concat(v392BuildProbability(rows, t)));
    return all.sort((a,b)=>b.pct-a.pct || b.total-a.total).slice(0, 8);
  }

  function v392EnsureBox(){
    const hermesPanel = document.querySelector(".hermes-panel");
    if (!hermesPanel) return null;

    let box = document.getElementById("hermesSmartSuggestionsBox");
    if (box) return box;

    box = document.createElement("div");
    box.className = "hermes-section smart-suggestions-center";
    box.id = "hermesSmartSuggestionsBox";
    box.innerHTML = `
      <h3>🧠 Smart Suggestions</h3>
      <p class="hermes-section-hint">Πιθανότητες από τις παλιές τελετές. Δεν εφαρμόζει τίποτα μόνο του.</p>
      <div id="hermesSmartSuggestionsList" class="hermes-list"></div>
    `;

    const completion = document.querySelector(".completion-center");
    if (completion && completion.parentNode) completion.parentNode.insertBefore(box, completion.nextSibling);
    else hermesPanel.appendChild(box);

    return box;
  }

  function v392Render(){
    const box = v392EnsureBox();
    if (!box) return;

    const list = document.getElementById("hermesSmartSuggestionsList");
    if (!list) return;

    const suggestions = v392Suggestions();

    if (!suggestions.length){
      list.innerHTML = `<div class="hermes-item empty"><strong>Δεν υπάρχουν ακόμα αρκετά μοτίβα.</strong>Ο Hermes χρειάζεται τουλάχιστον 2 παρόμοιες τελετές ανά τοποθεσία για να εμφανίσει πιθανότητες.</div>`;
      return;
    }

    list.innerHTML = suggestions.map(s => `
      <div class="hermes-item smart-suggestion">
        <div class="smart-suggestion-top">
          <strong>${s.place}</strong>
          <span>${s.pct}%</span>
        </div>
        <p>${s.label} ➜ <b>${s.value}</b></p>
        <small>Βάση: ${s.count}/${s.total} τελετές · Πρόταση, όχι κανόνας</small>
      </div>
    `).join("");
  }

  function v392AddStyles(){
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = `
      .smart-suggestions-center{border-color:rgba(99,102,241,.22);}
      .hermes-item.smart-suggestion{background:rgba(238,242,255,.72);border-color:rgba(99,102,241,.22);}
      .smart-suggestion-top{display:flex;align-items:center;justify-content:space-between;gap:10px;}
      .smart-suggestion-top span{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:#111827;color:#fff;padding:6px 9px;font-weight:950;font-size:12px;}
      .hermes-item.smart-suggestion p{margin:6px 0 0;color:#111827;}
      .hermes-item.smart-suggestion small{display:block;margin-top:6px;color:#6b7280;font-weight:700;}
    `;
    document.head.appendChild(st);
  }

  function v392Init(){
    v392AddStyles();
    v392Render();
    document.addEventListener("click", function(e){
      if (e.target && e.target.closest && e.target.closest('[data-tab="hermes"]')) {
        setTimeout(v392Render, 80);
      }
    });
    setTimeout(v392Render, 300);
    setTimeout(v392Render, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", v392Init);
  else v392Init();
})();



/* =========================================================
   V39.3 — Hermes Smart Inventory Orders
   Διαβάζει αποθήκη + στόχους Office Knowledge και προτείνει παραγγελίες.
   Δεν στέλνει τίποτα μόνο του.
   ========================================================= */
(function(){
  function h392Parse(key){
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch(e){ return null; }
  }

  function h393WarehouseItems(){
    const candidates = [
      "warehouse",
      "coffins",
      "warehouseItems",
      "staurakakiWarehouse",
      "staurakaki_coffins"
    ];

    let arr = [];
    for (const key of candidates){
      const v = h392Parse(key);
      if (Array.isArray(v) && v.length) {
        arr = v;
        break;
      }
    }

    if (!arr.length && Array.isArray(window.warehouse)) arr = window.warehouse;
    if (!arr.length && Array.isArray(window.coffins)) arr = window.coffins;

    return (arr || []).map(x => ({
      name: String(x.name || x.title || x.coffin || x.label || "").trim(),
      qty: Number(x.qty ?? x.quantity ?? x.count ?? x.stock ?? 0)
    })).filter(x => x.name);
  }

  function h393OfficeKnowledge(){
    try{
      return JSON.parse(localStorage.getItem("officeKnowledgeV1") || '{"rules":[],"probabilities":[],"suggestions":[]}');
    }catch(e){
      return {rules:[],probabilities:[],suggestions:[]};
    }
  }

  function h393SeedTargets(){
    const db = h393OfficeKnowledge();
    if (!Array.isArray(db.rules)) db.rules = [];

    const defaults = [
      {name:"ΦΛΩΡΙΝΑ", target:3},
      {name:"ΚΩΣΤΑΚΗ", target:2},
      {name:"ΓΚΡΙ ΣΕΤ", target:5},
      {name:"ΛΕΥΚΟ ΣΕΤ", target:5}
    ];

    defaults.forEach(d => {
      const exists = db.rules.some(r => String(r.name || "").toUpperCase() === d.name);
      if (!exists) db.rules.push(d);
    });

    localStorage.setItem("officeKnowledgeV1", JSON.stringify(db));
  }

  function h393FindTarget(itemName, rules){
    const upper = String(itemName || "").toUpperCase();
    const exact = rules.find(r => String(r.name || "").toUpperCase() === upper);
    if (exact) return Number(exact.target || 0);

    const partial = rules.find(r => {
      const rn = String(r.name || "").toUpperCase();
      return rn && (upper.includes(rn) || rn.includes(upper));
    });

    return partial ? Number(partial.target || 0) : 0;
  }

  function h393Suggestions(){
    h393SeedTargets();

    const items = h393WarehouseItems();
    const db = h393OfficeKnowledge();
    const rules = Array.isArray(db.rules) ? db.rules : [];

    return items.map(item => {
      const target = h393FindTarget(item.name, rules);
      if (!target || item.qty >= target) return null;
      return {
        name:item.name,
        qty:item.qty,
        target,
        need:target - item.qty
      };
    }).filter(Boolean).sort((a,b)=>b.need-a.need || a.qty-b.qty);
  }

  function h393Message(s){
    return `Καλημέρα, θα ήθελα παρακαλώ ${s.need} τεμ. ${s.name}. Ευχαριστώ.`;
  }

  function h393EnsureBox(){
    const panel = document.querySelector(".hermes-panel");
    if (!panel) return null;

    let box = document.getElementById("hermesSmartOrdersBox");
    if (box) return box;

    box = document.createElement("div");
    box.className = "hermes-section smart-orders-center";
    box.id = "hermesSmartOrdersBox";
    box.innerHTML = `
      <h3>📦 Smart Orders</h3>
      <p class="hermes-section-hint">Προτάσεις αγοράς από αποθήκη και κλειδωμένους στόχους. Δεν στέλνει τίποτα μόνο του.</p>
      <div id="hermesSmartOrdersList" class="hermes-list"></div>
    `;

    const after = document.getElementById("hermesSmartSuggestionsBox") || document.querySelector(".smart-suggestions-center") || document.querySelector(".completion-center");
    if (after && after.parentNode) after.parentNode.insertBefore(box, after.nextSibling);
    else panel.appendChild(box);

    return box;
  }

  function h393Render(){
    const box = h393EnsureBox();
    if (!box) return;

    const list = document.getElementById("hermesSmartOrdersList");
    if (!list) return;

    const suggestions = h393Suggestions();

    if (!suggestions.length){
      list.innerHTML = `<div class="hermes-item empty"><strong>Η αποθήκη φαίνεται εντάξει.</strong>Δεν υπάρχει προτεινόμενη αγορά με βάση τους τρέχοντες στόχους.</div>`;
      return;
    }

    list.innerHTML = suggestions.map((s,i)=>`
      <div class="hermes-item smart-order">
        <div class="smart-order-top">
          <strong>${s.name}</strong>
          <span>+${s.need}</span>
        </div>
        <p>Τρέχον: <b>${s.qty}</b> · Στόχος: <b>${s.target}</b></p>
        <textarea readonly id="smartOrderMsg${i}">${h393Message(s)}</textarea>
        <div class="smart-order-actions">
          <button type="button" data-smart-order-copy="${i}">Αντιγραφή μηνύματος</button>
        </div>
      </div>
    `).join("");
  }

  function h393Styles(){
    if (document.getElementById("v393-smart-orders-style")) return;
    const st = document.createElement("style");
    st.id = "v393-smart-orders-style";
    st.textContent = `
      .smart-orders-center{border-color:rgba(245,158,11,.28);}
      .hermes-item.smart-order{background:rgba(255,251,235,.82);border-color:rgba(245,158,11,.28);}
      .smart-order-top{display:flex;justify-content:space-between;align-items:center;gap:10px;}
      .smart-order-top span{border-radius:999px;background:#111827;color:#fff;padding:6px 10px;font-weight:950;}
      .smart-order textarea{width:100%;min-height:58px;margin-top:8px;border-radius:14px;border:1px solid rgba(17,24,39,.12);padding:9px;background:rgba(255,255,255,.7);font-size:13px;resize:vertical;}
      .smart-order-actions{display:flex;justify-content:flex-end;margin-top:8px;}
      .smart-order-actions button{border:none;border-radius:999px;background:#111827;color:#fff;padding:8px 12px;font-weight:850;cursor:pointer;}
    `;
    document.head.appendChild(st);
  }

  function h393Init(){
    h393Styles();
    h393Render();

    document.addEventListener("click", function(e){
      const btn = e.target && e.target.closest && e.target.closest("[data-smart-order-copy]");
      if (btn){
        const id = btn.getAttribute("data-smart-order-copy");
        const ta = document.getElementById("smartOrderMsg"+id);
        if (ta){
          navigator.clipboard?.writeText(ta.value);
          btn.textContent = "Αντιγράφηκε";
          setTimeout(()=>btn.textContent="Αντιγραφή μηνύματος",1200);
        }
      }

      if (e.target && e.target.closest && e.target.closest('[data-tab="hermes"]')) {
        setTimeout(h393Render, 80);
      }
    });

    setTimeout(h393Render, 300);
    setTimeout(h393Render, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", h393Init);
  else h393Init();
})();



/* =========================================================
   V39.4 — Hermes History Access Layer
   Ο Hermes βλέπει τις τελευταίες 300 τελετές, βγάζει σχέσεις/πιθανότητες
   και ΔΕΝ αλλάζει κλειδωμένους κανόνες μόνος του.
   ========================================================= */
(function(){
  const HISTORY_LIMIT = 300;

  function h394Parse(key){
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch(e){ return null; }
  }

  function h394AllCeremonies(){
    try{
      if (Array.isArray(window.ceremonies) && window.ceremonies.length) return window.ceremonies;

      const keys = [
        "ceremonies",
        "staurakakiCeremonies",
        "funeralCeremonies",
        "ceremoniesData",
        "teletes"
      ];

      for (const k of keys){
        const v = h394Parse(k);
        if (Array.isArray(v) && v.length) return v;
      }
    }catch(e){}
    return [];
  }

  function h394DateValue(c){
    const raw = c.date || c.ceremonyDate || c.ceremony_date || c.createdAt || c.created_at || "";
    const d = new Date(raw);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function h394Last300(){
    return h394AllCeremonies()
      .slice()
      .sort((a,b)=>h394DateValue(b)-h394DateValue(a))
      .slice(0, HISTORY_LIMIT);
  }

  function h394Field(c, names){
    for (const n of names){
      const v = c && c[n];
      if (v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "-"){
        return String(v).trim();
      }
    }
    return "";
  }

  function h394Relations(){
    const rows = h394Last300();

    const targets = [
      { title:"Τοποθεσία ➜ Στολισμός", from:["place","ceremonyPlace","location","ceremony_location"], to:["decor","ceremonyDecor","decoration"] },
      { title:"Τοποθεσία ➜ Φραγκοφόροι", from:["place","ceremonyPlace","location","ceremony_location"], to:["pallbearers","ceremonyPallbearers"] },
      { title:"Τοποθεσία ➜ Καφές", from:["place","ceremonyPlace","location","ceremony_location"], to:["coffee","ceremonyCoffee"] },
      { title:"Τοποθεσία ➜ ΣΕΤ", from:["place","ceremonyPlace","location","ceremony_location"], to:["set","ceremonySet"] },
      { title:"Τρόπος ➜ Αγγελτήριο", from:["burialType","type","ceremonyType"], to:["announcementStatus","announcement","aggeltirio"] }
    ];

    const result = [];

    targets.forEach(t=>{
      const buckets = {};
      rows.forEach(c=>{
        const from = h394Field(c, t.from);
        const to = h394Field(c, t.to);
        if (!from || !to) return;

        const key = from.toLowerCase();
        if (!buckets[key]) buckets[key] = { from, total:0, values:{} };
        buckets[key].total++;
        buckets[key].values[to] = (buckets[key].values[to] || 0) + 1;
      });

      Object.values(buckets).forEach(b=>{
        if (b.total < 3) return;
        const best = Object.entries(b.values).sort((a,b)=>b[1]-a[1])[0];
        const pct = Math.round((best[1] / b.total) * 100);
        if (pct < 60) return;

        result.push({
          title:t.title,
          from:b.from,
          to:best[0],
          pct,
          count:best[1],
          total:b.total
        });
      });
    });

    return result.sort((a,b)=>b.pct-a.pct || b.total-a.total).slice(0, 12);
  }

  function h394Knowledge(){
    try{
      return JSON.parse(localStorage.getItem("officeKnowledgeV1") || '{"rules":[],"probabilities":[],"suggestions":[]}');
    }catch(e){
      return {rules:[],probabilities:[],suggestions:[]};
    }
  }

  function h394SaveKnowledge(db){
    localStorage.setItem("officeKnowledgeV1", JSON.stringify(db));
  }

  function h394IsLocked(rel){
    const db = h394Knowledge();
    const rules = Array.isArray(db.rules) ? db.rules : [];
    const key = `${rel.title}|${rel.from}|${rel.to}`.toLowerCase();

    return rules.some(r=>{
      const rk = String(r.key || r.name || "").toLowerCase();
      return rk === key;
    });
  }

  function h394Lock(rel){
    const db = h394Knowledge();
    if (!Array.isArray(db.rules)) db.rules = [];

    const key = `${rel.title}|${rel.from}|${rel.to}`;
    const exists = db.rules.some(r => String(r.key || "") === key);
    if (!exists){
      db.rules.push({
        key,
        name:`${rel.from} ➜ ${rel.to}`,
        type:"relationship",
        relation:rel.title,
        from:rel.from,
        to:rel.to,
        confidence:rel.pct,
        sample:`${rel.count}/${rel.total}`,
        lockedAt:new Date().toISOString()
      });
      h394SaveKnowledge(db);
    }
  }

  function h394EnsureBox(){
    const panel = document.querySelector(".hermes-panel");
    if (!panel) return null;

    let box = document.getElementById("hermesHistoryLayerBox");
    if (box) return box;

    box = document.createElement("div");
    box.className = "hermes-section history-layer-center";
    box.id = "hermesHistoryLayerBox";
    box.innerHTML = `
      <h3>📚 History Access Layer</h3>
      <p class="hermes-section-hint">Ο Hermes βλέπει τις τελευταίες 300 τελετές και βρίσκει σχέσεις. Οι κανόνες κλειδώνουν μόνο όταν το ζητήσεις εσύ.</p>
      <div id="hermesHistoryLayerList" class="hermes-list"></div>
    `;

    const after = document.getElementById("hermesSmartOrdersBox") || document.querySelector(".smart-orders-center") || document.querySelector(".smart-suggestions-center");
    if (after && after.parentNode) after.parentNode.insertBefore(box, after.nextSibling);
    else panel.appendChild(box);

    return box;
  }

  function h394Render(){
    const box = h394EnsureBox();
    if (!box) return;

    const list = document.getElementById("hermesHistoryLayerList");
    if (!list) return;

    const rows = h394Last300();
    const rels = h394Relations();

    if (!rows.length){
      list.innerHTML = `<div class="hermes-item empty"><strong>Δεν βρέθηκε ιστορικό.</strong>Ο Hermes θα εμφανίσει σχέσεις όταν υπάρχουν αποθηκευμένες τελετές.</div>`;
      return;
    }

    if (!rels.length){
      list.innerHTML = `<div class="hermes-item alert"><strong>Αναγνώστηκαν ${rows.length} τελετές.</strong>Δεν υπάρχουν ακόμα αρκετά δυνατές σχέσεις για πρόταση κλειδώματος.</div>`;
      return;
    }

    list.innerHTML = rels.map((r,i)=>{
      const locked = h394IsLocked(r);
      return `
        <div class="hermes-item history-relation ${locked ? "locked" : ""}">
          <div class="history-relation-top">
            <strong>${r.from} ➜ ${r.to}</strong>
            <span>${r.pct}%</span>
          </div>
          <p>${r.title}</p>
          <small>Βάση: ${r.count}/${r.total} από τις τελευταίες ${rows.length} τελετές</small>
          <div class="history-relation-actions">
            ${locked ? `<button type="button" disabled>Κλειδωμένο</button>` : `<button type="button" data-h394-lock="${i}">Κλείδωμα σχέσης</button>`}
          </div>
        </div>
      `;
    }).join("");

    window.__h394Relations = rels;
  }

  function h394Styles(){
    if (document.getElementById("v394-history-layer-style")) return;
    const st = document.createElement("style");
    st.id = "v394-history-layer-style";
    st.textContent = `
      .history-layer-center{border-color:rgba(14,165,233,.26);}
      .hermes-item.history-relation{background:rgba(240,249,255,.78);border-color:rgba(14,165,233,.25);}
      .hermes-item.history-relation.locked{background:rgba(240,253,244,.82);border-color:rgba(34,197,94,.25);}
      .history-relation-top{display:flex;justify-content:space-between;align-items:center;gap:10px;}
      .history-relation-top span{border-radius:999px;background:#111827;color:#fff;padding:6px 10px;font-weight:950;font-size:12px;}
      .history-relation p{margin:6px 0 0;color:#111827;font-weight:800;}
      .history-relation small{display:block;margin-top:6px;color:#6b7280;font-weight:700;}
      .history-relation-actions{display:flex;justify-content:flex-end;margin-top:8px;}
      .history-relation-actions button{border:none;border-radius:999px;background:#111827;color:#fff;padding:8px 12px;font-weight:850;cursor:pointer;}
      .history-relation-actions button:disabled{background:#d1d5db;color:#374151;cursor:default;}
    `;
    document.head.appendChild(st);
  }

  function h394Init(){
    h394Styles();
    h394Render();

    document.addEventListener("click", function(e){
      const lockBtn = e.target && e.target.closest && e.target.closest("[data-h394-lock]");
      if (lockBtn){
        const idx = Number(lockBtn.getAttribute("data-h394-lock"));
        const rel = window.__h394Relations && window.__h394Relations[idx];
        if (rel){
          h394Lock(rel);
          h394Render();
        }
      }

      if (e.target && e.target.closest && e.target.closest('[data-tab="hermes"]')) {
        setTimeout(h394Render, 80);
      }
    });

    setTimeout(h394Render, 300);
    setTimeout(h394Render, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", h394Init);
  else h394Init();
})();



/* =========================================================
   V40 — Hermes Assistant 1.0
   Ενιαίο πακέτο:
   - Guided Completion
   - Knowledge Manager
   - Supplier Intelligence
   - Morning Auto Pilot
   - Hermes Brain
   Χρυσός κανόνας: ο Hermes συμπληρώνει μόνο κενά πεδία και μόνο μετά από δική σου ενέργεια.
   ========================================================= */
(function(){
  const HISTORY_LIMIT = 300;
  const KNOWLEDGE_KEY = "officeKnowledgeV1";
  const SUPPLIERS_KEY = "hermesSuppliersV1";

  function parseJSON(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e){ return fallback; }
  }

  function saveJSON(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }

  function allCeremonies(){
    try{
      if (Array.isArray(window.ceremonies) && window.ceremonies.length) return window.ceremonies;

      const keys = [
        "ceremonies",
        "staurakakiCeremonies",
        "funeralCeremonies",
        "ceremoniesData",
        "teletes"
      ];

      for (const k of keys){
        const v = parseJSON(k, null);
        if (Array.isArray(v) && v.length) return v;
      }
    }catch(e){}
    return [];
  }

  function saveCeremonies(rows){
    const keys = [
      "ceremonies",
      "staurakakiCeremonies",
      "funeralCeremonies",
      "ceremoniesData",
      "teletes"
    ];

    for (const k of keys){
      const v = parseJSON(k, null);
      if (Array.isArray(v)){
        saveJSON(k, rows);
        return true;
      }
    }

    try{
      if (Array.isArray(window.ceremonies)){
        window.ceremonies = rows;
        return true;
      }
    }catch(e){}

    return false;
  }

  function dateValue(c){
    const raw = c.date || c.ceremonyDate || c.ceremony_date || c.createdAt || c.created_at || "";
    const d = new Date(raw);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function lastCeremonies(){
    return allCeremonies()
      .slice()
      .sort((a,b)=>dateValue(b)-dateValue(a))
      .slice(0, HISTORY_LIMIT);
  }

  function field(c, names){
    for (const n of names){
      const v = c && c[n];
      if (v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "-"){
        return String(v).trim();
      }
    }
    return "";
  }

  function setField(c, names, value){
    const preferred = names[0];
    c[preferred] = value;
  }

  function ceremonyId(c){
    return c.id || c.case_id || c.caseId || c.caseID || c.name || c.deceasedName || JSON.stringify(c).slice(0,80);
  }

  function knowledge(){
    const db = parseJSON(KNOWLEDGE_KEY, {rules:[], probabilities:[], suggestions:[]});
    if (!Array.isArray(db.rules)) db.rules = [];
    if (!Array.isArray(db.probabilities)) db.probabilities = [];
    if (!Array.isArray(db.suggestions)) db.suggestions = [];

    const defaults = [
      {name:"ΦΛΩΡΙΝΑ", target:3},
      {name:"ΚΩΣΤΑΚΗ", target:2},
      {name:"ΓΚΡΙ ΣΕΤ", target:5},
      {name:"ΛΕΥΚΟ ΣΕΤ", target:5}
    ];

    defaults.forEach(d=>{
      const exists = db.rules.some(r => String(r.name || "").toUpperCase() === d.name);
      if (!exists) db.rules.push(d);
    });

    saveJSON(KNOWLEDGE_KEY, db);
    return db;
  }

  function saveKnowledge(db){
    saveJSON(KNOWLEDGE_KEY, db);
  }

  function seedSuppliers(){
    const suppliers = parseJSON(SUPPLIERS_KEY, null);
    if (suppliers) return;

    saveJSON(SUPPLIERS_KEY, {
      defaultMessagePrefix:"Καλημέρα, θα ήθελα παρακαλώ",
      defaultMessageSuffix:"Ευχαριστώ.",
      items:{}
    });
  }

  function targets(){
    return [
      {
        title:"Τοποθεσία ➜ Στολισμός",
        from:["place","ceremonyPlace","location","ceremony_location"],
        to:["decor","ceremonyDecor","decoration"],
        applyNames:["ceremonyDecor","decor","decoration"],
        label:"Στολισμός",
        minPct:70
      },
      {
        title:"Τοποθεσία ➜ Φραγκοφόροι",
        from:["place","ceremonyPlace","location","ceremony_location"],
        to:["pallbearers","ceremonyPallbearers"],
        applyNames:["ceremonyPallbearers","pallbearers"],
        label:"Φραγκοφόροι",
        minPct:70
      },
      {
        title:"Τοποθεσία ➜ Καφές",
        from:["place","ceremonyPlace","location","ceremony_location"],
        to:["coffee","ceremonyCoffee"],
        applyNames:["ceremonyCoffee","coffee"],
        label:"Καφές",
        minPct:70
      },
      {
        title:"Τοποθεσία ➜ ΣΕΤ",
        from:["place","ceremonyPlace","location","ceremony_location"],
        to:["set","ceremonySet"],
        applyNames:["ceremonySet","set"],
        label:"ΣΕΤ",
        minPct:70
      },
      {
        title:"Τρόπος ➜ Αγγελτήριο",
        from:["burialType","type","ceremonyType"],
        to:["announcementStatus","announcement","aggeltirio"],
        applyNames:["announcementStatus","announcement","aggeltirio"],
        label:"Αγγελτήριο",
        minPct:70
      }
    ];
  }

  function relations(){
    const rows = lastCeremonies();
    const result = [];

    targets().forEach(t=>{
      const buckets = {};

      rows.forEach(c=>{
        const from = field(c, t.from);
        const to = field(c, t.to);
        if (!from || !to) return;

        const key = from.toLowerCase();
        if (!buckets[key]) buckets[key] = {from, total:0, values:{}};
        buckets[key].total++;
        buckets[key].values[to] = (buckets[key].values[to] || 0) + 1;
      });

      Object.values(buckets).forEach(b=>{
        if (b.total < 3) return;

        const best = Object.entries(b.values).sort((a,b)=>b[1]-a[1])[0];
        const pct = Math.round(best[1] / b.total * 100);
        if (pct < t.minPct) return;

        result.push({
          ...t,
          from:b.from,
          to:best[0],
          pct,
          count:best[1],
          total:b.total
        });
      });
    });

    return result.sort((a,b)=>b.pct-a.pct || b.total-a.total).slice(0, 30);
  }

  function openCeremonies(){
    const rows = allCeremonies();
    const today = new Date();
    today.setHours(0,0,0,0);

    return rows.filter(c=>{
      const d = new Date(field(c,["date","ceremonyDate","ceremony_date"]) || 0);
      return !isNaN(d.getTime()) && d >= today;
    }).sort((a,b)=>dateValue(a)-dateValue(b)).slice(0, 30);
  }

  function completionSuggestions(){
    const ceremonies = openCeremonies();
    const rels = relations();
    const suggestions = [];

    ceremonies.forEach(c=>{
      rels.forEach(r=>{
        const fromValue = field(c, r.from);
        if (!fromValue || fromValue.toLowerCase() !== String(r.from).toLowerCase()) return;

        const current = field(c, r.applyNames);
        if (current) return; // χρυσός κανόνας: μόνο κενά

        suggestions.push({
          ceremony:c,
          relation:r.title,
          fieldNames:r.applyNames,
          fieldLabel:r.label,
          value:r.to,
          pct:r.pct,
          sample:`${r.count}/${r.total}`
        });
      });
    });

    return suggestions.sort((a,b)=>b.pct-a.pct).slice(0, 20);
  }

  function applySuggestion(index){
    const suggestions = completionSuggestions();
    const s = suggestions[index];
    if (!s) return false;

    const all = allCeremonies();
    const id = ceremonyId(s.ceremony);
    const target = all.find(c => ceremonyId(c) === id) || s.ceremony;

    if (field(target, s.fieldNames)) return false;

    setField(target, s.fieldNames, s.value);
    saveCeremonies(all);

    const db = knowledge();
    db.suggestions.push({
      at:new Date().toISOString(),
      action:"guided_completion_applied",
      field:s.fieldLabel,
      value:s.value,
      confidence:s.pct,
      sample:s.sample
    });
    saveKnowledge(db);

    if (typeof window.renderCeremonies === "function") {
      try { window.renderCeremonies(); } catch(e){}
    }

    return true;
  }

  function warehouseItems(){
    const candidates = ["warehouse","coffins","warehouseItems","staurakakiWarehouse","staurakaki_coffins"];
    let arr = [];

    for (const key of candidates){
      const v = parseJSON(key, null);
      if (Array.isArray(v) && v.length){
        arr = v;
        break;
      }
    }

    if (!arr.length && Array.isArray(window.warehouse)) arr = window.warehouse;
    if (!arr.length && Array.isArray(window.coffins)) arr = window.coffins;

    return (arr || []).map(x=>({
      name:String(x.name || x.title || x.coffin || x.label || "").trim(),
      qty:Number(x.qty ?? x.quantity ?? x.count ?? x.stock ?? 0)
    })).filter(x=>x.name);
  }

  function inventoryOrders(){
    const db = knowledge();
    const rules = db.rules || [];

    return warehouseItems().map(item=>{
      const upper = item.name.toUpperCase();
      const rule = rules.find(r=>{
        const rn = String(r.name || "").toUpperCase();
        return rn && (rn === upper || upper.includes(rn) || rn.includes(upper));
      });

      const target = Number(rule?.target || 0);
      if (!target || item.qty >= target) return null;

      return {
        name:item.name,
        qty:item.qty,
        target,
        need:target-item.qty
      };
    }).filter(Boolean).sort((a,b)=>b.need-a.need || a.qty-b.qty);
  }

  function supplierMessage(order){
    const suppliers = parseJSON(SUPPLIERS_KEY, {});
    const prefix = suppliers.defaultMessagePrefix || "Καλημέρα, θα ήθελα παρακαλώ";
    const suffix = suppliers.defaultMessageSuffix || "Ευχαριστώ.";
    return `${prefix} ${order.need} τεμ. ${order.name}. ${suffix}`;
  }

  function brainStats(){
    const rels = relations();
    const db = knowledge();
    const locked = (db.rules || []).filter(r=>r.type === "relationship").length;
    const confidence = rels.length ? Math.round(rels.reduce((sum,r)=>sum+r.pct,0) / rels.length) : 0;

    return {
      history:lastCeremonies().length,
      relations:rels.length,
      locked,
      completions:completionSuggestions().length,
      orders:inventoryOrders().length,
      confidence
    };
  }

  function ensureBox(id, title, hint, afterSelector){
    const panel = document.querySelector(".hermes-panel");
    if (!panel) return null;

    let box = document.getElementById(id);
    if (box) return box;

    box = document.createElement("div");
    box.className = "hermes-section v40-hermes-section";
    box.id = id;
    box.innerHTML = `
      <h3>${title}</h3>
      <p class="hermes-section-hint">${hint}</p>
      <div class="hermes-list"></div>
    `;

    const after = afterSelector ? document.querySelector(afterSelector) : null;
    if (after && after.parentNode) after.parentNode.insertBefore(box, after.nextSibling);
    else panel.appendChild(box);

    return box;
  }

  function renderGuidedCompletion(){
    const box = ensureBox(
      "v40GuidedCompletionBox",
      "🧠 Guided Completion",
      "Συμπληρώνει μόνο κενά πεδία και μόνο αφού πατήσεις εσύ εφαρμογή.",
      "#hermesHistoryLayerBox"
    );
    if (!box) return;

    const list = box.querySelector(".hermes-list");
    const suggestions = completionSuggestions();

    if (!suggestions.length){
      list.innerHTML = `
        <div class="hermes-item empty">
          <strong>Δεν υπάρχουν ασφαλείς συμπληρώσεις.</strong>
          Ο Hermes δεν βρήκε κενά πεδία με πιθανότητα πάνω από 70%.
        </div>
      `;
      return;
    }

    list.innerHTML = suggestions.map((s,i)=>`
      <div class="hermes-item v40-guided-item">
        <div class="v40-top">
          <strong>${field(s.ceremony,["name","deceasedName","deceased_name"]) || "Τελετή"}</strong>
          <span>${s.pct}%</span>
        </div>
        <p>${s.fieldLabel}: <b>${s.value}</b></p>
        <small>${s.relation} · βάση ${s.sample} · μόνο αν το πεδίο είναι κενό</small>
        <div class="v40-actions">
          <button type="button" data-v40-apply="${i}">Εφαρμογή στο κενό πεδίο</button>
        </div>
      </div>
    `).join("");
  }

  function renderKnowledgeManager(){
    const box = ensureBox(
      "v40KnowledgeManagerBox",
      "🧠 Knowledge Manager",
      "Κλειδωμένοι κανόνες και σχέσεις. Δεν αλλάζουν αυτόματα.",
      "#v40GuidedCompletionBox"
    );
    if (!box) return;

    const list = box.querySelector(".hermes-list");
    const db = knowledge();
    const rules = db.rules || [];

    if (!rules.length){
      list.innerHTML = `
        <div class="hermes-item alert">
          <strong>Δεν υπάρχουν ακόμα κανόνες.</strong>
          Κλείδωσε σχέσεις από το History Access Layer ή πρόσθεσε στόχους αποθήκης.
        </div>
      `;
      return;
    }

    list.innerHTML = rules.slice(-16).reverse().map(r=>`
      <div class="hermes-item v40-rule-item">
        <strong>${r.name || r.key || "Κανόνας"}</strong>
        <p>${r.type === "relationship" ? `${r.relation || ""} · ${r.confidence || ""}% · ${r.sample || ""}` : `Στόχος: ${r.target || "-"}`}</p>
        <small>Κλειδωμένο από γραφείο · δεν αλλάζει αυτόματα</small>
      </div>
    `).join("");
  }

  function renderSupplierIntelligence(){
    const box = ensureBox(
      "v40SupplierIntelBox",
      "📞 Supplier Intelligence",
      "Έτοιμα μηνύματα παραγγελίας. Αντιγραφή μόνο — δεν στέλνει τίποτα μόνο του.",
      "#v40KnowledgeManagerBox"
    );
    if (!box) return;

    const list = box.querySelector(".hermes-list");
    const orders = inventoryOrders();

    if (!orders.length){
      list.innerHTML = `
        <div class="hermes-item empty">
          <strong>Η αποθήκη είναι εντός στόχων.</strong>
          Δεν υπάρχει προτεινόμενη παραγγελία.
        </div>
      `;
      return;
    }

    list.innerHTML = orders.map((o,i)=>`
      <div class="hermes-item v40-supplier-item">
        <strong>${o.name} ➜ +${o.need}</strong>
        <p>Τρέχον ${o.qty} · στόχος ${o.target}</p>
        <textarea readonly id="v40SupplierMsg${i}">${supplierMessage(o)}</textarea>
        <div class="v40-actions">
          <button type="button" data-v40-copy-supplier="${i}">Αντιγραφή μηνύματος</button>
        </div>
      </div>
    `).join("");
  }

  function renderMorningAutoPilot(){
    const box = ensureBox(
      "v40MorningPilotBox",
      "🚀 Morning Auto Pilot",
      "Μία ματιά: συμπληρώσεις, παραγγελίες, σχέσεις και φόρτος ημέρας.",
      "#v40SupplierIntelBox"
    );
    if (!box) return;

    const list = box.querySelector(".hermes-list");
    const s = brainStats();
    const workload = s.completions + s.orders;
    const mood = workload === 0 ? "🟢 Ήρεμη μέρα" : workload <= 3 ? "🟡 Φυσιολογική μέρα" : workload <= 6 ? "🟠 Αυξημένη μέρα" : "🔴 Απαιτητική μέρα";

    list.innerHTML = `
      <div class="hermes-item v40-morning-item">
        <strong>${mood}</strong>
        <p>🎯 ${s.completions} συμπληρώσεις · 📦 ${s.orders} παραγγελίες · 🧠 ${s.relations} σχέσεις</p>
        <small>Ανάλυση από τελευταίες ${s.history} τελετές.</small>
      </div>
    `;
  }

  function renderBrain(){
    const box = ensureBox(
      "v40HermesBrainBox",
      "🧩 Hermes Brain",
      "Συνδυάζει ιστορικό 300 τελετών, κλειδωμένη γνώση, πιθανότητες και ελλείψεις.",
      "#v40MorningPilotBox"
    );
    if (!box) return;

    const list = box.querySelector(".hermes-list");
    const s = brainStats();
    const conf = s.confidence >= 90 ? "🟢 Υψηλή βεβαιότητα" : s.confidence >= 70 ? "🟡 Μέτρια βεβαιότητα" : "⚪ Συλλογή δεδομένων";

    list.innerHTML = `
      <div class="hermes-item v40-brain-item">
        <strong>${conf}</strong>
        <p>Ιστορικό: ${s.history}/300 · Σχέσεις: ${s.relations} · Κλειδωμένοι κανόνες: ${s.locked}</p>
        <small>Ο Hermes προτείνει. Εσύ εγκρίνεις. Ποτέ αντικατάσταση συμπληρωμένου πεδίου.</small>
      </div>
    `;
  }

  function renderAll(){
    seedSuppliers();
    renderGuidedCompletion();
    renderKnowledgeManager();
    renderSupplierIntelligence();
    renderMorningAutoPilot();
    renderBrain();
  }

  function styles(){
    if (document.getElementById("v40-hermes-assistant-style")) return;

    const st = document.createElement("style");
    st.id = "v40-hermes-assistant-style";
    st.textContent = `
      .v40-hermes-section{border-color:rgba(79,70,229,.22);}
      .v40-guided-item,.v40-rule-item,.v40-supplier-item,.v40-morning-item,.v40-brain-item{background:rgba(245,243,255,.72);border-color:rgba(79,70,229,.22);}
      .v40-top{display:flex;justify-content:space-between;align-items:center;gap:10px;}
      .v40-top span{border-radius:999px;background:#111827;color:#fff;padding:6px 10px;font-weight:950;font-size:12px;}
      .v40-actions{display:flex;justify-content:flex-end;margin-top:8px;gap:8px;flex-wrap:wrap;}
      .v40-actions button{border:none;border-radius:999px;background:#111827;color:#fff;padding:8px 12px;font-weight:850;cursor:pointer;}
      .v40-actions button:active{transform:scale(.98);}
      .v40-supplier-item textarea{width:100%;min-height:58px;margin-top:8px;border-radius:14px;border:1px solid rgba(17,24,39,.12);padding:9px;background:rgba(255,255,255,.75);font-size:13px;resize:vertical;}
    `;
    document.head.appendChild(st);
  }

  function init(){
    styles();
    renderAll();

    document.addEventListener("click", function(e){
      const apply = e.target && e.target.closest && e.target.closest("[data-v40-apply]");
      if (apply){
        const idx = Number(apply.getAttribute("data-v40-apply"));
        const ok = applySuggestion(idx);
        apply.textContent = ok ? "Εφαρμόστηκε" : "Δεν εφαρμόστηκε";
        setTimeout(renderAll, 300);
      }

      const copy = e.target && e.target.closest && e.target.closest("[data-v40-copy-supplier]");
      if (copy){
        const idx = copy.getAttribute("data-v40-copy-supplier");
        const ta = document.getElementById("v40SupplierMsg"+idx);
        if (ta){
          navigator.clipboard?.writeText(ta.value);
          copy.textContent = "Αντιγράφηκε";
          setTimeout(()=>copy.textContent="Αντιγραφή μηνύματος",1200);
        }
      }

      if (e.target && e.target.closest && e.target.closest('[data-tab="hermes"]')){
        setTimeout(renderAll, 80);
      }
    });

    setTimeout(renderAll, 300);
    setTimeout(renderAll, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();


/* FuneralOS v1.2 commercial polish — pricing config, WhatsApp to family, team/admin, referral, export backup */
(function(){
  const cfg = window.FUNERALOS_CONFIG || {};
  const PRO_PRICE = cfg.proPrice || 39;
  const TEAM_PRICE = cfg.teamPrice || 79;
  const proUrl = cfg.stripeProUrl || "https://buy.stripe.com/PLACEHOLDER_PRO";
  const teamUrl = cfg.stripeTeamUrl || "https://buy.stripe.com/PLACEHOLDER_TEAM";
  const demoUrl = cfg.demoBookingUrl || "https://wa.me/306987171717?text=Hello%20FuneralOS%2C%20I%20would%20like%20a%20live%20demo";

  function safeEsc(s){ try { return typeof esc === 'function' ? esc(s) : String(s||'').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); } catch(e){ return String(s||''); } }
  function allCeremonies(){ return Array.isArray(window.ceremonies) ? window.ceremonies : (typeof ceremonies !== 'undefined' ? ceremonies : []); }
  function allWarehouse(){ return Array.isArray(window.warehouse) ? window.warehouse : (typeof warehouse !== 'undefined' ? warehouse : []); }
  function allSets(){ return Array.isArray(window.setsWarehouse) ? window.setsWarehouse : (typeof setsWarehouse !== 'undefined' ? setsWarehouse : []); }

  function patchPrices(){
    document.querySelectorAll('a[href*="PLACEHOLDER_PRO"], a[href*="PLACEHOLDER"], #upgradeBtn').forEach(a=>{ if(proUrl && !proUrl.includes('PLACEHOLDER')) { a.href = proUrl; a.textContent = a.textContent.replace(/€\d+\/month|€\d+\/μήνα/g, `€${PRO_PRICE}/month`); } });
    document.querySelectorAll('a[href*="PLACEHOLDER_TEAM"]').forEach(a=>{ if(teamUrl && !teamUrl.includes('PLACEHOLDER')) { a.href = teamUrl; a.textContent = a.textContent.replace(/€\d+\/month|€\d+\/μήνα/g, `€${TEAM_PRICE}/month`); } });
    document.querySelectorAll('[data-book-demo], a[href="#demo"], a[href="#contact"]').forEach(a=>{ if(!a.dataset.keepHref) a.href = demoUrl; });
  }

  function familyMessage(c){
    return [
      `Dear family,`,
      `These are the basic ceremony details:`,
      c.name ? `Name: ${c.name}` : '',
      (c.date || c.time) ? `Date/time: ${c.date || ''} ${c.time || ''}`.trim() : '',
      c.place ? `Location: ${c.place}` : '',
      c.burialType ? `Type: ${c.burialType}` : '',
      ``,
      `Please reply if anything needs correction.`,
      `FuneralOS`
    ].filter(Boolean).join('\n');
  }

  function internalMessage(c){
    if(typeof buildWhatsAppMessage === 'function') return buildWhatsAppMessage(c);
    return `FuneralOS case\n${c.name||''}\n${c.date||''} ${c.time||''}\n${c.place||''}`;
  }

  function openWa(text){ window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener'); }
  function openEmail(subject, body){ location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; }

  function addFamilyActions(){
    const list=document.getElementById('ceremoniesList'); if(!list || list.dataset.v12==='1') return; list.dataset.v12='1';
    const mo=new MutationObserver(()=>{
      document.querySelectorAll('.ceremony-card .card-buttons').forEach(bar=>{
        if(bar.dataset.v12==='1') return; bar.dataset.v12='1';
        const waFamily=document.createElement('button');
        waFamily.type='button'; waFamily.textContent='Send to family'; waFamily.dataset.v12='family-wa';
        waFamily.style.cssText='border-radius:999px;border:none;padding:6px 12px;font-size:13px;cursor:pointer;background:#dcfce7;color:#14532d;font-weight:900;';
        const waInternal=document.createElement('button');
        waInternal.type='button'; waInternal.textContent='Internal WA'; waInternal.dataset.v12='internal-wa';
        waInternal.style.cssText='border-radius:999px;border:none;padding:6px 12px;font-size:13px;cursor:pointer;background:#25d366;color:#fff;font-weight:900;';
        const emailFamily=document.createElement('button');
        emailFamily.type='button'; emailFamily.textContent='Family Email'; emailFamily.dataset.v12='family-email';
        emailFamily.style.cssText='border-radius:999px;border:none;padding:6px 12px;font-size:13px;cursor:pointer;background:#e0f2fe;color:#075985;font-weight:900;';
        bar.insertBefore(waFamily, bar.lastElementChild);
        bar.insertBefore(emailFamily, bar.lastElementChild);
        bar.insertBefore(waInternal, bar.lastElementChild);
      });
    });
    mo.observe(list,{childList:true,subtree:true});
    list.addEventListener('click', e=>{
      const btn=e.target.closest('[data-v12]'); if(!btn) return;
      const card=btn.closest('.ceremony-card'); const id=card?.dataset?.id; const c=allCeremonies().find(x=>String(x.id)===String(id)); if(!c) return;
      if(btn.dataset.v12==='family-wa') openWa(familyMessage(c));
      if(btn.dataset.v12==='internal-wa') openWa(internalMessage(c));
      if(btn.dataset.v12==='family-email') openEmail('Ceremony details - '+(c.name||''), familyMessage(c));
    });
  }

  function backupJSON(){
    const payload = { exported_at:new Date().toISOString(), ceremonies:allCeremonies(), warehouse:allWarehouse(), setsWarehouse:allSets(), version:'v1.2' };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='funeralos-backup-'+new Date().toISOString().slice(0,10)+'.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function addOwnerBar(){
    if(document.getElementById('v12OwnerBar')) return;
    if(window.__authPlan !== 'pro') return;
    const top=document.querySelector('.top-bar') || document.querySelector('.tabs') || document.body;
    const bar=document.createElement('div'); bar.id='v12OwnerBar';
    bar.style.cssText='display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;padding:10px 12px;background:rgba(15,23,42,.92);color:#fff;border-bottom:1px solid rgba(255,255,255,.08)';
    bar.innerHTML=`<b style="margin-right:8px">Owner tools</b><button id="v12ExportBackup" type="button">Export backup</button><a href="${demoUrl}" target="_blank" rel="noopener" style="text-decoration:none">Book demo link</a><span>Pro €${PRO_PRICE}/month · Team €${TEAM_PRICE}/month</span>`;
    bar.querySelectorAll('button,a').forEach(el=>el.style.cssText+=';border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(255,255,255,.08);color:#fff;padding:7px 11px;font-weight:800;cursor:pointer');
    top.insertAdjacentElement('afterend', bar);
    document.getElementById('v12ExportBackup').onclick=backupJSON;
  }

  function enhanceAdmin(){
    const admin=document.getElementById('adminTab'); if(!admin || document.getElementById('v12SaasChecklist')) return;
    const box=document.createElement('div'); box.id='v12SaasChecklist'; box.className='section-card';
    box.innerHTML=`<h2>SaaS launch checklist</h2><p class="muted">Before taking real money, finish these items. No romance here: without them, support will become a small civil war.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px"><div><b>Payments</b><br><small>Stripe Payment Links: Pro €${PRO_PRICE}, Team €${TEAM_PRICE}. Webhook file included.</small></div><div><b>Privacy / Terms</b><br><small>Pages included. Review with a legal professional before launch.</small></div><div><b>Team users</b><br><small>Team plan up to 5 users. Real invitations need Supabase profile table.</small></div><div><b>Native app</b><br><small>Capacitor starter files included for later App Store / Play Store step.</small></div></div>`;
    admin.appendChild(box);
  }

  function init(){
    patchPrices(); addFamilyActions(); addOwnerBar(); setTimeout(enhanceAdmin,1000);
    document.addEventListener('click', e=>{ if(e.target?.closest?.('[data-tab="admin"]')) setTimeout(enhanceAdmin,120); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
