// FuneralOS — Capacitor native bridge
// Loaded ONLY by the native iOS/Android www/ bundles (see native/build-www.sh)
// — never referenced by the web PWA deploy. Everything here is also gated
// behind Capacitor.isNativePlatform() as a second safety net, so this file
// staying in the shared saas/ source tree (for build-www.sh to copy) can
// never accidentally affect the web app even if something goes wrong with
// bundle assembly.
//
// Plugin globals referenced here all come from window.Capacitor.Plugins.* —
// Purchases (@revenuecat/purchases-capacitor), FirebaseMessaging
// (@capacitor-firebase/messaging), CapacitorUpdater (@capgo/capacitor-updater),
// App (@capacitor/app) — installed in the native/*-app/ Capacitor projects.

(function () {
  "use strict";
  if (!window.Capacitor || typeof window.Capacitor.isNativePlatform !== "function" || !window.Capacitor.isNativePlatform()) {
    return;
  }

  const platform = window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : "unknown"; // "ios" | "android"

  // ── Capgo OTA updater handshake ─────────────────────────────────────────
  // @capgo/capacitor-updater holds the native splash screen and blocks the
  // WebView from becoming visible until the JS side calls notifyAppReady()
  // (default 10s timeout, then it errors and retries forever) — this is
  // required as soon as the plugin is installed, independent of whether a
  // Capgo account/channel exists yet (mobile-plan Phase 8, still pending).
  // Without this call the app hangs on the splash screen indefinitely.
  try {
    const CapacitorUpdater = window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater;
    if (CapacitorUpdater) CapacitorUpdater.notifyAppReady();
  } catch (err) {
    console.error("[native-bridge] CapacitorUpdater.notifyAppReady failed", err);
  }

  // ── window.open() → system browser ──────────────────────────────────────
  // A stock Capacitor WKWebView has no default handler for target="_blank"/
  // window.open() — it silently does nothing, since there's no native
  // webView(_:createWebViewWith:) delegate wired up to actually open a new
  // window. Every http(s) window.open() call across the shared JS (WhatsApp
  // share, signed-URL document links, etc.) would otherwise be a dead
  // button here. Overriding window.open globally, once, fixes every call
  // site without touching app.js/gr-documents.js/usa.js at all.
  try {
    const Browser = window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
    if (Browser) {
      window.open = function (url) {
        if (url && /^https?:\/\//i.test(url)) {
          Browser.open({ url }).catch((err) => console.error("[native-bridge] Browser.open failed", err));
        }
        return null;
      };
    }
  } catch (err) {
    console.error("[native-bridge] window.open override failed", err);
  }

  // Like every other Capacitor plugin (App, FirebaseMessaging below), the
  // RevenueCat plugin registers itself as Capacitor.Plugins.Purchases — there's
  // no bundler here to resolve the @revenuecat/purchases-capacitor JS import,
  // so the native bridge's auto-registered global is the only way to reach it.
  const Purchases = window.Capacitor.Plugins && window.Capacitor.Plugins.Purchases;

  // ── IAP (RevenueCat) ─────────────────────────────────────────────────────
  // Apple/Google both require Pro/Business upgrades to go through native IAP
  // inside the app — the LemonSqueezy checkout links this app uses on the web
  // are not permitted here. This intercepts the same buttons the web build
  // uses (so no HTML changes needed per-edition) and routes them through
  // RevenueCat instead.

  // Must configure() before any other Purchases.* call. TODO: this is the
  // RevenueCat "Test Store" sandbox key (only one exists yet) — replace with
  // the real per-platform key once GR/EN each have their own iOS + Android
  // "App" set up in RevenueCat (Project settings → API keys), since ios and
  // android keys will differ and this Test Store key is shared by both for
  // now, purely so sandbox purchases can be exercised before real store
  // products exist.
  const REVENUECAT_API_KEY = "test_VQrtGTPbcDneqyOmqSGrGJwIeQe";
  if (Purchases) {
    try {
      Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    } catch (err) {
      console.error("[native-bridge] Purchases.configure failed", err);
    }
  } else {
    console.error("[native-bridge] Capacitor.Plugins.Purchases unavailable — RevenueCat plugin not registered");
  }

  // Keeps RevenueCat's app_user_id equal to the Supabase user id, so
  // revenuecat-webhook (event.app_user_id) maps purchase events straight to
  // app_metadata.plan with no email-matching fallback needed.
  async function syncRevenueCatUser() {
    if (!Purchases) return;
    try {
      const { data } = await window.__sb.auth.getSession();
      const uid = data?.session?.user?.id;
      if (uid) await Purchases.logIn({ appUserID: uid });
      else await Purchases.logOut();
    } catch (err) {
      console.error("[native-bridge] RevenueCat logIn/logOut failed", err);
    }
  }
  if (window.__sb) {
    syncRevenueCatUser();
    window.__sb.auth.onAuthStateChange(() => syncRevenueCatUser());
  }

  const ENTITLEMENT_BY_BTN = {
    upgradeBtnPro: "pro", billingBtnPro: "pro",
    upgradeBtnBiz: "business", billingBtnBiz: "business",
  };

  async function purchaseEntitlement(entitlementId) {
    if (!Purchases) { alert("Οι αγορές δεν είναι διαθέσιμες αυτή τη στιγμή."); return; }
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings?.current?.availablePackages?.find(
        (p) => p.identifier === entitlementId || p.packageType?.toLowerCase() === entitlementId
      ) || offerings?.current?.availablePackages?.[0];
      if (!pkg) { alert("Δεν βρέθηκε διαθέσιμο πλάνο. Δοκίμασε ξανά αργότερα."); return; }
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      if (customerInfo?.entitlements?.active?.[entitlementId]) {
        // RevenueCat's webhook (supabase/functions/revenuecat-webhook) updates
        // app_metadata.plan server-side — refresh the session so the client
        // picks it up, same pattern as window.refreshMyPlan() after LemonSqueezy
        // checkout on the web.
        if (typeof window.refreshMyPlan === "function") window.refreshMyPlan();
        else location.reload();
      }
    } catch (err) {
      if (err && err.userCancelled) return;
      console.error("[native-bridge] purchase failed", err);
      alert("Η αγορά απέτυχε. Δοκίμασε ξανά.");
    }
  }

  window.__nativeRestorePurchases = async function () {
    if (!Purchases) { alert("Οι αγορές δεν είναι διαθέσιμες αυτή τη στιγμή."); return; }
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      const active = customerInfo?.entitlements?.active || {};
      if (active.business || active.pro) {
        if (typeof window.refreshMyPlan === "function") window.refreshMyPlan();
        else location.reload();
      } else {
        alert("Δεν βρέθηκαν προηγούμενες αγορές για επαναφορά.");
      }
    } catch (err) {
      console.error("[native-bridge] restore failed", err);
    }
  };

  document.addEventListener("click", function (e) {
    const btn = e.target.closest("#upgradeBtnPro, #billingBtnPro, #upgradeBtnBiz, #billingBtnBiz");
    if (!btn) return;
    const entitlementId = ENTITLEMENT_BY_BTN[btn.id];
    if (!entitlementId) return;
    e.preventDefault();
    purchaseEntitlement(entitlementId);
  }, true);

  // Manage-subscription link (EN billing panel) — LemonSqueezy's customer
  // portal doesn't apply to native purchases; send the user to the platform's
  // own subscription management instead.
  window.__nativeManageSubscriptionUrl = function () {
    return platform === "ios"
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions";
  };

  // ── Native push (replaces the web Service-Worker/VAPID path entirely) ──
  // Overrides the web implementation the "🔔 Push" button calls — see
  // registerServiceWorker()/subscribePush()/setupPushOptB() in app.js, none
  // of which apply inside a Capacitor WebView (no Service Worker push there).
  //
  // Uses @capacitor-firebase/messaging, not @capacitor/push-notifications —
  // push_sender (supabase/functions/push_sender) sends through FCM's v1 API
  // uniformly for both platforms, which requires an actual FCM registration
  // token. Android's push transport IS FCM, so @capacitor/push-notifications
  // already returned a usable token there, but on iOS it only ever returns
  // the raw APNs device token — FCM's messages:send rejects that outright.
  // @capacitor-firebase/messaging does the APNs→FCM token exchange
  // internally (via GoogleService-Info.plist), giving one code path that
  // actually works on both platforms.
  async function upsertPushToken(token) {
    if (!token) return;
    const session = typeof getCloudSession === "function" ? await getCloudSession() : null;
    if (!session || !window.__sb) return;
    await window.__sb.from("native_push_tokens").upsert(
      {
        office_id: session.rowId,
        platform,
        token,
        device_label: (typeof getDeviceLabel === "function" ? getDeviceLabel() : platform),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "office_id,token" }
    );
  }

  window.setupPushOptB = async function () {
    try {
      const { FirebaseMessaging } = window.Capacitor.Plugins;
      if (!FirebaseMessaging) { console.error("[native-bridge] FirebaseMessaging plugin unavailable"); return; }
      const perm = await FirebaseMessaging.requestPermissions();
      if (perm.receive !== "granted") return;
      const { token } = await FirebaseMessaging.getToken();
      await upsertPushToken(token);
      // FCM tokens can rotate (app reinstall, OS-level refresh) — keep the
      // stored token current rather than registering once and going stale.
      FirebaseMessaging.addListener("tokenReceived", (event) => upsertPushToken(event?.token));
    } catch (err) {
      console.error("[native-bridge] push setup failed", err);
    }
  };

  // ── Auth callback (custom URL scheme, net.funeralos.gr:// / net.funeralos.en://) ──
  // login.html/en/login.html branch emailRedirectTo to this scheme on native
  // (see the native-platform check added there) instead of the web's
  // https://funeralos.net/login.html — Supabase's client SDK handles the
  // token exchange itself once the URL reaches it via this listener.
  try {
    const { App } = window.Capacitor.Plugins;
    App.addListener("appUrlOpen", async (data) => {
      if (!data?.url || !window.__sb) return;
      const url = new URL(data.url);
      if (!/^net\.funeralos\.(gr|en):$/.test(url.protocol)) return;
      // PKCE flow (supabase-js v2 default): the redirect carries a ?code=
      // param that must be exchanged for a session. NOT yet verified against
      // a real build — confirm this is still the current API/flow type when
      // wiring the native projects (mobile-plan Phase 4 auth-redirect step).
      await window.__sb.auth.exchangeCodeForSession(data.url).catch((err) => {
        console.error("[native-bridge] auth callback failed", err);
      });
      location.reload();
    });
  } catch (err) {
    console.error("[native-bridge] App plugin unavailable", err);
  }
})();
