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

  const SUPABASE_URL = "https://rqklpnrgpiprttzsploe.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxa2xwbnJncGlwcnR0enNwbG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMzA2NTgsImV4cCI6MjA5ODYwNjY1OH0.L9kumMt04wy0rlEfE79AwvGD8C2YWAyr_CIh9dDlBZQ";

  const FREE_CEREMONY_LIMIT = 5;

  // Every localStorage key that holds one office's data — cleared on account
  // switch and on explicit sign-out so a shared/kiosk device never leaks one
  // office's cases into the next login.
  const OFFICE_LOCAL_STORAGE_KEYS = [
    "staurakaki_ceremonies_v8", "staurakaki_warehouse_v8", "staurakaki_sets_v8",
    "staurakaki_changes_v8", "staurakaki_option_warehouse_v2", "staurakaki_custom_fields_v36",
    "staurakaki_ai_seen_notes_v1", "staurakaki_ai_seen_alerts_v1",
    "staurakaki_ai_chat_history_v1", "staurakaki_second_helpers_v1",
    "staurakaki_push_sub_v1", "staurakaki_backup_v8",
  ];
  function clearOfficeLocalData() {
    OFFICE_LOCAL_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
  }
  const STRIPE_PRO_LINK = "https://funeralos.lemonsqueezy.com/checkout/buy/6cdaa45a-02fe-4a51-b4ae-e51633d3b36d";
  const STRIPE_BUSINESS_LINK = "https://funeralos.lemonsqueezy.com/checkout/buy/3c72881b-2f6b-40be-970c-effe794d8de7";

  const { createClient } = window.supabase;
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  window.__sb = sb;
  window.__authPlan = "free";
  window.__authUser = null;
  window.__authOfficeName = "Γραφείο";

  // ── Demo Mode ───────────────────────────────────────────────────────────────
  if (new URLSearchParams(location.search).get("demo") === "1") {
    window.__DEMO_MODE = true;
    window.__authPlan = "business";
    window.__authUser = { id: "demo", email: "demo@funeralos.net" };
    window.__authOfficeName = "Σταυρακάκη — Demo";
    document.addEventListener("DOMContentLoaded", function () {
      const overlay = document.getElementById("authOverlay");
      if (overlay) overlay.style.display = "none";
      const brandPill = document.getElementById("brandPill");
      if (brandPill) brandPill.textContent = "Σταυρακάκη";
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
      bar.innerHTML = '<span style="color:rgba(255,255,255,.7);">🔍 <b style="color:#c8a96e;">Demo mode</b> — δοκιμαστικά δεδομένα, χωρίς αποθήκευση.</span>'
        + '<div style="display:flex;gap:10px;align-items:center;">'
        + '<a href="/gr/login?tab=register" style="background:linear-gradient(135deg,#c8a96e,#d4b97e);color:#0f1523;padding:8px 18px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none;white-space:nowrap;letter-spacing:.3px;">Ξεκίνα δωρεάν →</a>'
        + '<button onclick="document.getElementById(\'__demo_bar\').style.display=\'none\'" style="background:transparent;border:none;color:rgba(255,255,255,.35);cursor:pointer;font-size:20px;padding:0 4px;line-height:1;" title="Κλείσιμο">×</button>'
        + '</div>';
      document.body.appendChild(bar);
    });
    return; // skip auth + gates
  }

  // ── Auth Check ──────────────────────────────────────────────────────────────
  async function initAuth() {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        await sb.auth.signOut();
        window.location.href = "/login.html";
        return;
      }

      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        await sb.auth.signOut();
        window.location.href = "/login.html?cleared=1";
        return;
      }
      window.__authUser = user;
      const OWNER_EMAILS = ["ststamato@gmail.com", "funeralos.net@gmail.com"];
      const isOwner = OWNER_EMAILS.includes(user.email);
      // Read plan from app_metadata (server-only, cannot be self-written by client).
      // Fallback to user_metadata for accounts upgraded before this change.
      window.__authPlan = isOwner ? "business" : (user.app_metadata?.plan || user.user_metadata?.plan || "free");
      // Owner: apply plan override from sessionStorage (for testing)
      if (isOwner) {
        const override = sessionStorage.getItem("__fos_plan_override");
        if (override) window.__authPlan = override;
        // Show admin switcher panel
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
      window.__authOfficeName = user.user_metadata?.office_name || user.email || "Γραφείο";

      // Clear localStorage if a different user logs in on the same device
      const storedId = localStorage.getItem("__funeralos_uid");
      if (storedId && storedId !== user.id) {
        clearOfficeLocalData();
      }
      localStorage.setItem("__funeralos_uid", user.id);

      // Load referral credits FIRST — may upgrade __authPlan before UI/gates
      await loadReferralProfile(user.id);
      applyUserUI(user);
      document.getElementById("authOverlay").style.display = "none";
      installFeatureGates();

    } catch (err) {
      console.error("Auth error:", err);
      // On unexpected error, show overlay message rather than redirect loop
      const overlay = document.getElementById("authOverlay");
      if (overlay) {
        overlay.innerHTML = '<p style="color:#c8a96e;font-size:14px;">Σφάλμα σύνδεσης. <a href="/gr/login" style="color:#fff;">Σύνδεση →</a></p>';
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
      badge.textContent = plan === "business" ? "BUSINESS" : plan === "pro" ? "PRO" : "FREE";
      badge.className = "plan-badge " + (plan === "business" ? "pro" : plan);
    }

    // Plan tiers indicator (FREE / PRO / BUSINESS, active one highlighted green)
    const tiers = document.getElementById("planTiers");
    if (tiers) {
      tiers.querySelectorAll("[data-tier]").forEach(function (t) {
        t.classList.toggle("active", t.dataset.tier === plan);
      });
    }

    // Logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await sb.auth.signOut();
        clearOfficeLocalData();
        window.location.href = "/login.html";
      };
    }
  }

  // ── Form Layout System (order + visibility) ────────────────────────────────
  var FORM_FIELD_DEFS = [
    { key: "datetime",     label: "Ημερομηνία & Ώρα",            required: true },
    { key: "name",         label: "Όνομα θανόντα",               required: true },
    { key: "place",        label: "Τοποθεσία τελετής",           required: false },
    { key: "burialType",   label: "Τρόπος (Ταφή / Αποτεφρωση)", required: false },
    { key: "cremation",    label: "Αποτέφρωση (λεπτομέρειες)",  required: false },
    { key: "responsible",  label: "Υπεύθυνος τελετής",           required: false },
    { key: "secondPerson", label: "2ο άτομο βοήθειας",          required: false },
    { key: "suitcase",     label: "Βαλίτσα",                    required: false },
    { key: "coffin",       label: "Φέρετρο",                    required: false },
    { key: "set",          label: "ΣΕΤ",                        required: false },
    { key: "flowers",      label: "Στεφάνια / Λουλούδια",       required: false },
    { key: "announcement", label: "Αγγελτήριο",                 required: false },
    { key: "decor",        label: "Στολισμός",                  required: false },
    { key: "pallbearers",  label: "Φραγκοφόροι",                required: false },
    { key: "coffee",       label: "Καφές",                      required: false },
    { key: "pickup",       label: "Παραλαβή",                   required: false },
    { key: "pickupDate",   label: "Ημερομηνία παραλαβής",       required: false },
    { key: "pickupSecond", label: "2ο άτομο παραλαβής",         required: false },
    { key: "coldRoom",     label: "Ψυκτικός θάλαμος",           required: false },
    { key: "grave",        label: "Τόπος ταφής",                required: false },
    { key: "notes",        label: "Σημειώσεις",                 required: false },
  ];

  var LS_LAYOUT_KEY = "funeralos_gr_form_layout_v2";

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
    var order = state.order || FORM_FIELD_DEFS.map(function (d) { return d.key; });
    var hidden = state.hidden || {};
    var anchor = form.querySelector("#customFieldsFormBox");
    if (!anchor) return;
    order.forEach(function (key) {
      var el = form.querySelector('[data-field-key="' + key + '"]');
      if (!el) return;
      var def = FORM_FIELD_DEFS.find(function (d) { return d.key === key; });
      el.style.display = (def && !def.required && hidden[key] === true) ? "none" : "";
      form.insertBefore(el, anchor);
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
        if (i > 0) { s.order.splice(i, 1); s.order.splice(i - 1, 0, key); saveFormLayoutState(s); applyFormLayout(); renderFormLayoutPanel(); }
      });
      btnDown.addEventListener("click", function () {
        var s = getFormLayoutState();
        var i = s.order.indexOf(key);
        if (i < s.order.length - 1) { s.order.splice(i, 1); s.order.splice(i + 1, 0, key); saveFormLayoutState(s); applyFormLayout(); renderFormLayoutPanel(); }
      });

      row.appendChild(btnUp);
      row.appendChild(btnDown);
      row.appendChild(labelEl);

      if (def.required) {
        var badge = document.createElement("span");
        badge.textContent = "βασικό";
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
    if (e.target.closest("#addCeremonyBtn") || e.target.closest("#newCeremonyBtn") ||
        e.target.closest("#newCeremonyHeroBtn") || e.target.closest("[data-editid]")) {
      setTimeout(function () {
        var plan = window.__authPlan;
        if (plan === "pro" || plan === "business") applyFormLayout();
      }, 50);
    }
  });

  // ── Feature Gates (installed after auth confirmed) ──────────────────────────
  function installFeatureGates() {
    // installFeatureGates runs after async auth checks, so DOMContentLoaded
    // has almost certainly already fired by now — call directly instead of
    // waiting on an event that will never come.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", markLockedFeatures);
    } else {
      markLockedFeatures();
    }

    // Business: fully unlocked
    if (window.__authPlan === "business") return;

    // Gate: Hermes AI — Business only
    document.addEventListener("click", function (e) {
      const tab = e.target.closest('[data-tab="hermes"]');
      if (!tab) return;
      if (window.__authPlan !== "business") {
        e.preventDefault();
        e.stopImmediatePropagation();
        showUpgradeModal(
          "Hermes AI — Business",
          "Ο Hermes AI είναι διαθέσιμος μόνο στο Business πλάνο.\nΑναβάθμισε για να αποκτήσεις πρόσβαση στο Action Center, τις προτεραιότητες και τη μνήμη γραφείου."
        );
      }
    }, true);

    document.addEventListener("click", function (e) {
      const btn = e.target.closest("#aiAssistantBtn");
      if (!btn) return;
      if (window.__authPlan !== "business") {
        e.preventDefault();
        e.stopImmediatePropagation();
        showUpgradeModal(
          "AI Βοηθός — Business",
          "Ο AI Βοηθός είναι διαθέσιμος μόνο στο Business πλάνο.\nΑναβάθμισε για πρόσβαση σε Briefing, Ελλείψεις, Cloud AI και πλήρη έλεγχο."
        );
      }
    }, true);

    // Pro: AI gated, rest unlocked
    if (window.__authPlan === "pro") return;

    // Gate: Ceremony limit (free only)
    const ceremonyForm = document.getElementById("ceremonyForm");
    if (ceremonyForm) {
      let __gateChecking = false;

      function _clientCeremonyCount() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const list = (typeof ceremonies !== "undefined" ? ceremonies : []);
        // id is Date.now().toString() at creation time — used as a creation-date
        // proxy so this offline fallback matches the server's created_at check.
        return list.filter(function(c) { const ts = Number(c.id); return ts && ts >= monthStart; }).length;
      }

      ceremonyForm.addEventListener("submit", async function (e) {
        if (typeof editingId !== "undefined" && editingId !== null) return;
        if (__gateChecking) { __gateChecking = false; return; }

        e.preventDefault();
        e.stopImmediatePropagation();

        let count;
        try {
          const { data, error } = await sb.rpc("get_monthly_ceremony_count");
          count = (!error && data != null) ? data : _clientCeremonyCount();
        } catch (_) {
          count = _clientCeremonyCount();
        }

        if (count >= FREE_CEREMONY_LIMIT) {
          showUpgradeModal(
            "Όριο τελετών",
            "Έχεις φτάσει τις " + FREE_CEREMONY_LIMIT + " τελετές αυτό τον μήνα για το δωρεάν πλάνο.\nΑναβάθμισε σε Pro ή Business για απεριόριστες τελετές."
          );
          return;
        }

        __gateChecking = true;
        ceremonyForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }, true);
    }
  }

  function markLockedFeatures() {
    const plan = window.__authPlan;
    const isPaid = plan === "pro" || plan === "business";

    renderTeamPanel();
    handlePendingInvite();
    applyRoleRestrictions();

    if (isPaid) {
      const panel = document.getElementById("optionalFieldsPanel");
      if (panel) { panel.style.display = ""; renderFormLayoutPanel(); }
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
          nudge.innerHTML = '<span>🔒 Δωρεάν πλάνο · <b id="monthCeremonyCount">0</b>/' + FREE_CEREMONY_LIMIT + " τελετές αυτό τον μήνα</span>" +
            '<a href="/gr/login" style="background:#c8a96e;color:#0f1523;padding:6px 14px;border-radius:7px;font-size:12px;font-weight:700;text-decoration:none;">Δες τιμές →</a>';
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
          const untilStr = new Date(window.__referralPlanUntil).toLocaleDateString("el-GR", { day: "2-digit", month: "long", year: "numeric" });
          const banner = document.createElement("div");
          banner.id = "referralBonusBanner";
          banner.style.cssText = "margin-top:12px;padding:12px 16px;background:rgba(42,157,92,.12);border:1px solid rgba(42,157,92,.35);border-radius:10px;font-size:13px;color:#2a9d5c;display:flex;align-items:center;gap:10px;";
          banner.innerHTML = '<span style="font-size:18px;">🎁</span><span><strong>Δωρεάν αναβάθμιση από σύσταση!</strong> Το πλάνο σου έχει αναβαθμιστεί δωρεάν έως <strong>' + untilStr + '</strong> χάρη στις συστάσεις σου.</span>';
          heroGrid.after(banner);
        }
      }, 650);
    }
  }

  function updateMonthCount() {
    const el = document.getElementById("monthCeremonyCount");
    if (!el) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const list = (typeof ceremonies !== "undefined" ? ceremonies : []);
    const count = list.filter(function (c) {
      const ts = Number(c.id);
      return ts && ts >= monthStart;
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
    if (titleEl) titleEl.textContent = title || "Αναβάθμιση πλάνου";
    if (textEl) textEl.textContent = text || "";
    if (modal) modal.classList.add("open");
  }

  window.__showUpgrade = showUpgradeModal;
  window.closeUpgradeModal = function () {
    const modal = document.getElementById("upgradeModal");
    if (modal) modal.classList.remove("open");
  };

  // Checkout opens in a new tab with no return redirect, so a user who just
  // paid keeps seeing their old (cached) plan until the JWT naturally
  // refreshes. This forces a session refresh + reload so app_metadata.plan
  // (set by the lemon-webhook) is picked up immediately.
  window.refreshMyPlan = async function () {
    const btn = document.getElementById("refreshPlanBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Έλεγχος…"; }
    try { await sb.auth.refreshSession(); } catch (_) {}
    location.reload();
  };

  // Close modal on backdrop click
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
      const code       = profileRes.data?.referral_code     || "";
      const credits    = profileRes.data?.referral_credits  || 0;
      const planUntil  = profileRes.data?.referral_plan_until || null;
      const count      = referralsRes.count || 0;

      window.__referralCode      = code;
      window.__referralCredits   = credits;
      window.__referralPlanUntil = planUntil;
      window.__referralPlanActive = false;

      // Auto-upgrade plan when credit period is still active
      if (planUntil && new Date(planUntil) > new Date() && window.__authPlan !== "business") {
        window.__authPlan = window.__authPlan === "pro" ? "business" : "pro";
        window.__referralPlanActive = true;
      }

      // Populate referral info panel elements (if present in DOM)
      const link = code ? "https://funeralos.net/?ref=" + code : "";
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
              ? new Date(planUntil).toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" })
              : "";
            const pill = document.createElement("span");
            pill.className = "referral-credit-pill";
            pill.title = credits + " δωρεάν " + (credits === 1 ? "μήνας" : "μήνες") + " από συστάσεις" + (untilStr ? " · Ισχύει έως " + untilStr : "");
            pill.style.cssText = "margin-left:6px;font-size:9px;font-weight:700;background:#2a9d5c;color:#fff;padding:2px 6px;border-radius:4px;letter-spacing:.4px;cursor:default;";
            pill.textContent = "🎁 +" + credits + "μ";
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
      if (el) el.textContent = "✓ Αντιγράφηκε!";
      setTimeout(function () { if (el) el.textContent = prev; }, 1500);
    });
  };

  window.copyReferralLink = function () {
    const code = window.__referralCode || "";
    if (!code) return;
    const link = "https://funeralos.net/?ref=" + code;
    navigator.clipboard.writeText(link).then(function () {
      const el = document.getElementById("referralLinkDisplay");
      const prev = el ? el.textContent : link;
      if (el) el.textContent = "✓ Αντιγράφηκε!";
      setTimeout(function () { if (el) el.textContent = prev; }, 1500);
    });
  };

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
      showUpgradeModal("Μέλη ομάδας — λειτουργία Pro", "Πρόσκλησε έως " + PRO_TEAM_LIMIT + " μέλη ομάδας στο Pro, ή απεριόριστα στο Business.");
      return;
    }

    const email = emailEl.value.trim();
    const role  = roleEl ? roleEl.value : "editor";
    if (!email) { msgEl.style.color = "#e07070"; msgEl.textContent = "Συμπλήρωσε πρώτα ένα email."; return; }

    msgEl.style.color = "#aabb88";
    msgEl.textContent = "Αποστολή…";

    const { data: { session } } = await sb.auth.getSession();
    if (!session) { msgEl.style.color = "#e07070"; msgEl.textContent = "Δεν είσαι συνδεδεμένος."; return; }

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
        msgEl.textContent = "Έφτασες το όριο Pro (" + PRO_TEAM_LIMIT + " μέλη). Αναβάθμισε σε Business για απεριόριστα.";
        return;
      }
    }

    const result = await callEdgeFunction("team-invite", { email, role, lang: "el" }, session.access_token);
    if (result.ok) {
      emailEl.value = "";
      renderTeamPanel();
      if (result.data?.emailSent) {
        msgEl.style.color = "#66cc88";
        msgEl.textContent = "Η πρόσκληση στάλθηκε στο " + email + ".";
      } else {
        msgEl.style.color = "#e0b866";
        msgEl.innerHTML = "Δεν στάλθηκε το email πρόσκλησης — αντέγραψε αυτόν τον σύνδεσμο και στείλ' τον εσύ: "
          + '<br><a href="#" id="teamInviteCopyLink" style="color:#c8a96e;word-break:break-all;">' + (result.data?.inviteLink || "") + "</a>";
        const copyLink = document.getElementById("teamInviteCopyLink");
        if (copyLink && result.data?.inviteLink) {
          copyLink.addEventListener("click", function (e) {
            e.preventDefault();
            navigator.clipboard?.writeText(result.data.inviteLink);
            msgEl.textContent = "Ο σύνδεσμος αντιγράφηκε.";
          });
        }
      }
    } else {
      msgEl.style.color = "#e07070";
      msgEl.textContent = result.data?.error || result.data?.message || "Η πρόσκληση απέτυχε.";
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
        + '<p style="font-size:13px;color:#c8a96e;margin:0 0 10px;font-weight:600;">Συνεργασία ομάδας — Pro &amp; Business</p>'
        + '<p style="font-size:12px;color:#8899aa;margin:0 0 12px;">Πρόσκλησε έως ' + PRO_TEAM_LIMIT + ' συναδέλφους στο Pro, ή απεριόριστους στο Business.</p>'
        + '<a href="javascript:void(0)" onclick="window.__showUpgrade && window.__showUpgrade(\'Μέλη ομάδας\',\'Πρόσκλησε έως ' + PRO_TEAM_LIMIT + ' μέλη ομάδας στο Pro, ή απεριόριστα στο Business.\')" style="display:inline-block;background:#c8a96e;color:#0f1523;padding:7px 18px;border-radius:7px;font-size:12px;font-weight:700;text-decoration:none;cursor:pointer;">Δες τα πλάνα →</a>'
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
      listEl.innerHTML = '<p style="font-size:12px;color:#8899aa;">Δεν ήταν δυνατή η φόρτωση των μελών.</p>';
      return;
    }
    const members = await res.json();

    const atProLimit = plan === "pro" && members.length >= PRO_TEAM_LIMIT;

    // Show/hide invite form
    if (formEl) formEl.style.display = (role === "admin" && !atProLimit) ? "" : "none";

    // Pro counter below invite form
    if (msgEl && plan === "pro" && role === "admin") {
      msgEl.style.color = atProLimit ? "#e07070" : "#8899aa";
      msgEl.textContent = members.length + "/" + PRO_TEAM_LIMIT + " μέλη ομάδας"
        + (atProLimit ? " · Αναβάθμισε σε Business για απεριόριστα." : "");
    }

    if (!members.length) {
      listEl.innerHTML = '<p style="font-size:12px;color:#8899aa;">Δεν υπάρχουν ακόμα μέλη ομάδας. Πρόσκαλε έναν συνάδελφο παραπάνω.</p>';
      return;
    }
    listEl.innerHTML = members.map(function (m) {
      const joined = m.joined_at ? new Date(m.joined_at).toLocaleDateString("el-GR") : "—";
      const isSelf = m.user_id === session.user.id;
      const roleLabel = m.role === "admin" ? '<span style="color:#c8a96e;font-weight:700;">Admin</span>' : '<span style="color:#8899aa;">Editor</span>';
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.07);">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:13px;color:#c8daf0;">' + m.user_id + (isSelf ? ' <span style="font-size:10px;color:#8899aa;">(εσύ)</span>' : '') + '</div>'
        + '<div style="font-size:11px;color:#8899aa;">' + roleLabel + ' · Εγγραφή ' + joined + '</div>'
        + '</div>'
        + (role === "admin" && !isSelf ? '<button onclick="removeTeamMember(\'' + m.user_id + '\')" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(220,80,80,.4);background:transparent;color:#e07070;font-size:11px;cursor:pointer;">Αφαίρεση</button>' : '')
        + '</div>';
    }).join("");
  }

  // Remove a team member (admin only, RLS-enforced)
  window.removeTeamMember = async function (userId) {
    if (!confirm("Αφαίρεση αυτού του μέλους; Θα χάσει την πρόσβαση στα κοινόχρηστα δεδομένα του γραφείου.")) return;
    const { data: { session } } = await sb.auth.getSession().catch(() => ({ data: {} }));
    if (!session) return;
    const officeId = (session.user.user_metadata || {}).office_id || session.user.id;
    // Admins can delete from office_members directly (RLS: office_id = auth.uid())
    const res = await fetch(
      SUPABASE_URL + "/rest/v1/office_members?office_id=eq." + officeId + "&user_id=eq." + userId,
      { method: "DELETE", headers: { Authorization: "Bearer " + session.access_token, apikey: SUPABASE_KEY, Prefer: "return=minimal" } }
    );
    if (res.ok) renderTeamPanel();
    else alert("Η αφαίρεση απέτυχε.");
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
      const loginUrl = "/login.html?invite=" + encodeURIComponent(token);
      location.replace(loginUrl);
      return;
    }

    const result = await callEdgeFunction("accept-invite", { token }, session.access_token);
    if (result.ok) {
      // Refresh session so new metadata (office_id, role) is applied
      await sb.auth.refreshSession();
      location.replace(location.pathname); // strip ?invite= from URL
    } else {
      const msg = result.data?.message || result.data?.error || "Μη έγκυρη ή ληγμένη πρόσκληση.";
      alert("Δεν ήταν δυνατή η αποδοχή της πρόσκλησης: " + msg);
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

  // ── Kick off ─────────────────────────────────────────────────────────────────
  initAuth();

})();
