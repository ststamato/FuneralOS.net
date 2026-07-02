// Η Μέρα Μου — Supabase config for device sync.
// 1. Create a free project at https://supabase.com
// 2. Run mera-mou/supabase/setup.sql in its SQL Editor
// 3. Project Settings → API → copy the "Project URL" and "anon public" key below.
// The anon key is safe to commit: access is controlled by Row Level Security
// policies (see setup.sql), not by keeping this key secret.
window.MERA_MOU_CONFIG = {
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY'
};
