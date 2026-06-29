(function () {
  "use strict";

  var STORE_KEY = "funeralos_en_suppliers_v1";

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      return Array.isArray(d) ? d : [];
    } catch (e) { return []; }
  }

  function save(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function uid() { return "sup_" + Date.now() + "_" + Math.floor(Math.random() * 1000); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ── Render list ──────────────────────────────────────────────────────────────
  function render() {
    var list = load();
    var container = document.getElementById("suppliersList");
    if (!container) return;

    if (!list.length) {
      container.innerHTML = '<p class="warehouse-hint" style="padding:10px 0;color:#6b7a99;">No suppliers yet. Add your first one above.</p>';
      return;
    }

    container.innerHTML = list.map(function (s) {
      return [
        '<div class="supplier-card" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px 14px;margin-bottom:10px;">',
        '  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">',
        '    <div style="flex:1;">',
        '      <div style="font-size:14px;font-weight:700;color:#c8daf0;margin-bottom:3px;">' + esc(s.name) + '</div>',
        s.contact ? '<div style="font-size:12px;color:#6b7a99;margin-bottom:4px;">📞 ' + esc(s.contact) + '</div>' : '',
        s.materials ? '<div style="font-size:12px;color:#6b7a99;">📦 ' + esc(s.materials) + '</div>' : '',
        '    </div>',
        '    <div style="display:flex;gap:6px;flex-shrink:0;">',
        '      <button class="sup-edit-btn" data-id="' + esc(s.id) + '" style="border:none;background:rgba(200,169,110,.15);color:#c8a96e;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;">Edit</button>',
        '      <button class="sup-del-btn" data-id="' + esc(s.id) + '" style="border:none;background:rgba(239,68,68,.12);color:#f87171;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;">Delete</button>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join("");
    }).join("");

    container.querySelectorAll(".sup-edit-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { openForm(btn.getAttribute("data-id")); });
    });
    container.querySelectorAll(".sup-del-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { deleteSupplier(btn.getAttribute("data-id")); });
    });
  }

  // ── Form (inline) ────────────────────────────────────────────────────────────
  function openForm(editId) {
    var list = load();
    var existing = editId ? (list.find(function (s) { return s.id === editId; }) || {}) : {};

    var overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99990;display:flex;align-items:center;justify-content:center;padding:20px;";

    var box = document.createElement("div");
    box.style.cssText = "background:#1e2a42;border:1px solid rgba(200,169,110,.25);border-radius:14px;padding:28px 24px;max-width:420px;width:100%;";
    box.innerHTML = [
      '<h3 style="font-size:16px;font-weight:800;color:#fff;margin-bottom:18px;">' + (editId ? 'Edit supplier' : 'New supplier') + '</h3>',
      '<label style="display:block;font-size:12px;font-weight:700;color:#6b7a99;margin-bottom:4px;">Supplier name *</label>',
      '<input id="supName" type="text" value="' + esc(existing.name || "") + '" placeholder="e.g. Smith Coffin Co." style="width:100%;padding:9px 12px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#0f1523;color:#fff;font-size:14px;margin-bottom:14px;box-sizing:border-box;" />',
      '<label style="display:block;font-size:12px;font-weight:700;color:#6b7a99;margin-bottom:4px;">Phone / Email</label>',
      '<input id="supContact" type="text" value="' + esc(existing.contact || "") + '" placeholder="e.g. 07700 900000 or info@supplier.com" style="width:100%;padding:9px 12px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#0f1523;color:#fff;font-size:14px;margin-bottom:14px;box-sizing:border-box;" />',
      '<label style="display:block;font-size:12px;font-weight:700;color:#6b7a99;margin-bottom:4px;">Materials / Products supplied</label>',
      '<textarea id="supMaterials" placeholder="e.g. Oak coffins, white cotton shrouds, floral wreaths" rows="3" style="width:100%;padding:9px 12px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#0f1523;color:#fff;font-size:14px;margin-bottom:20px;box-sizing:border-box;resize:vertical;font-family:inherit;">' + esc(existing.materials || "") + '</textarea>',
      '<div style="display:flex;gap:10px;justify-content:flex-end;">',
      '  <button id="supCancelBtn" style="border:1px solid rgba(255,255,255,.15);background:transparent;color:#6b7a99;border-radius:8px;padding:9px 18px;font-size:13px;cursor:pointer;">Cancel</button>',
      '  <button id="supSaveBtn" style="border:none;background:#c8a96e;color:#0f1523;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:800;cursor:pointer;">Save</button>',
      '</div>'
    ].join("");

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    box.querySelector("#supCancelBtn").addEventListener("click", function () { overlay.remove(); });
    box.querySelector("#supSaveBtn").addEventListener("click", function () {
      var name = box.querySelector("#supName").value.trim();
      if (!name) { box.querySelector("#supName").focus(); return; }
      var contact = box.querySelector("#supContact").value.trim();
      var materials = box.querySelector("#supMaterials").value.trim();
      var updated = load();
      if (editId) {
        var idx = updated.findIndex(function (s) { return s.id === editId; });
        if (idx !== -1) updated[idx] = { id: editId, name: name, contact: contact, materials: materials };
      } else {
        updated.push({ id: uid(), name: name, contact: contact, materials: materials });
      }
      save(updated);
      overlay.remove();
      render();
    });

    setTimeout(function () { box.querySelector("#supName").focus(); }, 50);
  }

  function deleteSupplier(id) {
    if (!confirm("Delete this supplier?")) return;
    var list = load().filter(function (s) { return s.id !== id; });
    save(list);
    render();
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    var addBtn = document.getElementById("addSupplierBtn");
    if (addBtn) addBtn.addEventListener("click", function () { openForm(null); });
    render();

    // Re-render when warehouse tab is shown
    document.addEventListener("click", function (e) {
      var tab = e.target.closest('[data-tab="warehouse"]');
      if (tab) setTimeout(render, 100);
    });
  });

})();
