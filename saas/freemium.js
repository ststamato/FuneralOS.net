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
        + '<a href="login.html?tab=register" style="background:linear-gradient(135deg,#c8a96e,#d4b97e);color:#0f1523;padding:8px 18px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none;white-space:nowrap;letter-spacing:.3px;">Ξεκίνα δωρεάν →</a>'
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
        window.location.href = "./login.html";
        return;
      }

      const user = session.user;
      window.__authUser = user;
      const OWNER_EMAILS = ["ststamato@gmail.com"];
      const isOwner = OWNER_EMAILS.includes(user.email);
      window.__authPlan = isOwner ? "business" : (user.user_metadata?.plan || "free");
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
        const plan = window.__authPlan;
        if (plan === "pro" || plan === "business") applyOptFieldVisibility();
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
            "Έχεις φτάσει τις " + FREE_CEREMONY_LIMIT + " τελετές αυτό τον μήνα για το δωρεάν πλάνο.\nΑναβάθμισε σε Pro ή Business για απεριόριστες τελετές."
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
          nudge.innerHTML = '<span>🔒 Δωρεάν πλάνο · <b id="monthCeremonyCount">0</b>/' + FREE_CEREMONY_LIMIT + " τελετές αυτό τον μήνα</span>" +
            '<a href="./login.html" style="background:#c8a96e;color:#0f1523;padding:6px 14px;border-radius:7px;font-size:12px;font-weight:700;text-decoration:none;">Δες τιμές →</a>';
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

  // ── Kick off ─────────────────────────────────────────────────────────────────
  initAuth();

})();
