// Service Worker — Τελετές Σταυρακάκη
// V41.3 — Web Push Notifications
//
// ΑΣΦΑΛΕΙΑ / ΦΙΛΟΣΟΦΙΑ:
// - ΔΕΝ έχει "fetch" handler => δεν παρεμβαίνει στη φόρτωση ή στο cache της
//   εφαρμογής. Άρα δεν μπορεί να "σπάσει" την εφαρμογή ούτε να δείξει παλιό
//   περιεχόμενο. Κάνει ΜΟΝΟ δύο πράγματα: λαμβάνει push και ανοίγει την εφαρμογή
//   στο tap.
// - Το app.js ήδη τον καταχωρεί (SW_PATH = "./sw.js") μόλις ο χρήστης πατήσει
//   "🔔 Push". Πριν υπήρχε αυτό το αρχείο, η καταχώρηση αποτύγχανε αθόρυβα.

self.addEventListener("install", () => {
  // Ενεργοποίηση αμέσως, χωρίς να περιμένει κλείσιμο tabs.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
