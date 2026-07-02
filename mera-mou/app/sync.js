(function (global) {
  var cfg = global.MERA_MOU_CONFIG || null;
  var configured = !!(cfg && cfg.supabaseUrl && cfg.supabaseAnonKey &&
    cfg.supabaseUrl.indexOf('YOUR_') === -1 && cfg.supabaseAnonKey.indexOf('YOUR_') === -1);

  var client = null;
  if (configured && global.supabase && global.supabase.createClient) {
    client = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  } else {
    configured = false;
  }

  function isConfigured() {
    return configured;
  }

  function onAuthStateChange(cb) {
    if (!client) return;
    client.auth.onAuthStateChange(function (event, session) {
      cb(session);
    });
  }

  function getSession() {
    if (!client) return Promise.resolve(null);
    return client.auth.getSession().then(function (r) { return r.data.session; });
  }

  function sendMagicLink(email) {
    if (!client) return Promise.reject(new Error('not configured'));
    return client.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: global.location.origin + global.location.pathname }
    });
  }

  function signOut() {
    if (!client) return Promise.resolve();
    return client.auth.signOut();
  }

  function pushData(store) {
    if (!client) return Promise.reject(new Error('not configured'));
    return client.auth.getUser().then(function (r) {
      var user = r.data.user;
      if (!user) return Promise.reject(new Error('not signed in'));
      return client.from('mera_mou_data').upsert({
        user_id: user.id,
        data: store,
        updated_at: new Date().toISOString()
      });
    });
  }

  function pullData() {
    if (!client) return Promise.reject(new Error('not configured'));
    return client.auth.getUser().then(function (r) {
      var user = r.data.user;
      if (!user) return Promise.reject(new Error('not signed in'));
      return client.from('mera_mou_data').select('data,updated_at').eq('user_id', user.id).maybeSingle();
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  global.MeraMouSync = {
    isConfigured: isConfigured,
    onAuthStateChange: onAuthStateChange,
    getSession: getSession,
    sendMagicLink: sendMagicLink,
    signOut: signOut,
    pushData: pushData,
    pullData: pullData
  };
})(window);
