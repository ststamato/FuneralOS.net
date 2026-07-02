(function (global) {
  var STORAGE_KEY = 'mera-mou:v1';

  function emptyStore() {
    return {
      profile: { name: '', lang: 'el' },
      meta: { updatedAt: 0 },
      tasks: [],
      family: [],
      activities: [],
      home: [],
      vehicles: [],
      shopping: [],
      timeline: []
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        var base = emptyStore();
        var merged = Object.assign(base, parsed);
        merged.profile = Object.assign({ name: '', lang: 'el' }, merged.profile);
        merged.meta = Object.assign({ updatedAt: 0 }, merged.meta);
        return merged;
      }
    } catch (e) {}
    return emptyStore();
  }

  function save(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var target = new Date(dateStr + 'T00:00:00');
    if (isNaN(target.getTime())) return null;
    return Math.round((target - today) / 86400000);
  }

  function urgencyClass(days) {
    if (days === null) return '';
    if (days <= 2) return 'dot-urgent';
    if (days <= 14) return 'dot-warn';
    return '';
  }

  global.MeraMou = {
    load: load,
    save: save,
    uid: uid,
    todayISO: todayISO,
    daysUntil: daysUntil,
    urgencyClass: urgencyClass
  };
})(window);
