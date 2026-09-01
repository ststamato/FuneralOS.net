# Pre-submission smoke test — TestFlight / Play Internal Testing

Run this on a **real device** for each edition, not just the simulator —
push notifications and IAP sandbox purchases don't work reliably in the
iOS Simulator, and background/OS-level behavior (backgrounding, killing
the app, notification permission prompts) only shows up on hardware.

## Auth & core flow
- [ ] Sign up a new account
- [ ] Log out, log back in
- [ ] Password reset flow completes and returns to the app (deep link via
      the custom URL scheme, `net.funeralos.gr://` / `net.funeralos.en://`)
- [ ] Create a case/ceremony, edit it, confirm it saves
- [ ] Delete a case (owner/admin role only — confirm editor role can't)

## Offline / sync
- [ ] Turn on Airplane Mode, create/edit a case, confirm it queues
- [ ] Turn Airplane Mode back off, confirm the queued change syncs
- [ ] Two devices (or one device + web), edit the same case near-
      simultaneously, confirm the conflict-resolution UI appears instead
      of silently dropping one edit

## Native IAP (RevenueCat, sandbox)
- [ ] Tap Upgrade → Pro, complete a sandbox purchase, confirm the plan
      updates in the app within a few seconds (via `revenuecat-webhook`)
- [ ] Tap "Restore Purchases" on a fresh install, confirm it restores the
      correct plan
- [ ] Confirm the "Manage subscription" link opens the platform's own
      subscription settings (App Store / Play Store), not a broken page

## Push notifications
- [ ] Grant notification permission when prompted
- [ ] Trigger a push (e.g. via `push_sender`'s FCM branch — low
      warehouse stock alert, or an assigned-case notification) and
      confirm it arrives with the app backgrounded
- [ ] Tap the notification, confirm it opens the app to a relevant screen

## Account deletion
- [ ] Settings → Delete Account → confirm the typed-confirmation modal
      works, the account is actually gone (can't log back in), and no
      orphaned `case_documents` Storage objects remain (spot-check the
      Storage bucket for the deleted office's files)

## External links stay outside the WebView
- [ ] Open a document (case_documents signed URL) — should open in the
      system viewer/browser, not render broken inside the app's own
      WebView
- [ ] WhatsApp share button opens WhatsApp (or the share sheet), not a
      dead link
- [ ] `mailto:` links open Mail, not a blank screen

## App icon & branding
- [ ] Home Screen icon matches the current design (no leftover white
      corners, no stale cached icon from a previous build)
- [ ] Splash screen shows correctly, doesn't hang (see
      `native-bridge.js`'s `CapacitorUpdater.notifyAppReady()` call —
      this is what unblocks it)

## Language / locale (GR vs EN edition)
- [ ] GR edition: all UI strings in Greek, currency shown as €
- [ ] EN edition: all UI strings in English, currency shown as $, USA-
      specific modules present (Staff, Fleet, Cremation workflow,
      Scheduling board)

## OTA update (once Capgo account exists — Phase 8)
- [ ] Push a trivial JS/HTML change via `native/publish-ota.sh`, confirm
      the running app picks it up without a new store submission
- [ ] Confirm a native-layer change (new permission, icon, IAP flow) is
      correctly NOT deliverable via OTA — Capgo/Apple's rules require a
      new binary for those
