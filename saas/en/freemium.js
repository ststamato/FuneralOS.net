/*
 * FuneralOS — freemium.js (English)
 * Auth guard + feature flags for the English version.
 * app.js loads AFTER this file.
 */

(function () {
  "use strict";

  const SUPABASE_URL = "https://rqklpnrgpiprttzsploe.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxa2xwbnJncGlwcnR0enNwbG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMzA2NTgsImV4cCI6MjA5ODYwNjY1OH0.L9kumMt04wy0rlEfE79AwvGD8C2YWAyr_CIh9dDlBZQ";

  const FREE_CEREMONY_LIMIT = 5;

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
    window.__authOfficeName = "Staurakakis — Demo";
    document.addEventListener("DOMContentLoaded", function () {
      const overlay = document.getElementById("authOverlay");
      if (overlay) overlay.style.display = "none";
      const brandPill = document.getElementById("brandPill");
      if (brandPill) brandPill.textContent = "Staurakakis FH";
      const badge = document.getElementById("planBadge");
      if (badge) { badge.textContent = "DEMO"; badge.className = "plan-badge pro"; }
      // Highlight correct plan tier
      const tiers = document.getElementById("planTiers");
      if (tiers) tiers.querySelectorAll("[data-tier]").forEach(function(t) {
        t.classList.toggle("active", t.dataset.tier === "business");
      });
      // Demo notification bar
      const bar = document.createElement("div");
      bar.id = "__demo_bar";
      bar.style.cssText = "position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#0f1523;border-top:2px solid rgba(200,169,110,.35);padding:11px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;box-shadow:0 -4px 24px rgba(0,0,0,.5);";
      bar.innerHTML = '<span style="color:rgba(255,255,255,.7);">🔍 <b style="color:#c8a96e;">Demo mode</b> — fictional data, nothing is saved.</span>'
        + '<div style="display:flex;gap:10px;align-items:center;">'
        + '<a href="../login.html?tab=register" style="background:linear-gradient(135deg,#c8a96e,#d4b97e);color:#0f1523;padding:8px 18px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none;white-space:nowrap;letter-spacing:.3px;">Start free →</a>'
        + '<button onclick="document.getElementById(\'__demo_bar\').style.display=\'none\'" style="background:transparent;border:none;color:rgba(255,255,255,.35);cursor:pointer;font-size:20px;padding:0 4px;line-height:1;" title="Close">×</button>'
        + '</div>';
      document.body.appendChild(bar);
      // Business plan features visible in demo
      var usaBtn = document.getElementById("usaNavBtn");
      if (usaBtn) usaBtn.style.display = "";
      var usaSettings = document.getElementById("usaSettingsPanel");
      if (usaSettings) { usaSettings.style.display = ""; if (typeof window.usaRenderSettings === "function") window.usaRenderSettings(); }
      var layoutPanel = document.getElementById("optionalFieldsPanel");
      if (layoutPanel) layoutPanel.style.display = "";
      renderBillingPanel();
      initTimezoneSelector();
      if (typeof renderTrashPanel === "function") renderTrashPanel();
      renderTeamPanel();
      applyRoleRestrictions();
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
      const OWNER_EMAILS = ["ststamato@gmail.com", "funeralos.net@gmail.com"];
      const isOwner = OWNER_EMAILS.includes(user.email);
      window.__authPlan = isOwner ? "business" : (user.user_metadata?.plan || "free");
      // Owner: apply plan override from sessionStorage (for testing)
      if (isOwner) {
        const override = sessionStorage.getItem("__fos_plan_override");
        if (override) window.__authPlan = override;
        const adminLink = document.getElementById("ownerAdminLink");
        if (adminLink) adminLink.style.display = "";

        const switcher = document.getElementById("ownerPlanSwitcher");
        if (switcher) {
          switcher.style.display = "";
          const btns = switcher.querySelectorAll("[data-plan]");
          btns.forEach(function(b) {
            b.style.fontWeight = b.dataset.plan === window.__authPlan ? "900" : "400";
            b.style.background = b.dataset.plan === window.__authPlan ? "#c8a96e" : "rgba(200,169,110,.1)";
            b.style.color = b.dataset.plan === window.__authPlan ? "#0f1523" : "#c8a96e";
          });
        }
      }
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

    // Plan tiers indicator (FREE / PRO / BUSINESS, active one highlighted green)
    const tiers = document.getElementById("planTiers");
    if (tiers) {
      tiers.querySelectorAll("[data-tier]").forEach(function (t) {
        t.classList.toggle("active", t.dataset.tier === plan);
      });
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.textContent = "Sign out";
      logoutBtn.onclick = async () => { await sb.auth.signOut(); window.location.href = "./login.html"; };
    }
  }

  // ── Feature Gates ─────────────────────────────────────────────────────────
  function installFeatureGates() {
    // installFeatureGates runs after async auth checks, so DOMContentLoaded
    // has almost certainly already fired by now — call directly instead of
    // waiting on an event that will never come.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", markLockedFeatures);
    } else {
      markLockedFeatures();
    }

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

  function initTimezoneSelector() {
    const sel = document.getElementById("usaTimezoneSelect");
    if (!sel || !window.__usaGetTz) return;
    sel.value = window.__usaGetTz();
    function updateClock() {
      const clockEl = document.getElementById("tzCurrentTime");
      if (!clockEl || !window.__usaGetTz) return;
      const tz = window.__usaGetTz();
      const now = new Date().toLocaleTimeString("en-US", {timeZone: tz, hour:"2-digit", minute:"2-digit", hour12:true});
      clockEl.textContent = "Current time: " + now;
    }
    updateClock();
    setInterval(updateClock, 30000);
  }

  function renderBillingPanel() {
    const body = document.getElementById("billingPanelBody");
    if (!body) return;
    const plan = window.__authPlan || "free";
    const planLabel = { free: "Free", pro: "Pro", business: "Business" }[plan] || plan;
    const planColor = plan === "free" ? "#6b7a99" : "#c8a96e";

    if (plan === "free") {
      body.innerHTML =
        '<p style="font-size:13px;color:#6b7a99;margin-bottom:16px;">You are on the <strong style="color:#fff;">Free</strong> plan — up to 5 cases.</p>' +
        '<a href="https://funeralos.lemonsqueezy.com/checkout/buy/6a2ae60d-2bb0-48e7-acdd-0795f57089be" target="_blank" id="billingBtnPro" style="display:block;padding:12px 18px;background:#c8a96e;color:#0f1523;border-radius:9px;font-weight:800;font-size:14px;text-decoration:none;text-align:center;margin-bottom:8px;">⭐ Upgrade to Pro — $99/month</a>' +
        '<a href="https://funeralos.lemonsqueezy.com/checkout/buy/8c690de9-aa0d-4b4f-b2c9-6f72a4d262ac" target="_blank" id="billingBtnBiz" style="display:block;padding:12px 18px;background:linear-gradient(135deg,#c8a96e,#a07840);color:#0f1523;border-radius:9px;font-weight:800;font-size:14px;text-decoration:none;text-align:center;">🚀 Upgrade to Business — $199/month</a>';
      // Inject user_id into upgrade links
      const user = window.__authUser;
      if (user && user.id) {
        ["billingBtnPro", "billingBtnBiz"].forEach(function(id) {
          const a = document.getElementById(id);
          if (a) {
            const u = new URL(a.href);
            u.searchParams.set("checkout[custom][user_id]", user.id);
            if (user.email) u.searchParams.set("checkout[email]", user.email);
            a.href = u.toString();
          }
        });
      }
    } else {
      body.innerHTML =
        '<p style="font-size:13px;color:#6b7a99;margin-bottom:16px;">You are on the <strong style="color:' + planColor + ';">' + planLabel + '</strong> plan.</p>' +
        '<a href="https://app.lemonsqueezy.com/my-orders" target="_blank" rel="noopener" style="display:inline-block;padding:10px 20px;background:rgba(200,169,110,.1);color:#c8a96e;border:1px solid rgba(200,169,110,.3);border-radius:9px;font-weight:700;font-size:13px;text-decoration:none;">Manage billing / Cancel subscription →</a>' +
        '<p style="font-size:11px;color:#556677;margin-top:10px;">You\'ll be redirected to the Lemon Squeezy customer portal. Find your order by the email address used at checkout.</p>';
    }
  }

  function markLockedFeatures() {
    const plan = window.__authPlan;
    const isPaid = plan === "pro" || plan === "business";

    renderBillingPanel();
    initTimezoneSelector();
    if (typeof renderTrashPanel === "function") renderTrashPanel();
    renderTeamPanel();
    handlePendingInvite();
    applyRoleRestrictions();

    if (isPaid) {
      const panel = document.getElementById("optionalFieldsPanel");
      if (panel) { panel.style.display = ""; renderFormLayoutPanel(); }
      const usaBtn = document.getElementById("usaNavBtn");
      if (usaBtn) usaBtn.style.display = "";
      const usaSettings = document.getElementById("usaSettingsPanel");
      if (usaSettings) { usaSettings.style.display = ""; if (typeof window.usaRenderSettings === "function") window.usaRenderSettings(); }
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
            '<a href="javascript:void(0)" onclick="window.__showUpgrade && window.__showUpgrade(\'Upgrade your plan\',\'\')" style="background:#c8a96e;color:#0f1523;padding:6px 14px;border-radius:7px;font-size:12px;font-weight:700;text-decoration:none;cursor:pointer;">See plans →</a>';
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

  // ── Form Layout System (order + visibility) ────────────────────────────────
  var FORM_FIELD_DEFS = [
    { key: "name",         label: "Decedent full name",      required: true },
    { key: "pickupDate",   label: "Date of death",           required: true },
    { key: "burialType",   label: "Disposition",             required: false },
    { key: "cremation",    label: "Cremation details",       required: false },
    { key: "placeOfDeath", label: "Place of death",          required: false },
    { key: "caller",       label: "Caller / Next of kin",    required: false },
    { key: "service",      label: "Service date & time",     required: false },
    { key: "servicePlace", label: "Service location",        required: false },
    { key: "embalmer",     label: "Embalmer",                required: false },
    { key: "responsible",  label: "Assigned director",       required: false },
    { key: "notes",        label: "Notes",                   required: false },
  ];

  var LS_LAYOUT_KEY = "funeralos_en_form_layout_v2";

  function getFormLayoutState() {
    try {
      var raw = localStorage.getItem(LS_LAYOUT_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { order: FORM_FIELD_DEFS.map(function (d) { return d.key; }), hidden: {} };
  }

  function saveFormLayoutState(state) {
    try { localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function applyFormLayout() {
    var form = document.getElementById("ceremonyForm");
    if (!form) return;
    var state = getFormLayoutState();
    var hidden = state.hidden || {};
    form.querySelectorAll("[data-field-key]").forEach(function (el) {
      var key = el.getAttribute("data-field-key");
      var def = FORM_FIELD_DEFS.find(function (d) { return d.key === key; });
      if (def && !def.required && hidden[key] === true) {
        el.style.display = "none";
      } else {
        el.style.display = "";
      }
    });
  }

  function renderFormLayoutPanel() {
    var container = document.getElementById("optFieldsToggleList");
    if (!container) return;
    var state = getFormLayoutState();
    var order = state.order || FORM_FIELD_DEFS.map(function (d) { return d.key; });
    var hidden = state.hidden || {};
    FORM_FIELD_DEFS.forEach(function (def) {
      if (order.indexOf(def.key) === -1) order.push(def.key);
    });
    container.innerHTML = "";
    container.style.cssText = "display:flex;flex-direction:column;gap:0;padding:4px 0;";
    order.forEach(function (key, idx) {
      var def = FORM_FIELD_DEFS.find(function (d) { return d.key === key; });
      if (!def) return;
      var isHidden = !def.required && hidden[key] === true;
      var row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);";

      var btnUp = document.createElement("button");
      btnUp.type = "button"; btnUp.textContent = "↑";
      btnUp.style.cssText = "background:none;border:1px solid rgba(255,255,255,.2);color:#c8daf0;border-radius:4px;width:26px;height:26px;cursor:pointer;font-size:13px;padding:0;flex-shrink:0;" + (idx === 0 ? "opacity:.25;pointer-events:none;" : "");

      var btnDown = document.createElement("button");
      btnDown.type = "button"; btnDown.textContent = "↓";
      btnDown.style.cssText = "background:none;border:1px solid rgba(255,255,255,.2);color:#c8daf0;border-radius:4px;width:26px;height:26px;cursor:pointer;font-size:13px;padding:0;flex-shrink:0;" + (idx === order.length - 1 ? "opacity:.25;pointer-events:none;" : "");

      var labelEl = document.createElement("span");
      labelEl.textContent = def.label;
      labelEl.style.cssText = "font-size:13px;color:" + (isHidden ? "#4a5a70" : "#c8daf0") + ";flex:1;";

      btnUp.addEventListener("click", function () {
        var s = getFormLayoutState();
        var i = s.order.indexOf(key);
        if (i > 0) { s.order.splice(i, 1); s.order.splice(i - 1, 0, key); saveFormLayoutState(s); renderFormLayoutPanel(); }
      });
      btnDown.addEventListener("click", function () {
        var s = getFormLayoutState();
        var i = s.order.indexOf(key);
        if (i < s.order.length - 1) { s.order.splice(i, 1); s.order.splice(i + 1, 0, key); saveFormLayoutState(s); renderFormLayoutPanel(); }
      });

      row.appendChild(btnUp);
      row.appendChild(btnDown);
      row.appendChild(labelEl);

      if (def.required) {
        var badge = document.createElement("span");
        badge.textContent = "required";
        badge.style.cssText = "font-size:10px;background:rgba(200,169,110,.15);color:#c8a96e;border-radius:4px;padding:2px 6px;flex-shrink:0;";
        row.appendChild(badge);
      } else {
        var toggle = document.createElement("label");
        toggle.style.cssText = "position:relative;display:inline-block;width:36px;height:20px;cursor:pointer;flex-shrink:0;";
        var input = document.createElement("input");
        input.type = "checkbox"; input.checked = !isHidden;
        input.style.cssText = "opacity:0;width:0;height:0;";
        var slider = document.createElement("span");
        slider.style.cssText = "position:absolute;inset:0;background:" + (!isHidden ? "#c8a96e" : "#2a3350") + ";border-radius:20px;transition:.2s;";
        var knob = document.createElement("span");
        knob.style.cssText = "position:absolute;top:3px;left:" + (!isHidden ? "19px" : "3px") + ";width:14px;height:14px;background:#fff;border-radius:50%;transition:.2s;";
        slider.appendChild(knob);
        toggle.appendChild(input); toggle.appendChild(slider);
        input.addEventListener("change", function () {
          var s = getFormLayoutState();
          if (!s.hidden) s.hidden = {};
          s.hidden[key] = !input.checked;
          saveFormLayoutState(s);
          slider.style.background = input.checked ? "#c8a96e" : "#2a3350";
          knob.style.left = input.checked ? "19px" : "3px";
          labelEl.style.color = input.checked ? "#c8daf0" : "#4a5a70";
          applyFormLayout();
        });
        row.appendChild(toggle);
      }
      container.appendChild(row);
    });
  }

  // Re-apply layout whenever ceremony modal opens
  document.addEventListener("click", function (e) {
    if (e.target.closest("#addCeremonyBtn") || e.target.closest("[data-editid]")) {
      setTimeout(function () {
        var plan = window.__authPlan;
        if (plan === "pro" || plan === "business") applyFormLayout();
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
  function buildCheckoutUrl(baseUrl) {
    const user = window.__authUser;
    if (!user || !user.id) return baseUrl;
    const u = new URL(baseUrl);
    u.searchParams.set("checkout[custom][user_id]", user.id);
    if (user.email) u.searchParams.set("checkout[email]", user.email);
    return u.toString();
  }

  function showUpgradeModal(title, text) {
    const modal = document.getElementById("upgradeModal");
    const titleEl = document.getElementById("upgradeTitle");
    const textEl = document.getElementById("upgradeText");
    if (titleEl) titleEl.textContent = title || "Upgrade your plan";
    if (textEl) textEl.textContent = text || "";
    // Inject user_id into checkout links so the webhook can identify the user
    const btnPro = document.getElementById("upgradeBtnPro");
    const btnBiz = document.getElementById("upgradeBtnBiz");
    if (btnPro) btnPro.href = buildCheckoutUrl(btnPro.href.split("?")[0]);
    if (btnBiz) btnBiz.href = buildCheckoutUrl(btnBiz.href.split("?")[0]);
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
      let code      = profileRes.data?.referral_code     || "";
      const credits   = profileRes.data?.referral_credits  || 0;
      const planUntil = profileRes.data?.referral_plan_until || null;
      const count     = referralsRes.count || 0;

      // Auto-create profile row if trigger didn't fire on signup
      if (!code) {
        const autoCode = userId.toLowerCase().replace(/-/g, "").slice(0, 8);
        await sb.from("profiles").upsert({ id: userId, referral_code: autoCode }, { onConflict: "id" });
        code = autoCode;
      }

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

  // ── Directors management (Settings panel) ────────────────────────────────────
  var DIRECTORS_KEY = "funeralos_en_directors_v1";

  function getDirectors() {
    try { return JSON.parse(localStorage.getItem(DIRECTORS_KEY) || "[]"); } catch (e) { return []; }
  }

  function saveDirectors(list) {
    try { localStorage.setItem(DIRECTORS_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function renderDirectorsList() {
    var box = document.getElementById("directorsList");
    if (!box) return;
    var list = getDirectors();
    if (!list.length) {
      box.innerHTML = '<p style="font-size:13px;color:#5a6a80;margin:0;">No directors added yet. Use the field below to add.</p>';
      return;
    }
    box.innerHTML = list.map(function (name, i) {
      return '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:8px;">' +
        '<span style="flex:1;font-size:14px;color:#c8daf0;">' + name + '</span>' +
        '<button data-dir-del="' + i + '" style="background:none;border:none;color:#e05a5a;cursor:pointer;font-size:18px;line-height:1;padding:0 4px;">✕</button>' +
        '</div>';
    }).join("");
  }

  window.addDirectorEntry = function () {
    var input = document.getElementById("directorNameInput");
    var name = (input ? input.value : "").trim();
    if (!name) return;
    var list = getDirectors();
    list.push(name);
    saveDirectors(list);
    if (input) input.value = "";
    renderDirectorsList();
  };

  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && document.activeElement && document.activeElement.id === "directorNameInput") {
      window.addDirectorEntry();
    }
  });

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-dir-del]");
    if (!btn) return;
    var list = getDirectors();
    list.splice(Number(btn.dataset.dirDel), 1);
    saveDirectors(list);
    renderDirectorsList();
  });

  document.addEventListener("DOMContentLoaded", renderDirectorsList);

  // ── Admin plan switcher (owner only) ─────────────────────────────────────────
  window.ownerSwitchPlan = function (plan) {
    if (plan === "business") {
      sessionStorage.removeItem("__fos_plan_override");
    } else {
      sessionStorage.setItem("__fos_plan_override", plan);
    }
    location.reload();
  };

  // ── Team / Multi-user ─────────────────────────────────────────────────────────

  async function callEdgeFunction(path, body, token) {
    const res = await fetch(SUPABASE_URL + "/functions/v1/" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
        "apikey": SUPABASE_KEY,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  const PRO_TEAM_LIMIT = 5;

  // Send a team invite
  window.sendTeamInvite = async function () {
    const plan  = window.__authPlan || "free";
    const emailEl = document.getElementById("inviteEmail");
    const roleEl  = document.getElementById("inviteRole");
    const msgEl   = document.getElementById("teamInviteMsg");
    if (!emailEl || !msgEl) return;

    if (plan === "free") {
      showUpgradeModal("Team Members — Pro feature", "Invite up to " + PRO_TEAM_LIMIT + " team members on Pro, or unlimited on Business.");
      return;
    }

    const email = emailEl.value.trim();
    const role  = roleEl ? roleEl.value : "editor";
    if (!email) { msgEl.style.color = "#e07070"; msgEl.textContent = "Enter an email address first."; return; }

    msgEl.style.color = "#aabb88";
    msgEl.textContent = "Sending…";

    const { data: { session } } = await sb.auth.getSession();
    if (!session) { msgEl.style.color = "#e07070"; msgEl.textContent = "Not logged in."; return; }

    // Pro plan: enforce 5-member limit before calling Edge Function
    if (plan === "pro") {
      const officeId = (session.user.user_metadata || {}).office_id || session.user.id;
      const countRes = await fetch(
        SUPABASE_URL + "/rest/v1/office_members?office_id=eq." + officeId + "&select=user_id",
        { headers: { Authorization: "Bearer " + session.access_token, apikey: SUPABASE_KEY } }
      );
      const current = countRes.ok ? await countRes.json() : [];
      if (current.length >= PRO_TEAM_LIMIT) {
        msgEl.style.color = "#e07070";
        msgEl.textContent = "Pro limit reached (" + PRO_TEAM_LIMIT + " members). Upgrade to Business for unlimited.";
        return;
      }
    }

    const result = await callEdgeFunction("team-invite", { email, role }, session.access_token);
    if (result.ok) {
      msgEl.style.color = "#66cc88";
      msgEl.textContent = "Invitation sent to " + email + ".";
      emailEl.value = "";
      renderTeamPanel();
    } else {
      msgEl.style.color = "#e07070";
      msgEl.textContent = result.data?.error || result.data?.message || "Failed to send invite.";
    }
  };

  // Fetch and render team members list
  async function renderTeamPanel() {
    const listEl = document.getElementById("teamMembersList");
    const formEl = document.getElementById("teamInviteForm");
    const msgEl  = document.getElementById("teamInviteMsg");
    if (!listEl) return;

    const plan = window.__authPlan || "free";

    // Free users: show upgrade prompt instead of team panel
    if (plan === "free") {
      if (formEl) formEl.style.display = "none";
      listEl.innerHTML =
        '<div style="padding:14px;background:rgba(200,169,110,.08);border:1px solid rgba(200,169,110,.2);border-radius:8px;text-align:center;">'
        + '<p style="font-size:13px;color:#c8a96e;margin:0 0 10px;font-weight:600;">Team collaboration — Pro &amp; Business</p>'
        + '<p style="font-size:12px;color:#8899aa;margin:0 0 12px;">Invite up to ' + PRO_TEAM_LIMIT + ' colleagues on Pro, or unlimited on Business.</p>'
        + '<a href="javascript:void(0)" onclick="window.__showUpgrade && window.__showUpgrade(\'Team Members\',\'Invite up to ' + PRO_TEAM_LIMIT + ' team members on Pro, or unlimited on Business.\')" style="display:inline-block;background:#c8a96e;color:#0f1523;padding:7px 18px;border-radius:7px;font-size:12px;font-weight:700;text-decoration:none;cursor:pointer;">See plans →</a>'
        + '</div>';
      return;
    }

    const role = window.__currentRole || "admin";

    const { data: { session } } = await sb.auth.getSession().catch(() => ({ data: {} }));
    if (!session) return;
    const token = session.access_token;

    // Fetch office members via Supabase REST (RLS: members can see each other)
    const officeId = (session.user.user_metadata || {}).office_id || session.user.id;
    const res = await fetch(
      SUPABASE_URL + "/rest/v1/office_members?office_id=eq." + officeId + "&select=user_id,role,joined_at",
      { headers: { Authorization: "Bearer " + token, apikey: SUPABASE_KEY } }
    );
    if (!res.ok) {
      listEl.innerHTML = '<p style="font-size:12px;color:#8899aa;">Could not load team members.</p>';
      return;
    }
    const members = await res.json();

    const atProLimit = plan === "pro" && members.length >= PRO_TEAM_LIMIT;

    // Show/hide invite form
    if (formEl) formEl.style.display = (role === "admin" && !atProLimit) ? "" : "none";

    // Pro counter below invite form
    if (msgEl && plan === "pro" && role === "admin") {
      msgEl.style.color = atProLimit ? "#e07070" : "#8899aa";
      msgEl.textContent = members.length + "/" + PRO_TEAM_LIMIT + " team members"
        + (atProLimit ? " · Upgrade to Business for unlimited." : "");
    }

    if (!members.length) {
      listEl.innerHTML = '<p style="font-size:12px;color:#8899aa;">No team members yet. Invite a colleague above.</p>';
      return;
    }
    listEl.innerHTML = members.map(function (m) {
      const joined = m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "—";
      const isSelf = m.user_id === session.user.id;
      const roleLabel = m.role === "admin" ? '<span style="color:#c8a96e;font-weight:700;">Admin</span>' : '<span style="color:#8899aa;">Editor</span>';
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.07);">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:13px;color:#c8daf0;">' + m.user_id + (isSelf ? ' <span style="font-size:10px;color:#8899aa;">(you)</span>' : '') + '</div>'
        + '<div style="font-size:11px;color:#8899aa;">' + roleLabel + ' · Joined ' + joined + '</div>'
        + '</div>'
        + (role === "admin" && !isSelf ? '<button onclick="removeTeamMember(\'' + m.user_id + '\')" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(220,80,80,.4);background:transparent;color:#e07070;font-size:11px;cursor:pointer;">Remove</button>' : '')
        + '</div>';
    }).join("");
  }

  // Remove a team member (admin only, server-side via service role — use Edge Function pattern)
  window.removeTeamMember = async function (userId) {
    if (!confirm("Remove this team member? They will lose access to the shared office data.")) return;
    const { data: { session } } = await sb.auth.getSession().catch(() => ({ data: {} }));
    if (!session) return;
    const officeId = (session.user.user_metadata || {}).office_id || session.user.id;
    // Admins can delete from office_members directly (RLS: office_id = auth.uid())
    const res = await fetch(
      SUPABASE_URL + "/rest/v1/office_members?office_id=eq." + officeId + "&user_id=eq." + userId,
      { method: "DELETE", headers: { Authorization: "Bearer " + session.access_token, apikey: SUPABASE_KEY, Prefer: "return=minimal" } }
    );
    if (res.ok) renderTeamPanel();
    else alert("Failed to remove member.");
  };

  // Handle pending invite token (set by app.js on ?invite=TOKEN load)
  async function handlePendingInvite() {
    const token = window.__pendingInviteToken;
    if (!token) return;
    delete window.__pendingInviteToken;

    // Wait for auth session
    const { data: { session } } = await sb.auth.getSession().catch(() => ({ data: {} }));
    if (!session) {
      // Not logged in — redirect to login with intent
      const loginUrl = "login.html?invite=" + encodeURIComponent(token);
      location.replace(loginUrl);
      return;
    }

    const result = await callEdgeFunction("accept-invite", { token }, session.access_token);
    if (result.ok) {
      // Refresh session so new metadata (office_id, role) is applied
      await sb.auth.refreshSession();
      location.replace(location.pathname); // strip ?invite= from URL
    } else {
      const msg = result.data?.message || result.data?.error || "Invalid or expired invitation.";
      alert("Could not accept invitation: " + msg);
    }
  }

  // Apply role-based UI restrictions for editors
  function applyRoleRestrictions() {
    const role = window.__currentRole || "admin";
    if (role === "editor") {
      // Hide settings tab
      var settingsTab = document.querySelector('[data-tab="settings"]');
      if (settingsTab) settingsTab.style.display = "none";
      // Add "Editor" badge to nav
      var nav = document.querySelector(".tab-nav") || document.querySelector("nav");
      if (nav && !document.getElementById("editorRoleBadge")) {
        var badge = document.createElement("span");
        badge.id = "editorRoleBadge";
        badge.style.cssText = "font-size:10px;font-weight:700;background:rgba(200,169,110,.15);color:#c8a96e;border:1px solid rgba(200,169,110,.3);padding:2px 8px;border-radius:10px;margin-left:8px;align-self:center;";
        badge.textContent = "Editor";
        nav.appendChild(badge);
      }
    }
  }

  initAuth();
})();
