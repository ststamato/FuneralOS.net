/*
 * FuneralOS — freemium.js (English)
 * Auth guard + feature flags for the English version.
 * app.js loads AFTER this file.
 */

(function () {
  "use strict";

  const SUPABASE_URL = "https://jciaozbyvdiqfxwlgdql.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjaWFvemJ5dmRpcWZ4d2xnZHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTE5NjQsImV4cCI6MjA4MDY4Nzk2NH0.eEBYVU1VTU3CZvaSA9fh-LLEbqRPRY9ZpK7P-17kWaA";

  const FREE_CEREMONY_LIMIT = 5;
  const STRIPE_PRO_LINK = "https://funeralos.lemonsqueezy.com/checkout/buy/6cdaa45a-02fe-4a51-b4ae-e51633d3b36d";
  const STRIPE_BUSINESS_LINK = "https://funeralos.lemonsqueezy.com/checkout/buy/3c72881b-2f6b-40be-970c-effe794d8de7";

  const { createClient } = window.supabase;
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  window.__sb = sb;
  window.__authPlan = "free";
  window.__authUser = null;
  window.__authOfficeName = "My Funeral Home";

  // ── Demo Mode ───────────────────────────────────────────────────────────────
  if (new URLSearchParams(location.search).get("demo") === "1") {
    window.__DEMO_MODE = true;
    window.__authPlan = "business";
    window.__authUser = { id: "demo", email: "demo@funeralos.net" };
    window.__authOfficeName = "Demo Office";
    document.addEventListener("DOMContentLoaded", function () {
      const overlay = document.getElementById("authOverlay");
      if (overlay) overlay.style.display = "none";
      const brandPill = document.getElementById("brandPill");
      if (brandPill) brandPill.textContent = "Demo Office";
      const badge = document.getElementById("planBadge");
      if (badge) { badge.textContent = "DEMO"; badge.className = "plan-badge pro"; }
    });
    return;
  }

  // ── Auth Check ────────────────────────────────────────────────────────────
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
      window.__authPlan = isOwner ? "business" : (user.user_metadata?.plan || "free");
      window.__authOfficeName = user.user_metadata?.office_name || user.email || "My Funeral Home";

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

      // Load referral credits FIRST — may upgrade __authPlan before UI/gates
      await loadReferralProfile(user.id);
      applyUserUI(user);
      document.getElementById("authOverlay").style.display = "none";
      installFeatureGates();
    } catch (err) {
      console.error("Auth error:", err);
      const overlay = document.getElementById("authOverlay");
      if (overlay) overlay.innerHTML = '<p style="color:#c8a96e;font-size:14px;">Connection error. <a href="login.html" style="color:#fff;">Sign in →</a></p>';
    }
  }

  // ── Update UI ─────────────────────────────────────────────────────────────
  function applyUserUI(user) {
    const plan = window.__authPlan;
    const officeName = window.__authOfficeName;

    const brandPill = document.getElementById("brandPill");
    if (brandPill) brandPill.textContent = officeName;

    const badge = document.getElementById("planBadge");
    if (badge) { badge.textContent = plan === "business" ? "BUSINESS" : plan === "pro" ? "PRO" : "FREE"; badge.className = "plan-badge " + (plan === "business" ? "pro" : plan); }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.textContent = "Sign out";
      logoutBtn.onclick = async () => { await sb.auth.signOut(); window.location.href = "./login.html"; };
    }
  }

  // ── Feature Gates ─────────────────────────────────────────────────────────
  function installFeatureGates() {
    document.addEventListener("DOMContentLoaded", markLockedFeatures);

    if (window.__authPlan === "business") return;

    // Gate: Hermes AI — Business only
    document.addEventListener("click", function (e) {
      const tab = e.target.closest('[data-tab="hermes"]');
      if (!tab) return;
      if (window.__authPlan !== "business") {
        e.preventDefault(); e.stopImmediatePropagation();
        showUpgradeModal("Hermes AI — Business feature", "Hermes AI is available on the Business plan.\nUpgrade to unlock the Action Center, priorities and office memory.");
      }
    }, true);

    document.addEventListener("click", function (e) {
      const btn = e.target.closest("#aiAssistantBtn");
      if (!btn) return;
      if (window.__authPlan !== "business") {
        e.preventDefault(); e.stopImmediatePropagation();
        showUpgradeModal("AI Assistant — Business feature", "The AI Assistant is available on the Business plan.\nUpgrade for Daily Briefing, Gap Analysis, Cloud AI and full analysis.");
      }
    }, true);

    if (window.__authPlan === "pro") return;

    // Gate: Ceremony limit (free only)
    const ceremonyForm = document.getElementById("ceremonyForm");
    if (ceremonyForm) {
      ceremonyForm.addEventListener("submit", function (e) {
        if (typeof editingId !== "undefined" && editingId !== null) return;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const list = (typeof ceremonies !== "undefined" ? ceremonies : []);
        const monthCount = list.filter(c => c.date && new Date(c.date) >= monthStart).length;
        if (monthCount >= FREE_CEREMONY_LIMIT) {
          e.preventDefault();
          e.stopImmediatePropagation();
          showUpgradeModal(
            "Ceremony limit reached",
            "You've used " + FREE_CEREMONY_LIMIT + " ceremonies this month on the free plan.\nUpgrade to Pro or Business for unlimited ceremonies."
          );
        }
      }, true);
    }
  }

  function markLockedFeatures() {
    const plan = window.__authPlan;
    const isPaid = plan === "pro" || plan === "business";

    if (isPaid) {
      const panel = document.getElementById("optionalFieldsPanel");
      if (panel) { panel.style.display = ""; renderOptFieldsToggles(); }
    }

    if (plan !== "business") {
      setTimeout(function () {
        const hermesTab = document.querySelector('[data-tab="hermes"]');
        if (hermesTab && !hermesTab.querySelector(".pro-lock")) {
          const lock = document.createElement("span");
          lock.className = "pro-lock";
          lock.textContent = "BIZ";
          lock.style.cssText = "margin-left:5px;font-size:9px;font-weight:700;background:#c8a96e;color:#0f1523;padding:1px 5px;border-radius:4px;letter-spacing:.5px;";
          hermesTab.appendChild(lock);
        }
      }, 400);
    }

    if (plan === "free") {
      setTimeout(function () {
        const aiBtn = document.getElementById("aiAssistantBtn");
        if (aiBtn) aiBtn.style.display = "none";

        document.querySelectorAll(".opt-field").forEach(function (el) { el.style.display = "none"; });

        const heroGrid = document.getElementById("homeDashboardGrid");
        if (heroGrid && !document.getElementById("upgradeNudge")) {
          const nudge = document.createElement("div");
          nudge.id = "upgradeNudge";
          nudge.style.cssText = "margin-top:12px;padding:12px 16px;background:rgba(200,169,110,.1);border:1px solid rgba(200,169,110,.25);border-radius:10px;font-size:13px;color:#c8a96e;display:flex;align-items:center;justify-content:space-between;gap:12px;";
          nudge.innerHTML = '<span>🔒 Free plan · <b id="monthCeremonyCount">0</b>/' + FREE_CEREMONY_LIMIT + " ceremonies this month</span>" +
            '<a href="./login.html" style="background:#c8a96e;color:#0f1523;padding:6px 14px;border-radius:7px;font-size:12px;font-weight:700;text-decoration:none;">See plans →</a>';
          heroGrid.after(nudge);
          updateMonthCount();
        }
      }, 600);
    }

    // Referral bonus banner — show when plan was upgraded via credits
    if (window.__referralPlanActive && window.__referralPlanUntil) {
      setTimeout(function () {
        const heroGrid = document.getElementById("homeDashboardGrid");
        if (heroGrid && !document.getElementById("referralBonusBanner")) {
          const untilStr = new Date(window.__referralPlanUntil).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
          const banner = document.createElement("div");
          banner.id = "referralBonusBanner";
          banner.style.cssText = "margin-top:12px;padding:12px 16px;background:rgba(42,157,92,.12);border:1px solid rgba(42,157,92,.35);border-radius:10px;font-size:13px;color:#2a9d5c;display:flex;align-items:center;gap:10px;";
          banner.innerHTML = '<span style="font-size:18px;">🎁</span><span><strong>Free upgrade from referrals!</strong> Your plan has been upgraded at no charge until <strong>' + untilStr + '</strong> thanks to your referrals.</span>';
          heroGrid.after(banner);
        }
      }, 650);
    }
  }

  var OPT_FIELD_LABELS = {
    cremation: "Cremation details",
    secondPerson: "2nd assistant",
    suitcase: "Luggage",
    set: "Burial set",
    flowers: "Flowers / Wreaths",
    announcement: "Obituary status",
    decor: "Decoration",
    pallbearers: "Pallbearers",
    coffee: "Wake / Reception",
    pickupSecond: "2nd pickup person",
    coldRoom: "Cold storage",
    grave: "Grave details"
  };

  var LS_OPT_KEY = "funeralos_en_opt_fields_v1";

  function getOptFieldState() {
    try {
      var raw = localStorage.getItem(LS_OPT_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    // Default: all enabled
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

  // Re-apply visibility whenever the ceremony modal opens
  document.addEventListener("click", function (e) {
    if (e.target.closest("#addCeremonyBtn") || e.target.closest("[data-editid]")) {
      setTimeout(function () {
        const plan = window.__authPlan;
        if (plan === "pro" || plan === "business") applyOptFieldVisibility();
      }, 50);
    }
  });

  function updateMonthCount() {
    const el = document.getElementById("monthCeremonyCount");
    if (!el) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const list = (typeof ceremonies !== "undefined" ? ceremonies : []);
    el.textContent = list.filter(c => c.date && new Date(c.date) >= monthStart).length;
  }

  document.addEventListener("renderAll", updateMonthCount);

  // ── Upgrade Modal ─────────────────────────────────────────────────────────
  function showUpgradeModal(title, text) {
    const modal = document.getElementById("upgradeModal");
    const titleEl = document.getElementById("upgradeTitle");
    const textEl = document.getElementById("upgradeText");
    const btn = document.getElementById("upgradeBtn");
    if (titleEl) titleEl.textContent = title || "Upgrade to Pro";
    if (textEl) textEl.textContent = text || "";
    if (btn) { btn.textContent = "See plans →"; btn.href = "../en/"; }
    if (modal) modal.classList.add("open");
  }

  window.__showUpgrade = showUpgradeModal;
  window.closeUpgradeModal = function () {
    const modal = document.getElementById("upgradeModal");
    if (modal) modal.classList.remove("open");
  };

  document.addEventListener("click", function (e) {
    const modal = document.getElementById("upgradeModal");
    if (modal && e.target === modal) window.closeUpgradeModal();
  });

  // ── Referral System ───────────────────────────────────────────────────────────
  async function loadReferralProfile(userId) {
    try {
      const [profileRes, referralsRes] = await Promise.all([
        sb.from("profiles").select("referral_code, referral_credits, referral_plan_until").eq("id", userId).single(),
        sb.from("referrals").select("id", { count: "exact" }).eq("referrer_id", userId).eq("status", "rewarded")
      ]);
      const code      = profileRes.data?.referral_code     || "";
      const credits   = profileRes.data?.referral_credits  || 0;
      const planUntil = profileRes.data?.referral_plan_until || null;
      const count     = referralsRes.count || 0;

      window.__referralCode       = code;
      window.__referralCredits    = credits;
      window.__referralPlanUntil  = planUntil;
      window.__referralPlanActive = false;

      // Auto-upgrade plan when credit period is still active
      if (planUntil && new Date(planUntil) > new Date() && window.__authPlan !== "business") {
        window.__authPlan = window.__authPlan === "pro" ? "business" : "pro";
        window.__referralPlanActive = true;
      }

      // Populate referral info panel elements (if present in DOM)
      const link = code ? "https://funeralos.net/en/?ref=" + code : "";
      const codeEl  = document.getElementById("referralCodeDisplay");
      const linkEl  = document.getElementById("referralLinkDisplay");
      const countEl = document.getElementById("referralCountDisplay");
      const credEl  = document.getElementById("referralCreditsDisplay");
      if (codeEl)  codeEl.textContent  = code || "---";
      if (linkEl)  linkEl.textContent  = link || "-";
      if (countEl) countEl.textContent = count;
      if (credEl)  credEl.textContent  = credits;

      // Show credit pill next to plan badge
      if (credits > 0) {
        const badge = document.getElementById("planBadge");
        if (badge) {
          const existing = badge.parentElement.querySelector(".referral-credit-pill");
          if (!existing) {
            const untilStr = planUntil
              ? new Date(planUntil).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
              : "";
            const pill = document.createElement("span");
            pill.className = "referral-credit-pill";
            pill.title = credits + " free " + (credits === 1 ? "month" : "months") + " from referrals" + (untilStr ? " · Active until " + untilStr : "");
            pill.style.cssText = "margin-left:6px;font-size:9px;font-weight:700;background:#2a9d5c;color:#fff;padding:2px 6px;border-radius:4px;letter-spacing:.4px;cursor:default;";
            pill.textContent = "🎁 +" + credits + "m";
            badge.after(pill);
          }
        }
      }
    } catch (e) {
      console.error("Referral load error:", e);
    }
  }

  window.copyReferralCode = function () {
    const code = window.__referralCode || "";
    if (!code) return;
    navigator.clipboard.writeText(code).then(function () {
      const el = document.getElementById("referralCodeDisplay");
      const prev = el ? el.textContent : code;
      if (el) el.textContent = "✓ Copied!";
      setTimeout(function () { if (el) el.textContent = prev; }, 1500);
    });
  };

  window.copyReferralLink = function () {
    const code = window.__referralCode || "";
    if (!code) return;
    const link = "https://funeralos.net/en/?ref=" + code;
    navigator.clipboard.writeText(link).then(function () {
      const el = document.getElementById("referralLinkDisplay");
      const prev = el ? el.textContent : link;
      if (el) el.textContent = "✓ Copied!";
      setTimeout(function () { if (el) el.textContent = prev; }, 1500);
    });
  };

  initAuth();
})();
