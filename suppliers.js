/* =========================================================
   Τελετές Σταυρακάκη — V42.2 Office Organizer Pro: ΠΡΟΜΗΘΕΥΤΕΣ
   (V42.2: ΑΣΦΑΛΗΣ συγχρονισμός — ΕΝΩΝΕΙ τοπικά+cloud, ΠΟΤΕ δεν σβήνει.
    Διορθώνει το V42.1 που «έκρυβε» τους προμηθευτές.)
   ---------------------------------------------------------
   100% ΠΡΟΣΘΕΤΙΚΟ — δεν αγγίζει καθόλου το app.js.
   Βελτιώσεις σε σχέση με V42:
   - Συγχρονισμός σε ΟΛΕΣ τις συσκευές (best-effort μέσω Supabase app_state,
     ξεχωριστή γραμμή "suppliers_v42"), με πλήρη τοπική εφεδρεία.
   - Έξτρα είδη εκτός αποθήκης (λουλούδια, κεριά, λάδι κ.λπ.) με δικό τους όριο.
   - Επεξεργάσιμη ποσότητα παραγγελίας πριν την αντιγραφή.
   - Κουμπί WhatsApp (αν υπάρχει τηλέφωνο) — ανοίγει έτοιμο μήνυμα, στέλνεις εσύ.
   - «Σήμανση ως παραγγέλθηκε» με ημερομηνία (ιστορικό παραγγελιών).
   - Badge στο κουμπί: πόσα είδη χρειάζονται παραγγελία τώρα.
   - Αναζήτηση προμηθευτών, αλφαβητική σειρά, προεπιλογή ορίου από Office Knowledge.
   - Αντίγραφο/Επαναφορά (backup) των προμηθευτών.
   Δεν στέλνει τίποτα μόνο του. Δεν αλλάζει αποθέματα. Read-only στην αποθήκη.
   Απενεργοποίηση: σβήνεις τη γραμμή <script src="suppliers.js">.
   ========================================================= */
(function () {
  "use strict";

  var STORE_KEY = "staurakaki_suppliers_v42";
  var WAREHOUSE_KEY = "staurakaki_warehouse_v8";
  var SETS_KEY = "staurakaki_sets_v8";
  var KNOWLEDGE_KEY = "officeKnowledgeV1";
  var CLOUD_ID = "suppliers_v42";

  // ---------------- storage ----------------
  function loadAll() {
    try {
      var d = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      if (!d || typeof d !== "object") d = {};
      if (!Array.isArray(d.suppliers)) d.suppliers = [];
      if (!Array.isArray(d.deleted)) d.deleted = [];
      if (typeof d.ts !== "number") d.ts = 0;
      return d;
    } catch (e) { return { suppliers: [], deleted: [], ts: 0 }; }
  }
  function persistLocal(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) {} }
  function saveAll(d) {
    if (!d || typeof d !== "object") return;
    if (!Array.isArray(d.suppliers)) d.suppliers = [];
    d.ts = Date.now();
    persistLocal(d);
    cloudSave(d);
    updateBadge();
  }

  function loadStock() {
    var coffins = [], sets = [];
    try { coffins = JSON.parse(localStorage.getItem(WAREHOUSE_KEY) || "[]"); } catch (e) {}
    try { sets = JSON.parse(localStorage.getItem(SETS_KEY) || "[]"); } catch (e) {}
    return { coffins: Array.isArray(coffins) ? coffins : [], sets: Array.isArray(sets) ? sets : [] };
  }
  function stockQty(stock, source, name) {
    var list = source === "set" ? stock.sets : stock.coffins;
    var n = String(name || "").trim().toUpperCase();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].name || "").trim().toUpperCase() === n) return Number(list[i].qty) || 0;
    }
    return 0;
  }
  function knowledgeTarget(name) {
    try {
      var db = JSON.parse(localStorage.getItem(KNOWLEDGE_KEY) || "{}");
      var rules = (db && Array.isArray(db.rules)) ? db.rules : [];
      var n = String(name || "").trim().toUpperCase();
      for (var i = 0; i < rules.length; i++) {
        if (String(rules[i].name || "").trim().toUpperCase() === n) return Number(rules[i].target) || "";
      }
    } catch (e) {}
    return "";
  }

  function uid() { return "s" + Date.now() + Math.floor(Math.random() * 1000); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // ---------------- cloud sync (best-effort) ----------------
  function sbCtx() {
    try {
      if (typeof SUPABASE_URL === "string" && typeof supabaseHeaders === "function") {
        return { url: SUPABASE_URL, h: supabaseHeaders() };
      }
    } catch (e) {}
    return null;
  }
  function cloudLoad(cb) {
    var ctx = sbCtx(); if (!ctx) { cb(null); return; }
    try {
      fetch(ctx.url + "/rest/v1/app_state?id=eq." + CLOUD_ID + "&select=payload", { headers: ctx.h })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (rows) { cb(rows && rows[0] && rows[0].payload ? rows[0].payload : null); })
        .catch(function () { cb(null); });
    } catch (e) { cb(null); }
  }
  function cloudSave(data) {
    var ctx = sbCtx(); if (!ctx) return;
    try {
      var headers = {}; for (var k in ctx.h) headers[k] = ctx.h[k];
      headers["Prefer"] = "resolution=merge-duplicates";
      fetch(ctx.url + "/rest/v1/app_state", {
        method: "POST", headers: headers,
        body: JSON.stringify([{ id: CLOUD_ID, payload: data }])
      }).catch(function () {});
    } catch (e) {}
  }
  // ΑΣΦΑΛΗΣ ΕΝΩΣΗ (union): ποτέ δεν σβήνει προμηθευτή — κρατά όλους από cloud + τοπικά.
  // Οι διαγραφές περνούν ως "tombstones" (deleted ids) ώστε να μην ξαναεμφανίζονται.
  function mergeAll(local, cloud) {
    var delIds = {};
    (local.deleted || []).forEach(function (id) { delIds[id] = 1; });
    (cloud.deleted || []).forEach(function (id) { delIds[id] = 1; });
    var byId = {};
    (cloud.suppliers || []).forEach(function (s) { if (s && s.id) byId[s.id] = s; });
    (local.suppliers || []).forEach(function (s) {
      if (!s || !s.id) return;
      var c = byId[s.id];
      if (!c) { byId[s.id] = s; return; }
      var lt = Number(s._ts || 0), ct = Number(c._ts || 0);
      if (lt !== ct) byId[s.id] = (lt > ct) ? s : c;
      else byId[s.id] = ((s.products || []).length >= (c.products || []).length) ? s : c;
    });
    var suppliers = Object.keys(byId).filter(function (id) { return !delIds[id]; }).map(function (id) { return byId[id]; });
    return { suppliers: suppliers, deleted: Object.keys(delIds), ts: Math.max(Number(local.ts || 0), Number(cloud.ts || 0)) };
  }

  function syncFromCloud(thenRender) {
    cloudLoad(function (cloud) {
      var local = loadAll();
      if (cloud && (Array.isArray(cloud.suppliers) || Array.isArray(cloud.deleted))) {
        var merged = mergeAll(local, cloud);
        persistLocal(merged);
        cloudSave(merged); // ανέβασε το ενοποιημένο ώστε να συγκλίνουν οι συσκευές
        updateBadge();
        if (thenRender && isOpen()) render();
      } else if (local.suppliers && local.suppliers.length) {
        cloudSave(local); // δεν υπάρχει cloud ακόμη -> κράτα αντίγραφο το τοπικό
      }
    });
  }

  // ---------------- styles ----------------
  function injectStyles() {
    if (document.getElementById("sup42-style")) return;
    var st = document.createElement("style");
    st.id = "sup42-style";
    st.textContent = [
      ".sup42-overlay{position:fixed;inset:0;background:rgba(17,24,39,.55);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow:auto}",
      ".sup42-overlay.sup42-hidden{display:none}",
      ".sup42-modal{background:#f6f0e7;color:#1f2430;width:100%;max-width:700px;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.35);padding:16px 16px 22px;margin:auto}",
      ".sup42-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}",
      ".sup42-head h2{font-size:18px;margin:0}",
      ".sup42-x{border:none;background:#111827;color:#fff;border-radius:999px;width:34px;height:34px;font-size:16px;cursor:pointer}",
      ".sup42-tabs{display:flex;gap:8px;margin:8px 0 12px;flex-wrap:wrap}",
      ".sup42-tab{border:none;border-radius:999px;padding:8px 14px;font-weight:800;font-size:13px;cursor:pointer;background:#e5e7eb;color:#1f2430}",
      ".sup42-tab.active{background:#111827;color:#fff}",
      ".sup42-tab .b{display:inline-block;min-width:18px;margin-left:6px;background:#dc2626;color:#fff;border-radius:999px;padding:0 6px;font-size:11px}",
      ".sup42-btn{border:none;border-radius:999px;padding:9px 14px;font-weight:800;font-size:13px;cursor:pointer;background:#e3d7c5;color:#1f2430}",
      ".sup42-btn.dark{background:#111827;color:#fff}",
      ".sup42-btn.wa{background:#25d366;color:#06381c}",
      ".sup42-btn.danger{background:#fee2e2;color:#991b1b}",
      ".sup42-btn.small{padding:6px 10px;font-size:12px}",
      ".sup42-card{background:#fff;border:1px solid #e7e1d6;border-radius:14px;padding:12px;margin-bottom:10px}",
      ".sup42-card h3{margin:0 0 4px;font-size:15px}",
      ".sup42-muted{color:#6b7280;font-size:12px}",
      ".sup42-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}",
      ".sup42-row.between{justify-content:space-between}",
      ".sup42-field{display:flex;flex-direction:column;gap:3px;margin-bottom:8px}",
      ".sup42-field label{font-size:12px;font-weight:700;color:#374151}",
      ".sup42-field input,.sup42-field textarea{border:1px solid #d1d5db;border-radius:10px;padding:8px 10px;font-size:14px;font-family:inherit;width:100%;box-sizing:border-box}",
      ".sup42-search{border:1px solid #d1d5db;border-radius:10px;padding:8px 10px;font-size:14px;width:100%;box-sizing:border-box;margin-bottom:10px;font-family:inherit}",
      ".sup42-prod{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed #eee;flex-wrap:wrap}",
      ".sup42-prod:last-child{border-bottom:none}",
      ".sup42-prod .nm{flex:1;min-width:140px;font-size:13px}",
      ".sup42-prod .tag{font-size:11px;color:#6b7280;background:#f3f4f6;border-radius:999px;padding:1px 7px}",
      ".sup42-prod input[type=number]{width:64px;border:1px solid #d1d5db;border-radius:8px;padding:5px 6px;font-size:13px}",
      ".sup42-prod input[type=text]{flex:1;min-width:120px;border:1px solid #d1d5db;border-radius:8px;padding:6px 8px;font-size:13px}",
      ".sup42-need{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px;margin-top:8px}",
      ".sup42-need .qi{width:60px;border:1px solid #fdba74;border-radius:8px;padding:4px 6px;font-size:13px;margin:0 4px}",
      ".sup42-msg{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:10px;padding:8px;font-size:13px;font-family:inherit;min-height:96px;margin-top:8px}",
      ".sup42-empty{color:#6b7280;font-size:13px;padding:10px 0}",
      ".sup42-ok{color:#15803d;font-size:12px;font-weight:700}",
      ".sup42-summary{background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:10px;margin-bottom:12px;font-size:13px}",
      "#sup42-openBtn{margin-left:10px;border:none;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:800;cursor:pointer;background:#e3d7c5;color:#1f2430;position:relative}",
      "#sup42-badge{position:absolute;top:-7px;right:-7px;background:#dc2626;color:#fff;border-radius:999px;font-size:10px;min-width:17px;height:17px;line-height:17px;text-align:center;display:none;padding:0 4px}"
    ].join("");
    document.head.appendChild(st);
  }

  // ---------------- launcher button + badge ----------------
  function ensureButton() {
    if (document.getElementById("sup42-openBtn")) { updateBadge(); return; }
    var btn = document.createElement("button");
    btn.id = "sup42-openBtn";
    btn.type = "button";
    btn.innerHTML = '🏪 Προμηθευτές<span id="sup42-badge">0</span>';
    btn.onclick = openModal;
    var topBar = document.querySelector(".top-bar");
    if (topBar) { topBar.appendChild(btn); }
    else {
      btn.style.position = "fixed"; btn.style.right = "14px"; btn.style.bottom = "14px"; btn.style.zIndex = "99998";
      document.body.appendChild(btn);
    }
    updateBadge();
  }
  function computeNeeds(supplier, stock) {
    var needs = [];
    (supplier.products || []).forEach(function (p) {
      var target = Number(p.target) || 0;
      if (target <= 0) return;
      var current = (p.source === "custom") ? (Number(p.manualStock) || 0) : stockQty(stock, p.source, p.name);
      var need = target - current;
      if (need > 0) needs.push({ name: p.name, source: p.source, current: current, target: target, need: need });
    });
    return needs;
  }
  function totalNeeds() {
    var db = loadAll(), stock = loadStock(), n = 0;
    db.suppliers.forEach(function (s) { n += computeNeeds(s, stock).length; });
    return n;
  }
  function updateBadge() {
    var b = document.getElementById("sup42-badge");
    if (!b) return;
    var n = totalNeeds();
    b.textContent = String(n);
    b.style.display = n > 0 ? "inline-block" : "none";
  }

  // ---------------- modal ----------------
  var screen = "list"; // list | form | products | orders
  var editingId = null;
  var search = "";

  function isOpen() {
    var ov = document.getElementById("sup42-overlay");
    return ov && !ov.classList.contains("sup42-hidden");
  }
  function ensureModal() {
    var ov = document.getElementById("sup42-overlay");
    if (ov) return ov;
    ov = document.createElement("div");
    ov.id = "sup42-overlay";
    ov.className = "sup42-overlay sup42-hidden";
    ov.innerHTML =
      '<div class="sup42-modal">' +
      '  <div class="sup42-head"><h2>🏪 Προμηθευτές & Παραγγελίες</h2><button class="sup42-x" id="sup42-close">✕</button></div>' +
      '  <div class="sup42-tabs">' +
      '    <button class="sup42-tab" data-view="list">Προμηθευτές</button>' +
      '    <button class="sup42-tab" data-view="orders">Προτάσεις Παραγγελιών <span class="b" id="sup42-tabbadge" style="display:none">0</span></button>' +
      '  </div>' +
      '  <div class="sup42-body" id="sup42-body"></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) closeModal(); });
    ov.querySelector("#sup42-close").onclick = closeModal;
    ov.querySelectorAll(".sup42-tab").forEach(function (t) {
      t.onclick = function () { screen = t.getAttribute("data-view"); editingId = null; render(); };
    });
    return ov;
  }
  function openModal() {
    injectStyles(); ensureModal();
    screen = "list"; editingId = null; search = "";
    document.getElementById("sup42-overlay").classList.remove("sup42-hidden");
    render();
    syncFromCloud(true);
  }
  function closeModal() {
    var ov = document.getElementById("sup42-overlay");
    if (ov) ov.classList.add("sup42-hidden");
  }

  function setActiveTab() {
    var tabKey = (screen === "orders") ? "orders" : "list";
    document.querySelectorAll("#sup42-overlay .sup42-tab").forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-view") === tabKey);
    });
    var tb = document.getElementById("sup42-tabbadge");
    if (tb) { var n = totalNeeds(); tb.textContent = String(n); tb.style.display = n > 0 ? "inline-block" : "none"; }
  }
  function render() {
    setActiveTab();
    var body = document.getElementById("sup42-body");
    if (!body) return;
    if (screen === "orders") return renderOrders(body);
    if (screen === "form") return renderForm(body);
    if (screen === "products") return renderProducts(body);
    return renderList(body);
  }

  // ---------------- list ----------------
  function renderList(body) {
    var db = loadAll();
    var suppliers = db.suppliers.slice().sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""), "el");
    });
    if (search) {
      var q = search.toLowerCase();
      suppliers = suppliers.filter(function (s) {
        return (String(s.name || "") + " " + String(s.phone || "") + " " + String(s.email || "")).toLowerCase().indexOf(q) !== -1;
      });
    }
    var html = '<div class="sup42-row between" style="margin-bottom:10px">' +
      '<div class="sup42-muted">Πρόσθεσε προμηθευτές και όρισε ποια προϊόντα σου δίνει ο καθένας.</div>' +
      '<div class="sup42-row"><button class="sup42-btn small" id="sup42-export" title="Αντίγραφο">⤓</button>' +
      '<button class="sup42-btn small" id="sup42-import" title="Επαναφορά">⤒</button>' +
      '<button class="sup42-btn dark" id="sup42-add">+ Νέος προμηθευτής</button></div></div>';

    if (db.suppliers.length > 3) {
      html += '<input class="sup42-search" id="sup42-search" placeholder="🔎 Αναζήτηση προμηθευτή..." value="' + esc(search) + '">';
    }

    if (!suppliers.length) {
      html += '<div class="sup42-empty">' + (db.suppliers.length ? "Κανένα αποτέλεσμα." : "Δεν έχεις προμηθευτές ακόμη. Πάτησε «+ Νέος προμηθευτής».") + '</div>';
    } else {
      var stock = loadStock();
      suppliers.forEach(function (s) {
        var contact = [s.phone, s.email].filter(Boolean).join(" · ");
        var pc = (s.products || []).length;
        var needN = computeNeeds(s, stock).length;
        html += '<div class="sup42-card">' +
          '<div class="sup42-row between">' +
          '<div><h3>' + esc(s.name || "Προμηθευτής") + (needN ? ' <span class="tag" style="background:#fee2e2;color:#991b1b">' + needN + ' ελλείψεις</span>' : '') + '</h3>' +
          (contact ? '<div class="sup42-muted">' + esc(contact) + '</div>' : '') +
          '<div class="sup42-muted">Προϊόντα: ' + pc + (s.lastOrder ? ' · Τελ. παραγγελία: ' + esc(s.lastOrder.date) : '') + '</div></div>' +
          '</div>' +
          '<div class="sup42-row" style="margin-top:10px">' +
          '<button class="sup42-btn small" data-prod="' + s.id + '">📦 Προϊόντα & Όρια</button>' +
          '<button class="sup42-btn small" data-edit="' + s.id + '">✏️ Επεξεργασία</button>' +
          '<button class="sup42-btn small danger" data-del="' + s.id + '">🗑️</button>' +
          '</div></div>';
      });
    }
    body.innerHTML = html;

    var sb = body.querySelector("#sup42-search");
    if (sb) sb.oninput = function () { search = sb.value; var pos = sb.selectionStart; renderList(body); var nb = body.querySelector("#sup42-search"); if (nb) { nb.focus(); try { nb.setSelectionRange(pos, pos); } catch (e) {} } };

    body.querySelector("#sup42-add").onclick = function () { editingId = null; screen = "form"; render(); };
    body.querySelector("#sup42-export").onclick = doExport;
    body.querySelector("#sup42-import").onclick = doImport;
    body.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { editingId = b.getAttribute("data-edit"); screen = "form"; render(); }; });
    body.querySelectorAll("[data-prod]").forEach(function (b) { b.onclick = function () { editingId = b.getAttribute("data-prod"); screen = "products"; render(); }; });
    body.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = function () {
        if (!confirm("Διαγραφή προμηθευτή;")) return;
        var id = b.getAttribute("data-del");
        var db2 = loadAll();
        db2.suppliers = db2.suppliers.filter(function (x) { return x.id !== id; });
        if (!Array.isArray(db2.deleted)) db2.deleted = [];
        if (db2.deleted.indexOf(id) === -1) db2.deleted.push(id);
        saveAll(db2); render();
      };
    });
  }

  // ---------------- form ----------------
  function renderForm(body) {
    var db = loadAll();
    var s = db.suppliers.filter(function (x) { return x.id === editingId; })[0] || { id: null, name: "", phone: "", email: "", notes: "" };
    body.innerHTML =
      '<div class="sup42-field"><label>Όνομα προμηθευτή *</label><input id="sup42-name" value="' + esc(s.name) + '"></div>' +
      '<div class="sup42-field"><label>Τηλέφωνο (για WhatsApp)</label><input id="sup42-phone" value="' + esc(s.phone) + '" placeholder="π.χ. 69........"></div>' +
      '<div class="sup42-field"><label>Email</label><input id="sup42-email" value="' + esc(s.email) + '"></div>' +
      '<div class="sup42-field"><label>Σημειώσεις</label><textarea id="sup42-notes">' + esc(s.notes) + '</textarea></div>' +
      '<div class="sup42-row"><button class="sup42-btn dark" id="sup42-save">💾 Αποθήκευση</button>' +
      '<button class="sup42-btn" id="sup42-cancel">Άκυρο</button></div>';
    body.querySelector("#sup42-cancel").onclick = function () { screen = "list"; render(); };
    body.querySelector("#sup42-save").onclick = function () {
      var name = (document.getElementById("sup42-name").value || "").trim();
      if (!name) { alert("Γράψε όνομα προμηθευτή."); return; }
      var db2 = loadAll();
      var rec = db2.suppliers.filter(function (x) { return x.id === editingId; })[0];
      if (!rec) { rec = { id: uid(), products: [] }; db2.suppliers.push(rec); }
      rec.name = name;
      rec.phone = (document.getElementById("sup42-phone").value || "").trim();
      rec.email = (document.getElementById("sup42-email").value || "").trim();
      rec.notes = (document.getElementById("sup42-notes").value || "").trim();
      if (!Array.isArray(rec.products)) rec.products = [];
      rec._ts = Date.now();
      saveAll(db2);
      editingId = rec.id; screen = "products"; render();
    };
  }

  // ---------------- products & limits ----------------
  function renderProducts(body) {
    var db = loadAll();
    var s = db.suppliers.filter(function (x) { return x.id === editingId; })[0];
    if (!s) { screen = "list"; return render(); }
    if (!Array.isArray(s.products)) s.products = [];
    var stock = loadStock();

    var assigned = {};
    var customItems = [];
    s.products.forEach(function (p) {
      if (p.source === "custom") customItems.push(p);
      else assigned[(p.source || "coffin") + "|" + String(p.name).toUpperCase()] = p.target;
    });

    function rowHtml(item, source) {
      var name = String(item.name || "").trim();
      if (!name) return "";
      var key = source + "|" + name.toUpperCase();
      var isOn = assigned.hasOwnProperty(key);
      var tgt = isOn ? assigned[key] : (knowledgeTarget(name) || "");
      var qty = Number(item.qty) || 0;
      return '<div class="sup42-prod">' +
        '<input type="checkbox" data-key="' + esc(key) + '" ' + (isOn ? "checked" : "") + '>' +
        '<span class="nm">' + esc(name) + ' <span class="tag">' + (source === "set" ? "ΣΕΤ" : "Φέρετρο") + '</span> <span class="sup42-muted">(τώρα: ' + qty + ')</span></span>' +
        'όριο <input type="number" min="0" step="1" data-target="' + esc(key) + '" value="' + esc(tgt) + '" placeholder="3">' +
        '</div>';
    }

    var html = '<div class="sup42-row between" style="margin-bottom:8px"><h3 style="margin:0">' + esc(s.name) + '</h3>' +
      '<button class="sup42-btn small" id="sup42-back">← Πίσω</button></div>' +
      '<div class="sup42-muted" style="margin-bottom:10px">Τσέκαρε ποια προϊόντα δίνει ο προμηθευτής και βάλε το <b>όριο</b> (πόσα θες να έχεις πάντα). Π.χ. όριο 3 και αποθήκη 1 → χρειάζεσαι 2.</div>';

    html += '<div class="sup42-card"><h3>Φέρετρα</h3>';
    var anyC = false;
    stock.coffins.forEach(function (it) { var r = rowHtml(it, "coffin"); if (r) { html += r; anyC = true; } });
    if (!anyC) html += '<div class="sup42-empty">Δεν βρέθηκαν φέρετρα στην αποθήκη.</div>';
    html += '</div>';

    html += '<div class="sup42-card"><h3>ΣΕΤ</h3>';
    var anyS = false;
    stock.sets.forEach(function (it) { var r = rowHtml(it, "set"); if (r) { html += r; anyS = true; } });
    if (!anyS) html += '<div class="sup42-empty">Δεν βρέθηκαν ΣΕΤ στην αποθήκη.</div>';
    html += '</div>';

    // custom items
    html += '<div class="sup42-card"><h3>Άλλα είδη (εκτός αποθήκης)</h3>' +
      '<div class="sup42-muted" style="margin-bottom:6px">π.χ. λουλούδια, κεριά, λάδι. Βάζεις όνομα, πόσα έχεις τώρα, και το όριο.</div>' +
      '<div id="sup42-customwrap">';
    customItems.forEach(function (p, i) { html += customRow(p, i); });
    html += '</div><button class="sup42-btn small" id="sup42-addcustom">+ Προσθήκη είδους</button></div>';

    html += '<div class="sup42-row"><button class="sup42-btn dark" id="sup42-saveprod">💾 Αποθήκευση προϊόντων</button></div>';
    body.innerHTML = html;

    body.querySelector("#sup42-back").onclick = function () { screen = "list"; render(); };
    body.querySelector("#sup42-addcustom").onclick = function () {
      var wrap = document.getElementById("sup42-customwrap");
      var div = document.createElement("div");
      div.innerHTML = customRow({ name: "", manualStock: 0, target: "" }, Date.now());
      wrap.appendChild(div.firstChild);
    };
    body.addEventListener("click", function (e) {
      var rm = e.target.closest && e.target.closest("[data-rmcustom]");
      if (rm) { var row = rm.closest(".sup42-prod"); if (row) row.parentNode.removeChild(row); }
    });
    body.querySelector("#sup42-saveprod").onclick = function () {
      var db2 = loadAll();
      var rec = db2.suppliers.filter(function (x) { return x.id === editingId; })[0];
      if (!rec) { screen = "list"; return render(); }
      var products = [];
      body.querySelectorAll("input[type=checkbox][data-key]").forEach(function (cb) {
        if (!cb.checked) return;
        var key = cb.getAttribute("data-key");
        var parts = key.split("|");
        var source = parts[0];
        var ti = body.querySelector('input[data-target="' + cssEsc(key) + '"]');
        var target = ti ? (parseInt(ti.value, 10) || 0) : 0;
        products.push({ name: originalName(source, parts.slice(1).join("|")), source: source, target: target });
      });
      body.querySelectorAll(".sup42-custom").forEach(function (row) {
        var nm = (row.querySelector(".cname").value || "").trim();
        if (!nm) return;
        var cur = parseInt(row.querySelector(".cstock").value, 10) || 0;
        var tgt = parseInt(row.querySelector(".ctarget").value, 10) || 0;
        products.push({ name: nm, source: "custom", manualStock: cur, target: tgt });
      });
      rec.products = products;
      rec._ts = Date.now();
      saveAll(db2);
      alert("Αποθηκεύτηκαν τα προϊόντα. ✅");
      screen = "orders"; render();
    };
  }
  function customRow(p, i) {
    return '<div class="sup42-prod sup42-custom">' +
      '<input type="text" class="cname" placeholder="Όνομα είδους" value="' + esc(p.name) + '">' +
      'έχω <input type="number" class="cstock" min="0" step="1" value="' + esc(p.manualStock != null ? p.manualStock : 0) + '">' +
      'όριο <input type="number" class="ctarget" min="0" step="1" value="' + esc(p.target) + '" placeholder="3">' +
      '<button class="sup42-btn small danger" data-rmcustom="1">✕</button>' +
      '</div>';
  }
  function cssEsc(s) { return String(s).replace(/"/g, '\\"'); }
  function originalName(source, upperName) {
    var stock = loadStock();
    var list = source === "set" ? stock.sets : stock.coffins;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].name || "").trim().toUpperCase() === upperName) return String(list[i].name).trim();
    }
    return upperName;
  }

  // ---------------- orders ----------------
  function buildMessage(supplier, items) {
    var lines = [];
    lines.push("Καλημέρα" + (supplier.name ? " " + supplier.name : "") + ",");
    lines.push("Θα ήθελα να παραγγείλω:");
    items.forEach(function (n) { lines.push("• " + n.name + ": " + n.qty + " τεμ."); });
    lines.push("Ευχαριστώ,");
    lines.push("Τελετές Σταυρακάκη");
    return lines.join("\n");
  }
  function gatherQty(body, idx) {
    var items = [];
    body.querySelectorAll('input[data-qty^="' + idx + '|"]').forEach(function (inp) {
      var qty = parseInt(inp.value, 10) || 0;
      if (qty > 0) items.push({ name: inp.getAttribute("data-name"), qty: qty });
    });
    return items;
  }
  function waLink(phone, text) {
    var d = String(phone || "").replace(/[^0-9]/g, "");
    if (!d) return null;
    if (d.length === 10 && (d[0] === "6" || d[0] === "2")) d = "30" + d; // Ελλάδα
    return "https://wa.me/" + d + "?text=" + encodeURIComponent(text);
  }

  function renderOrders(body) {
    var db = loadAll();
    var stock = loadStock();
    if (!db.suppliers.length) {
      body.innerHTML = '<div class="sup42-empty">Δεν έχεις προμηθευτές ακόμη. Πήγαινε στην καρτέλα «Προμηθευτές».</div>';
      return;
    }
    var total = totalNeeds();
    var nSup = db.suppliers.filter(function (s) { return computeNeeds(s, stock).length > 0; }).length;
    var html = '<div class="sup42-summary">' + (total > 0
      ? '📋 <b>' + total + '</b> είδη χρειάζονται παραγγελία σε <b>' + nSup + '</b> προμηθευτές.'
      : '🎉 Όλα τα αποθέματα είναι στο όριο ή πάνω — καμία παραγγελία τώρα.') + '</div>';

    db.suppliers.slice().sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || ""), "el"); })
      .forEach(function (s, idx) {
        var needs = computeNeeds(s, stock);
        if (!needs.length) return;
        html += '<div class="sup42-card"><div class="sup42-row between"><h3 style="margin:0">' + esc(s.name || "Προμηθευτής") + '</h3>' +
          (s.lastOrder ? '<span class="sup42-muted">Τελ. παραγγελία: ' + esc(s.lastOrder.date) + '</span>' : '') + '</div>';
        html += '<div class="sup42-need">';
        needs.forEach(function (n) {
          html += '<div style="margin:3px 0">• <b>' + esc(n.name) + '</b>: έχεις ' + n.current + ', όριο ' + n.target +
            ' → παράγγειλε <input class="qi" type="number" min="0" step="1" value="' + n.need + '" data-qty="' + idx + '|' + esc(n.name) + '" data-name="' + esc(n.name) + '"> τεμ.</div>';
        });
        html += '</div>';
        html += '<textarea class="sup42-msg" id="sup42-msg-' + idx + '" readonly></textarea>';
        html += '<div class="sup42-row" style="margin-top:8px">' +
          '<button class="sup42-btn dark" data-copy="' + idx + '">📋 Αντιγραφή</button>' +
          (s.phone ? '<button class="sup42-btn wa" data-wa="' + idx + '">📱 WhatsApp</button>' : '') +
          '<button class="sup42-btn small" data-ordered="' + s.id + '|' + idx + '">✅ Παραγγέλθηκε</button>' +
          '</div></div>';
      });
    body.innerHTML = html;

    // αρχικό γέμισμα μηνυμάτων + ζωντανή ανανέωση όταν αλλάζει η ποσότητα
    function refreshMsg(idx) {
      var ta = document.getElementById("sup42-msg-" + idx); if (!ta) return;
      var sup = db.suppliers.slice().sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || ""), "el"); })[idx];
      ta.value = buildMessage(sup, gatherQty(body, idx));
    }
    body.querySelectorAll("input[data-qty]").forEach(function (inp) {
      var idx = inp.getAttribute("data-qty").split("|")[0];
      inp.addEventListener("input", function () { refreshMsg(idx); });
    });
    // initial fill
    var seen = {};
    body.querySelectorAll("input[data-qty]").forEach(function (inp) { var idx = inp.getAttribute("data-qty").split("|")[0]; if (!seen[idx]) { seen[idx] = 1; refreshMsg(idx); } });

    body.querySelectorAll("[data-copy]").forEach(function (b) {
      b.onclick = function () {
        var ta = document.getElementById("sup42-msg-" + b.getAttribute("data-copy"));
        if (!ta) return;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value);
          else { ta.removeAttribute("readonly"); ta.select(); document.execCommand("copy"); ta.setAttribute("readonly", "readonly"); }
          var old = b.textContent; b.textContent = "✓ Αντιγράφηκε"; setTimeout(function () { b.textContent = old; }, 1500);
        } catch (e) { alert("Αντιγραφή απέτυχε — επίλεξε το κείμενο χειροκίνητα."); }
      };
    });
    body.querySelectorAll("[data-wa]").forEach(function (b) {
      b.onclick = function () {
        var idx = b.getAttribute("data-wa");
        var sup = db.suppliers.slice().sort(function (a, b2) { return String(a.name || "").localeCompare(String(b2.name || ""), "el"); })[idx];
        var ta = document.getElementById("sup42-msg-" + idx);
        var link = waLink(sup.phone, ta ? ta.value : "");
        if (link) window.open(link, "_blank"); else alert("Δεν υπάρχει έγκυρο τηλέφωνο.");
      };
    });
    body.querySelectorAll("[data-ordered]").forEach(function (b) {
      b.onclick = function () {
        var parts = b.getAttribute("data-ordered").split("|");
        var sid = parts[0], idx = parts[1];
        var items = gatherQty(body, idx);
        if (!items.length) { alert("Δεν υπάρχει ποσότητα για παραγγελία."); return; }
        if (!confirm("Σήμανση ως παραγγέλθηκε σήμερα;")) return;
        var db2 = loadAll();
        var rec = db2.suppliers.filter(function (x) { return x.id === sid; })[0];
        if (rec) { rec.lastOrder = { date: todayStr(), items: items }; rec._ts = Date.now(); saveAll(db2); render(); }
      };
    });
  }

  // ---------------- backup ----------------
  function doExport() {
    try {
      var data = JSON.stringify(loadAll(), null, 2);
      var blob = new Blob([data], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "promitheutes_staurakaki.json";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } catch (e) { alert("Δεν έγινε εξαγωγή."); }
  }
  function doImport() {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json,.json";
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var d = JSON.parse(r.result);
          if (!d || !Array.isArray(d.suppliers)) throw new Error("bad");
          if (!confirm("Επαναφορά " + d.suppliers.length + " προμηθευτών; (αντικαθιστά τους τωρινούς)")) return;
          saveAll(d); render();
          alert("Έγινε επαναφορά. ✅");
        } catch (e) { alert("Μη έγκυρο αρχείο."); }
      };
      r.readAsText(f);
    };
    inp.click();
  }

  // ---------------- init ----------------
  function init() { injectStyles(); ensureButton(); syncFromCloud(false); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  setTimeout(init, 1200);
})();
