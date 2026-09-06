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
};

export default config;
