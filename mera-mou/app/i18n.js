(function (global) {
  var STORAGE_KEY = 'mera-mou:lang';
  var DEFAULT_LANG = 'el';

  var MONTHS = {
    el: ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'],
    it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };

  var DATE_FORMAT = {
    el: function (d, month) { return d + ' ' + month; },
    it: function (d, month) { return d + ' ' + month; },
    es: function (d, month) { return d + ' de ' + month; },
    fr: function (d, month) { return d + ' ' + month; },
    en: function (d, month) { return month + ' ' + d; }
  };

  var LANG_NAMES = { el: 'Ελληνικά', it: 'Italiano', es: 'Español', fr: 'Français', en: 'English' };

  var STRINGS = {
    el: {
      'app.title': 'Η Μέρα Μου',
      'app.description': 'Ο προσωπικός πίνακας ελέγχου της καθημερινότητάς σου.',

      'nav.today': 'Σήμερα',
      'nav.family': 'Οικογένεια',
      'nav.home': 'Σπίτι',
      'nav.auto': 'Auto',
      'nav.shopping': 'Αγορές',
      'nav.timeline': 'Timeline',
      'nav.settings': 'Ρυθμίσεις',
      'nav.backup': 'Backup',
      'nav.premium': 'Premium',

      'today.tasksTitle': 'Εκκρεμότητες ημέρας',
      'today.tasksEmpty': 'Καμία εκκρεμότητα ακόμα.',
      'today.expiringTitle': 'Λήγει κάτι;',
      'today.expiringEmpty': 'Καμία λήξη καταχωρημένη.',
      'today.shoppingTitle': 'Τι πρέπει να αγοράσεις;',
      'today.shoppingEmpty': 'Η λίστα αγορών είναι άδεια.',
      'today.goShopping': 'Πήγαινε στις Αγορές →',
      'today.quickAdd': 'Νέα υποχρέωση',
      'today.noneToday': 'Δεν έχεις καταχωρήσει ακόμα τίποτα για σήμερα.',
      'today.priorityPrefix': 'Προτεραιότητα:',
      'today.pendingLine': 'Σήμερα έχεις <strong>{n} {unit}</strong>.',
      'today.shoppingSummary': '{n} {unit} στη λίστα supermarket',

      'unit.pendingOne': 'εκκρεμότητα',
      'unit.pendingMany': 'εκκρεμότητες',
      'unit.productOne': 'προϊόν',
      'unit.productMany': 'προϊόντα',

      'family.membersTitle': 'Μέλη οικογένειας',
      'family.membersEmpty': 'Δεν έχεις προσθέσει μέλη ακόμα.',
      'family.activitiesTitle': 'Δραστηριότητες',
      'family.activitiesEmpty': 'Καμία δραστηριότητα καταχωρημένη.',
      'family.addActivity': '+ Δραστηριότητα',
      'family.addMember': '+ Νέο μέλος',
      'family.birthdayPrefix': 'Γενέθλια:',
      'family.namedayPrefix': 'Γιορτή:',
      'family.medsPrefix': 'Φάρμακο',

      'home.billsTitle': 'Λογαριασμοί',
      'home.billsEmpty': 'Κανένας λογαριασμός καταχωρημένος.',
      'home.otherTitle': 'Ασφάλειες & συντηρήσεις',
      'home.otherEmpty': 'Καμία ασφάλεια ή συντήρηση καταχωρημένη.',
      'home.addItem': '+ Νέα υποχρέωση',

      'auto.empty': 'Δεν έχεις προσθέσει όχημα ακόμα.',
      'auto.addVehicle': '+ Νέο όχημα',
      'auto.noDates': 'Δεν έχεις καταχωρήσει ημερομηνίες ακόμα.',
      'auto.kteo': 'ΚΤΕΟ',
      'auto.insurance': 'Ασφάλεια',
      'auto.service': 'Service',
      'auto.fees': 'Τέλη κυκλοφορίας',
      'auto.tiresLabel': 'Ελαστικά — τελευταία αλλαγή',

      'shopping.listTitle': 'Λίστα supermarket',
      'shopping.listEmpty': 'Η λίστα είναι άδεια.',
      'shopping.frequentTitle': 'Συχνά προϊόντα',
      'shopping.frequentEmpty': 'Δεν έχεις καταχωρήσει συχνά προϊόντα ακόμα.',
      'shopping.addProduct': '+ Προϊόν',

      'timeline.subtitle': 'Ιστορικό ζωής, εξόδων και ενεργειών.',
      'timeline.empty': 'Δεν υπάρχει ακόμα ιστορικό. Θα εμφανίζεται εδώ καθώς χρησιμοποιείς την εφαρμογή.',

      'rel.today': 'Σήμερα',
      'rel.yesterday': 'Χθες',
      'rel.daysAgo': 'Πριν {n} ημέρες',

      'settings.yourName': 'Το όνομά σου',
      'settings.namePlaceholder': 'π.χ. Σταύρος',
      'settings.language': 'Γλώσσα',
      'settings.notifications': 'Ειδοποιήσεις — Ενεργές',
      'settings.theme': 'Θέμα — Σύστημα',

      'backup.subtitle': 'Τα δεδομένα σου μένουν στο κινητό. Το cloud backup είναι λειτουργία Premium.',
      'backup.export': 'Λήψη αντιγράφου (.json)',
      'backup.import': 'Εισαγωγή αντιγράφου',
      'backup.invalidFile': 'Το αρχείο δεν είναι έγκυρο αντίγραφο.',

      'premium.title': 'Premium — 2,99€/μήνα',
      'premium.family': 'Οικογένεια — πολλαπλά μέλη',
      'premium.reminders': 'Απεριόριστες υπενθυμίσεις',
      'premium.vehicles': 'Περισσότερα αυτοκίνητα',
      'premium.cloudBackup': 'Cloud backup',
      'premium.aiDailyBrief': 'AI daily brief',
      'premium.sync': 'Συγχρονισμός συσκευών',
      'premium.cta': 'Δοκίμασε Premium',

      'sheet.save': 'Αποθήκευση',

      'task.addTitle': 'Γρήγορη προσθήκη',
      'task.editTitle': 'Επεξεργασία εκκρεμότητας',
      'task.placeholder': 'π.χ. Πληρωμή ΟΤΕ',
      'task.whenLabel': 'Πότε; (προαιρετικό)',

      'member.addTitle': 'Νέο μέλος',
      'member.editTitle': 'Επεξεργασία μέλους',
      'member.nameLabel': 'Όνομα',
      'member.namePlaceholder': 'π.χ. Ελένη',
      'member.birthdayLabel': 'Γενέθλια',
      'member.namedayLabel': 'Γιορτή ονόματος',
      'member.medsLabel': 'Ώρα φαρμάκου (προαιρετικό)',
      'member.notesLabel': 'Σημειώσεις',
      'member.notesPlaceholder': 'π.χ. αλλεργίες, προτιμήσεις',

      'activity.addTitle': 'Νέα δραστηριότητα',
      'activity.editTitle': 'Επεξεργασία δραστηριότητας',
      'activity.whatLabel': 'Τι;',
      'activity.whatPlaceholder': 'π.χ. Κολύμπι',
      'activity.whoLabel': 'Ποιος;',
      'activity.whenLabel': 'Πότε;',
      'activity.whenPlaceholder': 'π.χ. Τρίτη 18:00',

      'home.addTitle': 'Νέα υποχρέωση σπιτιού',
      'home.editTitle': 'Επεξεργασία υποχρέωσης',
      'home.titleLabel': 'Τίτλος',
      'home.titlePlaceholder': 'π.χ. ΔΕΗ',
      'home.categoryLabel': 'Κατηγορία',
      'home.categoryBill': 'Λογαριασμός',
      'home.categoryInsurance': 'Ασφάλεια',
      'home.categoryMaintenance': 'Συντήρηση',
      'home.dueLabel': 'Ημερομηνία λήξης',

      'vehicle.addTitle': 'Νέο όχημα',
      'vehicle.editTitle': 'Επεξεργασία οχήματος',
      'vehicle.modelLabel': 'Μοντέλο',
      'vehicle.modelPlaceholder': 'π.χ. Toyota Yaris',
      'vehicle.plateLabel': 'Πινακίδα',
      'vehicle.platePlaceholder': 'π.χ. ΙΧΧ 1234',
      'vehicle.kteoLabel': 'ΚΤΕΟ — λήξη',
      'vehicle.insuranceLabel': 'Ασφάλεια — λήξη',
      'vehicle.serviceLabel': 'Επόμενο service',
      'vehicle.feesLabel': 'Τέλη κυκλοφορίας — προθεσμία',
      'vehicle.tiresEditLabel': 'Ελαστικά — τελευταία αλλαγή',

      'shopping.addTitle': 'Νέο προϊόν',
      'shopping.editTitle': 'Επεξεργασία προϊόντος',
      'shopping.namePlaceholder': 'π.χ. Γάλα',
      'shopping.frequentCheckbox': 'Συχνό προϊόν',

      'due.today': 'σήμερα',
      'due.tomorrow': 'αύριο',
      'due.in': 'σε {n} ημέρες',
      'due.overdueOne': 'έληξε πριν 1 ημέρα',
      'due.overdueMany': 'έληξε πριν {n} ημέρες',

      'greeting.morning': 'Καλημέρα',
      'greeting.afternoon': 'Καλησπέρα',
      'greeting.night': 'Καληνύχτα',

      'log.added': 'Προστέθηκε: {title}',
      'log.updated': 'Ενημερώθηκε: {title}',
      'log.newMember': 'Νέο μέλος οικογένειας: {title}',
      'log.updatedMember': 'Ενημερώθηκε μέλος: {title}',
      'log.newActivity': 'Νέα δραστηριότητα: {title}',
      'log.updatedActivity': 'Ενημερώθηκε δραστηριότητα: {title}',
      'log.newHome': 'Νέα υποχρέωση σπιτιού: {title}',
      'log.newVehicle': 'Νέο όχημα: {title}',
      'log.updatedVehicle': 'Ενημερώθηκε όχημα: {title}',
      'log.newShopping': 'Προστέθηκε στη λίστα αγορών: {title}',
      'log.updatedShopping': 'Ενημερώθηκε προϊόν: {title}',
      'log.completed': 'Ολοκληρώθηκε: {title}',
      'log.deleted': 'Διαγράφηκε: {title}',

      'aria.profile': 'Προφίλ',
      'aria.quickAdd': 'Γρήγορη προσθήκη',
      'aria.edit': 'Επεξεργασία',
      'aria.delete': 'Διαγραφή'
    },

    it: {
      'app.title': 'Η Μέρα Μου',
      'app.description': 'Il tuo pannello di controllo personale per la vita quotidiana.',

      'nav.today': 'Oggi',
      'nav.family': 'Famiglia',
      'nav.home': 'Casa',
      'nav.auto': 'Auto',
      'nav.shopping': 'Spesa',
      'nav.timeline': 'Timeline',
      'nav.settings': 'Impostazioni',
      'nav.backup': 'Backup',
      'nav.premium': 'Premium',

      'today.tasksTitle': 'Impegni di oggi',
      'today.tasksEmpty': 'Nessun impegno ancora.',
      'today.expiringTitle': 'Qualcosa in scadenza?',
      'today.expiringEmpty': 'Nessuna scadenza registrata.',
      'today.shoppingTitle': 'Cosa devi comprare?',
      'today.shoppingEmpty': 'La lista della spesa è vuota.',
      'today.goShopping': 'Vai alla Spesa →',
      'today.quickAdd': 'Nuovo impegno',
      'today.noneToday': 'Non hai ancora registrato nulla per oggi.',
      'today.priorityPrefix': 'Priorità:',
      'today.pendingLine': 'Oggi hai <strong>{n} {unit}</strong>.',
      'today.shoppingSummary': '{n} {unit} nella lista della spesa',

      'unit.pendingOne': 'impegno',
      'unit.pendingMany': 'impegni',
      'unit.productOne': 'prodotto',
      'unit.productMany': 'prodotti',

      'family.membersTitle': 'Membri della famiglia',
      'family.membersEmpty': 'Non hai ancora aggiunto membri.',
      'family.activitiesTitle': 'Attività',
      'family.activitiesEmpty': 'Nessuna attività registrata.',
      'family.addActivity': '+ Attività',
      'family.addMember': '+ Nuovo membro',
      'family.birthdayPrefix': 'Compleanno:',
      'family.namedayPrefix': 'Onomastico:',
      'family.medsPrefix': 'Farmaco',

      'home.billsTitle': 'Bollette',
      'home.billsEmpty': 'Nessuna bolletta registrata.',
      'home.otherTitle': 'Assicurazioni e manutenzioni',
      'home.otherEmpty': 'Nessuna assicurazione o manutenzione registrata.',
      'home.addItem': '+ Nuova scadenza',

      'auto.empty': 'Non hai ancora aggiunto un veicolo.',
      'auto.addVehicle': '+ Nuovo veicolo',
      'auto.noDates': 'Non hai ancora registrato date.',
      'auto.kteo': 'Revisione',
      'auto.insurance': 'Assicurazione',
      'auto.service': 'Tagliando',
      'auto.fees': 'Bollo auto',
      'auto.tiresLabel': 'Pneumatici — ultimo cambio',

      'shopping.listTitle': 'Lista della spesa',
      'shopping.listEmpty': 'La lista è vuota.',
      'shopping.frequentTitle': 'Prodotti frequenti',
      'shopping.frequentEmpty': 'Non hai ancora registrato prodotti frequenti.',
      'shopping.addProduct': '+ Prodotto',

      'timeline.subtitle': 'Cronologia di vita, spese e azioni.',
      'timeline.empty': 'Non c’è ancora cronologia. Apparirà qui man mano che usi l’app.',

      'rel.today': 'Oggi',
      'rel.yesterday': 'Ieri',
      'rel.daysAgo': '{n} giorni fa',

      'settings.yourName': 'Il tuo nome',
      'settings.namePlaceholder': 'es. Marco',
      'settings.language': 'Lingua',
      'settings.notifications': 'Notifiche — Attive',
      'settings.theme': 'Tema — Sistema',

      'backup.subtitle': 'I tuoi dati restano sul telefono. Il backup cloud è una funzione Premium.',
      'backup.export': 'Scarica copia (.json)',
      'backup.import': 'Importa copia',
      'backup.invalidFile': 'Il file non è una copia valida.',

      'premium.title': 'Premium — 2,99€/mese',
      'premium.family': 'Famiglia — più membri',
      'premium.reminders': 'Promemoria illimitati',
      'premium.vehicles': 'Più veicoli',
      'premium.cloudBackup': 'Cloud backup',
      'premium.aiDailyBrief': 'AI daily brief',
      'premium.sync': 'Sincronizzazione dispositivi',
      'premium.cta': 'Prova Premium',

      'sheet.save': 'Salva',

      'task.addTitle': 'Aggiunta rapida',
      'task.editTitle': 'Modifica impegno',
      'task.placeholder': 'es. Pagamento bolletta',
      'task.whenLabel': 'Quando? (facoltativo)',

      'member.addTitle': 'Nuovo membro',
      'member.editTitle': 'Modifica membro',
      'member.nameLabel': 'Nome',
      'member.namePlaceholder': 'es. Elena',
      'member.birthdayLabel': 'Compleanno',
      'member.namedayLabel': 'Onomastico',
      'member.medsLabel': 'Orario farmaco (facoltativo)',
      'member.notesLabel': 'Note',
      'member.notesPlaceholder': 'es. allergie, preferenze',

      'activity.addTitle': 'Nuova attività',
      'activity.editTitle': 'Modifica attività',
      'activity.whatLabel': 'Cosa?',
      'activity.whatPlaceholder': 'es. Nuoto',
      'activity.whoLabel': 'Chi?',
      'activity.whenLabel': 'Quando?',
      'activity.whenPlaceholder': 'es. Martedì 18:00',

      'home.addTitle': 'Nuova scadenza casa',
      'home.editTitle': 'Modifica scadenza',
      'home.titleLabel': 'Titolo',
      'home.titlePlaceholder': 'es. Bolletta luce',
      'home.categoryLabel': 'Categoria',
      'home.categoryBill': 'Bolletta',
      'home.categoryInsurance': 'Assicurazione',
      'home.categoryMaintenance': 'Manutenzione',
      'home.dueLabel': 'Data di scadenza',

      'vehicle.addTitle': 'Nuovo veicolo',
      'vehicle.editTitle': 'Modifica veicolo',
      'vehicle.modelLabel': 'Modello',
      'vehicle.modelPlaceholder': 'es. Toyota Yaris',
      'vehicle.plateLabel': 'Targa',
      'vehicle.platePlaceholder': 'es. AB123CD',
      'vehicle.kteoLabel': 'Revisione — scadenza',
      'vehicle.insuranceLabel': 'Assicurazione — scadenza',
      'vehicle.serviceLabel': 'Prossimo tagliando',
      'vehicle.feesLabel': 'Bollo auto — scadenza',
      'vehicle.tiresEditLabel': 'Pneumatici — ultimo cambio',

      'shopping.addTitle': 'Nuovo prodotto',
      'shopping.editTitle': 'Modifica prodotto',
      'shopping.namePlaceholder': 'es. Latte',
      'shopping.frequentCheckbox': 'Prodotto frequente',

      'due.today': 'oggi',
      'due.tomorrow': 'domani',
      'due.in': 'tra {n} giorni',
      'due.overdueOne': 'scaduto da 1 giorno',
      'due.overdueMany': 'scaduto da {n} giorni',

      'greeting.morning': 'Buongiorno',
      'greeting.afternoon': 'Buonasera',
      'greeting.night': 'Buonanotte',

      'log.added': 'Aggiunto: {title}',
      'log.updated': 'Aggiornato: {title}',
      'log.newMember': 'Nuovo membro della famiglia: {title}',
      'log.updatedMember': 'Membro aggiornato: {title}',
      'log.newActivity': 'Nuova attività: {title}',
      'log.updatedActivity': 'Attività aggiornata: {title}',
      'log.newHome': 'Nuova scadenza casa: {title}',
      'log.newVehicle': 'Nuovo veicolo: {title}',
      'log.updatedVehicle': 'Veicolo aggiornato: {title}',
      'log.newShopping': 'Aggiunto alla lista della spesa: {title}',
      'log.updatedShopping': 'Prodotto aggiornato: {title}',
      'log.completed': 'Completato: {title}',
      'log.deleted': 'Eliminato: {title}',

      'aria.profile': 'Profilo',
      'aria.quickAdd': 'Aggiunta rapida',
      'aria.edit': 'Modifica',
      'aria.delete': 'Elimina'
    },

    es: {
      'app.title': 'Η Μέρα Μου',
      'app.description': 'Tu panel de control personal para el día a día.',

      'nav.today': 'Hoy',
      'nav.family': 'Familia',
      'nav.home': 'Casa',
      'nav.auto': 'Auto',
      'nav.shopping': 'Compras',
      'nav.timeline': 'Timeline',
      'nav.settings': 'Ajustes',
      'nav.backup': 'Backup',
      'nav.premium': 'Premium',

      'today.tasksTitle': 'Pendientes de hoy',
      'today.tasksEmpty': 'Aún no hay pendientes.',
      'today.expiringTitle': '¿Algo por vencer?',
      'today.expiringEmpty': 'No hay vencimientos registrados.',
      'today.shoppingTitle': '¿Qué tienes que comprar?',
      'today.shoppingEmpty': 'La lista de compras está vacía.',
      'today.goShopping': 'Ir a Compras →',
      'today.quickAdd': 'Nueva tarea',
      'today.noneToday': 'Aún no has registrado nada para hoy.',
      'today.priorityPrefix': 'Prioridad:',
      'today.pendingLine': 'Hoy tienes <strong>{n} {unit}</strong>.',
      'today.shoppingSummary': '{n} {unit} en la lista del súper',

      'unit.pendingOne': 'pendiente',
      'unit.pendingMany': 'pendientes',
      'unit.productOne': 'producto',
      'unit.productMany': 'productos',

      'family.membersTitle': 'Miembros de la familia',
      'family.membersEmpty': 'Aún no has añadido miembros.',
      'family.activitiesTitle': 'Actividades',
      'family.activitiesEmpty': 'No hay actividades registradas.',
      'family.addActivity': '+ Actividad',
      'family.addMember': '+ Nuevo miembro',
      'family.birthdayPrefix': 'Cumpleaños:',
      'family.namedayPrefix': 'Onomástico:',
      'family.medsPrefix': 'Medicamento',

      'home.billsTitle': 'Facturas',
      'home.billsEmpty': 'No hay facturas registradas.',
      'home.otherTitle': 'Seguros y mantenimientos',
      'home.otherEmpty': 'No hay seguros ni mantenimientos registrados.',
      'home.addItem': '+ Nueva obligación',

      'auto.empty': 'Aún no has añadido un vehículo.',
      'auto.addVehicle': '+ Nuevo vehículo',
      'auto.noDates': 'Aún no has registrado fechas.',
      'auto.kteo': 'ITV',
      'auto.insurance': 'Seguro',
      'auto.service': 'Mantenimiento',
      'auto.fees': 'Impuesto de circulación',
      'auto.tiresLabel': 'Neumáticos — último cambio',

      'shopping.listTitle': 'Lista del súper',
      'shopping.listEmpty': 'La lista está vacía.',
      'shopping.frequentTitle': 'Productos frecuentes',
      'shopping.frequentEmpty': 'Aún no has registrado productos frecuentes.',
      'shopping.addProduct': '+ Producto',

      'timeline.subtitle': 'Historial de vida, gastos y acciones.',
      'timeline.empty': 'Aún no hay historial. Aparecerá aquí a medida que uses la app.',

      'rel.today': 'Hoy',
      'rel.yesterday': 'Ayer',
      'rel.daysAgo': 'Hace {n} días',

      'settings.yourName': 'Tu nombre',
      'settings.namePlaceholder': 'ej. Carlos',
      'settings.language': 'Idioma',
      'settings.notifications': 'Notificaciones — Activadas',
      'settings.theme': 'Tema — Sistema',

      'backup.subtitle': 'Tus datos permanecen en tu móvil. La copia en la nube es una función Premium.',
      'backup.export': 'Descargar copia (.json)',
      'backup.import': 'Importar copia',
      'backup.invalidFile': 'El archivo no es una copia válida.',

      'premium.title': 'Premium — 2,99€/mes',
      'premium.family': 'Familia — varios miembros',
      'premium.reminders': 'Recordatorios ilimitados',
      'premium.vehicles': 'Más vehículos',
      'premium.cloudBackup': 'Cloud backup',
      'premium.aiDailyBrief': 'AI daily brief',
      'premium.sync': 'Sincronización de dispositivos',
      'premium.cta': 'Prueba Premium',

      'sheet.save': 'Guardar',

      'task.addTitle': 'Añadir rápido',
      'task.editTitle': 'Editar pendiente',
      'task.placeholder': 'ej. Pago de factura',
      'task.whenLabel': '¿Cuándo? (opcional)',

      'member.addTitle': 'Nuevo miembro',
      'member.editTitle': 'Editar miembro',
      'member.nameLabel': 'Nombre',
      'member.namePlaceholder': 'ej. Elena',
      'member.birthdayLabel': 'Cumpleaños',
      'member.namedayLabel': 'Onomástico',
      'member.medsLabel': 'Hora del medicamento (opcional)',
      'member.notesLabel': 'Notas',
      'member.notesPlaceholder': 'ej. alergias, preferencias',

      'activity.addTitle': 'Nueva actividad',
      'activity.editTitle': 'Editar actividad',
      'activity.whatLabel': '¿Qué?',
      'activity.whatPlaceholder': 'ej. Natación',
      'activity.whoLabel': '¿Quién?',
      'activity.whenLabel': '¿Cuándo?',
      'activity.whenPlaceholder': 'ej. Martes 18:00',

      'home.addTitle': 'Nueva obligación del hogar',
      'home.editTitle': 'Editar obligación',
      'home.titleLabel': 'Título',
      'home.titlePlaceholder': 'ej. Factura de luz',
      'home.categoryLabel': 'Categoría',
      'home.categoryBill': 'Factura',
      'home.categoryInsurance': 'Seguro',
      'home.categoryMaintenance': 'Mantenimiento',
      'home.dueLabel': 'Fecha de vencimiento',

      'vehicle.addTitle': 'Nuevo vehículo',
      'vehicle.editTitle': 'Editar vehículo',
      'vehicle.modelLabel': 'Modelo',
      'vehicle.modelPlaceholder': 'ej. Toyota Yaris',
      'vehicle.plateLabel': 'Matrícula',
      'vehicle.platePlaceholder': 'ej. 1234 ABC',
      'vehicle.kteoLabel': 'ITV — vencimiento',
      'vehicle.insuranceLabel': 'Seguro — vencimiento',
      'vehicle.serviceLabel': 'Próximo mantenimiento',
      'vehicle.feesLabel': 'Impuesto de circulación — plazo',
      'vehicle.tiresEditLabel': 'Neumáticos — último cambio',

      'shopping.addTitle': 'Nuevo producto',
      'shopping.editTitle': 'Editar producto',
      'shopping.namePlaceholder': 'ej. Leche',
      'shopping.frequentCheckbox': 'Producto frecuente',

      'due.today': 'hoy',
      'due.tomorrow': 'mañana',
      'due.in': 'en {n} días',
      'due.overdueOne': 'venció hace 1 día',
      'due.overdueMany': 'venció hace {n} días',

      'greeting.morning': 'Buenos días',
      'greeting.afternoon': 'Buenas tardes',
      'greeting.night': 'Buenas noches',

      'log.added': 'Añadido: {title}',
      'log.updated': 'Actualizado: {title}',
      'log.newMember': 'Nuevo miembro de la familia: {title}',
      'log.updatedMember': 'Miembro actualizado: {title}',
      'log.newActivity': 'Nueva actividad: {title}',
      'log.updatedActivity': 'Actividad actualizada: {title}',
      'log.newHome': 'Nueva obligación del hogar: {title}',
      'log.newVehicle': 'Nuevo vehículo: {title}',
      'log.updatedVehicle': 'Vehículo actualizado: {title}',
      'log.newShopping': 'Añadido a la lista de compras: {title}',
      'log.updatedShopping': 'Producto actualizado: {title}',
      'log.completed': 'Completado: {title}',
      'log.deleted': 'Eliminado: {title}',

      'aria.profile': 'Perfil',
      'aria.quickAdd': 'Añadir rápido',
      'aria.edit': 'Editar',
      'aria.delete': 'Eliminar'
    },

    fr: {
      'app.title': 'Η Μέρα Μου',
      'app.description': 'Ton tableau de bord personnel pour le quotidien.',

      'nav.today': 'Aujourd’hui',
      'nav.family': 'Famille',
      'nav.home': 'Maison',
      'nav.auto': 'Auto',
      'nav.shopping': 'Courses',
      'nav.timeline': 'Timeline',
      'nav.settings': 'Paramètres',
      'nav.backup': 'Backup',
      'nav.premium': 'Premium',

      'today.tasksTitle': 'Tâches du jour',
      'today.tasksEmpty': 'Aucune tâche pour l’instant.',
      'today.expiringTitle': 'Quelque chose expire ?',
      'today.expiringEmpty': 'Aucune échéance enregistrée.',
      'today.shoppingTitle': 'Qu’est-ce qu’il faut acheter ?',
      'today.shoppingEmpty': 'La liste de courses est vide.',
      'today.goShopping': 'Aller aux Courses →',
      'today.quickAdd': 'Nouvelle tâche',
      'today.noneToday': 'Tu n’as encore rien enregistré pour aujourd’hui.',
      'today.priorityPrefix': 'Priorité :',
      'today.pendingLine': 'Aujourd’hui tu as <strong>{n} {unit}</strong>.',
      'today.shoppingSummary': '{n} {unit} dans la liste de courses',

      'unit.pendingOne': 'tâche',
      'unit.pendingMany': 'tâches',
      'unit.productOne': 'produit',
      'unit.productMany': 'produits',

      'family.membersTitle': 'Membres de la famille',
      'family.membersEmpty': 'Tu n’as pas encore ajouté de membres.',
      'family.activitiesTitle': 'Activités',
      'family.activitiesEmpty': 'Aucune activité enregistrée.',
      'family.addActivity': '+ Activité',
      'family.addMember': '+ Nouveau membre',
      'family.birthdayPrefix': 'Anniversaire :',
      'family.namedayPrefix': 'Fête :',
      'family.medsPrefix': 'Médicament',

      'home.billsTitle': 'Factures',
      'home.billsEmpty': 'Aucune facture enregistrée.',
      'home.otherTitle': 'Assurances et entretiens',
      'home.otherEmpty': 'Aucune assurance ni entretien enregistré.',
      'home.addItem': '+ Nouvelle échéance',

      'auto.empty': 'Tu n’as pas encore ajouté de véhicule.',
      'auto.addVehicle': '+ Nouveau véhicule',
      'auto.noDates': 'Tu n’as pas encore renseigné de dates.',
      'auto.kteo': 'Contrôle technique',
      'auto.insurance': 'Assurance',
      'auto.service': 'Entretien',
      'auto.fees': 'Vignette',
      'auto.tiresLabel': 'Pneus — dernier changement',

      'shopping.listTitle': 'Liste de courses',
      'shopping.listEmpty': 'La liste est vide.',
      'shopping.frequentTitle': 'Produits fréquents',
      'shopping.frequentEmpty': 'Tu n’as pas encore enregistré de produits fréquents.',
      'shopping.addProduct': '+ Produit',

      'timeline.subtitle': 'Historique de vie, dépenses et actions.',
      'timeline.empty': 'Il n’y a pas encore d’historique. Il apparaîtra ici au fur et à mesure que tu utilises l’appli.',

      'rel.today': 'Aujourd’hui',
      'rel.yesterday': 'Hier',
      'rel.daysAgo': 'Il y a {n} jours',

      'settings.yourName': 'Ton nom',
      'settings.namePlaceholder': 'ex. Pierre',
      'settings.language': 'Langue',
      'settings.notifications': 'Notifications — Activées',
      'settings.theme': 'Thème — Système',

      'backup.subtitle': 'Tes données restent sur ton téléphone. La sauvegarde cloud est une fonctionnalité Premium.',
      'backup.export': 'Télécharger une copie (.json)',
      'backup.import': 'Importer une copie',
      'backup.invalidFile': 'Le fichier n’est pas une copie valide.',

      'premium.title': 'Premium — 2,99€/mois',
      'premium.family': 'Famille — plusieurs membres',
      'premium.reminders': 'Rappels illimités',
      'premium.vehicles': 'Plus de véhicules',
      'premium.cloudBackup': 'Cloud backup',
      'premium.aiDailyBrief': 'AI daily brief',
      'premium.sync': 'Synchronisation des appareils',
      'premium.cta': 'Essayer Premium',

      'sheet.save': 'Enregistrer',

      'task.addTitle': 'Ajout rapide',
      'task.editTitle': 'Modifier la tâche',
      'task.placeholder': 'ex. Paiement facture',
      'task.whenLabel': 'Quand ? (facultatif)',

      'member.addTitle': 'Nouveau membre',
      'member.editTitle': 'Modifier le membre',
      'member.nameLabel': 'Nom',
      'member.namePlaceholder': 'ex. Hélène',
      'member.birthdayLabel': 'Anniversaire',
      'member.namedayLabel': 'Fête (du prénom)',
      'member.medsLabel': 'Heure du médicament (facultatif)',
      'member.notesLabel': 'Notes',
      'member.notesPlaceholder': 'ex. allergies, préférences',

      'activity.addTitle': 'Nouvelle activité',
      'activity.editTitle': 'Modifier l’activité',
      'activity.whatLabel': 'Quoi ?',
      'activity.whatPlaceholder': 'ex. Natation',
      'activity.whoLabel': 'Qui ?',
      'activity.whenLabel': 'Quand ?',
      'activity.whenPlaceholder': 'ex. Mardi 18h00',

      'home.addTitle': 'Nouvelle échéance maison',
      'home.editTitle': 'Modifier l’échéance',
      'home.titleLabel': 'Titre',
      'home.titlePlaceholder': 'ex. Facture d’électricité',
      'home.categoryLabel': 'Catégorie',
      'home.categoryBill': 'Facture',
      'home.categoryInsurance': 'Assurance',
      'home.categoryMaintenance': 'Entretien',
      'home.dueLabel': 'Date d’échéance',

      'vehicle.addTitle': 'Nouveau véhicule',
      'vehicle.editTitle': 'Modifier le véhicule',
      'vehicle.modelLabel': 'Modèle',
      'vehicle.modelPlaceholder': 'ex. Toyota Yaris',
      'vehicle.plateLabel': 'Plaque d’immatriculation',
      'vehicle.platePlaceholder': 'ex. AB-123-CD',
      'vehicle.kteoLabel': 'Contrôle technique — échéance',
      'vehicle.insuranceLabel': 'Assurance — échéance',
      'vehicle.serviceLabel': 'Prochain entretien',
      'vehicle.feesLabel': 'Vignette — échéance',
      'vehicle.tiresEditLabel': 'Pneus — dernier changement',

      'shopping.addTitle': 'Nouveau produit',
      'shopping.editTitle': 'Modifier le produit',
      'shopping.namePlaceholder': 'ex. Lait',
      'shopping.frequentCheckbox': 'Produit fréquent',

      'due.today': 'aujourd’hui',
      'due.tomorrow': 'demain',
      'due.in': 'dans {n} jours',
      'due.overdueOne': 'expiré depuis 1 jour',
      'due.overdueMany': 'expiré depuis {n} jours',

      'greeting.morning': 'Bonjour',
      'greeting.afternoon': 'Bonsoir',
      'greeting.night': 'Bonne nuit',

      'log.added': 'Ajouté : {title}',
      'log.updated': 'Mis à jour : {title}',
      'log.newMember': 'Nouveau membre de la famille : {title}',
      'log.updatedMember': 'Membre mis à jour : {title}',
      'log.newActivity': 'Nouvelle activité : {title}',
      'log.updatedActivity': 'Activité mise à jour : {title}',
      'log.newHome': 'Nouvelle échéance maison : {title}',
      'log.newVehicle': 'Nouveau véhicule : {title}',
      'log.updatedVehicle': 'Véhicule mis à jour : {title}',
      'log.newShopping': 'Ajouté à la liste de courses : {title}',
      'log.updatedShopping': 'Produit mis à jour : {title}',
      'log.completed': 'Terminé : {title}',
      'log.deleted': 'Supprimé : {title}',

      'aria.profile': 'Profil',
      'aria.quickAdd': 'Ajout rapide',
      'aria.edit': 'Modifier',
      'aria.delete': 'Supprimer'
    },

    en: {
      'app.title': 'Η Μέρα Μου',
      'app.description': 'Your personal dashboard for everyday life.',

      'nav.today': 'Today',
      'nav.family': 'Family',
      'nav.home': 'Home',
      'nav.auto': 'Auto',
      'nav.shopping': 'Shopping',
      'nav.timeline': 'Timeline',
      'nav.settings': 'Settings',
      'nav.backup': 'Backup',
      'nav.premium': 'Premium',

      'today.tasksTitle': 'Today’s tasks',
      'today.tasksEmpty': 'No tasks yet.',
      'today.expiringTitle': 'Anything expiring?',
      'today.expiringEmpty': 'No deadlines recorded.',
      'today.shoppingTitle': 'What do you need to buy?',
      'today.shoppingEmpty': 'Your shopping list is empty.',
      'today.goShopping': 'Go to Shopping →',
      'today.quickAdd': 'New task',
      'today.noneToday': 'You haven’t added anything for today yet.',
      'today.priorityPrefix': 'Priority:',
      'today.pendingLine': 'You have <strong>{n} {unit}</strong> today.',
      'today.shoppingSummary': '{n} {unit} on your shopping list',

      'unit.pendingOne': 'task',
      'unit.pendingMany': 'tasks',
      'unit.productOne': 'item',
      'unit.productMany': 'items',

      'family.membersTitle': 'Family members',
      'family.membersEmpty': 'You haven’t added any members yet.',
      'family.activitiesTitle': 'Activities',
      'family.activitiesEmpty': 'No activities recorded.',
      'family.addActivity': '+ Activity',
      'family.addMember': '+ New member',
      'family.birthdayPrefix': 'Birthday:',
      'family.namedayPrefix': 'Name day:',
      'family.medsPrefix': 'Medication',

      'home.billsTitle': 'Bills',
      'home.billsEmpty': 'No bills recorded.',
      'home.otherTitle': 'Insurance & maintenance',
      'home.otherEmpty': 'No insurance or maintenance recorded.',
      'home.addItem': '+ New item',

      'auto.empty': 'You haven’t added a vehicle yet.',
      'auto.addVehicle': '+ New vehicle',
      'auto.noDates': 'You haven’t recorded any dates yet.',
      'auto.kteo': 'Inspection',
      'auto.insurance': 'Insurance',
      'auto.service': 'Service',
      'auto.fees': 'Road tax',
      'auto.tiresLabel': 'Tires — last changed',

      'shopping.listTitle': 'Shopping list',
      'shopping.listEmpty': 'The list is empty.',
      'shopping.frequentTitle': 'Frequent items',
      'shopping.frequentEmpty': 'You haven’t recorded any frequent items yet.',
      'shopping.addProduct': '+ Item',

      'timeline.subtitle': 'History of life, expenses, and actions.',
      'timeline.empty': 'There’s no history yet. It will appear here as you use the app.',

      'rel.today': 'Today',
      'rel.yesterday': 'Yesterday',
      'rel.daysAgo': '{n} days ago',

      'settings.yourName': 'Your name',
      'settings.namePlaceholder': 'e.g. John',
      'settings.language': 'Language',
      'settings.notifications': 'Notifications — On',
      'settings.theme': 'Theme — System',

      'backup.subtitle': 'Your data stays on your phone. Cloud backup is a Premium feature.',
      'backup.export': 'Download copy (.json)',
      'backup.import': 'Import copy',
      'backup.invalidFile': 'This file is not a valid backup.',

      'premium.title': 'Premium — €2.99/month',
      'premium.family': 'Family — multiple members',
      'premium.reminders': 'Unlimited reminders',
      'premium.vehicles': 'More vehicles',
      'premium.cloudBackup': 'Cloud backup',
      'premium.aiDailyBrief': 'AI daily brief',
      'premium.sync': 'Device sync',
      'premium.cta': 'Try Premium',

      'sheet.save': 'Save',

      'task.addTitle': 'Quick add',
      'task.editTitle': 'Edit task',
      'task.placeholder': 'e.g. Pay phone bill',
      'task.whenLabel': 'When? (optional)',

      'member.addTitle': 'New member',
      'member.editTitle': 'Edit member',
      'member.nameLabel': 'Name',
      'member.namePlaceholder': 'e.g. Helen',
      'member.birthdayLabel': 'Birthday',
      'member.namedayLabel': 'Name day',
      'member.medsLabel': 'Medication time (optional)',
      'member.notesLabel': 'Notes',
      'member.notesPlaceholder': 'e.g. allergies, preferences',

      'activity.addTitle': 'New activity',
      'activity.editTitle': 'Edit activity',
      'activity.whatLabel': 'What?',
      'activity.whatPlaceholder': 'e.g. Swimming',
      'activity.whoLabel': 'Who?',
      'activity.whenLabel': 'When?',
      'activity.whenPlaceholder': 'e.g. Tuesday 6:00 PM',

      'home.addTitle': 'New home item',
      'home.editTitle': 'Edit item',
      'home.titleLabel': 'Title',
      'home.titlePlaceholder': 'e.g. Electricity bill',
      'home.categoryLabel': 'Category',
      'home.categoryBill': 'Bill',
      'home.categoryInsurance': 'Insurance',
      'home.categoryMaintenance': 'Maintenance',
      'home.dueLabel': 'Due date',

      'vehicle.addTitle': 'New vehicle',
      'vehicle.editTitle': 'Edit vehicle',
      'vehicle.modelLabel': 'Model',
      'vehicle.modelPlaceholder': 'e.g. Toyota Yaris',
      'vehicle.plateLabel': 'License plate',
      'vehicle.platePlaceholder': 'e.g. AB12 CDE',
      'vehicle.kteoLabel': 'Inspection — due',
      'vehicle.insuranceLabel': 'Insurance — due',
      'vehicle.serviceLabel': 'Next service',
      'vehicle.feesLabel': 'Road tax — deadline',
      'vehicle.tiresEditLabel': 'Tires — last changed',

      'shopping.addTitle': 'New item',
      'shopping.editTitle': 'Edit item',
      'shopping.namePlaceholder': 'e.g. Milk',
      'shopping.frequentCheckbox': 'Frequent item',

      'due.today': 'today',
      'due.tomorrow': 'tomorrow',
      'due.in': 'in {n} days',
      'due.overdueOne': 'overdue by 1 day',
      'due.overdueMany': 'overdue by {n} days',

      'greeting.morning': 'Good morning',
      'greeting.afternoon': 'Good evening',
      'greeting.night': 'Good night',

      'log.added': 'Added: {title}',
      'log.updated': 'Updated: {title}',
      'log.newMember': 'New family member: {title}',
      'log.updatedMember': 'Member updated: {title}',
      'log.newActivity': 'New activity: {title}',
      'log.updatedActivity': 'Activity updated: {title}',
      'log.newHome': 'New home item: {title}',
      'log.newVehicle': 'New vehicle: {title}',
      'log.updatedVehicle': 'Vehicle updated: {title}',
      'log.newShopping': 'Added to shopping list: {title}',
      'log.updatedShopping': 'Item updated: {title}',
      'log.completed': 'Completed: {title}',
      'log.deleted': 'Deleted: {title}',

      'aria.profile': 'Profile',
      'aria.quickAdd': 'Quick add',
      'aria.edit': 'Edit',
      'aria.delete': 'Delete'
    }
  };

  var current = DEFAULT_LANG;
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved && STRINGS[saved]) current = saved;
  } catch (e) {}

  function setLang(lang) {
    if (!STRINGS[lang]) return;
    current = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  function getLang() {
    return current;
  }

  function t(key, vars) {
    var str = (STRINGS[current] && STRINGS[current][key]) || STRINGS[DEFAULT_LANG][key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        str = str.replace('{' + k + '}', vars[k]);
      });
    }
    return str;
  }

  function formatDayMonth(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    var months = MONTHS[current] || MONTHS[DEFAULT_LANG];
    var format = DATE_FORMAT[current] || DATE_FORMAT[DEFAULT_LANG];
    return format(d.getDate(), months[d.getMonth()]);
  }

  function greeting() {
    var h = new Date().getHours();
    if (h < 12) return t('greeting.morning');
    if (h < 19) return t('greeting.afternoon');
    return t('greeting.night');
  }

  function greetingEmoji() {
    var h = new Date().getHours();
    if (h < 12) return '☀️';
    if (h < 19) return '🌇';
    return '🌙';
  }

  function dueLabel(days) {
    if (days === null) return '';
    if (days < 0) return Math.abs(days) === 1 ? t('due.overdueOne') : t('due.overdueMany', { n: Math.abs(days) });
    if (days === 0) return t('due.today');
    if (days === 1) return t('due.tomorrow');
    return t('due.in', { n: days });
  }

  function relativeDay(ts) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var day = new Date(ts);
    day.setHours(0, 0, 0, 0);
    var diff = Math.round((today - day) / 86400000);
    if (diff === 0) return t('rel.today');
    if (diff === 1) return t('rel.yesterday');
    return t('rel.daysAgo', { n: diff });
  }

  global.I18N = {
    LANGS: Object.keys(STRINGS),
    LANG_NAMES: LANG_NAMES,
    setLang: setLang,
    getLang: getLang,
    t: t,
    formatDayMonth: formatDayMonth,
    greeting: greeting,
    greetingEmoji: greetingEmoji,
    dueLabel: dueLabel,
    relativeDay: relativeDay
  };
})(window);
