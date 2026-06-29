/*
 * FuneralOS — freemium.js
 * Τρέχει ΠΡΙΝ το app.js.
 * 1) Auth guard: αν δεν υπάρχει session → login.html
 * 2) Αν υπάρχει session → αφαιρεί overlay, ορίζει globals, ενημερώνει UI
 * 3) Ceremony limit: free plan ≤ 5 τελετές/μήνα
 * 4) Hermes / AI lock για free plan
 * 5) Logout
 */

(function () {
  "use strict";

  const SUPABASE_URL = "https://jciaozbyvdiqfxwlgdql.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjaWFvemJ5dmRpcWZ4d2xnZHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTE5NjQsImV4cCI6MjA4MDY4Nzk2NH0.eEBYVU1VTU3CZvaSA9fh-LLEbqRPRY9ZpK7P-17kWaA";

  const FREE_CEREMONY_LIMIT = 5;
  // Replace with your actual Stripe Payment Link after setup
  const STRIPE_PRO_LINK = "https://buy.stripe.com/PLACEHOLDER";

  // Create Supabase client (window.supabase comes from CDN loaded before this file)
  const { createClient } = window.supabase;
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Expose auth instance globally so app.js can use it if needed
  window.__sb = sb;
  window.__authPlan = "free";
  window.__authUser = null;
  window.__authOfficeName = "Γραφείο";

  // ── Auth Check ──────────────────────────────────────────────────────────────
  async function initAuth() {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        window.location.href = "./login.html";
        return;
      }

      const user = session.user;
      window.__authUser = user;
      const OWNER_EMAILS = ["ststamato@gmail.com"];
      const isOwner = OWNER_EMAILS.includes(user.email);
      window.__authPlan = isOwner ? "pro" : (user.user_metadata?.plan || "free");
      window.__authOfficeName = user.user_metadata?.office_name || user.email || "Γραφείο";

      // Clear localStorage if a different user logs in on the same device
      const storedId = localStorage.getItem("__funeralos_uid");
      if (storedId && storedId !== user.id) {
        ["staurakaki_ceremonies_v8","staurakaki_warehouse_v8","staurakaki_sets_v8",
         "staurakaki_changes_v8","staurakaki_option_warehouse_v2","staurakaki_custom_fields_v36",
         "staurakaki_ai_seen_notes_v1","staurakaki_ai_seen_alerts_v1",
         "staurakaki_ai_chat_history_v1","staurakaki_second_helpers_v1",
         "staurakaki_push_sub_v1","staurakaki_backup_v8"
        ].forEach(k => localStorage.removeItem(k));
      }
      localStorage.setItem("__funeralos_uid", user.id);

      applyUserUI(user);
      document.getElementById("authOverlay").style.display = "none";
      installFeatureGates();

    } catch (err) {
      console.error("Auth error:", err);
      // On unexpected error, show overlay message rather than redirect loop
      const overlay = document.getElementById("authOverlay");
      if (overlay) {
        overlay.innerHTML = '<p style="color:#c8a96e;font-size:14px;">Σφάλμα σύνδεσης. <a href="login.html" style="color:#fff;">Σύνδεση →</a></p>';
      }
    }
  }

  // ── Update UI with user info ────────────────────────────────────────────────
  function applyUserUI(user) {
    const plan = window.__authPlan;
    const officeName = window.__authOfficeName;

    // Brand pill → office name
    const brandPill = document.getElementById("brandPill");
    if (brandPill) brandPill.textContent = officeName;

    // Plan badge
    const badge = document.getElementById("planBadge");
    if (badge) {
      badge.textContent = plan === "pro" ? "PRO" : "FREE";
      badge.className = "plan-badge " + plan;
    }

    // Logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await sb.auth.signOut();
        window.location.href = "./login.html";
      };
    }
  }

  // ── Optional fields system ──────────────────────────────────────────────────
  var OPT_FIELD_LABELS = {
    cremation: "Αποτέφρωση (λεπτομέρειες)",
    secondPerson: "2ο άτομο βοήθειας",
    suitcase: "Βαλίτσα",
    set: "ΣΕΤ",
    flowers: "Στεφάνια / Λουλούδια",
    announcement: "Αγγελτήριο",
    decor: "Στολισμός",
    pallbearers: "Φραγκοφόροι",
    coffee: "Καφές",
    pickupSecond: "2ο άτομο παραλαβής",
    coldRoom: "Ψυκτικός θάλαμος",
    grave: "Τόπος ταφής"
  };

  var LS_OPT_KEY = "funeralos_gr_opt_fields_v1";

  function getOptFieldState() {
    try {
      var raw = localStorage.getItem(LS_OPT_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    var defaults = {};
    Object.keys(OPT_FIELD_LABELS).forEach(function (k) { defaults[k] = true; });
    return defaults;
  }

  function saveOptFieldState(state) {
    try { localStorage.setItem(LS_OPT_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function applyOptFieldVisibility() {
    var state = getOptFieldState();
    document.querySelectorAll(".opt-field[data-opt]").forEach(function (el) {
      var key = el.getAttribute("data-opt");
      el.style.display = (state[key] === false) ? "none" : "";
    });
  }

  function renderOptFieldsToggles() {
    var container = document.getElementById("optFieldsToggleList");
    if (!container) return;
    var state = getOptFieldState();
    container.innerHTML = "";
    container.style.cssText = "display:flex;flex-direction:column;gap:8px;padding:4px 0;";
    Object.keys(OPT_FIELD_LABELS).forEach(function (key) {
      var enabled = state[key] !== false;
      var row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);";
      var label = document.createElement("span");
      label.textContent = OPT_FIELD_LABELS[key];
      label.style.cssText = "font-size:13px;color:#c8daf0;";
      var toggle = document.createElement("label");
      toggle.style.cssText = "position:relative;display:inline-block;width:36px;height:20px;cursor:pointer;";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.checked = enabled;
      input.style.cssText = "opacity:0;width:0;height:0;";
      var slider = document.createElement("span");
      slider.style.cssText = "position:absolute;inset:0;background:" + (enabled ? "#c8a96e" : "#2a3350") + ";border-radius:20px;transition:.2s;";
      var knob = document.createElement("span");
      knob.style.cssText = "position:absolute;top:3px;left:" + (enabled ? "19px" : "3px") + ";width:14px;height:14px;background:#fff;border-radius:50%;transition:.2s;";
      slider.appendChild(knob);
      toggle.appendChild(input);
      toggle.appendChild(slider);
      input.addEventListener("change", function () {
        var s = getOptFieldState();
        s[key] = input.checked;
        saveOptFieldState(s);
        slider.style.background = input.checked ? "#c8a96e" : "#2a3350";
        knob.style.left = input.checked ? "19px" : "3px";
        applyOptFieldVisibility();
      });
      row.appendChild(label);
      row.appendChild(toggle);
      container.appendChild(row);
    });
  }

  // Re-apply visibility whenever ceremony modal opens
  document.addEventListener("click", function (e) {
    if (e.target.closest("#addCeremonyBtn") || e.target.closest("#newCeremonyBtn") ||
        e.target.closest("#newCeremonyHeroBtn") || e.target.closest("[data-editid]")) {
      setTimeout(function () {
        if (window.__authPlan === "pro") applyOptFieldVisibility();
      }, 50);
    }
  });

  // ── Feature Gates (installed after auth confirmed) ──────────────────────────
  function installFeatureGates() {
    // Always wire up markLockedFeatures (handles both free and pro)
    document.addEventListener("DOMContentLoaded", markLockedFeatures);

    if (window.__authPlan === "pro") return;

    // Gate 1: Ceremony limit
    const ceremonyForm = document.getElementById("ceremonyForm");
    if (ceremonyForm) {
      ceremonyForm.addEventListener("submit", function (e) {
        if (typeof editingId !== "undefined" && editingId !== null) return;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const list = (typeof ceremonies !== "undefined" ? ceremonies : []);
        const monthCount = list.filter(function (c) {
          if (!c.date) return false;
          return new Date(c.date) >= monthStart;
        }).length;
        if (monthCount >= FREE_CEREMONY_LIMIT) {
          e.preventDefault();
          e.stopImmediatePropagation();
          showUpgradeModal(
            "Όριο τελετών",
            "Έχεις φτάσει τις " + FREE_CEREMONY_LIMIT + " τελετές αυτό τον μήνα για το δωρεάν πλάνο.\nΑναβάθμισε σε Pro για απεριόριστες τελετές."
          );
        }
      }, true);
    }

    // Gate 2: Hermes tab lock
    document.addEventListener("click", function (e) {
      const tab = e.target.closest('[data-tab="hermes"]');
      if (!tab) return;
      if (window.__authPlan !== "pro") {
        e.preventDefault();
        e.stopImmediatePropagation();
        showUpgradeModal(
          "Hermes AI — Pro",
          "Ο Hermes AI είναι διαθέσιμος μόνο στο Pro πλάνο.\nΑναβάθμισε για να αποκτήσεις πρόσβαση στο Action Center, τις προτεραιότητες και τη μνήμη γραφείου."
        );
      }
    }, true);

    // Gate 3: AI Assistant button lock
    document.addEventListener("click", function (e) {
      const btn = e.target.closest("#aiAssistantBtn");
      if (!btn) return;
      if (window.__authPlan !== "pro") {
        e.preventDefault();
        e.stopImmediatePropagation();
        showUpgradeModal(
          "AI Βοηθός — Pro",
          "Ο AI Βοηθός είναι διαθέσιμος μόνο στο Pro πλάνο.\nΑναβάθμισε για πρόσβαση σε Briefing, Ελλείψεις, Cloud AI και πλήρη έλεγχο."
        );
      }
    }, true);
  }

  function markLockedFeatures() {
    if (window.__authPlan === "pro") {
      const panel = document.getElementById("optionalFieldsPanel");
      if (panel) {
        panel.style.display = "";
        renderOptFieldsToggles();
      }
      return;
    }

    setTimeout(function () {
      // Hide all optional ceremony form fields
      document.querySelectorAll(".opt-field").forEach(function (el) {
        el.style.display = "none";
      });

      const hermesTab = document.querySelector('[data-tab="hermes"]');
      if (hermesTab && !hermesTab.querySelector(".pro-lock")) {
        const lock = document.createElement("span");
        lock.className = "pro-lock";
        lock.textContent = "PRO";
        lock.style.cssText = "margin-left:5px;font-size:9px;font-weight:700;background:#c8a96e;color:#0f1523;padding:1px 5px;border-radius:4px;letter-spacing:.5px;";
        hermesTab.appendChild(lock);
      }

      const heroGrid = document.getElementById("homeDashboardGrid");
      if (heroGrid && !document.getElementById("upgradeNudge")) {
        const nudge = document.createElement("div");
        nudge.id = "upgradeNudge";
        nudge.style.cssText = "margin-top:12px;padding:12px 16px;background:rgba(200,169,110,.1);border:1px solid rgba(200,169,110,.25);border-radius:10px;font-size:13px;color:#c8a96e;display:flex;align-items:center;justify-content:space-between;gap:12px;";
        nudge.innerHTML = '<span>🔒 Δωρεάν πλάνο · <b id="monthCeremonyCount">0</b>/' + FREE_CEREMONY_LIMIT + " τελετές αυτό τον μήνα</span>" +
          '<button onclick="window.__showUpgrade(\'Αναβάθμιση\',\'Αναβάθμισε για απεριόριστες τελετές, AI Hermes και Cloud sync.\')" style="background:#c8a96e;color:#0f1523;border:none;padding:6px 14px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;">Αναβάθμιση Pro →</button>';
        heroGrid.after(nudge);
        updateMonthCount();
      }
    }, 600);
  }

  function updateMonthCount() {
    const el = document.getElementById("monthCeremonyCount");
    if (!el) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const list = (typeof ceremonies !== "undefined" ? ceremonies : []);
    const count = list.filter(function (c) {
      return c.date && new Date(c.date) >= monthStart;
    }).length;
    el.textContent = count;
  }

  // Refresh count whenever page re-renders
  document.addEventListener("renderAll", updateMonthCount);

  // ── Upgrade Modal ────────────────────────────────────────────────────────────
  function showUpgradeModal(title, text) {
    const modal = document.getElementById("upgradeModal");
    const titleEl = document.getElementById("upgradeTitle");
    const textEl = document.getElementById("upgradeText");
    const btn = document.getElementById("upgradeBtn");
    if (titleEl) titleEl.textContent = title || "Αναβάθμιση σε Pro";
    if (textEl) textEl.textContent = text || "";
    if (btn) btn.href = STRIPE_PRO_LINK;
    if (modal) modal.classList.add("open");
  }

  window.__showUpgrade = showUpgradeModal;
  window.closeUpgradeModal = function () {
    const modal = document.getElementById("upgradeModal");
    if (modal) modal.classList.remove("open");
  };

  // Close modal on backdrop click
  document.addEventListener("click", function (e) {
    const modal = document.getElementById("upgradeModal");
    if (modal && e.target === modal) window.closeUpgradeModal();
  });

  // ── Kick off ─────────────────────────────────────────────────────────────────
  initAuth();

})();
