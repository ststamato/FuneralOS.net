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

  // ── Feature Gates (installed after auth confirmed) ──────────────────────────
  function installFeatureGates() {
    if (window.__authPlan === "pro") return; // Pro has no limits

    // Gate 1: Ceremony limit on form submit (capture phase = runs before app.js handler)
    const ceremonyForm = document.getElementById("ceremonyForm");
    if (ceremonyForm) {
      ceremonyForm.addEventListener("submit", function (e) {
        // Only block NEW ceremonies (editingId === null in app.js global scope)
        if (typeof editingId !== "undefined" && editingId !== null) return;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // ceremonies is the global array from app.js
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
      }, true); // capture = true → runs before app.js listener
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

    // Visual indicator on locked features (after app is fully loaded)
    document.addEventListener("DOMContentLoaded", function () {
      markLockedFeatures();
    });
  }

  function markLockedFeatures() {
    if (window.__authPlan === "pro") return;

    // Add PRO lock badge on Hermes tab button
    setTimeout(function () {
      const hermesTab = document.querySelector('[data-tab="hermes"]');
      if (hermesTab && !hermesTab.querySelector(".pro-lock")) {
        const lock = document.createElement("span");
        lock.className = "pro-lock";
        lock.textContent = "PRO";
        lock.style.cssText = "margin-left:5px;font-size:9px;font-weight:700;background:#c8a96e;color:#0f1523;padding:1px 5px;border-radius:4px;letter-spacing:.5px;";
        hermesTab.appendChild(lock);
      }

      // Add upgrade nudge in hero area
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
