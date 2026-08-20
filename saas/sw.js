// Service Worker — Τελετές Σταυρακάκη
// V41.4 — Web Push Notifications + offline app-shell cache
//
// ΑΣΦΑΛΕΙΑ / ΦΙΛΟΣΟΦΙΑ:
// - Ο fetch handler παρακάτω καλύπτει ΜΟΝΟ το static app shell (HTML/CSS/JS
//   same-origin). Είναι network-first: κάθε φόρτωση δοκιμάζει πρώτα το
//   δίκτυο, οπότε online ο χρήστης βλέπει πάντα φρέσκο περιεχόμενο — μηδενικό
//   ρίσκο stale UI. Το cache χρησιμοποιείται ΜΟΝΟ σαν fallback όταν το δίκτυο
//   αποτυγχάνει (killed tab / καθόλου σήμα), ώστε η εφαρμογή τουλάχιστον να
//   ανοίγει αντί να μη φορτώνει καθόλου. Ποτέ δεν αγγίζει κλήσεις προς
//   Supabase (διαφορετικό origin, εξαιρείται αυτόματα) — τα δεδομένα δεν
//   κρύβονται ποτέ πίσω από stale cache.
// - Το app.js ήδη τον καταχωρεί (SW_PATH = "/sw.js") μόλις ο χρήστης πατήσει
//   "🔔 Push" ή στο αρχικό load. Κάνει επίσης λήψη push και ανοίγει την
//   εφαρμογή στο tap.

const SHELL_CACHE_NAME = "fos-shell-v1";
const SHELL_URLS = [
  "/app.html", "/login.html", "/styles.css", "/config.js",
  "/app.js", "/freemium.js",
  "/en/app.html", "/en/login.html", "/en/freemium.js", "/usa.js",
];

self.addEventListener("install", (event) => {
  // Ενεργοποίηση αμέσως, χωρίς να περιμένει κλείσιμο tabs.
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch((e) => console.warn("SW precache skipped", e))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((names) =>
        Promise.all(names.filter((n) => n !== SHELL_CACHE_NAME).map((n) => caches.delete(n)))
      ),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase or any cross-origin call
  if (!/\.(html|css|js)$/.test(url.pathname)) return; // static shell files only

  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(SHELL_CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});

// Λήψη push από το Supabase Edge Function "push_sender".
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    try {
      data = { title: "Σταυρακάκη", body: event.data ? event.data.text() : "" };
    } catch (_e2) {
      data = {};
    }
  }

  const title = data.title || "Σταυρακάκη — Νέα αλλαγή";
  const options = {
    body: data.body || "Υπάρχει νέα ενημέρωση στην εφαρμογή.",
    tag: data.tag || "staurakaki-update",
    renotify: true,
    data: { url: data.url || "./index.html" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tap στην ειδοποίηση -> φέρνει μπροστά (ή ανοίγει) την εφαρμογή.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "./index.html";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
