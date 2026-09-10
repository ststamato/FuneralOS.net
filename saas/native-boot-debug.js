// FuneralOS — native boot diagnostics
// Injected as the FIRST script of the native www/ bundles by
// native/build-www.sh, before freemium.js/app.js, so it can catch anything
// they throw. Never part of the web deploy.
//
// A Capacitor WebView has no visible error surface. A fatal boot error just
// leaves the app sitting on its loading overlay forever, and the Xcode
// console only reports a generic "JS Eval error A JavaScript exception
// occurred" with no message, file, or line. This paints the real error onto
// the screen instead — and if nothing throws but boot stalls anyway (a hang
// on an await rather than an exception), it dumps a snapshot of what did and
// didn't initialize, which is what actually narrows that case down.

(function () {
  "use strict";

  var VERSION = "v2";
  var t0 = Date.now();
  var shown = false;

  // Flipped to true by native/build-www.sh when built with FOS_DEBUG=1.
  // Off (the default, and what ships to the stores) keeps the error and
  // rejection handlers — a legible error on screen beats a blank app for a
  // real user too — but drops the developer-facing badge and stall dump.
  var VERBOSE = false;

  window.__FOS_BOOT_DEBUG = VERSION;

  function esc(s) {
    return String(s).replace(/[<>&]/g, function (c) {
      return c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;";
    });
  }

  // An always-visible badge, up before anything else can fail. Its presence is
  // the unambiguous answer to "is the device actually running the build I just
  // made?" — a question that has repeatedly cost a debug round here. It also
  // ticks, so a frozen number distinguishes a dead JS context from a slow one,
  // and tapping it dumps full state on demand instead of waiting for a stall.
  var badge;
  function mountBadge() {
    if (!VERBOSE || badge || !document.body) return;
    badge = document.createElement("div");
    badge.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:2147483646;background:#c8a96e;" +
      "color:#0f1523;font:11px/1.4 ui-monospace,Menlo,monospace;font-weight:700;" +
      "padding:3px 8px;text-align:center;";
    badge.textContent = "diag " + VERSION;
    badge.addEventListener("click", function () {
      shown = false;
      dumpState("State (tapped)");
    });
    document.body.appendChild(badge);
    setInterval(function () {
      if (!shown) {
        badge.textContent =
          "diag " + VERSION + " · " + ((Date.now() - t0) / 1000).toFixed(0) + "s";
      }
    }, 500);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountBadge);
  } else {
    mountBadge();
  }

  function panel(title, body) {
    if (shown) return;
    shown = true;
    try {
      var d = document.createElement("div");
      d.id = "__fosBootDiag";
      d.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;background:#0f1523;color:#fff;" +
        "font:12px/1.55 ui-monospace,Menlo,monospace;padding:60px 16px 24px;" +
        "overflow:auto;-webkit-user-select:text;user-select:text;";
      d.innerHTML =
        '<div style="color:#c8a96e;font-weight:800;font-size:15px;margin-bottom:12px;">' +
        esc(title) +
        "</div><pre style=\"white-space:pre-wrap;word-break:break-word;margin:0;\">" +
        body +
        "</pre>";
      (document.body || document.documentElement).appendChild(d);
    } catch (e) {
      /* nothing left to do — the screen is already broken */
    }
  }

  window.addEventListener("error", function (e) {
    panel(
      "Boot error",
      esc(
        (e.message || "unknown") +
          "\n\n" +
          (e.filename || "?") + ":" + (e.lineno || "?") + ":" + (e.colno || "?") +
          "\n\n" +
          ((e.error && e.error.stack) || "(no stack)")
      )
    );
  });

  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    panel(
      "Unhandled promise rejection",
      esc(
        ((r && (r.message || r)) || "unknown") +
          "\n\n" +
          ((r && r.stack) || "(no stack)")
      )
    );
  });

  // Nothing threw, but the app never got past its loading overlay. That's a
  // hang on an await (network, a stuck supabase auth lock, ...) rather than an
  // exception, so report the state that distinguishes those instead.
  function dumpState(title) {
    var plugins = [];
    try {
      plugins = Object.keys((window.Capacitor && window.Capacitor.Plugins) || {});
    } catch (e) {
      plugins = ["<unreadable: " + e.message + ">"];
    }

    var storage;
    try {
      localStorage.setItem("__fos_probe", "1");
      localStorage.removeItem("__fos_probe");
      storage = "ok";
    } catch (e) {
      storage = "BLOCKED: " + e.message;
    }

    var cap = window.Capacitor || {};
    var lines = [
      "location       : " + location.href,
      "supabase lib   : " + typeof window.supabase,
      "__sb client    : " + typeof window.__sb,
      "__authUser     : " + JSON.stringify(window.__authUser || null),
      "__appLang      : " + window.__appLang,
      "isNative       : " + (cap.isNativePlatform ? cap.isNativePlatform() : "n/a"),
      "platform       : " + (cap.getPlatform ? cap.getPlatform() : "n/a"),
      "plugins        : " + (plugins.join(", ") || "(none)"),
      "localStorage   : " + storage,
      "navigator.locks: " + typeof navigator.locks,
    ];

    // Whether the WebView can reach Supabase at all is the single most useful
    // fact here: every path out of the loading overlay goes through it.
    var probeStart = Date.now();
    var settle = function (net) {
      lines.push("supabase reach : " + net);
      panel(title, esc(lines.join("\n")));
    };
    var timer = setTimeout(function () {
      settle("TIMEOUT (no response in 6s)");
    }, 6000);

    fetch("https://rqklpnrgpiprttzsploe.supabase.co/auth/v1/health")
      .then(function (r) {
        clearTimeout(timer);
        settle("HTTP " + r.status + " in " + (Date.now() - probeStart) + "ms");
      })
      .catch(function (e) {
        clearTimeout(timer);
        settle("FAILED: " + e.message);
      });
  }

  setTimeout(function () {
    if (!VERBOSE) return;
    var ov = document.getElementById("authOverlay");
    var stillLoading = ov && ov.style.display !== "none";
    if (stillLoading || !window.__authUser) dumpState("Boot stalled (6s)");
  }, 6000);
})();
