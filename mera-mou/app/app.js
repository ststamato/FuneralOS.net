(function () {
  var M = window.MeraMou;
  var store = M.load();

  var TITLES = {
    today: 'Σήμερα',
    family: 'Οικογένεια',
    home: 'Σπίτι',
    auto: 'Αυτοκίνητο',
    shopping: 'Αγορές',
    timeline: 'Timeline',
    settings: 'Ρυθμίσεις',
    backup: 'Backup',
    premium: 'Premium'
  };

  var GREETING_EMOJI = { 'Καλημέρα': '☀️', 'Καλησπέρα': '🌇', 'Καληνύχτα': '🌙' };

  var topbarTitle = document.getElementById('topbar-title');
  var navButtons = document.querySelectorAll('.nav-btn');
  var backdrops = document.querySelectorAll('.sheet-backdrop');

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function persist() {
    M.save(store);
  }

  function logTimeline(text) {
    store.timeline.unshift({ id: M.uid(), ts: Date.now(), text: text });
  }

  // ---------- navigation ----------

  function goto(screen) {
    document.querySelectorAll('[data-screen]').forEach(function (el) {
      el.hidden = el.id !== 'screen-' + screen;
    });
    topbarTitle.textContent = TITLES[screen] || 'Η Μέρα Μου';
    navButtons.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.goto === screen);
    });
    closeAllSheets();
  }

  function closeAllSheets() {
    backdrops.forEach(function (b) { b.hidden = true; });
  }

  function openSheet(id) {
    closeAllSheets();
    document.getElementById(id).hidden = false;
  }

  // ---------- due-date aggregation ----------

  function collectDueItems() {
    var items = [];
    store.tasks.forEach(function (t) {
      if (!t.done && t.dueDate) {
        items.push({ kind: 'task', title: t.title, dueDate: t.dueDate, days: M.daysUntil(t.dueDate) });
      }
    });
    store.home.forEach(function (h) {
      if (h.dueDate) {
        items.push({ kind: 'home', title: h.title, dueDate: h.dueDate, days: M.daysUntil(h.dueDate) });
      }
    });
    store.vehicles.forEach(function (v) {
      var fields = [
        ['kteo', 'ΚΤΕΟ'],
        ['insurance', 'Ασφάλεια'],
        ['service', 'Service'],
        ['fees', 'Τέλη κυκλοφορίας']
      ];
      fields.forEach(function (f) {
        if (v[f[0]]) {
          items.push({ kind: 'vehicle', title: f[1] + ' — ' + v.name, dueDate: v[f[0]], days: M.daysUntil(v[f[0]]) });
        }
      });
    });
    items.sort(function (a, b) { return a.days - b.days; });
    return items;
  }

  // ---------- render: today ----------

  function renderToday() {
    var name = store.profile.name ? ', ' + escapeHtml(store.profile.name) : '';
    var g = M.greeting();
    document.getElementById('brief-greeting').textContent = g + name + ' ' + GREETING_EMOJI[g];

    var pending = store.tasks.filter(function (t) { return !t.done; });
    var briefLine = document.getElementById('brief-line');
    if (pending.length > 0) {
      briefLine.innerHTML = 'Σήμερα έχεις <strong>' + pending.length + (pending.length === 1 ? ' εκκρεμότητα' : ' εκκρεμότητες') + '</strong>.';
    } else {
      briefLine.textContent = 'Δεν έχεις καταχωρήσει ακόμα τίποτα για σήμερα.';
    }

    var due = collectDueItems();
    var priorityEl = document.getElementById('brief-priority');
    if (due.length > 0) {
      priorityEl.hidden = false;
      priorityEl.textContent = 'Προτεραιότητα: ' + due[0].title + ' — ' + M.dueLabel(due[0].days) + '.';
    } else {
      priorityEl.hidden = true;
    }

    // tasks list
    var tasksList = document.getElementById('today-tasks-list');
    var tasksEmpty = document.getElementById('today-tasks-empty');
    tasksList.innerHTML = '';
    var visibleTasks = store.tasks.filter(function (t) { return !t.done; });
    tasksEmpty.hidden = visibleTasks.length > 0;
    visibleTasks.forEach(function (t) {
      var days = t.dueDate ? M.daysUntil(t.dueDate) : null;
      var li = document.createElement('li');
      li.className = 'list-item checkable';
      li.innerHTML = '<label><input type="checkbox" class="task-checkbox" data-id="' + t.id + '">' +
        '<span class="row-text">' + escapeHtml(t.title) + (days !== null ? ' — ' + M.dueLabel(days) : '') + '</span></label>' +
        '<button class="item-delete" data-type="task" data-id="' + t.id + '" aria-label="Διαγραφή">×</button>';
      tasksList.appendChild(li);
    });

    // expiring list
    var expiringList = document.getElementById('expiring-list');
    var expiringEmpty = document.getElementById('expiring-empty');
    expiringList.innerHTML = '';
    var expiringItems = collectDueItems().filter(function (item) {
      return item.kind === 'home' || item.kind === 'vehicle';
    }).slice(0, 6);
    expiringEmpty.hidden = expiringItems.length > 0;
    expiringItems.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'list-item';
      li.innerHTML = '<span class="dot ' + M.urgencyClass(item.days) + '"></span><span class="row-text">' +
        escapeHtml(item.title) + ' — ' + M.dueLabel(item.days) + '</span>';
      expiringList.appendChild(li);
    });

    // shopping summary
    var pendingShopping = store.shopping.filter(function (s) { return !s.checked; });
    var summary = document.getElementById('shopping-summary');
    var summaryEmpty = document.getElementById('shopping-summary-empty');
    if (pendingShopping.length > 0) {
      summary.hidden = false;
      summaryEmpty.hidden = true;
      summary.textContent = pendingShopping.length + (pendingShopping.length === 1 ? ' προϊόν' : ' προϊόντα') + ' στη λίστα supermarket';
    } else {
      summary.hidden = true;
      summaryEmpty.hidden = false;
    }
  }

  // ---------- render: family ----------

  function renderFamily() {
    var list = document.getElementById('family-list');
    var empty = document.getElementById('family-empty');
    list.innerHTML = '';
    empty.hidden = store.family.length > 0;
    store.family.forEach(function (m) {
      var meta = [];
      if (m.birthday) meta.push('Γενέθλια: ' + M.formatDayMonth(m.birthday));
      if (m.medsTime) meta.push('Φάρμακο ' + m.medsTime);
      var li = document.createElement('li');
      li.className = 'list-item member editable-row';
      li.dataset.type = 'family';
      li.dataset.id = m.id;
      li.innerHTML = '<div class="member-info"><span class="member-name">' + escapeHtml(m.name) + '</span>' +
        (meta.length ? '<span class="member-meta">' + escapeHtml(meta.join(' · ')) + '</span>' : '') + '</div>' +
        '<button class="item-delete" data-type="family" data-id="' + m.id + '" aria-label="Διαγραφή">×</button>';
      list.appendChild(li);
    });

    var actList = document.getElementById('activities-list');
    var actEmpty = document.getElementById('activities-empty');
    actList.innerHTML = '';
    actEmpty.hidden = store.activities.length > 0;
    store.activities.forEach(function (a) {
      var member = store.family.find(function (m) { return m.id === a.memberId; });
      var li = document.createElement('li');
      li.className = 'list-item';
      li.innerHTML = '<span class="row-text">' + escapeHtml(a.title) +
        (a.when ? ' — ' + escapeHtml(a.when) : '') + (member ? ' (' + escapeHtml(member.name) + ')' : '') + '</span>' +
        '<button class="item-delete" data-type="activity" data-id="' + a.id + '" aria-label="Διαγραφή">×</button>';
      actList.appendChild(li);
    });

    var select = document.getElementById('activity-member');
    select.innerHTML = '<option value="">—</option>' + store.family.map(function (m) {
      return '<option value="' + m.id + '">' + escapeHtml(m.name) + '</option>';
    }).join('');
  }

  // ---------- render: home ----------

  function renderHome() {
    var bills = document.getElementById('home-bills-list');
    var billsEmpty = document.getElementById('home-bills-empty');
    var other = document.getElementById('home-other-list');
    var otherEmpty = document.getElementById('home-other-empty');
    bills.innerHTML = '';
    other.innerHTML = '';

    var billItems = store.home.filter(function (h) { return h.category === 'bill'; });
    var otherItems = store.home.filter(function (h) { return h.category !== 'bill'; });
    billsEmpty.hidden = billItems.length > 0;
    otherEmpty.hidden = otherItems.length > 0;

    function renderRow(h) {
      var days = h.dueDate ? M.daysUntil(h.dueDate) : null;
      var li = document.createElement('li');
      li.className = 'list-item editable-row';
      li.dataset.type = 'home';
      li.dataset.id = h.id;
      li.innerHTML = '<span class="dot ' + (days !== null ? M.urgencyClass(days) : '') + '"></span>' +
        '<span class="row-text">' + escapeHtml(h.title) + (days !== null ? ' — ' + M.dueLabel(days) : '') + '</span>' +
        '<button class="item-delete" data-type="home" data-id="' + h.id + '" aria-label="Διαγραφή">×</button>';
      return li;
    }

    billItems.forEach(function (h) { bills.appendChild(renderRow(h)); });
    otherItems.forEach(function (h) { other.appendChild(renderRow(h)); });
  }

  // ---------- render: auto ----------

  function renderAuto() {
    var container = document.getElementById('vehicles-container');
    var empty = document.getElementById('vehicles-empty');
    container.innerHTML = '';
    empty.hidden = store.vehicles.length > 0;

    store.vehicles.forEach(function (v) {
      var fields = [
        ['ΚΤΕΟ', v.kteo, false],
        ['Ασφάλεια', v.insurance, false],
        ['Service', v.service, false],
        ['Τέλη κυκλοφορίας', v.fees, false],
        ['Ελαστικά — τελευταία αλλαγή', v.tires, true]
      ];
      var rows = fields.map(function (f) {
        if (!f[1]) return '';
        if (f[2]) {
          return '<li class="list-item"><span class="dot"></span><span class="row-text">' + escapeHtml(f[0]) + ': ' + M.formatDayMonth(f[1]) + '</span></li>';
        }
        var days = M.daysUntil(f[1]);
        return '<li class="list-item"><span class="dot ' + M.urgencyClass(days) + '"></span><span class="row-text">' +
          escapeHtml(f[0]) + ' — ' + M.dueLabel(days) + '</span></li>';
      }).join('');

      var card = document.createElement('div');
      card.className = 'card vehicle-card';
      card.innerHTML = '<div class="vehicle-header editable-row" data-type="vehicle" data-id="' + v.id + '">' +
        '<h2 class="card-title">' + escapeHtml(v.name) + (v.plate ? ' · ' + escapeHtml(v.plate) : '') + '</h2>' +
        '<button class="item-delete" data-type="vehicle" data-id="' + v.id + '" aria-label="Διαγραφή">×</button></div>' +
        (rows ? '<ul class="list">' + rows + '</ul>' : '<p class="empty-state">Δεν έχεις καταχωρήσει ημερομηνίες ακόμα.</p>');
      container.appendChild(card);
    });
  }

  // ---------- render: shopping ----------

  function renderShopping() {
    var list = document.getElementById('shopping-list');
    var listEmpty = document.getElementById('shopping-list-empty');
    list.innerHTML = '';
    listEmpty.hidden = store.shopping.length > 0;
    store.shopping.forEach(function (s) {
      var li = document.createElement('li');
      li.className = 'list-item checkable';
      li.innerHTML = '<label><input type="checkbox" class="shopping-checkbox" data-id="' + s.id + '"' + (s.checked ? ' checked' : '') + '>' +
        '<span class="row-text">' + escapeHtml(s.name) + '</span></label>' +
        '<button class="item-delete" data-type="shopping" data-id="' + s.id + '" aria-label="Διαγραφή">×</button>';
      list.appendChild(li);
    });

    var chips = document.getElementById('frequent-chips');
    var chipsEmpty = document.getElementById('frequent-empty');
    var frequentNames = [];
    store.shopping.forEach(function (s) {
      if (s.frequent && frequentNames.indexOf(s.name) === -1) frequentNames.push(s.name);
    });
    chipsEmpty.hidden = frequentNames.length > 0;
    chips.innerHTML = frequentNames.map(function (name) {
      return '<button class="chip" data-frequent-name="' + escapeHtml(name) + '">' + escapeHtml(name) + '</button>';
    }).join('');
  }

  // ---------- render: timeline ----------

  function renderTimeline() {
    var list = document.getElementById('timeline-list');
    var empty = document.getElementById('timeline-empty');
    list.innerHTML = '';
    empty.hidden = store.timeline.length > 0;
    store.timeline.slice(0, 50).forEach(function (entry) {
      var li = document.createElement('li');
      li.className = 'list-item';
      li.innerHTML = '<span class="row-text">' + M.relativeDay(entry.ts) + ' — ' + escapeHtml(entry.text) + '</span>';
      list.appendChild(li);
    });
  }

  function renderAvatar() {
    var name = store.profile.name.trim();
    var avatarBtn = document.getElementById('profile-btn');
    if (!name) {
      avatarBtn.textContent = '👤';
      return;
    }
    var initials = name.split(/\s+/).slice(0, 2).map(function (p) { return p[0].toUpperCase(); }).join('');
    avatarBtn.textContent = initials;
  }

  function renderAll() {
    renderAvatar();
    renderToday();
    renderFamily();
    renderHome();
    renderAuto();
    renderShopping();
    renderTimeline();
  }

  // ---------- form helpers ----------

  function resetForm(form) {
    form.reset();
  }

  // Quick add (today task)
  document.getElementById('quickadd-sheet').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = document.getElementById('quickadd-title').value.trim();
    if (!title) return;
    var dueDate = document.getElementById('quickadd-date').value || null;
    store.tasks.push({ id: M.uid(), title: title, dueDate: dueDate, done: false });
    logTimeline('Προστέθηκε: ' + title);
    persist();
    resetForm(e.target);
    closeAllSheets();
    renderAll();
  });

  // Family member add/edit
  document.getElementById('member-sheet').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('member-id').value;
    var name = document.getElementById('member-name').value.trim();
    if (!name) return;
    var data = {
      name: name,
      birthday: document.getElementById('member-birthday').value || '',
      medsTime: document.getElementById('member-meds').value || '',
      notes: document.getElementById('member-notes').value.trim()
    };
    if (id) {
      var existing = store.family.find(function (m) { return m.id === id; });
      Object.assign(existing, data);
      logTimeline('Ενημερώθηκε μέλος: ' + name);
    } else {
      store.family.push(Object.assign({ id: M.uid() }, data));
      logTimeline('Νέο μέλος οικογένειας: ' + name);
    }
    persist();
    resetForm(e.target);
    document.getElementById('member-id').value = '';
    closeAllSheets();
    renderAll();
  });

  // Family activity add
  document.getElementById('activity-sheet').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = document.getElementById('activity-title').value.trim();
    if (!title) return;
    store.activities.push({
      id: M.uid(),
      title: title,
      memberId: document.getElementById('activity-member').value || null,
      when: document.getElementById('activity-when').value.trim()
    });
    logTimeline('Νέα δραστηριότητα: ' + title);
    persist();
    resetForm(e.target);
    closeAllSheets();
    renderAll();
  });

  // Home item add/edit
  document.getElementById('home-sheet').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('home-id').value;
    var title = document.getElementById('home-title').value.trim();
    if (!title) return;
    var data = {
      title: title,
      category: document.getElementById('home-category').value,
      dueDate: document.getElementById('home-date').value || null
    };
    if (id) {
      var existing = store.home.find(function (h) { return h.id === id; });
      Object.assign(existing, data);
      logTimeline('Ενημερώθηκε: ' + title);
    } else {
      store.home.push(Object.assign({ id: M.uid() }, data));
      logTimeline('Νέα υποχρέωση σπιτιού: ' + title);
    }
    persist();
    resetForm(e.target);
    document.getElementById('home-id').value = '';
    closeAllSheets();
    renderAll();
  });

  // Vehicle add/edit
  document.getElementById('vehicle-sheet').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('vehicle-id').value;
    var name = document.getElementById('vehicle-name').value.trim();
    if (!name) return;
    var data = {
      name: name,
      plate: document.getElementById('vehicle-plate').value.trim(),
      kteo: document.getElementById('vehicle-kteo').value || null,
      insurance: document.getElementById('vehicle-insurance').value || null,
      service: document.getElementById('vehicle-service').value || null,
      fees: document.getElementById('vehicle-fees').value || null,
      tires: document.getElementById('vehicle-tires').value || null
    };
    if (id) {
      var existing = store.vehicles.find(function (v) { return v.id === id; });
      Object.assign(existing, data);
      logTimeline('Ενημερώθηκε όχημα: ' + name);
    } else {
      store.vehicles.push(Object.assign({ id: M.uid() }, data));
      logTimeline('Νέο όχημα: ' + name);
    }
    persist();
    resetForm(e.target);
    document.getElementById('vehicle-id').value = '';
    closeAllSheets();
    renderAll();
  });

  // Shopping item add
  document.getElementById('shopping-sheet').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('shopping-name').value.trim();
    if (!name) return;
    store.shopping.push({
      id: M.uid(),
      name: name,
      checked: false,
      frequent: document.getElementById('shopping-frequent').checked
    });
    logTimeline('Προστέθηκε στη λίστα αγορών: ' + name);
    persist();
    resetForm(e.target);
    closeAllSheets();
    renderAll();
  });

  // Settings name
  document.getElementById('settings-name').addEventListener('change', function (e) {
    store.profile.name = e.target.value.trim();
    persist();
    renderToday();
  });

  // Backup export
  document.getElementById('backup-export-btn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'mera-mou-backup-' + M.todayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Backup import
  document.getElementById('backup-import-input').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var imported = JSON.parse(reader.result);
        store = Object.assign({ profile: {}, tasks: [], family: [], activities: [], home: [], vehicles: [], shopping: [], timeline: [] }, imported);
        persist();
        renderAll();
        document.getElementById('settings-name').value = store.profile.name || '';
      } catch (err) {
        alert('Το αρχείο δεν είναι έγκυρο αντίγραφο.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // ---------- edit openers ----------

  function openMemberEdit(id) {
    var m = store.family.find(function (x) { return x.id === id; });
    if (!m) return;
    document.getElementById('member-sheet-title').textContent = 'Επεξεργασία μέλους';
    document.getElementById('member-id').value = m.id;
    document.getElementById('member-name').value = m.name;
    document.getElementById('member-birthday').value = m.birthday || '';
    document.getElementById('member-meds').value = m.medsTime || '';
    document.getElementById('member-notes').value = m.notes || '';
    openSheet('member-backdrop');
  }

  function openHomeEdit(id) {
    var h = store.home.find(function (x) { return x.id === id; });
    if (!h) return;
    document.getElementById('home-sheet-title').textContent = 'Επεξεργασία υποχρέωσης';
    document.getElementById('home-id').value = h.id;
    document.getElementById('home-title').value = h.title;
    document.getElementById('home-category').value = h.category;
    document.getElementById('home-date').value = h.dueDate || '';
    openSheet('home-backdrop');
  }

  function openVehicleEdit(id) {
    var v = store.vehicles.find(function (x) { return x.id === id; });
    if (!v) return;
    document.getElementById('vehicle-sheet-title').textContent = 'Επεξεργασία οχήματος';
    document.getElementById('vehicle-id').value = v.id;
    document.getElementById('vehicle-name').value = v.name;
    document.getElementById('vehicle-plate').value = v.plate || '';
    document.getElementById('vehicle-kteo').value = v.kteo || '';
    document.getElementById('vehicle-insurance').value = v.insurance || '';
    document.getElementById('vehicle-service').value = v.service || '';
    document.getElementById('vehicle-fees').value = v.fees || '';
    document.getElementById('vehicle-tires').value = v.tires || '';
    openSheet('vehicle-backdrop');
  }

  // ---------- delete ----------

  function handleDelete(type, id) {
    var map = { task: 'tasks', family: 'family', activity: 'activities', home: 'home', vehicle: 'vehicles', shopping: 'shopping' };
    var key = map[type];
    if (!key) return;
    var idx = store[key].findIndex(function (x) { return x.id === id; });
    if (idx === -1) return;
    var removed = store[key][idx];
    var label = removed.title || removed.name || 'στοιχείο';
    store[key].splice(idx, 1);
    logTimeline('Διαγράφηκε: ' + label);
    persist();
    renderAll();
  }

  // ---------- global click handling ----------

  document.addEventListener('click', function (event) {
    var delBtn = event.target.closest('.item-delete');
    if (delBtn) {
      event.stopPropagation();
      handleDelete(delBtn.dataset.type, delBtn.dataset.id);
      return;
    }

    var editRow = event.target.closest('.editable-row');
    if (editRow) {
      var type = editRow.dataset.type;
      var id = editRow.dataset.id;
      if (type === 'family') openMemberEdit(id);
      else if (type === 'home') openHomeEdit(id);
      else if (type === 'vehicle') openVehicleEdit(id);
      return;
    }

    var chip = event.target.closest('.chip[data-frequent-name]');
    if (chip) {
      var chipName = chip.dataset.frequentName;
      var existing = store.shopping.find(function (s) { return s.name === chipName && s.checked; });
      if (existing) {
        existing.checked = false;
      } else if (!store.shopping.some(function (s) { return s.name === chipName && !s.checked; })) {
        store.shopping.push({ id: M.uid(), name: chipName, checked: false, frequent: true });
      }
      persist();
      renderAll();
      return;
    }

    var gotoTarget = event.target.closest('[data-goto]');
    if (gotoTarget) {
      goto(gotoTarget.dataset.goto);
      return;
    }

    if (event.target.id === 'profile-btn') { openSheet('profile-backdrop'); return; }
    if (event.target.id === 'quick-add-btn') { openSheet('quickadd-backdrop'); return; }
    if (event.target.id === 'add-member-btn') {
      document.getElementById('member-sheet-title').textContent = 'Νέο μέλος';
      document.getElementById('member-sheet').reset();
      document.getElementById('member-id').value = '';
      openSheet('member-backdrop');
      return;
    }
    if (event.target.id === 'add-activity-btn') { openSheet('activity-backdrop'); return; }
    if (event.target.id === 'add-home-btn') {
      document.getElementById('home-sheet-title').textContent = 'Νέα υποχρέωση σπιτιού';
      document.getElementById('home-sheet').reset();
      document.getElementById('home-id').value = '';
      openSheet('home-backdrop');
      return;
    }
    if (event.target.id === 'add-vehicle-btn') {
      document.getElementById('vehicle-sheet-title').textContent = 'Νέο όχημα';
      document.getElementById('vehicle-sheet').reset();
      document.getElementById('vehicle-id').value = '';
      openSheet('vehicle-backdrop');
      return;
    }
    if (event.target.id === 'add-shopping-btn') { openSheet('shopping-backdrop'); return; }

    if (event.target.classList.contains('sheet-backdrop')) {
      event.target.hidden = true;
      return;
    }
  });

  document.addEventListener('change', function (event) {
    if (event.target.classList.contains('task-checkbox')) {
      var task = store.tasks.find(function (t) { return t.id === event.target.dataset.id; });
      if (task) {
        task.done = event.target.checked;
        if (task.done) logTimeline('Ολοκληρώθηκε: ' + task.title);
        persist();
        renderAll();
      }
      return;
    }
    if (event.target.classList.contains('shopping-checkbox')) {
      var item = store.shopping.find(function (s) { return s.id === event.target.dataset.id; });
      if (item) {
        item.checked = event.target.checked;
        persist();
        renderAll();
      }
    }
  });

  // ---------- init ----------

  document.getElementById('settings-name').value = store.profile.name || '';
  goto('today');
  renderAll();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
