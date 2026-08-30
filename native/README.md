# FuneralOS — Native apps (Apple App Store / Google Play Store)

Two separate Capacitor projects, one per edition — they don't share a
build, only the underlying `saas/` source:

- `gr-app/` — Greek edition (`net.funeralos.gr`)
- `en-app/` — English/USA edition (`net.funeralos.en`)

Full plan (all phases, what's done vs. pending): see the plan this was
generated from, or ask Claude to summarize `mobile-plan` phases in a new
session — the phase numbers below match it.

## How the web source becomes a native app (Phase 4 — done)

Nothing in `native/*/www/` is hand-edited. `build-www.sh` copies the
relevant subset of `saas/` into each project's `www/`, rewrites EN's `../`
relative paths (its HTML normally lives one directory below the shared
files), and injects a `<script src="native-bridge.js">` tag. Excludes
`sw.js` and `manifest.webmanifest` — Service Worker / PWA-install concepts
don't apply inside a Capacitor WebView; Capgo (Phase 8) covers the "get
updates without a store review" role instead.

```bash
./native/build-www.sh          # regenerate both www/ folders from saas/
cd native/gr-app && npx cap sync   # copy www/ into ios/ and android/
cd native/en-app && npx cap sync
```

Run this after every `saas/` change you want reflected in the native apps
— for a pure JS/HTML/CSS change, that's also all you need before an OTA
push (see `publish-ota.sh`); a change to a native plugin, permission, icon,
or the IAP flow needs a full rebuild + store resubmission instead (Phases
9-13 again).

## What's done (this session, no vendor accounts required)

- Both Capacitor projects scaffolded: `package.json`, `capacitor.config.ts`,
  `ios/` + `android/` platforms, plugins installed (`@capacitor/app`,
  `@capacitor/browser`, `@capacitor/clipboard`, `@capacitor/share`,
  `@capacitor/push-notifications`, `@revenuecat/purchases-capacitor`,
  `@capgo/capacitor-updater`).
- Custom URL scheme registered in both platforms (`net.funeralos.gr://`,
  `net.funeralos.en://`) for the auth-callback deep link — `Info.plist`
  `CFBundleURLTypes` (iOS), `AndroidManifest.xml` intent-filter (Android).
- `saas/native-bridge.js` — IAP button interception, native push
  registration, restore-purchases, auth-callback handling. All gated behind
  `Capacitor.isNativePlatform()`, so it's a no-op if it were ever loaded on
  web (it isn't — `build-www.sh` is the only thing that references it).
- Backend ready: `native_push_tokens` table, `delete_own_account()` RPC,
  CORS allow-list on the 5 app-facing edge functions, `push_sender`'s FCM
  branch, `revenuecat-webhook` function — all deployed live already.

## What's still pending (needs vendor accounts / a Mac or cloud CI)

None of this can happen inside this session — no Xcode/macOS here, and the
IAP/push/OTA vendors need real accounts with real credentials.

1. **Apple Developer Program** (individual, ~$99/yr) + **Google Play
   Console** (individual, ~$25 one-time) — not yet created.
2. **RevenueCat** account + entitlements (`pro`/`business`) + the matching
   subscription products created in App Store Connect / Play Console, then
   linked into RevenueCat. Set `REVENUECAT_WEBHOOK_AUTH` via
   `supabase secrets set` once the webhook is configured in RevenueCat's
   dashboard pointing at
   `https://rqklpnrgpiprttzsploe.supabase.co/functions/v1/revenuecat-webhook`.
3. **Firebase** project (FCM for native push) — add both apps, download
   `google-services.json` (→ `native/*-app/android/app/`) and
   `GoogleService-Info.plist` (→ `native/*-app/ios/App/App/`), upload the
   APNs auth key into Firebase's iOS config. Set
   `FCM_SERVICE_ACCOUNT_JSON` via `supabase secrets set` (Firebase service
   account key JSON, one line).
4. **Capgo** account + channels (`production`/`beta`) per app, `npx
   @capgo/cli login`, then `publish-ota.sh` works as documented.
5. ~~**App icon**~~ — done (Phase 5, revised). A folded-ribbon "F" mark on
   a dark navy card (`#202433`): white ribbon on top, brand-purple
   (`#8b7cf6`-family) ribbon below, with a soft fold shadow at the seam.
   Replaced the earlier tricolor "FoS" lettermark design. Source artwork
   came from the user as a finished render with pre-baked rounded corners
   (AI-generated mockup) — the four corners outside the rounded-rect were
   near-white, not transparent or edge-to-edge navy, which would have left
   visible white slivers once iOS/Android applied their own icon mask on
   top; fixed by flood-filling those corner regions with the card's navy
   so the master is a true full-bleed 1024×1024 square before handing it
   to capacitor-assets. 1024×1024 master committed to
   `native/{gr,en}-app/resources/icon.png`; `npx capacitor-assets generate`
   ran in both projects — every iOS AppIcon/splash size and Android
   adaptive-icon/splash density is already in place under each project's
   `ios/`/`android/` folders. Same brand for both apps. To change it
   later: replace `resources/icon.png` (1024×1024, no transparency, no
   pre-baked rounded corners — full-bleed square, OS applies its own mask)
   and re-run `npx capacitor-assets generate --iconBackgroundColor
   '#202433' --iconBackgroundColorDark '#202433' --splashBackgroundColor
   '#202433' --splashBackgroundColorDark '#202433'` in each project.
6. **First compiled build** — needs the user's own Mac + Xcode, or a cloud
   CI service (Codemagic / EAS Build) configured with the Apple/Google
   credentials from step 1.
7. **Store listings, screenshots, App Privacy / Data Safety forms, TestFlight
   / Play Internal Testing, submission** — all downstream of steps 1-6.
