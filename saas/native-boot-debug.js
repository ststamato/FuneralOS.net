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

  var shown = false;

  function esc(s) {
    return String(s).replace(/[<>&]/g, function (c) {
      return c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;";
    });
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
  setTimeout(function () {
    var ov = document.getElementById("authOverlay");
    if (!ov || ov.style.display === "none") return;

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
    var t0 = Date.now();
    var settle = function (net) {
      lines.push("supabase reach : " + net);
      panel("Boot stalled (10s)", esc(lines.join("\n")));
    };
    var timer = setTimeout(function () {
      settle("TIMEOUT (no response in 6s)");
    }, 6000);

    fetch("https://rqklpnrgpiprttzsploe.supabase.co/auth/v1/health")
      .then(function (r) {
        clearTimeout(timer);
        settle("HTTP " + r.status + " in " + (Date.now() - t0) + "ms");
      })
      .catch(function (e) {
        clearTimeout(timer);
        settle("FAILED: " + e.message);
      });
  }, 10000);
})();
