# Launch checklist — App Store & Play Store submission

Everything in this folder is prep work that doesn't need a working native
build or a Mac — draft it once here, paste it into the consoles when the
time comes. See `../README.md` for the native-app engineering status
(icon, IAP wiring, Firebase, current build blocker).

## Files in this folder

| File | Covers |
|---|---|
| `store-listing-gr.md` | App Store Connect + Play Console copy — Greek edition |
| `store-listing-en.md` | App Store Connect + Play Console copy — EN/USA edition |
| `meta.md` | Categories, age rating, URLs, export compliance, content rights (shared) |
| `privacy-labels.md` | Apple App Privacy / Google Data Safety form answers, mapped from the real Supabase schema |
| `demo-reviewer-account.md` | How to set up the login credentials reviewers need |
| `testing-checklist.md` | Smoke-test script to run on a real device before submitting |

## Master sequence (do in this order)

1. **Fix the current native build blocker** — the EN app's own JS
   (`config.js`/`app.js`/`native-bridge.js`) is failing to load at
   runtime in the compiled app despite existing in `www/`/`public/`;
   likely a stale Xcode build product. `Product → Clean Build Folder`,
   then rebuild. Nothing below this line matters until the app actually
   boots past its splash screen on a real build.
2. **Real device test** — run `testing-checklist.md` in full on physical
   hardware, both editions. Push and IAP sandbox purchases need to
   actually work before you screenshot or submit anything.
3. **Google Play device verification** — still blocked on access to a
   genuine (non-emulated) Android device; borrow one for five minutes to
   scan the verification QR code, or use the "Copy URL" alternative
   flow if it appears.
4. **Real IAP products** — create the actual subscription products in
   App Store Connect and Play Console (Pro/Business, monthly/yearly),
   matching the identifiers already used in RevenueCat (`monthly`,
   `yearly`, `business_monthly`, `business_yearly`), then attach them to
   the corresponding RevenueCat products, replacing the current Test
   Store ones. Once real per-platform "Apps" exist in RevenueCat, swap
   the Test Store API key in `saas/native-bridge.js` for the real ones.
5. **Demo reviewer accounts** — follow `demo-reviewer-account.md` once
   step 1 is done (need a working build to sign up through).
6. **Screenshots** — real device only, both stores reject obvious
   mockups/frames-only submissions for a first-time listing in some
   categories. Capture: login, main case list, a case detail view, the
   AI assistant panel, and (EN edition) the Staff/Fleet/Scheduling
   screens. Standard sizes: iPhone 6.7" and 6.5" displays for Apple;
   Google auto-generates most sizes from a phone screenshot set.
7. **App Store Connect / Play Console listing entry** — paste in
   `store-listing-*.md` and `meta.md` content, fill `privacy-labels.md`
   into the App Privacy / Data Safety forms (resolve the one flagged
   Sensitive Info judgment call first).
8. **TestFlight / Play Internal Testing** — invite yourself (and ideally
   one real funeral-home contact) as a tester, re-run
   `testing-checklist.md` against the actual TestFlight/Internal build,
   not just the Xcode debug build.
9. **Submit** — respond to review feedback; the most likely first-round
   friction is account-deletion discoverability, restore-purchases
   visibility, or an external link opening inside the WebView instead of
   the system browser (all already covered as checklist items above).

## What's explicitly out of scope for these docs

Capgo OTA account setup (Phase 8) — deferred until a first compiled
build exists and gets through app review once; OTA only matters for
*post-launch* updates, not the initial submission.
