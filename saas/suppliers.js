/* =========================================================
   Τελετές Σταυρακάκη — V42 Office Organizer: ΠΡΟΜΗΘΕΥΤΕΣ
   ---------------------------------------------------------
   100% ΠΡΟΣΘΕΤΙΚΟ — δεν αγγίζει καθόλου το app.js.
   - Δικό του localStorage key ("staurakaki_suppliers_v42").
   - Διαβάζει (read-only) την αποθήκη φερέτρων/ΣΕΤ για να υπολογίζει ελλείψεις.
   - Δεν στέλνει τίποτα μόνο του: φτιάχνει έτοιμο μήνυμα παραγγελίας με κουμπί
     «Αντιγραφή» και το στέλνεις εσύ.
   Αν θες να το απενεργοποιήσεις: σβήνεις τη γραμμή <script src="suppliers.js">.
   ========================================================= */
(function () {
  "use strict";

  var STORE_KEY = "staurakaki_suppliers_v42";
  var WAREHOUSE_KEY = "staurakaki_warehouse_v8"; // φέρετρα  [{name, qty}]
  var SETS_KEY = "staurakaki_sets_v8";           // ΣΕΤ      [{name, qty}]

  // ---------------- storage ----------------
  function loadAll() {
    try {
      var d = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      if (!d || typeof d !== "object") d = {};
      if (!Array.isArray(d.suppliers)) d.suppliers = [];
      return d;
    } catch (e) { return { suppliers: [] }; }
  }
  function saveAll(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) {} }

  function loadStock() {
    var coffins = [], sets = [];
    try { coffins = JSON.parse(localStorage.getItem(WAREHOUSE_KEY) || "[]"); } catch (e) {}
    try { sets = JSON.parse(localStorage.getItem(SETS_KEY) || "[]"); } catch (e) {}
    return {
      coffins: Array.isArray(coffins) ? coffins : [],
      sets: Array.isArray(sets) ? sets : []
    };
  }
  function stockQty(stock, source, name) {
    var list = source === "set" ? stock.sets : stock.coffins;
    var n = String(name || "").trim().toUpperCase();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].name || "").trim().toUpperCase() === n) return Number(list[i].qty) || 0;
    }
    return 0;
  }

  function uid() { return "s" + Date.now() + Math.floor(Math.random() * 1000); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ---------------- styles ----------------
  function injectStyles() {
    if (document.getElementById("sup42-style")) return;
    var st = document.createElement("style");
    st.id = "sup42-style";
    st.textContent = [
      ".sup42-overlay{position:fixed;inset:0;background:rgba(17,24,39,.55);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow:auto}",
      ".sup42-overlay.sup42-hidden{display:none}",
      ".sup42-modal{background:#f6f0e7;color:#1f2430;width:100%;max-width:680px;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.35);padding:16px 16px 22px;margin:auto}",
      ".sup42-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}",
      ".sup42-head h2{font-size:18px;margin:0}",
      ".sup42-x{border:none;background:#111827;color:#fff;border-radius:999px;width:34px;height:34px;font-size:16px;cursor:pointer}",
      ".sup42-tabs{display:flex;gap:8px;margin:8px 0 14px;flex-wrap:wrap}",
      ".sup42-tab{border:none;border-radius:999px;padding:8px 14px;font-weight:800;font-size:13px;cursor:pointer;background:#e5e7eb;color:#1f2430}",
      ".sup42-tab.active{background:#111827;color:#fff}",
      ".sup42-btn{border:none;border-radius:999px;padding:9px 14px;font-weight:800;font-size:13px;cursor:pointer;background:#e3d7c5;color:#1f2430}",
      ".sup42-btn.dark{background:#111827;color:#fff}",
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
      ".sup42-prod{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed #eee}",
      ".sup42-prod:last-child{border-bottom:none}",
      ".sup42-prod .nm{flex:1;font-size:13px}",
      ".sup42-prod .tag{font-size:11px;color:#6b7280;background:#f3f4f6;border-radius:999px;padding:1px 7px}",
      ".sup42-prod input[type=number]{width:64px;border:1px solid #d1d5db;border-radius:8px;padding:5px 6px;font-size:13px}",
      ".sup42-need{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px;margin-top:8px}",
      ".sup42-msg{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:10px;padding:8px;font-size:13px;font-family:inherit;min-height:96px;margin-top:8px}",
      ".sup42-empty{color:#6b7280;font-size:13px;padding:10px 0}",
      "#sup42-openBtn{margin-left:10px;border:none;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:800;cursor:pointer;background:#e3d7c5;color:#1f2430}"
    ].join("");
    document.head.appendChild(st);
  }

  // ---------------- launcher button ----------------
  function ensureButton() {
    if (document.getElementById("sup42-openBtn")) return;
    var btn = document.createElement("button");
    btn.id = "sup42-openBtn";
    btn.type = "button";
    btn.textContent = "🏪 Προμηθευτές";
    btn.onclick = openModal;
    var topBar = document.querySelector(".top-bar");
    if (topBar) { topBar.appendChild(btn); }
    else {
      btn.style.position = "fixed";
      btn.style.right = "14px";
      btn.style.bottom = "14px";
      btn.style.zIndex = "99998";
      document.body.appendChild(btn);
    }
  }

  // ---------------- modal state ----------------
  var screen = "list"; // list | form | products | orders
  var editingId = null;

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
      '    <button class="sup42-tab" data-view="orders">Προτάσεις Παραγγελιών</button>' +
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
    injectStyles();
    ensureModal();
    screen = "list"; editingId = null;
    document.getElementById("sup42-overlay").classList.remove("sup42-hidden");
    render();
  }
  function closeModal() {
    var ov = document.getElementById("sup42-overlay");
    if (ov) ov.classList.add("sup42-hidden");
  }

  // ---------------- rendering ----------------
  function setActiveTab() {
    var tabKey = (screen === "orders") ? "orders" : "list";
    document.querySelectorAll("#sup42-overlay .sup42-tab").forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-view") === tabKey);
    });
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

  function renderList(body) {
    var db = loadAll();
    var html = '<div class="sup42-row between" style="margin-bottom:12px">' +
      '<div class="sup42-muted">Πρόσθεσε προμηθευτές και όρισε ποια προϊόντα σου δίνει ο καθένας.</div>' +
      '<button class="sup42-btn dark" id="sup42-add">+ Νέος προμηθευτής</button></div>';

    if (!db.suppliers.length) {
      html += '<div class="sup42-empty">Δεν έχεις προμηθευτές ακόμη. Πάτησε «+ Νέος προμηθευτής».</div>';
    } else {
      db.suppliers.forEach(function (s) {
        var contact = [s.phone, s.email].filter(Boolean).join(" · ");
        var pc = (s.products || []).length;
        html += '<div class="sup42-card">' +
          '<div class="sup42-row between">' +
          '<div><h3>' + esc(s.name || "Προμηθευτής") + '</h3>' +
          (contact ? '<div class="sup42-muted">' + esc(contact) + '</div>' : '') +
          '<div class="sup42-muted">Προϊόντα: ' + pc + '</div></div>' +
          '</div>' +
          '<div class="sup42-row" style="margin-top:10px">' +
          '<button class="sup42-btn small" data-prod="' + s.id + '">📦 Προϊόντα & Όρια</button>' +
          '<button class="sup42-btn small" data-edit="' + s.id + '">✏️ Επεξεργασία</button>' +
          '<button class="sup42-btn small danger" data-del="' + s.id + '">🗑️ Διαγραφή</button>' +
          '</div></div>';
      });
    }
    body.innerHTML = html;

    body.querySelector("#sup42-add").onclick = function () { editingId = null; screen = "form"; render(); };
    body.querySelectorAll("[data-edit]").forEach(function (b) {
      b.onclick = function () { editingId = b.getAttribute("data-edit"); screen = "form"; render(); };
    });
    body.querySelectorAll("[data-prod]").forEach(function (b) {
      b.onclick = function () { editingId = b.getAttribute("data-prod"); screen = "products"; render(); };
    });
    body.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = function () {
        if (!confirm("Διαγραφή προμηθευτή;")) return;
        var db2 = loadAll();
        db2.suppliers = db2.suppliers.filter(function (x) { return x.id !== b.getAttribute("data-del"); });
        saveAll(db2); render();
      };
    });
  }

  function renderForm(body) {
    var db = loadAll();
    var s = db.suppliers.filter(function (x) { return x.id === editingId; })[0] ||
      { id: null, name: "", phone: "", email: "", notes: "" };
    body.innerHTML =
      '<div class="sup42-field"><label>Όνομα προμηθευτή *</label><input id="sup42-name" value="' + esc(s.name) + '"></div>' +
      '<div class="sup42-field"><label>Τηλέφωνο</label><input id="sup42-phone" value="' + esc(s.phone) + '"></div>' +
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
      saveAll(db2);
      editingId = rec.id;
      screen = "products"; // πάμε κατευθείαν να ορίσει προϊόντα/όρια
      render();
    };
  }

  function renderProducts(body) {
    var db = loadAll();
    var s = db.suppliers.filter(function (x) { return x.id === editingId; })[0];
    if (!s) { screen = "list"; return render(); }
    if (!Array.isArray(s.products)) s.products = [];
    var stock = loadStock();

    // Χάρτης ήδη ανατεθειμένων (source|name -> target)
    var assigned = {};
    s.products.forEach(function (p) { assigned[(p.source || "coffin") + "|" + String(p.name).toUpperCase()] = p.target; });

    function rowHtml(item, source) {
      var name = String(item.name || "").trim();
      if (!name) return "";
      var key = source + "|" + name.toUpperCase();
      var isOn = assigned.hasOwnProperty(key);
      var tgt = isOn ? assigned[key] : "";
      var qty = Number(item.qty) || 0;
      return '<div class="sup42-prod">' +
        '<input type="checkbox" data-key="' + esc(key) + '" ' + (isOn ? "checked" : "") + '>' +
        '<span class="nm">' + esc(name) + ' <span class="tag">' + (source === "set" ? "ΣΕΤ" : "Φέρετρο") + '</span> <span class="sup42-muted">(τώρα: ' + qty + ')</span></span>' +
        'όριο <input type="number" min="0" step="1" data-target="' + esc(key) + '" value="' + esc(tgt) + '" placeholder="π.χ. 3">' +
        '</div>';
    }

    var html = '<div class="sup42-row between" style="margin-bottom:8px"><h3 style="margin:0">' + esc(s.name) + '</h3>' +
      '<button class="sup42-btn small" id="sup42-back">← Πίσω</button></div>' +
      '<div class="sup42-muted" style="margin-bottom:10px">Τσέκαρε ποια προϊόντα δίνει ο προμηθευτής και βάλε το <b>όριο</b> (πόσα θες να έχεις πάντα). Π.χ. όριο 3 και στην αποθήκη 1 → χρειάζεσαι 2.</div>';

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

    html += '<div class="sup42-row"><button class="sup42-btn dark" id="sup42-saveprod">💾 Αποθήκευση προϊόντων</button></div>';
    body.innerHTML = html;

    body.querySelector("#sup42-back").onclick = function () { screen = "list"; render(); };
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
        var ti = body.querySelector('input[data-target="' + key.replace(/"/g, '\\"') + '"]');
        var target = ti ? (parseInt(ti.value, 10) || 0) : 0;
        // βρες το αρχικό όνομα (όχι uppercase) από το stock
        var nameUpper = parts.slice(1).join("|");
        products.push({ name: originalName(source, nameUpper), source: source, target: target });
      });
      rec.products = products;
      saveAll(db2);
      alert("Αποθηκεύτηκαν τα προϊόντα του προμηθευτή. ✅");
      screen = "orders"; render();
    };
  }

  function originalName(source, upperName) {
    var stock = loadStock();
    var list = source === "set" ? stock.sets : stock.coffins;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].name || "").trim().toUpperCase() === upperName) return String(list[i].name).trim();
    }
    return upperName;
  }

  function computeNeeds(supplier, stock) {
    var needs = [];
    (supplier.products || []).forEach(function (p) {
      var target = Number(p.target) || 0;
      if (target <= 0) return;
      var current = stockQty(stock, p.source, p.name);
      var need = target - current;
      if (need > 0) needs.push({ name: p.name, source: p.source, current: current, target: target, need: need });
    });
    return needs;
  }

  function buildMessage(supplier, needs) {
    var lines = [];
    lines.push("Καλημέρα" + (supplier.name ? " " + supplier.name : "") + ",");
    lines.push("Θα ήθελα να παραγγείλω:");
    needs.forEach(function (n) { lines.push("• " + n.name + ": " + n.need + " τεμ."); });
    lines.push("Ευχαριστώ,");
    lines.push("Τελετές Σταυρακάκη");
    return lines.join("\n");
  }

  function renderOrders(body) {
    var db = loadAll();
    var stock = loadStock();
    if (!db.suppliers.length) {
      body.innerHTML = '<div class="sup42-empty">Δεν έχεις προμηθευτές ακόμη. Πήγαινε στην καρτέλα «Προμηθευτές».</div>';
      return;
    }
    var html = '<div class="sup42-muted" style="margin-bottom:10px">Σύγκριση αποθήκης με τα όρια. Όπου το απόθεμα είναι κάτω από το όριο, βγαίνει πρόταση παραγγελίας.</div>';
    var anyNeed = false;

    db.suppliers.forEach(function (s, idx) {
      var needs = computeNeeds(s, stock);
      html += '<div class="sup42-card"><div class="sup42-row between"><h3 style="margin:0">' + esc(s.name || "Προμηθευτής") + '</h3>' +
        (s.phone ? '<span class="sup42-muted">' + esc(s.phone) + '</span>' : '') + '</div>';
      if (!needs.length) {
        html += '<div class="sup42-muted" style="margin-top:6px">✓ Όλα τα προϊόντα είναι στο όριο ή πάνω — δεν χρειάζεται παραγγελία.</div>';
      } else {
        anyNeed = true;
        html += '<div class="sup42-need">';
        needs.forEach(function (n) {
          html += '<div>• <b>' + esc(n.name) + '</b>: έχεις ' + n.current + ', όριο ' + n.target + ' → <b>παράγγειλε ' + n.need + ' τεμ.</b></div>';
        });
        html += '</div>';
        var msg = buildMessage(s, needs);
        html += '<textarea class="sup42-msg" id="sup42-msg-' + idx + '" readonly>' + esc(msg) + '</textarea>';
        html += '<div class="sup42-row" style="margin-top:8px"><button class="sup42-btn dark" data-copy="' + idx + '">📋 Αντιγραφή μηνύματος</button></div>';
      }
      html += '</div>';
    });

    if (!anyNeed) {
      html += '<div class="sup42-empty">🎉 Όλα τα αποθέματα είναι εντάξει — καμία παραγγελία αυτή τη στιγμή.</div>';
    }
    body.innerHTML = html;

    body.querySelectorAll("[data-copy]").forEach(function (b) {
      b.onclick = function () {
        var ta = document.getElementById("sup42-msg-" + b.getAttribute("data-copy"));
        if (!ta) return;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value);
          else { ta.removeAttribute("readonly"); ta.select(); document.execCommand("copy"); ta.setAttribute("readonly", "readonly"); }
          var old = b.textContent; b.textContent = "✓ Αντιγράφηκε";
          setTimeout(function () { b.textContent = old; }, 1500);
        } catch (e) { alert("Αντιγραφή απέτυχε — επίλεξε το κείμενο χειροκίνητα."); }
      };
    });
  }

  // ---------------- init ----------------
  function init() { injectStyles(); ensureButton(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  // δεύτερη προσπάθεια σε περίπτωση που η top-bar φτιάχνεται αργότερα
  setTimeout(init, 1200);
})();
