(function (global) {
  var STORAGE_KEY = 'mera-mou:v1';
  var GREEK_MONTHS = ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου',
    'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];

  function emptyStore() {
    return {
      profile: { name: '' },
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
        return Object.assign(base, parsed);
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

  function dueLabel(days) {
    if (days === null) return '';
    if (days < 0) return 'έληξε πριν ' + Math.abs(days) + (Math.abs(days) === 1 ? ' ημέρα' : ' ημέρες');
    if (days === 0) return 'σήμερα';
    if (days === 1) return 'αύριο';
    return 'σε ' + days + ' ημέρες';
  }

  function formatDayMonth(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return d.getDate() + ' ' + GREEK_MONTHS[d.getMonth()];
  }

  function greeting() {
    var h = new Date().getHours();
    if (h < 12) return 'Καλημέρα';
    if (h < 19) return 'Καλησπέρα';
    return 'Καληνύχτα';
  }

  function relativeDay(ts) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var day = new Date(ts);
    day.setHours(0, 0, 0, 0);
    var diff = Math.round((today - day) / 86400000);
    if (diff === 0) return 'Σήμερα';
    if (diff === 1) return 'Χθες';
    return 'Πριν ' + diff + ' ημέρες';
  }

  global.MeraMou = {
    load: load,
    save: save,
    uid: uid,
    todayISO: todayISO,
    daysUntil: daysUntil,
    urgencyClass: urgencyClass,
    dueLabel: dueLabel,
    formatDayMonth: formatDayMonth,
    greeting: greeting,
    relativeDay: relativeDay
  };
})(window);
