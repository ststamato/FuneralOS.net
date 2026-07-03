// ================================
// FuneralOS USA — Shared Helpers
// Bridges USA modules to EN ceremony data.
// All IIFEs below rely on window.__usaLib exposed here.
// ================================
(function(){
  const USA_META_KEY = "funeralos_en_usa_meta_v1";
  const USA_SETTINGS_KEY = "funeralos_en_usa_settings_v1";
  const USA_DOCS = ["Death Certificate","Burial Permit","Cremation Authorization","Contract","Invoice"];
  const USA_STEPS = ["First Call","Removal Scheduled","Family Meeting","Documents Pending","Preparation","Viewing","Service Scheduled","Burial/Cremation","Closed"];
  const USA_MODULES_LIST = [
    {tab:"usaDirector",  icon:"🗂",  label:"Director"},
    {tab:"usaCases",     icon:"📁",  label:"Cases"},
    {tab:"usaFirstCall", icon:"📞",  label:"First Call"},
    {tab:"usaDocuments", icon:"📄",  label:"Docs"},
    {tab:"usaStaff",     icon:"👥",  label:"Staff"},
    {tab:"usaFleet",     icon:"🚗",  label:"Fleet"},
    {tab:"usaCremation", icon:"🔥",  label:"Cremation"},
    {tab:"usaFinance",   icon:"💰",  label:"Finance"},
    {tab:"usaSchedule",  icon:"📅",  label:"Schedule"},
  ];
  const DEFAULT_MODULES = Object.fromEntries(USA_MODULES_LIST.map(m=>[m.tab, true]));
  const addDays = (n)=>{ const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };

  function readCeremonies(){
    const raw = typeof window.__fosGetCeremonies === "function" ? window.__fosGetCeremonies() : null;
    if (Array.isArray(raw) && raw.length) return raw;
    try { return JSON.parse(localStorage.getItem("staurakaki_ceremonies_v8") || "[]") || []; } catch { return []; }
  }

  function getMeta(){
    if (window.__DEMO_MODE) return window.__usaDemoMeta || {};
    try { return JSON.parse(localStorage.getItem(USA_META_KEY) || "{}") || {}; } catch { return {}; }
  }

  function saveMeta(meta){
    if (window.__DEMO_MODE) { window.__usaDemoMeta = meta; return; }
    localStorage.setItem(USA_META_KEY, JSON.stringify(meta));
  }

  function updateMeta(caseId, updates){
    const meta = getMeta();
    meta[caseId] = Object.assign({}, meta[caseId] || {}, updates);
    saveMeta(meta);
  }

  function getSettings(){
    const defaults = {modules: Object.assign({}, DEFAULT_MODULES), customDocs: [], defaultPriority: "Normal"};
    if (window.__DEMO_MODE) return Object.assign({}, defaults, window.__usaSettings || {});
    try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(USA_SETTINGS_KEY) || "{}")); } catch { return defaults; }
  }

  function saveSettings(s){
    if (window.__DEMO_MODE) { window.__usaSettings = s; return; }
    localStorage.setItem(USA_SETTINGS_KEY, JSON.stringify(s));
  }

  function allDocs(){
    const s = getSettings();
    return [...USA_DOCS, ...(s.customDocs || [])];
  }

  function blankDocs(){ return Object.fromEntries(allDocs().map(d => [d, "Missing"])); }

  const safe = (s)=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  function renderUsaSettings(){
    const panel = document.getElementById("usaSettingsPanel");
    if (!panel || panel.style.display === "none") return;
    const s = getSettings();

    const togglesEl = document.getElementById("usaModuleToggles");
    if (togglesEl) {
      togglesEl.innerHTML = USA_MODULES_LIST.map(m=>`
        <label style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);cursor:pointer;">
          <input type="checkbox" data-usa-module="${m.tab}" ${s.modules[m.tab]!==false?'checked':''} onchange="window.usaToggleModule(this)" style="width:16px;height:16px;accent-color:#c8a96e;cursor:pointer;" />
          <span style="font-size:14px;">${m.icon} ${m.label}</span>
        </label>`).join("");
    }

    const docsEl = document.getElementById("usaCustomDocsList");
    if (docsEl) {
      docsEl.innerHTML = (s.customDocs || []).length
        ? s.customDocs.map(d=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,.04);border-radius:8px;"><span style="font-size:14px;color:#c8daf0;">📄 ${safe(d)}</span><button onclick="window.usaRemoveCustomDoc('${safe(d).replace(/'/g,"&#39;")}')" style="background:none;border:none;color:#667788;cursor:pointer;font-size:16px;padding:0 4px;">✕</button></div>`).join("")
        : `<p style="font-size:12px;color:#556677;margin:0;">No custom documents added.</p>`;
    }

    const prioEl = document.getElementById("usaDefaultPriority");
    if (prioEl) prioEl.value = s.defaultPriority || "Normal";
  }

  window.usaToggleModule = function(checkbox){
    const s = getSettings(); s.modules[checkbox.dataset.usaModule] = checkbox.checked; saveSettings(s);
  };
  window.usaSavePriority = function(value){
    const s = getSettings(); s.defaultPriority = value; saveSettings(s);
  };
  window.usaAddCustomDoc = function(){
    const input = document.getElementById("usaCustomDocInput");
    const name = (input?.value || "").trim(); if(!name) return;
    const s = getSettings();
    if(!s.customDocs.includes(name)){ s.customDocs.push(name); saveSettings(s); }
    if(input) input.value = ""; renderUsaSettings();
  };
  window.usaRemoveCustomDoc = function(name){
    const s = getSettings(); s.customDocs = s.customDocs.filter(d=>d!==name); saveSettings(s); renderUsaSettings();
  };
  window.usaExportMeta = function(){
    const data = {meta: getMeta(), settings: getSettings(), exportDate: new Date().toISOString()};
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "funeralos-usa-export.json"; a.click();
    URL.revokeObjectURL(url);
  };
  window.usaRenderSettings = renderUsaSettings;

  function mergeCase(ceremony){
    const meta = getMeta()[ceremony.id] || {};
    const rawType = (ceremony.burialType || "").toLowerCase();
    const disposition = rawType.includes("αποτε") ? "Cremation" : "Burial";
    return {
      id: ceremony.id,
      caseNumber: meta.caseNumber || ceremony.case_id || ("EN-" + String(ceremony.id).toUpperCase()),
      decedent: ceremony.name || "Unnamed",
      dateOfDeath: meta.dateOfDeath || "",
      serviceDate: meta.serviceDate || ceremony.date || "",
      serviceTime: meta.serviceTime || ceremony.time || "",
      serviceLocation: meta.serviceLocation || ceremony.place || "",
      director: meta.director || ceremony.responsible || "",
      disposition,
      caller: meta.caller || "",
      relationship: meta.relationship || "",
      phone: meta.phone || "",
      placeOfDeath: meta.placeOfDeath || "",
      facility: meta.facility || "",
      priority: meta.priority || "Normal",
      driver: meta.driver || "",
      vehicle: meta.vehicle || "",
      viewingDate: meta.viewingDate || "",
      viewingRoom: meta.viewingRoom || "",
      finalLocation: meta.finalLocation || "",
      status: meta.status || "First Call",
      balance: Number(meta.balance || 0),
      caseValue: Number(meta.caseValue || 0),
      paymentStatus: meta.paymentStatus || "Pending",
      notes: meta.notes || ceremony.notes || "",
      documents: meta.documents || blankDocs(),
      timeline: meta.timeline || ["First Call"],
      cremation: meta.cremation || {},
      crematory: meta.crematory || "",
      urn: meta.urn || "",
      assignedStaff: meta.assignedStaff || "",
    };
  }

  function cases(){
    return readCeremonies()
      .filter(c => c.burialType !== "Μνημόσυνο")
      .map(mergeCase);
  }

  // Demo meta — realistic data for EN demo ceremonies (demo_1 through demo_12)
  const DEMO_META = {
    "demo_1": {
      caseNumber:"DEMO-2026-001", caller:"James Johnson", relationship:"Son",
      phone:"(555) 210-6001", placeOfDeath:"Hospital", facility:"St. Mary Medical Center",
      priority:"Urgent", driver:"Thomas", vehicle:"Hearse #1",
      viewingDate: addDays(-1), viewingRoom:"Chapel A",
      finalLocation:"Greenwood Cemetery",
      status:"Documents Pending", balance:3200, caseValue:8500, paymentStatus:"Pending",
      notes:"⚠️ Death Certificate NOT yet filed. Cemetery plot unconfirmed.",
      documents: {"Death Certificate":"Pending","Burial Permit":"Pending","Cremation Authorization":"Missing","Contract":"Complete","Invoice":"Pending"},
      timeline:["First Call","Removal Scheduled","Family Meeting","Documents Pending"],
      cremation:{}, crematory:"", urn:""
    },
    "demo_2": {
      caseNumber:"DEMO-2026-002", caller:"Robert Williams", relationship:"Son",
      phone:"(555) 382-2002", placeOfDeath:"Home", facility:"Residence",
      priority:"Normal", driver:"Andrew", vehicle:"Hearse #1",
      viewingDate: addDays(0), viewingRoom:"Chapel B",
      finalLocation:"Oak Hill Cemetery",
      status:"Service Scheduled", balance:0, caseValue:6800, paymentStatus:"Paid",
      notes:"All arrangements confirmed. White flowers only — NO wreaths.",
      documents: {"Death Certificate":"Complete","Burial Permit":"Complete","Cremation Authorization":"Missing","Contract":"Complete","Invoice":"Complete"},
      timeline:["First Call","Removal Scheduled","Family Meeting","Documents Pending","Preparation","Viewing","Service Scheduled"],
      cremation:{}, crematory:"", urn:""
    },
    "demo_3": {
      caseNumber:"DEMO-2026-003", caller:"Linda Davis", relationship:"Daughter",
      phone:"(555) 491-3003", placeOfDeath:"Hospice", facility:"Serenity Hospice Center",
      priority:"High", driver:"Thomas", vehicle:"Removal Van #1",
      viewingDate:"", viewingRoom:"",
      finalLocation:"Hatherley Crematorium",
      status:"Preparation", balance:2800, caseValue:4500, paymentStatus:"Partial",
      notes:"Family arriving from abroad. Cremation authorization pending.",
      documents: {"Death Certificate":"Pending","Burial Permit":"Missing","Cremation Authorization":"Pending","Contract":"Complete","Invoice":"Pending"},
      timeline:["First Call","Removal Scheduled","Family Meeting","Documents Pending","Preparation"],
      cremation:{"Cremation Authorization":"Pending","Cremation Permit":"Missing","Crematory Scheduled":"Pending","Urn Selected":"Pending","Ashes Released":"Missing"},
      crematory:"Hatherley Crematorium", urn:"Silver Companion Urn"
    },
    "demo_4": {
      caseNumber:"DEMO-2026-004", caller:"Sarah Thompson", relationship:"Wife",
      phone:"(555) 603-4004", placeOfDeath:"Hospital", facility:"City General Hospital",
      priority:"Normal", driver:"Andrew", vehicle:"Hearse #1",
      viewingDate: addDays(4), viewingRoom:"Main Chapel",
      finalLocation:"St. Mary's Cemetery",
      status:"Family Meeting", balance:1500, caseValue:7200, paymentStatus:"Partial",
      notes:"",
      documents: {"Death Certificate":"Pending","Burial Permit":"Missing","Cremation Authorization":"Missing","Contract":"Complete","Invoice":"Missing"},
      timeline:["First Call","Removal Scheduled","Family Meeting"],
      cremation:{}, crematory:"", urn:""
    },
    "demo_5": {
      caseNumber:"DEMO-2026-005", caller:"David Anderson", relationship:"Son",
      phone:"(555) 714-5005", placeOfDeath:"Hospital", facility:"General Hospital",
      priority:"Normal", driver:"Christine", vehicle:"Hearse #1",
      viewingDate: addDays(6), viewingRoom:"Chapel A",
      finalLocation:"Christ Church Cemetery",
      status:"First Call", balance:0, caseValue:6500, paymentStatus:"Pending",
      notes:"Pallbearers pending confirmation.",
      documents: {"Death Certificate":"Missing","Burial Permit":"Missing","Cremation Authorization":"Missing","Contract":"Missing","Invoice":"Missing"},
      timeline:["First Call"],
      cremation:{}, crematory:"", urn:""
    },
    "demo_6": {
      caseNumber:"DEMO-2026-006", caller:"Nancy Clark", relationship:"Daughter",
      phone:"(555) 825-6006", placeOfDeath:"Residence", facility:"Home Death",
      priority:"Normal", driver:"Thomas", vehicle:"Removal Van #1",
      viewingDate:"", viewingRoom:"",
      finalLocation:"Hatherley Crematorium",
      status:"Removal Scheduled", balance:0, caseValue:4200, paymentStatus:"Pending",
      notes:"",
      documents: {"Death Certificate":"Missing","Burial Permit":"Missing","Cremation Authorization":"Missing","Contract":"Missing","Invoice":"Missing"},
      timeline:["First Call","Removal Scheduled"],
      cremation:{}, crematory:"Hatherley Crematorium", urn:""
    },
    "demo_7": {
      caseNumber:"DEMO-2026-007", caller:"Paul Harris", relationship:"Son",
      phone:"(555) 936-7007", placeOfDeath:"Hospital", facility:"St. Paul's Hospital",
      priority:"Normal", driver:"Andrew", vehicle:"Hearse #1",
      viewingDate: addDays(-4), viewingRoom:"Chapel B",
      finalLocation:"St. Paul's Cemetery",
      status:"Closed", balance:0, caseValue:7800, paymentStatus:"Paid",
      notes:"Service completed successfully.",
      documents: {"Death Certificate":"Complete","Burial Permit":"Complete","Cremation Authorization":"Missing","Contract":"Complete","Invoice":"Complete"},
      timeline:["First Call","Removal Scheduled","Family Meeting","Documents Pending","Preparation","Viewing","Service Scheduled","Burial/Cremation","Closed"],
      cremation:{}, crematory:"", urn:""
    },
    "demo_8": {
      caseNumber:"DEMO-2026-008", caller:"Mary Lewis", relationship:"Wife",
      phone:"(555) 047-8008", placeOfDeath:"Hospital", facility:"All Saints Medical",
      priority:"Normal", driver:"Christine", vehicle:"Hearse #1",
      viewingDate: addDays(-7), viewingRoom:"Main Chapel",
      finalLocation:"All Saints Cemetery",
      status:"Closed", balance:0, caseValue:8200, paymentStatus:"Paid",
      notes:"All documents filed.",
      documents: {"Death Certificate":"Complete","Burial Permit":"Complete","Cremation Authorization":"Missing","Contract":"Complete","Invoice":"Complete"},
      timeline:["First Call","Removal Scheduled","Family Meeting","Documents Pending","Preparation","Viewing","Service Scheduled","Burial/Cremation","Closed"],
      cremation:{}, crematory:"", urn:""
    },
    "demo_9": {
      caseNumber:"DEMO-2026-009", caller:"George Robinson", relationship:"Son",
      phone:"(555) 158-9009", placeOfDeath:"Hospice", facility:"Valley Hospice",
      priority:"Normal", driver:"Thomas", vehicle:"Removal Van #1",
      viewingDate:"", viewingRoom:"",
      finalLocation:"Hatherley Crematorium",
      status:"Closed", balance:0, caseValue:4800, paymentStatus:"Paid",
      notes:"Ashes returned to family.",
      documents: {"Death Certificate":"Complete","Burial Permit":"Missing","Cremation Authorization":"Complete","Contract":"Complete","Invoice":"Complete"},
      timeline:["First Call","Removal Scheduled","Family Meeting","Documents Pending","Preparation","Service Scheduled","Burial/Cremation","Closed"],
      cremation:{"Cremation Authorization":"Complete","Cremation Permit":"Complete","Crematory Scheduled":"Complete","Urn Selected":"Complete","Ashes Released":"Complete"},
      crematory:"Hatherley Crematorium", urn:"Classic Mahogany Urn"
    },
    "demo_10": {
      caseNumber:"DEMO-2026-010", caller:"Helen Walker", relationship:"Daughter",
      phone:"(555) 269-0010", placeOfDeath:"Nursing Home", facility:"Sunrise Care Home",
      priority:"Normal", driver:"Andrew", vehicle:"Hearse #1",
      viewingDate: addDays(-13), viewingRoom:"Chapel A",
      finalLocation:"Greenwood Cemetery",
      status:"Closed", balance:0, caseValue:9100, paymentStatus:"Paid",
      notes:"Case closed.",
      documents: {"Death Certificate":"Complete","Burial Permit":"Complete","Cremation Authorization":"Missing","Contract":"Complete","Invoice":"Complete"},
      timeline:["First Call","Removal Scheduled","Family Meeting","Documents Pending","Preparation","Viewing","Service Scheduled","Burial/Cremation","Closed"],
      cremation:{}, crematory:"", urn:""
    },
    "demo_11": {
      caseNumber:"DEMO-2026-011", caller:"William Mitchell", relationship:"Son",
      phone:"(555) 370-1011", placeOfDeath:"Hospital", facility:"Christ Church Hospital",
      priority:"Normal", driver:"Christine", vehicle:"Hearse #1",
      viewingDate: addDays(-16), viewingRoom:"Chapel B",
      finalLocation:"Christ Church Cemetery",
      status:"Closed", balance:0, caseValue:6900, paymentStatus:"Paid",
      notes:"Case closed.",
      documents: {"Death Certificate":"Complete","Burial Permit":"Complete","Cremation Authorization":"Missing","Contract":"Complete","Invoice":"Complete"},
      timeline:["First Call","Removal Scheduled","Family Meeting","Documents Pending","Preparation","Viewing","Service Scheduled","Burial/Cremation","Closed"],
      cremation:{}, crematory:"", urn:""
    },
    "demo_12": {
      caseNumber:"DEMO-2026-012", caller:"Elizabeth Campbell", relationship:"Wife",
      phone:"(555) 481-2012", placeOfDeath:"Hospital", facility:"Holy Trinity Hospital",
      priority:"Normal", driver:"Andrew", vehicle:"Hearse #1",
      viewingDate: addDays(-19), viewingRoom:"Main Chapel",
      finalLocation:"Holy Trinity Cemetery",
      status:"Closed", balance:0, caseValue:7500, paymentStatus:"Paid",
      notes:"All documents filed.",
      documents: {"Death Certificate":"Complete","Burial Permit":"Complete","Cremation Authorization":"Missing","Contract":"Complete","Invoice":"Complete"},
      timeline:["First Call","Removal Scheduled","Family Meeting","Documents Pending","Preparation","Viewing","Service Scheduled","Burial/Cremation","Closed"],
      cremation:{}, crematory:"", urn:""
    }
  };

  document.addEventListener("DOMContentLoaded", ()=>{
    if (window.__DEMO_MODE) {
      window.__usaDemoMeta = Object.assign({}, DEMO_META);
    }
    // Re-render settings panel whenever the Settings tab is opened
    const settingsBtn = document.querySelector('.tab-button[data-tab="settings"]');
    if (settingsBtn) settingsBtn.addEventListener("click", ()=>setTimeout(renderUsaSettings, 50));
  });

  window.__usaLib = { cases, updateMeta, getMeta, saveMeta, blankDocs, allDocs, getSettings, saveSettings, renderUsaSettings, USA_DOCS, USA_STEPS, USA_MODULES_LIST, readCeremonies };
})();


// ================================
// FuneralOS USA v1 — Director Modules
// Adds: Cases, First Call, Documents, Director Command Center
// Reads EN ceremony data via window.__usaLib; stores USA-specific
// metadata in funeralos_en_usa_meta_v1.
// ================================
(function(){
  const USA_DOCS = ()=>window.__usaLib.allDocs();
  const USA_STEPS = ()=>window.__usaLib.USA_STEPS;
  let usaFilter = "active";

  const el = (id)=>document.getElementById(id);
  const safe = (s)=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const money = (n)=>"$"+(Number(n||0).toLocaleString("en-US"));
  const todayIso = ()=>new Date().toISOString().slice(0,10);
  const addDaysIso = (days)=>{const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);};
  const uid = ()=>"usa_"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);

  function cases(){ return window.__usaLib.cases(); }
  function updateMeta(id, updates){ window.__usaLib.updateMeta(id, updates); }

  function docStats(c){
    const docs = c.documents || {};
    let missing=0, pending=0, complete=0;
    USA_DOCS().forEach(d=>{ const v=docs[d]||"Missing"; if(v==="Complete") complete++; else if(v==="Pending") pending++; else missing++; });
    return {missing, pending, complete};
  }
  function activeCases(){ return cases().filter(c=>c.status!=="Closed"); }
  function isUpcoming(c){ return c.serviceDate && c.serviceDate>=todayIso() && c.serviceDate<=addDaysIso(7); }
  function classify(c){ if(c.status==="Closed") return "closed"; if((c.status||"").includes("Pending") || docStats(c).missing>0) return "pending"; return "active"; }

  function createCase(data){
    const newId = uid();
    // Create a real EN ceremony so it appears in the main case list
    const ceremony = {
      id: newId,
      case_id: data.caseNumber || newId,
      name: data.decedent || "Unnamed Case",
      date: data.serviceDate || data.dateOfDeath || "",
      time: data.serviceTime || "",
      place: data.serviceLocation || "",
      burialType: data.disposition === "Cremation" ? "Αποτεφρωση" : "Ταφή",
      responsible: data.director || "",
      coffin: "", pallbearers: "", sheet: "", set: "", flowers: "",
      announcementStatus: "Not needed", decor: "", decorNote: "",
      secondPerson: "None", pickupSecondPerson: "", suitcase: "-",
      coffee: "", coffeePlace: "", pickup: "", pickupDate: "",
      coldRoom: "", cremationEscortCount: 0, cremationParishNote: "",
      graveNumber: "", graveZone: "", graveType: "", customValues: {},
      notes: data.notes || ""
    };
    if (typeof window.__fosPushCeremony === "function") {
      window.__fosPushCeremony(ceremony);
    }
    const metaDefaults = {
      caseNumber: data.caseNumber || ("EN-" + new Date().getFullYear() + "-" + newId.slice(-4).toUpperCase()),
      caller: data.caller || "", relationship: data.relationship || "",
      phone: data.phone || "", placeOfDeath: data.placeOfDeath || "",
      facility: data.facility || "", priority: data.priority || window.__usaLib.getSettings().defaultPriority || "Normal",
      driver: data.driver || "", vehicle: data.vehicle || "",
      status: "First Call", balance: 0, caseValue: 0, paymentStatus: "Pending",
      notes: data.notes || "",
      documents: Object.fromEntries(USA_DOCS().map(d=>[d,"Missing"])),
      timeline: ["First Call"].concat(data.driver || data.vehicle ? ["Removal Scheduled"] : []),
      cremation: {}, crematory: "", urn: ""
    };
    updateMeta(newId, metaDefaults);
    renderUSA();
    return newId;
  }

  function setStatus(id, status){
    const c = cases().find(x=>x.id===id); if(!c) return;
    const timeline = Array.isArray(c.timeline) ? [...c.timeline] : [];
    if(!timeline.includes(status)) timeline.push(status);
    if(status==="Closed" && !timeline.includes("Closed")) timeline.push("Closed");
    updateMeta(id, { status, timeline });
    renderUSA();
  }

  function setDoc(id, doc, status){
    const c = cases().find(x=>x.id===id); if(!c) return;
    const documents = Object.assign({}, c.documents || {}, { [doc]: status });
    updateMeta(id, { documents });
    renderUSA();
  }

  function renderDirector(){
    const allCases = cases();
    const active = allCases.filter(c=>c.status!=="Closed");
    const missing = allCases.reduce((sum,c)=>sum+docStats(c).missing, 0);
    const pendingPay = active.reduce((s,c)=>s+Number(c.balance||0), 0);
    const upcoming = allCases.filter(isUpcoming).length;
    if(el("usaActiveCount")) el("usaActiveCount").textContent = active.length;
    if(el("usaMissingDocsCount")) el("usaMissingDocsCount").textContent = missing;
    if(el("usaPendingPaymentsTotal")) el("usaPendingPaymentsTotal").textContent = money(pendingPay);
    if(el("usaUpcomingServicesCount")) el("usaUpcomingServicesCount").textContent = upcoming;
    const alerts = [];
    active.forEach(c=>{
      const ds = docStats(c);
      if(ds.missing) alerts.push({type:"danger", title:`${c.decedent}: ${ds.missing} missing document(s)`, meta:`${c.caseNumber} · ${c.status}`});
      if(Number(c.balance||0)>0) alerts.push({type:"warning", title:`${c.decedent}: unpaid balance ${money(c.balance)}`, meta:`Family: ${c.caller||"not set"}`});
      if(isUpcoming(c)) alerts.push({type:"", title:`Upcoming service: ${c.decedent}`, meta:`${c.serviceDate} · vehicle ${c.vehicle||"not assigned"}`});
    });
    if(el("usaAttentionList")) el("usaAttentionList").innerHTML = alerts.length
      ? alerts.slice(0,12).map(a=>`<div class="usa-alert ${a.type}"><strong>${safe(a.title)}</strong><small>${safe(a.meta)}</small></div>`).join("")
      : `<div class="usa-alert"><strong>No urgent items.</strong><small>Clean board. Rare animal, enjoy it.</small></div>`;
    if(el("usaDirectorBrief")) el("usaDirectorBrief").innerHTML = `<b>Today:</b> ${active.length} active case(s), ${missing} missing document(s), ${money(pendingPay)} pending balance.<br><br><b>Next move:</b> ${missing?"clear document gaps first":"review upcoming services and vehicle assignments"}.<br><br><b>Funeral director truth:</b> if documents and money are clean, the day becomes much less dramatic.`;
  }

  function renderCases(){
    const q = (el("usaCaseSearch")?.value||"").toLowerCase();
    const list = el("usaCasesList"); if(!list) return;
    const allCases = cases();
    const filtered = allCases.filter(c=>classify(c)===usaFilter).filter(c=>[c.decedent,c.caller,c.director,c.caseNumber,c.facility].join(" ").toLowerCase().includes(q));
    list.innerHTML = filtered.length ? filtered.map(c=>{
      const ds = docStats(c); const cls = classify(c);
      return `<article class="usa-case-card">
        <div class="usa-case-top"><div><h3>${safe(c.decedent)}</h3><small>${safe(c.caseNumber)} · ${safe(c.priority)}</small></div><span class="usa-badge ${cls}">${safe(c.status)}</span></div>
        <div class="usa-meta"><div><span>Family</span><b>${safe(c.caller||"—")}</b></div><div><span>Phone</span><b>${safe(c.phone||"—")}</b></div><div><span>Facility</span><b>${safe(c.facility||c.placeOfDeath||"—")}</b></div><div><span>Balance</span><b>${money(c.balance)}</b></div></div>
        <div><b>Documents:</b> ${ds.complete} complete · ${ds.pending} pending · ${ds.missing} missing</div>
        <div class="usa-timeline">${USA_STEPS().map(s=>`<span class="usa-step ${(c.timeline||[]).includes(s)||c.status===s?'done':''}">${safe(s)}</span>`).join("")}</div>
        <div class="usa-card-actions">
          <button data-usa-status="Family Meeting" data-id="${c.id}">Family Meeting</button>
          <button data-usa-status="Documents Pending" data-id="${c.id}">Docs Pending</button>
          <button data-usa-status="Service Scheduled" data-id="${c.id}">Service Scheduled</button>
          <button data-usa-status="Closed" data-id="${c.id}">Close Case</button>
        </div>
      </article>`;
    }).join("") : `<div class="usa-panel">No cases in this view.</div>`;
  }

  function renderDocuments(){
    const list = el("usaDocumentsList"); if(!list) return;
    const allCases = cases();
    list.innerHTML = allCases.length ? allCases.map(c=>`<article class="usa-doc-card"><h3>${safe(c.decedent)}</h3><small>${safe(c.caseNumber)} · ${safe(c.status)}</small>${USA_DOCS().map(d=>{const st=(c.documents||{})[d]||"Missing"; return `<div class="usa-doc-row"><b>${safe(d)}</b><select class="usa-doc-status ${st.toLowerCase()}" data-id="${c.id}" data-doc="${safe(d)}"><option ${st==='Missing'?'selected':''}>Missing</option><option ${st==='Pending'?'selected':''}>Pending</option><option ${st==='Complete'?'selected':''}>Complete</option></select></div>`}).join("")}</article>`).join("") : `<div class="usa-panel">No cases yet. Create one from First Call Center.</div>`;
  }

  function renderUSA(){ renderDirector(); renderCases(); renderDocuments(); }

  function bind(){
    document.querySelectorAll('.tab-button[data-tab^="usa"]').forEach(btn=>{
      if(btn.dataset.usaBound) return; btn.dataset.usaBound="1";
      btn.addEventListener("click", ()=>setTimeout(renderUSA, 0));
    });
    el("usaNewCaseBtn")?.addEventListener("click", ()=>{ if(typeof window.v38SwitchTab==="function") window.v38SwitchTab("usaFirstCall"); });
    el("usaHeroNewCaseBtn")?.addEventListener("click", ()=>{ if(typeof window.v38SwitchTab==="function") window.v38SwitchTab("usaFirstCall"); });
    el("usaCaseSearch")?.addEventListener("input", renderCases);
    document.querySelectorAll(".usa-filter").forEach(b=>b.addEventListener("click", ()=>{
      document.querySelectorAll(".usa-filter").forEach(x=>x.classList.remove("active"));
      b.classList.add("active"); usaFilter = b.dataset.usaFilter||"active"; renderCases();
    }));
    el("usaFirstCallForm")?.addEventListener("submit", (e)=>{
      e.preventDefault();
      createCase({
        decedent: el("usaFcDecedent")?.value,
        dateOfDeath: el("usaFcDod")?.value,
        caller: el("usaFcCaller")?.value,
        relationship: el("usaFcRelationship")?.value,
        phone: el("usaFcPhone")?.value,
        placeOfDeath: el("usaFcPlace")?.value,
        facility: el("usaFcFacility")?.value,
        priority: el("usaFcPriority")?.value,
        driver: el("usaFcDriver")?.value,
        vehicle: el("usaFcVehicle")?.value,
        notes: el("usaFcNotes")?.value,
        status: "First Call"
      });
      e.target.reset();
      if(typeof window.v38SwitchTab === "function") window.v38SwitchTab("usaCases");
    });
    document.addEventListener("click", (e)=>{ const b=e.target.closest("[data-usa-status]"); if(b) setStatus(b.dataset.id, b.dataset.usaStatus); });
    document.addEventListener("change", (e)=>{ const s=e.target.closest(".usa-doc-status[data-id]"); if(s) setDoc(s.dataset.id, s.dataset.doc, s.value); });
  }

  function showUsaTab(tabName){
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    const section = document.getElementById(tabName + "Tab");
    if(section) section.classList.add("active");
    document.querySelectorAll(".tab-button").forEach(b => b.classList.toggle("active", b.dataset.tab === "usaDirector" || b.dataset.tab === tabName));
    injectSubNav(tabName);
    window.scrollTo(0, 0);
  }

  function patchTabSwitcher(){
    const old = window.v38SwitchTab;
    window.v38SwitchTab = function(tabName){
      if(String(tabName||"").startsWith("usa")){ showUsaTab(tabName); renderUSA(); return; }
      if(typeof old==="function") return old(tabName);
    };
  }

  function injectSubNav(activeTab){
    const modules = window.__usaLib.USA_MODULES_LIST;
    const settings = window.__usaLib.getSettings();
    const visible = modules.filter(m => settings.modules[m.tab] !== false);
    document.querySelectorAll(".usa-module-tab").forEach(section => {
      const existing = section.querySelector(".usa-subnav");
      if(existing) existing.remove();
      const nav = document.createElement("div");
      nav.className = "usa-subnav";
      nav.style.cssText = "display:flex;overflow-x:auto;gap:6px;margin-bottom:18px;padding-bottom:4px;scrollbar-width:none;";
      visible.forEach(m => {
        const btn = document.createElement("button");
        btn.type = "button";
        const isActive = section.id === m.tab + "Tab";
        btn.style.cssText = `white-space:nowrap;padding:7px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid rgba(200,169,110,${isActive?'.6':'.2'});background:${isActive?'rgba(200,169,110,.2)':'transparent'};color:${isActive?'#c8a96e':'#8899aa'};`;
        btn.textContent = m.icon + " " + m.label;
        btn.onclick = () => { if(typeof window.v38SwitchTab==="function") window.v38SwitchTab(m.tab); };
        nav.appendChild(btn);
      });
      section.insertBefore(nav, section.firstChild);
    });
  }

  document.addEventListener("DOMContentLoaded", ()=>{ bind(); patchTabSwitcher(); injectSubNav(); setTimeout(renderUSA, 350); });
})();


// ================================
// FuneralOS USA v2 — Operational Modules
// Adds: Staff, Fleet, Cremation Workflow, Finance Dashboard, Service/Viewings Schedule
// Reads cases from window.__usaLib; stores USA metadata back via updateMeta.
// ================================
(function(){
  const STAFF_KEY = "funeralos_usa_staff_v2";
  const FLEET_KEY = "funeralos_usa_fleet_v2";
  const CREM_STEPS = ["Cremation Authorization","Cremation Permit","Crematory Scheduled","Urn Selected","Ashes Released"];
  const el = (id)=>document.getElementById(id);
  const safe = (s)=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const money = (n)=>"$"+(Number(n||0).toLocaleString("en-US"));
  const todayIso = ()=>new Date().toISOString().slice(0,10);
  const addDaysIso = (days)=>{const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);};
  const uid = ()=>"V2-"+Math.random().toString(36).slice(2,8).toUpperCase();
  function loadKey(key){try{return JSON.parse(localStorage.getItem(key)||"[]")||[]}catch{return []}}
  function saveKey(key,data){localStorage.setItem(key,JSON.stringify(data))}
  function cases(){ return window.__usaLib.cases(); }
  function staff(){ return loadKey(STAFF_KEY); }
  function fleet(){ return loadKey(FLEET_KEY); }

  function setCaseField(caseId, field, value){
    window.__usaLib.updateMeta(caseId, { [field]: value });
    renderAllV2();
  }
  function setCaseNested(caseId, group, key, value){
    const c = cases().find(x=>x.id===caseId); if(!c) return;
    const nested = Object.assign({}, c[group] || {}, { [key]: value });
    window.__usaLib.updateMeta(caseId, { [group]: nested });
    renderAllV2();
  }
  function needsSoon(date){ return date && date>=todayIso() && date<=addDaysIso(30); }

  function renderStaff(){
    const box = el('usaStaffList'); if(!box) return; const data = staff();
    box.innerHTML = data.length ? data.map(s=>`<article class="usa-v2-card"><div class="usa-v2-top"><h3>${safe(s.name)}</h3><span>${safe(s.role)}</span></div><p><b>Shift:</b> ${safe(s.shift||'—')}</p><p><b>Current Assignment:</b> ${safe(s.assignment||'Available')}</p><p class="${needsSoon(s.cert)?'usa-v2-warn':''}"><b>Certification:</b> ${safe(s.cert||'not set')}</p><div class="usa-card-actions"><button data-v2-staff-del="${s.id}">Remove</button></div></article>`).join('') : `<div class="usa-panel">No staff yet. Add your funeral directors, drivers and removal technicians.</div>`;
  }

  function renderFleet(){
    const box = el('usaFleetList'); if(!box) return; const data = fleet();
    box.innerHTML = data.length ? data.map(v=>`<article class="usa-v2-card"><div class="usa-v2-top"><h3>${safe(v.name)}</h3><span>${safe(v.type)}</span></div><p><b>Mileage:</b> ${Number(v.mileage||0).toLocaleString('en-US')}</p><p><b>Status:</b> ${safe(v.status||'Available')}</p><p class="${needsSoon(v.service)?'usa-v2-warn':''}"><b>Next Service:</b> ${safe(v.service||'not set')}</p><p class="${needsSoon(v.insurance)?'usa-v2-warn':''}"><b>Insurance:</b> ${safe(v.insurance||'not set')}</p><div class="usa-card-actions"><button data-v2-fleet-del="${v.id}">Remove</button></div></article>`).join('') : `<div class="usa-panel">No fleet yet. Add hearse, removal van, limo or utility vehicle.</div>`;
  }

  function renderCremation(){
    const box = el('usaCremationList'); if(!box) return;
    const list = cases().filter(c=>/cremat/i.test([c.status,c.notes,c.disposition].join(' ')) || c.disposition==="Cremation" || Object.keys(c.cremation||{}).length>0);
    box.innerHTML = list.length ? list.map(c=>`<article class="usa-case-card"><div class="usa-case-top"><div><h3>${safe(c.decedent)}</h3><small>${safe(c.caseNumber)} · ${safe(c.status)}</small></div><span class="usa-badge pending">Cremation</span></div><div class="usa-form-grid usa-inline-editor">${CREM_STEPS.map(step=>{const st=(c.cremation||{})[step]||'Missing';return `<label>${safe(step)}<select class="usa-v2-crem" data-case="${c.id}" data-step="${safe(step)}"><option ${st==='Missing'?'selected':''}>Missing</option><option ${st==='Pending'?'selected':''}>Pending</option><option ${st==='Complete'?'selected':''}>Complete</option></select></label>`}).join('')}<label>Crematory<input class="usa-v2-field" data-case="${c.id}" data-field="crematory" value="${safe(c.crematory||'')}" placeholder="Crematory name" /></label><label>Urn<input class="usa-v2-field" data-case="${c.id}" data-field="urn" value="${safe(c.urn||'')}" placeholder="Urn selection" /></label></div></article>`).join('') : `<div class="usa-panel">No cremation cases yet. Cases with cremation disposition appear here automatically.</div>`;
  }

  function renderFinance(){
    const list = cases(); const closed = list.filter(c=>c.status==='Closed');
    const revenue = closed.reduce((s,c)=>s+Number(c.caseValue||0), 0);
    const outstanding = list.filter(c=>c.status!=='Closed').reduce((s,c)=>s+Number(c.balance||0), 0);
    const avg = list.length ? Math.round(list.reduce((s,c)=>s+Number(c.caseValue||0),0)/list.length) : 0;
    const unpaid = list.filter(c=>Number(c.balance||0)>0 && c.status!=='Closed').length;
    if(el('usaRevenueClosed')) el('usaRevenueClosed').textContent = money(revenue);
    if(el('usaFinanceOutstanding')) el('usaFinanceOutstanding').textContent = money(outstanding);
    if(el('usaAvgCaseValue')) el('usaAvgCaseValue').textContent = money(avg);
    if(el('usaUnpaidCases')) el('usaUnpaidCases').textContent = unpaid;
    const box = el('usaFinanceList'); if(!box) return;
    box.innerHTML = list.length ? list.map(c=>`<article class="usa-case-card"><div class="usa-case-top"><div><h3>${safe(c.decedent)}</h3><small>${safe(c.caseNumber)} · ${safe(c.status)}</small></div><span class="usa-badge ${Number(c.balance||0)>0?'pending':'closed'}">${Number(c.balance||0)>0?'Unpaid':'Clean'}</span></div><div class="usa-form-grid usa-inline-editor"><label>Case Value<input class="usa-v2-number" data-case="${c.id}" data-field="caseValue" type="number" value="${Number(c.caseValue||0)}" /></label><label>Pending Balance<input class="usa-v2-number" data-case="${c.id}" data-field="balance" type="number" value="${Number(c.balance||0)}" /></label><label>Payment Status<select class="usa-v2-field" data-case="${c.id}" data-field="paymentStatus"><option ${c.paymentStatus==='Pending'?'selected':''}>Pending</option><option ${c.paymentStatus==='Partial'?'selected':''}>Partial</option><option ${c.paymentStatus==='Paid'?'selected':''}>Paid</option><option ${c.paymentStatus==='Insurance Assignment'?'selected':''}>Insurance Assignment</option></select></label></div></article>`).join('') : `<div class="usa-panel">No cases yet.</div>`;
  }

  function renderSchedule(){
    const box = el('usaScheduleList'); if(!box) return;
    const list = cases().filter(c=>c.status!=='Closed');
    box.innerHTML = list.length ? list.map(c=>`<article class="usa-case-card"><div class="usa-case-top"><div><h3>${safe(c.decedent)}</h3><small>${safe(c.caseNumber)} · scheduling board</small></div><span class="usa-badge">Schedule</span></div><div class="usa-form-grid usa-inline-editor"><label>Viewing Date<input class="usa-v2-field" data-case="${c.id}" data-field="viewingDate" type="date" value="${safe(c.viewingDate||'')}" /></label><label>Viewing Room<input class="usa-v2-field" data-case="${c.id}" data-field="viewingRoom" value="${safe(c.viewingRoom||'')}" placeholder="Room A" /></label><label>Service Date<input class="usa-v2-field" data-case="${c.id}" data-field="serviceDate" type="date" value="${safe(c.serviceDate||'')}" /></label><label>Service Time<input class="usa-v2-field" data-case="${c.id}" data-field="serviceTime" type="time" value="${safe(c.serviceTime||'')}" /></label><label>Service Location<input class="usa-v2-field" data-case="${c.id}" data-field="serviceLocation" value="${safe(c.serviceLocation||'')}" /></label><label>Assigned Staff<input class="usa-v2-field" data-case="${c.id}" data-field="assignedStaff" value="${safe(c.assignedStaff||c.driver||'')}" /></label><label>Vehicle<input class="usa-v2-field" data-case="${c.id}" data-field="vehicle" value="${safe(c.vehicle||'')}" /></label><label>Cemetery / Crematory<input class="usa-v2-field" data-case="${c.id}" data-field="finalLocation" value="${safe(c.finalLocation||c.crematory||'')}" /></label></div></article>`).join('') : `<div class="usa-panel">No active cases to schedule.</div>`;
  }

  function renderDirectorV2Extras(){
    const active = cases().filter(c=>c.status!=='Closed'); const st = staff(); const fl = fleet();
    const dueStaff = st.filter(s=>needsSoon(s.cert)).length;
    const dueFleet = fl.filter(v=>needsSoon(v.service)||needsSoon(v.insurance)||v.status==='Out of Service').length;
    const target = el('usaDirectorBrief');
    if(target){
      const old = target.innerHTML.split('<hr class="usa-v2-hr">')[0];
      target.innerHTML = old + `<hr class="usa-v2-hr"><b>USA v2 Ops:</b> ${st.length} staff member(s), ${fl.length} vehicle(s), ${dueStaff} certification alert(s), ${dueFleet} fleet alert(s).<br><br><b>Manager focus:</b> match each upcoming service with staff + vehicle before documents become tomorrow's headache.`;
    }
    const att = el('usaAttentionList');
    if(att){
      const extras = [];
      st.filter(s=>needsSoon(s.cert)).forEach(s=>extras.push(`<div class="usa-alert warning"><strong>${safe(s.name)} certification expiring</strong><small>${safe(s.cert)} · ${safe(s.role)}</small></div>`));
      fl.filter(v=>needsSoon(v.service)||needsSoon(v.insurance)||v.status==='Out of Service').forEach(v=>extras.push(`<div class="usa-alert danger"><strong>${safe(v.name)} fleet attention</strong><small>Service ${safe(v.service||'—')} · Insurance ${safe(v.insurance||'—')} · ${safe(v.status||'')}</small></div>`));
      if(extras.length && !att.dataset.v2){ att.dataset.v2='1'; att.insertAdjacentHTML('beforeend', extras.join('')); }
    }
  }

  function renderAllV2(){ renderStaff(); renderFleet(); renderCremation(); renderFinance(); renderSchedule(); setTimeout(renderDirectorV2Extras, 20); }

  function bind(){
    document.querySelectorAll('.tab-button[data-tab^="usa"]').forEach(btn=>btn.addEventListener('click', ()=>setTimeout(renderAllV2, 50)));
    el('usaStaffForm')?.addEventListener('submit', (e)=>{
      e.preventDefault();
      const d = staff();
      d.push({id:uid(), name:el('usaStaffName')?.value||'Unnamed', role:el('usaStaffRole')?.value, shift:el('usaStaffShift')?.value, cert:el('usaStaffCert')?.value, assignment:'Available'});
      saveKey(STAFF_KEY, d); e.target.reset(); renderAllV2();
    });
    el('usaFleetForm')?.addEventListener('submit', (e)=>{
      e.preventDefault();
      const d = fleet();
      d.push({id:uid(), name:el('usaFleetName')?.value||'Vehicle', type:el('usaFleetType')?.value, mileage:el('usaFleetMileage')?.value, service:el('usaFleetService')?.value, insurance:el('usaFleetInsurance')?.value, status:el('usaFleetStatus')?.value});
      saveKey(FLEET_KEY, d); e.target.reset(); renderAllV2();
    });
    document.addEventListener('click', (e)=>{
      const s = e.target.closest('[data-v2-staff-del]');
      if(s){ saveKey(STAFF_KEY, staff().filter(x=>x.id!==s.dataset.v2StaffDel)); renderAllV2(); }
      const f = e.target.closest('[data-v2-fleet-del]');
      if(f){ saveKey(FLEET_KEY, fleet().filter(x=>x.id!==f.dataset.v2FleetDel)); renderAllV2(); }
    });
    document.addEventListener('change', (e)=>{
      const cr = e.target.closest('.usa-v2-crem');
      if(cr) setCaseNested(cr.dataset.case, 'cremation', cr.dataset.step, cr.value);
      const fld = e.target.closest('.usa-v2-field,.usa-v2-number');
      if(fld) setCaseField(fld.dataset.case, fld.dataset.field, fld.value);
    });
    document.addEventListener('blur', (e)=>{
      const fld = e.target.closest?.('.usa-v2-field,.usa-v2-number');
      if(fld) setCaseField(fld.dataset.case, fld.dataset.field, fld.value);
    }, true);
  }

  document.addEventListener('DOMContentLoaded', ()=>{ bind(); setTimeout(renderAllV2, 400); });
})();


// ================================
// FuneralOS USA v3 - AI Operations Director
// Built as local-first intelligence layer on top of USA v2 data.
// ================================
(function(){
  const STAFF_KEY = "funeralos_usa_staff_v2";
  const FLEET_KEY = "funeralos_usa_fleet_v2";
  const DOCS = ["Death Certificate","Burial Permit","Cremation Authorization","Contract","Invoice"];
  const el = (id)=>document.getElementById(id);
  const safe = (s)=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const money = (n)=>"$"+Number(n||0).toLocaleString("en-US");
  const load = (key)=>{try{return JSON.parse(localStorage.getItem(key)||"[]")||[]}catch{return []}};
  const todayIso = ()=>new Date().toISOString().slice(0,10);
  const addDaysIso = (days)=>{const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)};
  const daysBetween = (date)=>{ if(!date) return null; const a=new Date(todayIso()); const b=new Date(date); return Math.round((b-a)/86400000); };
  const cases = ()=> window.__usaLib ? window.__usaLib.cases() : [];
  const staff = ()=>load(STAFF_KEY);
  const fleet = ()=>load(FLEET_KEY);

  function isActive(c){ return c && c.status !== "Closed"; }
  function isUpcoming(c){ const d=c.serviceDate||c.viewingDate; const diff=daysBetween(d); return diff!==null && diff>=0 && diff<=7 && isActive(c); }
  function missingDocs(c){ return DOCS.filter(d=>((c.documents||{})[d]||"Missing")!=="Complete"); }
  function pendingDocs(c){ return DOCS.filter(d=>((c.documents||{})[d]||"Missing")==="Pending"); }
  function needsSoon(date,days=30){ const diff=daysBetween(date); return diff!==null && diff>=0 && diff<=days; }
  function oldOpenCase(c){ const created=c.createdAt||c.dateOfDeath; if(!created) return false; const diff=daysBetween(created); return diff!==null && diff<=-7 && isActive(c); }

  function caseHealth(c){
    let score=100; const issues=[];
    const miss=missingDocs(c); const pend=pendingDocs(c);
    if(miss.length){ score-=Math.min(35, miss.length*7); issues.push(`${miss.length} document(s) not complete`); }
    if(pend.length){ score-=Math.min(10, pend.length*2); }
    if(Number(c.balance||0)>0){ score-=18; issues.push(`Outstanding balance ${money(c.balance)}`); }
    if(isUpcoming(c) && miss.length){ score-=18; issues.push("Upcoming service with document gaps"); }
    if(!c.assignedStaff && !c.driver){ score-=8; issues.push("No staff assignment"); }
    if(!c.vehicle && (c.serviceDate||c.viewingDate)){ score-=6; issues.push("No vehicle assigned"); }
    if(oldOpenCase(c)){ score-=8; issues.push("Open more than 7 days"); }
    score=Math.max(0, Math.min(100, Math.round(score)));
    const level = score>=90?"Healthy":score>=70?"Attention":"Risk";
    return {score, level, issues};
  }

  function smartAlerts(){
    const out=[]; const active=cases().filter(isActive);
    active.forEach(c=>{
      const h=caseHealth(c); const miss=missingDocs(c);
      if(h.score<70) out.push({level:"urgent",title:`${c.caseNumber||"Case"} at risk`,meta:`${c.decedent||"Unnamed"} · ${h.issues.slice(0,2).join(" · ")}`});
      if(isUpcoming(c) && miss.length) out.push({level:"urgent",title:`Service approaching with missing documents`,meta:`${c.decedent||"Unnamed"} · ${miss.slice(0,3).join(", ")}`});
      if(Number(c.balance||0)>0) out.push({level:"warning",title:`Outstanding balance`,meta:`${c.decedent||"Unnamed"} · ${money(c.balance)}`});
      if(oldOpenCase(c)) out.push({level:"warning",title:`Case open more than 7 days`,meta:`${c.decedent||"Unnamed"} · review timeline`});
    });
    staff().forEach(s=>{ if(needsSoon(s.cert,30)) out.push({level:"warning",title:`Staff certification expiring`,meta:`${s.name||"Staff"} · ${s.cert||"date missing"}`}); });
    fleet().forEach(v=>{
      if(v.status==="Out of Service") out.push({level:"urgent",title:`Vehicle out of service`,meta:`${v.name||"Vehicle"} · remove from assignments`});
      if(needsSoon(v.service,30)) out.push({level:"warning",title:`Fleet service due`,meta:`${v.name||"Vehicle"} · ${v.service}`});
      if(needsSoon(v.insurance,30)) out.push({level:"warning",title:`Vehicle insurance expiring`,meta:`${v.name||"Vehicle"} · ${v.insurance}`});
    });
    return out;
  }

  function operationsScore(){
    const cs=cases(); const active=cs.filter(isActive); const st=staff(); const fl=fleet();
    const totalDocs=active.length*DOCS.length || 1;
    const completeDocs=active.reduce((sum,c)=>sum+DOCS.filter(d=>((c.documents||{})[d]||"Missing")==="Complete").length, 0);
    const documents=Math.round((completeDocs/totalDocs)*100);
    const scheduled=active.length?Math.round((active.filter(c=>c.serviceDate||c.viewingDate).length/active.length)*100):100;
    const paidBase=active.length||1;
    const payments=Math.round((active.filter(c=>Number(c.balance||0)<=0).length/paidBase)*100);
    const fleetScore=fl.length?Math.max(0,100-(fl.filter(v=>v.status==="Out of Service"||needsSoon(v.service,15)||needsSoon(v.insurance,15)).length*18)):85;
    const staffScore=st.length?Math.max(0,100-(st.filter(s=>needsSoon(s.cert,15)).length*15)):80;
    const score=Math.round(documents*.28 + scheduled*.22 + payments*.22 + fleetScore*.14 + staffScore*.14);
    return {score, documents, scheduled, payments, fleet:fleetScore, staff:staffScore};
  }

  function topAction(alerts, active){
    if(alerts.some(a=>a.level==="urgent" && /missing|documents|Service approaching/i.test(a.title+a.meta))) return "Fix docs";
    if(alerts.some(a=>/balance/i.test(a.title))) return "Collect AR";
    if(alerts.some(a=>/Vehicle|Fleet/i.test(a.title))) return "Check fleet";
    if(active.some(c=>!c.assignedStaff&&!c.driver)) return "Assign staff";
    return active.length ? "Review schedule" : "Create case";
  }

  function briefingHtml(kind){
    const cs=cases(); const active=cs.filter(isActive);
    const closedToday=cs.filter(c=>c.status==="Closed").length;
    const upcoming=active.filter(isUpcoming); const alerts=smartAlerts(); const ops=operationsScore();
    const missing=active.reduce((s,c)=>s+missingDocs(c).length, 0);
    const outstanding=active.reduce((s,c)=>s+Number(c.balance||0), 0);
    if(kind==="evening"){
      return `<h4>End-of-Day Recap</h4><p><b>Operations Score:</b> ${ops.score}/100 · <b>Closed:</b> ${closedToday} · <b>Open Cases:</b> ${active.length}</p><ul><li>${missing} document item(s) still not complete.</li><li>${money(outstanding)} outstanding balance across active cases.</li><li>${upcoming.length} service/viewing item(s) in the next 7 days.</li><li>${alerts.filter(a=>a.level==="urgent").length} urgent alert(s) should be handled before tomorrow.</li></ul><div class="usa-v3-pill-row"><span class="usa-v3-pill">Tomorrow focus: ${topAction(alerts,active)}</span><span class="usa-v3-pill">Payments: ${ops.payments}/100</span><span class="usa-v3-pill">Docs: ${ops.documents}/100</span></div>`;
    }
    return `<h4>Good Morning, Director</h4><p><b>${active.length}</b> active case(s). <b>${alerts.length}</b> smart alert(s). <b>${upcoming.length}</b> upcoming service/viewing item(s).</p><ul><li>${missing} document item(s) need completion.</li><li>${money(outstanding)} in pending balances.</li><li>${active.filter(c=>caseHealth(c).level==="Risk").length} case(s) are at risk.</li><li>Recommended first move: <b>${topAction(alerts,active)}</b>.</li></ul><div class="usa-v3-pill-row"><span class="usa-v3-pill">Operations ${ops.score}/100</span><span class="usa-v3-pill">Staff ${ops.staff}/100</span><span class="usa-v3-pill">Fleet ${ops.fleet}/100</span></div>`;
  }

  function renderV3(){
    const cs=cases(); const active=cs.filter(isActive); const alerts=smartAlerts(); const ops=operationsScore();
    if(el("usaV3OpsScore")) el("usaV3OpsScore").textContent = ops.score;
    if(el("usaV3OpsLabel")) el("usaV3OpsLabel").textContent = ops.score>=90?"Healthy":ops.score>=75?"Needs attention":"Director action required";
    if(el("usaV3OpsBar")) el("usaV3OpsBar").style.width = ops.score+"%";
    if(el("usaV3RiskCases")) el("usaV3RiskCases").textContent = active.filter(c=>caseHealth(c).level==="Risk").length;
    if(el("usaV3AlertCount")) el("usaV3AlertCount").textContent = alerts.length;
    if(el("usaV3TopAction")) el("usaV3TopAction").textContent = topAction(alerts, active);
    if(el("usaV3MorningBrief")) el("usaV3MorningBrief").innerHTML = briefingHtml("morning");
    if(el("usaV3EveningRecap")) el("usaV3EveningRecap").innerHTML = briefingHtml("evening");
    const healthBox = el("usaV3CaseHealth");
    if(healthBox){
      const sorted = active.map(c=>({c,h:caseHealth(c)})).sort((a,b)=>a.h.score-b.h.score).slice(0,8);
      healthBox.innerHTML = sorted.length ? sorted.map(({c,h})=>`<article class="usa-v3-health-card"><div class="usa-v3-health-top"><div><h4>${safe(c.decedent||"Unnamed case")}</h4><small>${safe(c.caseNumber||"")} · ${safe(c.status||"")}</small></div><span class="usa-v3-health-score ${h.score<70?'risk':h.score<90?'warn':''}">${h.score}%</span></div><small>${h.issues.length?safe(h.issues.join(" · ")):"No operational gaps detected."}</small></article>`).join("") : `<div class="usa-panel">No active cases. Add a case from First Call.</div>`;
    }
    const alertBox = el("usaV3SmartAlerts");
    if(alertBox){
      alertBox.innerHTML = alerts.length ? alerts.slice(0,12).map(a=>`<div class="usa-alert usa-v3-alert-${a.level}"><strong>${safe(a.title)}</strong><small>${safe(a.meta)}</small></div>`).join("") : `<div class="usa-alert usa-v3-alert-ok"><strong>No important alerts.</strong><small>Everything is clean enough to make coffee taste better.</small></div>`;
    }
  }

  function copyText(text){
    if(navigator.clipboard) navigator.clipboard.writeText(text).catch(()=>{});
  }

  function bindV3(){
    document.querySelectorAll('.tab-button[data-tab^="usa"]').forEach(btn=>btn.addEventListener('click', ()=>setTimeout(renderV3, 120)));
    document.addEventListener('change', ()=>setTimeout(renderV3, 120));
    document.addEventListener('blur', ()=>setTimeout(renderV3, 120), true);
    el('usaV3MorningBtn')?.addEventListener('click', ()=>{ renderV3(); copyText(el('usaV3MorningBrief')?.innerText||''); });
    el('usaV3EveningBtn')?.addEventListener('click', ()=>{ renderV3(); copyText(el('usaV3EveningRecap')?.innerText||''); });
  }

  document.addEventListener('DOMContentLoaded', ()=>{ bindV3(); setTimeout(renderV3, 450); });
})();
