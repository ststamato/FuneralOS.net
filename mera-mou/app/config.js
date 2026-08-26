// Η Μέρα Μου — Supabase config for device sync.
// Project: mera-mou (eu-west-1), separate from the FuneralOS project.
// The anon key and VAPID public key are safe to commit: the anon key is
// scoped by Row Level Security (see supabase/setup.sql), and a VAPID
// *public* key is meant to be public — only the matching private key
// (kept as a Supabase Edge Function secret, never in this repo) can sign
// push messages.
window.MERA_MOU_CONFIG = {
  supabaseUrl: 'https://csbbnngpiogbvhnaenjo.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzYmJubmdwaW9nYnZobmFlbmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2Njc4NDIsImV4cCI6MjEwMzI0Mzg0Mn0.L_bN7B4hgdNzVfnk4mnyqtaoy0mn4Z0p-4tkJLlF9JE',
  vapidPublicKey: 'BCgCeDI9uFCpkWCpa-Wd6gJglE98yCdchcJAbXOXUmhTPFfywijvKus2wnKx4ms7BBOgZPelwegkigfB1Hu2eU8'
};
