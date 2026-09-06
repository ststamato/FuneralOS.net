import type { CapacitorConfig } from '@capacitor/cli';

// FuneralOS — Greek edition native wrapper.
// Deliberately left on Capacitor's DEFAULT WebView origins (iOS:
// capacitor://localhost, Android: https://localhost) rather than a custom
// server.hostname/androidScheme — the CORS allow-list added to the Supabase
// edge functions this app calls (admin-stats, ai-assistant, team-invite,
// accept-invite, push_sender) assumes exactly these two default origins.
// Changing this later means updating that allow-list too.
const config: CapacitorConfig = {
  appId: 'net.funeralos.gr',
  appName: 'FuneralOS',
  webDir: 'www',
  plugins: {
    // No Capgo account/channel exists yet (mobile-plan Phase 8, still
    // pending) — with autoUpdate left on its default, the plugin tries to
    // phone home on every launch and fails ("getLatest failed with error:
    // on_premise_app"), which was blocking the splash screen from ever
    // clearing. notifyAppReady() (see saas/native-bridge.js) still runs
    // regardless — this only turns off the update *check*, not the
    // plugin. Flip back to a real autoUpdate mode once Capgo is set up.
    CapacitorUpdater: {
      autoUpdate: false,
    },
  },
};

export default config;
