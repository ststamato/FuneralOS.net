// ================================
// FuneralOS USA — Demo Seeder
// Runs before all IIFEs; writes realistic demo data to localStorage
// only in demo mode and only when keys are empty.
// ================================
(function(){
  if (!window.__DEMO_MODE) return;
  const todayIso = ()=>new Date().toISOString().slice(0,10);
  const addDays = (n)=>{ const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
  const CASES_KEY = "funeralos_usa_cases_v1";
  const STAFF_KEY = "funeralos_usa_staff_v2";
  const FLEET_KEY = "funeralos_usa_fleet_v2";
  const USA_DOCS = ["Death Certificate","Burial Permit","Cremation Authorization","Contract","Invoice"];

  function seed(key, data){ if(!(localStorage.getItem(key)||"").includes('"id"')) localStorage.setItem(key, JSON.stringify(data)); }

  function makeDocs(overrides){
    const d={}; USA_DOCS.forEach(k=>d[k]="Missing");
    Object.assign(d, overrides); return d;
  }

  seed(CASES_KEY, [
    {
      id:"DEMO-USA-001", createdAt: new Date(Date.now()-3*864e5).toISOString(), caseNumber:"USA-2026-001",
      decedent:"Miller, John R.", dateOfDeath: addDays(-3), caller:"Susan Miller", relationship:"Daughter",
      phone:"(555) 210-6542", placeOfDeath:"Hospital", facility:"St. Mary Medical Center",
      priority:"Urgent", director:"Christine Walsh", driver:"Thomas Anderson", vehicle:"Hearse #1",
      serviceDate: addDays(2), serviceTime:"10:00", serviceLocation:"Riverside Community Church",
      viewingDate: addDays(1), viewingRoom:"Chapel A",
      disposition:"Burial", finalLocation:"Greenwood Cemetery",
      status:"Documents Pending", balance:4250, caseValue:8500, paymentStatus:"Pending",
      notes:"⚠️ Death Certificate NOT yet filed — call Dr. Patterson office. Family requesting urgent transfer authorization. 3 out-of-town relatives arriving Fri.",
      documents: makeDocs({"Contract":"Complete","Cremation Authorization":"Missing","Death Certificate":"Pending","Burial Permit":"Pending"}),
      timeline:["First Call","Removal Scheduled","Family Meeting","Documents Pending"],
      cremation:{}
    },
    {
      id:"DEMO-USA-002", createdAt: new Date(Date.now()-1*864e5).toISOString(), caseNumber:"USA-2026-002",
      decedent:"Thompson, Elizabeth A.", dateOfDeath: addDays(-1), caller:"James Thompson", relationship:"Son",
      phone:"(555) 382-9104", placeOfDeath:"Hospice", facility:"Serenity Hospice Center",
      priority:"Normal", director:"Thomas Anderson", driver:"Michael Brown", vehicle:"Removal Van #1",
      serviceDate: addDays(1), serviceTime:"14:00", serviceLocation:"First Presbyterian Church",
      viewingDate: todayIso(), viewingRoom:"Chapel B",
      disposition:"Burial", finalLocation:"Oak Hill Cemetery",
      status:"Service Scheduled", balance:0, caseValue:6800, paymentStatus:"Paid",
      notes:"All arrangements confirmed. Flowers by Carter's Florists. Family has pre-paid in full. 12 pallbearers coordinated.",
      documents: makeDocs({"Death Certificate":"Complete","Burial Permit":"Complete","Contract":"Complete","Invoice":"Complete","Cremation Authorization":"Missing"}),
      timeline:["First Call","Removal Scheduled","Family Meeting","Documents Pending","Preparation","Viewing","Service Scheduled"],
      cremation:{}
    },
    {
      id:"DEMO-USA-003", createdAt: new Date(Date.now()-5*864e5).toISOString(), caseNumber:"USA-2026-003",
      decedent:"Davis, Robert W.", dateOfDeath: addDays(-5), caller:"Linda Davis", relationship:"Wife",
      phone:"(555) 491-7733", placeOfDeath:"Coroner Case", facility:"County Coroner's Office",
      priority:"High", director:"Christine Walsh", driver:"Michael Brown", vehicle:"Removal Van #1",
      serviceDate: addDays(4), serviceTime:"11:00", serviceLocation:"Valley Crematory",
      viewingDate:"", viewingRoom:"",
      disposition:"Cremation", finalLocation:"Valley Crematory",
      status:"Preparation", balance:3800, caseValue:5200, paymentStatus:"Partial",
      notes:"Coroner hold — pending toxicology report (est. release in 2 days). Cremation cannot proceed until authorization released. Family notified.",
      documents: makeDocs({"Death Certificate":"Pending","Cremation Authorization":"Pending","Contract":"Complete","Invoice":"Pending"}),
      timeline:["First Call","Removal Scheduled","Family Meeting","Documents Pending","Preparation"],
      cremation:{"Cremation Authorization":"Pending","Cremation Permit":"Missing","Crematory Scheduled":"Pending","Urn Selected":"Pending","Ashes Released":"Missing"},
      crematory:"Valley Crematory", urn:"Silver Companion Urn"
    },
    {
      id:"DEMO-USA-004", createdAt: new Date(Date.now()-18*864e5).toISOString(), caseNumber:"USA-2026-004",
      decedent:"Garcia, Maria L.", dateOfDeath: addDays(-18), caller:"Carlos Garcia", relationship:"Son",
      phone:"(555) 603-2281", placeOfDeath:"Residence", facility:"Home Death",
      priority:"Normal", director:"Thomas Anderson", driver:"Thomas Anderson", vehicle:"Hearse #1",
      serviceDate: addDays(-14), serviceTime:"09:00", serviceLocation:"St. Joseph Catholic Church",
      viewingDate: addDays(-15), viewingRoom:"Main Chapel",
      disposition:"Burial", finalLocation:"Holy Cross Cemetery",
      status:"Closed", balance:0, caseValue:5200, paymentStatus:"Paid",
      notes:"Service completed. All documents filed with County. Urn returned to family. Case closed.",
      documents: makeDocs({"Death Certificate":"Complete","Burial Permit":"Complete","Contract":"Complete","Invoice":"Complete","Cremation Authorization":"Missing"}),
      timeline:["First Call","Removal Scheduled","Family Meeting","Documents Pending","Preparation","Viewing","Service Scheduled","Burial/Cremation","Closed"],
      cremation:{}
    }
  ]);

  // Staff list intentionally not pre-seeded — users add their own staff from Settings

  seed(FLEET_KEY, [
    { id:"DEMO-FL-001", name:"Hearse #1", type:"Hearse", mileage:84520, service: addDays(12), insurance: addDays(95), status:"Assigned — Case 002" },
    { id:"DEMO-FL-002", name:"Removal Van #1", type:"Removal Van", mileage:61300, service: addDays(45), insurance: addDays(120), status:"Available" },
    { id:"DEMO-FL-003", name:"Limousine #1", type:"Limousine", mileage:52800, service: addDays(-5), insurance: addDays(60), status:"Out of Service" }
  ]);
})();

// ================================
// FuneralOS USA v1 — Director Modules
// Adds: Cases, First Call, Documents, Director Command Center
// Standalone localStorage layer: does NOT alter Greek Bible data.
// ================================
(function(){
  const USA_KEY = "funeralos_usa_cases_v1";
  const USA_DOCS = ["Death Certificate","Burial Permit","Cremation Authorization","Contract","Invoice"];
  const USA_STEPS = ["First Call","Removal Scheduled","Family Meeting","Documents Pending","Preparation","Viewing","Service Scheduled","Burial/Cremation","Closed"];
  let usaCases = [];
  let usaFilter = "active";

  const el = (id)=>document.getElementById(id);
  const safe = (s)=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const money = (n)=>"$"+(Number(n||0).toLocaleString("en-US"));
  const todayIso = ()=>new Date().toISOString().slice(0,10);
  const addDaysIso = (days)=>{const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);};
  const uid = ()=>"USA-"+new Date().getFullYear()+"-"+Math.random().toString(36).slice(2,7).toUpperCase();

  function load(){
    try{ usaCases = JSON.parse(localStorage.getItem(USA_KEY)||"[]") || []; }catch{ usaCases=[]; }
  }
  function save(){ localStorage.setItem(USA_KEY, JSON.stringify(usaCases)); }
  function docStats(c){
    const docs = c.documents || {};
    let missing=0,pending=0,complete=0;
    USA_DOCS.forEach(d=>{ const v=docs[d]||"Missing"; if(v==="Complete") complete++; else if(v==="Pending") pending++; else missing++; });
    return {missing,pending,complete};
  }
  function activeCases(){ return usaCases.filter(c=>c.status!=="Closed"); }
  function isUpcoming(c){ return c.serviceDate && c.serviceDate>=todayIso() && c.serviceDate<=addDaysIso(7); }
  function classify(c){ if(c.status==="Closed") return "closed"; if((c.status||"").includes("Pending") || docStats(c).missing>0) return "pending"; return "active"; }
  function createCase(data){
    const docs = {}; USA_DOCS.forEach(d=>docs[d]="Missing");
    const c = {
      id: uid(), createdAt: new Date().toISOString(), caseNumber: data.caseNumber || uid(), decedent: data.decedent || "Unnamed Case",
      dateOfDeath: data.dateOfDeath || "", caller: data.caller||"", relationship:data.relationship||"", phone:data.phone||"",
      placeOfDeath:data.placeOfDeath||"", facility:data.facility||"", priority:data.priority||"Normal", director:data.director||"",
      driver:data.driver||"", vehicle:data.vehicle||"", serviceDate:data.serviceDate||"", status:data.status||"First Call",
      balance:Number(data.balance||0), notes:data.notes||"", documents:docs,
      timeline:["First Call"].concat(data.driver||data.vehicle?["Removal Scheduled"]:[])
    };
    usaCases.unshift(c); save(); renderUSA(); return c;
  }
  function setStatus(id,status){
    const c=usaCases.find(x=>x.id===id); if(!c) return;
    c.status=status; if(!c.timeline) c.timeline=[]; if(!c.timeline.includes(status)) c.timeline.push(status);
    if(status==="Closed" && !c.timeline.includes("Closed")) c.timeline.push("Closed");
    save(); renderUSA();
  }
  function setDoc(id,doc,status){ const c=usaCases.find(x=>x.id===id); if(!c) return; c.documents=c.documents||{}; c.documents[doc]=status; save(); renderUSA(); }
  function seedDemo(){
    createCase({decedent:"John Miller",dateOfDeath:todayIso(),caller:"Susan Miller",relationship:"Daughter",phone:"(555) 210-6542",placeOfDeath:"Hospital",facility:"St. Mary Hospital",priority:"Urgent",director:"Funeral Director",driver:"Removal Team A",vehicle:"Removal Van",serviceDate:addDaysIso(2),balance:2450,notes:"Family requested viewing before service."});
    const c=usaCases[0]; c.documents["Death Certificate"]="Pending"; c.documents["Contract"]="Complete"; save(); renderUSA();
  }
  function renderDirector(){
    const active=activeCases();
    const missing = usaCases.reduce((sum,c)=>sum+docStats(c).missing,0);
    const pendingPay = usaCases.filter(c=>c.status!=="Closed").reduce((s,c)=>s+Number(c.balance||0),0);
    const upcoming = usaCases.filter(isUpcoming).length;
    if(el("usaActiveCount")) el("usaActiveCount").textContent=active.length;
    if(el("usaMissingDocsCount")) el("usaMissingDocsCount").textContent=missing;
    if(el("usaPendingPaymentsTotal")) el("usaPendingPaymentsTotal").textContent=money(pendingPay);
    if(el("usaUpcomingServicesCount")) el("usaUpcomingServicesCount").textContent=upcoming;
    const alerts=[];
    active.forEach(c=>{
      const ds=docStats(c);
      if(ds.missing) alerts.push({type:"danger",title:`${c.decedent}: ${ds.missing} missing document(s)`,meta:`${c.caseNumber} · ${c.status}`});
      if(Number(c.balance||0)>0) alerts.push({type:"warning",title:`${c.decedent}: unpaid balance ${money(c.balance)}`,meta:`Family: ${c.caller||"not set"}`});
      if(isUpcoming(c)) alerts.push({type:"",title:`Upcoming service: ${c.decedent}`,meta:`${c.serviceDate} · vehicle ${c.vehicle||"not assigned"}`});
    });
    if(el("usaAttentionList")) el("usaAttentionList").innerHTML = alerts.length ? alerts.slice(0,12).map(a=>`<div class="usa-alert ${a.type}"><strong>${safe(a.title)}</strong><small>${safe(a.meta)}</small></div>`).join("") : `<div class="usa-alert"><strong>No urgent items.</strong><small>Clean board. Rare animal, enjoy it.</small></div>`;
    if(el("usaDirectorBrief")) el("usaDirectorBrief").innerHTML = `<b>Today:</b> ${active.length} active case(s), ${missing} missing document(s), ${money(pendingPay)} pending balance.<br><br><b>Next move:</b> ${missing?"clear document gaps first":"review upcoming services and vehicle assignments"}.<br><br><b>Funeral director truth:</b> if documents and money are clean, the day becomes much less dramatic.`;
  }
  function renderCases(){
    const q=(el("usaCaseSearch")?.value||"").toLowerCase();
    const list=el("usaCasesList"); if(!list) return;
    const filtered=usaCases.filter(c=>classify(c)===usaFilter).filter(c=>[c.decedent,c.caller,c.director,c.caseNumber,c.facility].join(" ").toLowerCase().includes(q));
    list.innerHTML = filtered.length ? filtered.map(c=>{
      const ds=docStats(c); const cls=classify(c);
      return `<article class="usa-case-card">
        <div class="usa-case-top"><div><h3>${safe(c.decedent)}</h3><small>${safe(c.caseNumber)} · ${safe(c.priority)}</small></div><span class="usa-badge ${cls}">${safe(c.status)}</span></div>
        <div class="usa-meta"><div><span>Family</span><b>${safe(c.caller||"—")}</b></div><div><span>Phone</span><b>${safe(c.phone||"—")}</b></div><div><span>Facility</span><b>${safe(c.facility||c.placeOfDeath||"—")}</b></div><div><span>Balance</span><b>${money(c.balance)}</b></div></div>
        <div><b>Documents:</b> ${ds.complete} complete · ${ds.pending} pending · ${ds.missing} missing</div>
        <div class="usa-timeline">${USA_STEPS.map(s=>`<span class="usa-step ${(c.timeline||[]).includes(s)||c.status===s?'done':''}">${safe(s)}</span>`).join("")}</div>
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
    const list=el("usaDocumentsList"); if(!list) return;
    list.innerHTML = usaCases.length ? usaCases.map(c=>`<article class="usa-doc-card"><h3>${safe(c.decedent)}</h3><small>${safe(c.caseNumber)} · ${safe(c.status)}</small>${USA_DOCS.map(d=>{const st=(c.documents||{})[d]||"Missing"; return `<div class="usa-doc-row"><b>${safe(d)}</b><select class="usa-doc-status ${st.toLowerCase()}" data-id="${c.id}" data-doc="${safe(d)}"><option ${st==='Missing'?'selected':''}>Missing</option><option ${st==='Pending'?'selected':''}>Pending</option><option ${st==='Complete'?'selected':''}>Complete</option></select></div>`}).join("")}</article>`).join("") : `<div class="usa-panel">No USA cases yet. Create one from First Call Center.</div>`;
  }
  function renderUSA(){ renderDirector(); renderCases(); renderDocuments(); }
  function bind(){
    document.querySelectorAll('.tab-button[data-tab^="usa"]').forEach(btn=>{
      if(btn.dataset.usaBound) return; btn.dataset.usaBound="1";
      btn.addEventListener("click",()=>setTimeout(renderUSA,0));
    });
    el("usaSeedBtn")?.addEventListener("click",seedDemo);
    el("usaNewCaseBtn")?.addEventListener("click",()=>{ document.querySelector('[data-tab="usaFirstCall"]')?.click(); });
    el("usaCaseSearch")?.addEventListener("input",renderCases);
    document.querySelectorAll(".usa-filter").forEach(b=>b.addEventListener("click",()=>{ document.querySelectorAll(".usa-filter").forEach(x=>x.classList.remove("active")); b.classList.add("active"); usaFilter=b.dataset.usaFilter||"active"; renderCases(); }));
    el("usaFirstCallForm")?.addEventListener("submit",(e)=>{e.preventDefault();
      createCase({decedent:el("usaFcDecedent")?.value,dateOfDeath:el("usaFcDod")?.value,caller:el("usaFcCaller")?.value,relationship:el("usaFcRelationship")?.value,phone:el("usaFcPhone")?.value,placeOfDeath:el("usaFcPlace")?.value,facility:el("usaFcFacility")?.value,priority:el("usaFcPriority")?.value,driver:el("usaFcDriver")?.value,vehicle:el("usaFcVehicle")?.value,notes:el("usaFcNotes")?.value,status:"First Call"});
      e.target.reset(); document.querySelector('[data-tab="usaCases"]')?.click();
    });
    document.addEventListener("click",(e)=>{ const b=e.target.closest("[data-usa-status]"); if(b) setStatus(b.dataset.id,b.dataset.usaStatus); });
    document.addEventListener("change",(e)=>{ const s=e.target.closest(".usa-doc-status[data-id]"); if(s) setDoc(s.dataset.id,s.dataset.doc,s.value); });
  }
  function showUsaTab(tabName){
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    const section = document.getElementById(tabName + "Tab");
    if(section) section.classList.add("active");
    document.querySelectorAll(".tab-button").forEach(b => b.classList.remove("active"));
    window.scrollTo(0,0);
  }
  function patchTabSwitcher(){
    const old = window.v38SwitchTab;
    window.v38SwitchTab = function(tabName){
      if(String(tabName||"").startsWith("usa")){ showUsaTab(tabName); renderUSA(); return; }
      if(typeof old==="function") return old(tabName);
    };
  }
  function injectBackButtons(){
    document.querySelectorAll(".usa-module-tab").forEach(section => {
      if(section.querySelector(".usa-back-btn")) return;
      const bar = document.createElement("div");
      bar.style.cssText = "margin-bottom:16px;";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "usa-back-btn";
      btn.style.cssText = "background:none;border:none;color:#8899aa;font-size:13px;cursor:pointer;padding:6px 0;display:flex;align-items:center;gap:6px;";
      btn.innerHTML = "&#8592; Back to Settings";
      btn.onclick = () => { if(typeof window.v38SwitchTab==="function") window.v38SwitchTab("settings"); };
      bar.appendChild(btn);
      section.insertBefore(bar, section.firstChild);
    });
  }
  document.addEventListener("DOMContentLoaded",()=>{ load(); bind(); patchTabSwitcher(); injectBackButtons(); renderUSA(); });
})();


// ================================
// FuneralOS USA v2 — Operational Modules
// Adds: Staff, Fleet, Cremation Workflow, Finance Dashboard, Service/Viewings Schedule
// Uses the USA v1 cases localStorage; does not alter Greek Bible data.
// ================================
(function(){
  const CASES_KEY = "funeralos_usa_cases_v1";
  const STAFF_KEY = "funeralos_usa_staff_v2";
  const FLEET_KEY = "funeralos_usa_fleet_v2";
  const CREM_STEPS = ["Cremation Authorization","Cremation Permit","Crematory Scheduled","Urn Selected","Ashes Released"];
  const el=(id)=>document.getElementById(id);
  const safe=(s)=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const money=(n)=>"$"+(Number(n||0).toLocaleString("en-US"));
  const todayIso=()=>new Date().toISOString().slice(0,10);
  const addDaysIso=(days)=>{const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);};
  const id=()=>"V2-"+Math.random().toString(36).slice(2,8).toUpperCase();
  function load(key){try{return JSON.parse(localStorage.getItem(key)||"[]")||[]}catch{return []}}
  function save(key,data){localStorage.setItem(key,JSON.stringify(data))}
  function cases(){return load(CASES_KEY)}
  function saveCases(data){save(CASES_KEY,data)}
  function staff(){return load(STAFF_KEY)}
  function fleet(){return load(FLEET_KEY)}
  function setCaseField(caseId, field, value){const list=cases(); const c=list.find(x=>x.id===caseId); if(!c)return; c[field]=value; saveCases(list); renderAllV2();}
  function setCaseNested(caseId, group, key, value){const list=cases(); const c=list.find(x=>x.id===caseId); if(!c)return; c[group]=c[group]||{}; c[group][key]=value; saveCases(list); renderAllV2();}
  function needsSoon(date){return date && date>=todayIso() && date<=addDaysIso(30)}
  function renderStaff(){
    const box=el('usaStaffList'); if(!box)return; const data=staff();
    box.innerHTML=data.length?data.map(s=>`<article class="usa-v2-card"><div class="usa-v2-top"><h3>${safe(s.name)}</h3><span>${safe(s.role)}</span></div><p><b>Shift:</b> ${safe(s.shift||'—')}</p><p><b>Current Assignment:</b> ${safe(s.assignment||'Available')}</p><p class="${needsSoon(s.cert)?'usa-v2-warn':''}"><b>Certification:</b> ${safe(s.cert||'not set')}</p><div class="usa-card-actions"><button data-v2-staff-del="${s.id}">Remove</button></div></article>`).join(''):`<div class="usa-panel">No staff yet. Add your funeral directors, drivers and removal technicians.</div>`;
  }
  function renderFleet(){
    const box=el('usaFleetList'); if(!box)return; const data=fleet();
    box.innerHTML=data.length?data.map(v=>`<article class="usa-v2-card"><div class="usa-v2-top"><h3>${safe(v.name)}</h3><span>${safe(v.type)}</span></div><p><b>Mileage:</b> ${Number(v.mileage||0).toLocaleString('en-US')}</p><p><b>Status:</b> ${safe(v.status||'Available')}</p><p class="${needsSoon(v.service)?'usa-v2-warn':''}"><b>Next Service:</b> ${safe(v.service||'not set')}</p><p class="${needsSoon(v.insurance)?'usa-v2-warn':''}"><b>Insurance:</b> ${safe(v.insurance||'not set')}</p><div class="usa-card-actions"><button data-v2-fleet-del="${v.id}">Remove</button></div></article>`).join(''):`<div class="usa-panel">No fleet yet. Add hearse, removal van, limo or utility vehicle.</div>`;
  }
  function renderCremation(){
    const box=el('usaCremationList'); if(!box)return; const list=cases().filter(c=>/cremat|crematory|urn/i.test([c.status,c.notes,c.serviceType,c.disposition].join(' ')) || (c.documents&&c.documents['Cremation Authorization']!=='Missing'));
    box.innerHTML=list.length?list.map(c=>`<article class="usa-case-card"><div class="usa-case-top"><div><h3>${safe(c.decedent)}</h3><small>${safe(c.caseNumber)} · ${safe(c.status)}</small></div><span class="usa-badge pending">Cremation</span></div><div class="usa-form-grid usa-inline-editor">${CREM_STEPS.map(step=>{const st=(c.cremation||{})[step]||'Missing';return `<label>${safe(step)}<select class="usa-v2-crem" data-case="${c.id}" data-step="${safe(step)}"><option ${st==='Missing'?'selected':''}>Missing</option><option ${st==='Pending'?'selected':''}>Pending</option><option ${st==='Complete'?'selected':''}>Complete</option></select></label>`}).join('')}<label>Crematory<input class="usa-v2-field" data-case="${c.id}" data-field="crematory" value="${safe(c.crematory||'')}" placeholder="Crematory name" /></label><label>Urn<input class="usa-v2-field" data-case="${c.id}" data-field="urn" value="${safe(c.urn||'')}" placeholder="Urn selection" /></label></div></article>`).join(''):`<div class="usa-panel">No cremation workflow yet. Mark a case as cremation from notes/status or complete Cremation Authorization.</div>`;
  }
  function renderFinance(){
    const list=cases(); const closed=list.filter(c=>c.status==='Closed');
    const revenue=closed.reduce((s,c)=>s+Number(c.total||c.caseValue||c.balancePaid||0),0);
    const outstanding=list.filter(c=>c.status!=='Closed').reduce((s,c)=>s+Number(c.balance||0),0);
    const avg=list.length?Math.round(list.reduce((s,c)=>s+Number(c.caseValue||c.total||c.balance||0),0)/list.length):0;
    const unpaid=list.filter(c=>Number(c.balance||0)>0 && c.status!=='Closed').length;
    if(el('usaRevenueClosed'))el('usaRevenueClosed').textContent=money(revenue);
    if(el('usaFinanceOutstanding'))el('usaFinanceOutstanding').textContent=money(outstanding);
    if(el('usaAvgCaseValue'))el('usaAvgCaseValue').textContent=money(avg);
    if(el('usaUnpaidCases'))el('usaUnpaidCases').textContent=unpaid;
    const box=el('usaFinanceList'); if(!box)return;
    box.innerHTML=list.length?list.map(c=>`<article class="usa-case-card"><div class="usa-case-top"><div><h3>${safe(c.decedent)}</h3><small>${safe(c.caseNumber)} · ${safe(c.status)}</small></div><span class="usa-badge ${Number(c.balance||0)>0?'pending':'closed'}">${Number(c.balance||0)>0?'Unpaid':'Clean'}</span></div><div class="usa-form-grid usa-inline-editor"><label>Case Value<input class="usa-v2-number" data-case="${c.id}" data-field="caseValue" type="number" value="${Number(c.caseValue||c.balance||0)}" /></label><label>Pending Balance<input class="usa-v2-number" data-case="${c.id}" data-field="balance" type="number" value="${Number(c.balance||0)}" /></label><label>Payment Status<select class="usa-v2-field" data-case="${c.id}" data-field="paymentStatus"><option ${c.paymentStatus==='Pending'?'selected':''}>Pending</option><option ${c.paymentStatus==='Partial'?'selected':''}>Partial</option><option ${c.paymentStatus==='Paid'?'selected':''}>Paid</option><option ${c.paymentStatus==='Insurance Assignment'?'selected':''}>Insurance Assignment</option></select></label></div></article>`).join(''):`<div class="usa-panel">No cases yet.</div>`;
  }
  function renderSchedule(){
    const box=el('usaScheduleList'); if(!box)return; const list=cases().filter(c=>c.status!=='Closed');
    box.innerHTML=list.length?list.map(c=>`<article class="usa-case-card"><div class="usa-case-top"><div><h3>${safe(c.decedent)}</h3><small>${safe(c.caseNumber)} · scheduling board</small></div><span class="usa-badge">Schedule</span></div><div class="usa-form-grid usa-inline-editor"><label>Viewing Date<input class="usa-v2-field" data-case="${c.id}" data-field="viewingDate" type="date" value="${safe(c.viewingDate||'')}" /></label><label>Viewing Room<input class="usa-v2-field" data-case="${c.id}" data-field="viewingRoom" value="${safe(c.viewingRoom||'')}" placeholder="Room A" /></label><label>Service Date<input class="usa-v2-field" data-case="${c.id}" data-field="serviceDate" type="date" value="${safe(c.serviceDate||'')}" /></label><label>Service Time<input class="usa-v2-field" data-case="${c.id}" data-field="serviceTime" type="time" value="${safe(c.serviceTime||'')}" /></label><label>Service Location<input class="usa-v2-field" data-case="${c.id}" data-field="serviceLocation" value="${safe(c.serviceLocation||c.facility||'')}" /></label><label>Assigned Staff<input class="usa-v2-field" data-case="${c.id}" data-field="assignedStaff" value="${safe(c.assignedStaff||c.driver||'')}" /></label><label>Vehicle<input class="usa-v2-field" data-case="${c.id}" data-field="vehicle" value="${safe(c.vehicle||'')}" /></label><label>Cemetery / Crematory<input class="usa-v2-field" data-case="${c.id}" data-field="finalLocation" value="${safe(c.finalLocation||c.crematory||'')}" /></label></div></article>`).join(''):`<div class="usa-panel">No active cases to schedule.</div>`;
  }
  function renderDirectorV2Extras(){
    const active=cases().filter(c=>c.status!=='Closed'); const st=staff(); const fl=fleet();
    const dueStaff=st.filter(s=>needsSoon(s.cert)).length; const dueFleet=fl.filter(v=>needsSoon(v.service)||needsSoon(v.insurance)||v.status==='Out of Service').length;
    const target=el('usaDirectorBrief'); if(target && !target.dataset.v2){ target.dataset.v2='1'; }
    if(target){
      const old=target.innerHTML.split('<hr class="usa-v2-hr">')[0];
      target.innerHTML = old + `<hr class="usa-v2-hr"><b>USA v2 Ops:</b> ${st.length} staff member(s), ${fl.length} vehicle(s), ${dueStaff} certification alert(s), ${dueFleet} fleet alert(s).<br><br><b>Manager focus:</b> match each upcoming service with staff + vehicle before documents become tomorrow's headache.`;
    }
    const att=el('usaAttentionList');
    if(att){
      const extras=[];
      st.filter(s=>needsSoon(s.cert)).forEach(s=>extras.push(`<div class="usa-alert warning"><strong>${safe(s.name)} certification expiring</strong><small>${safe(s.cert)} · ${safe(s.role)}</small></div>`));
      fl.filter(v=>needsSoon(v.service)||needsSoon(v.insurance)||v.status==='Out of Service').forEach(v=>extras.push(`<div class="usa-alert danger"><strong>${safe(v.name)} fleet attention</strong><small>Service ${safe(v.service||'—')} · Insurance ${safe(v.insurance||'—')} · ${safe(v.status||'')}</small></div>`));
      if(extras.length && !att.dataset.v2){ att.dataset.v2='1'; att.insertAdjacentHTML('beforeend', extras.join('')); }
    }
  }
  function renderAllV2(){renderStaff();renderFleet();renderCremation();renderFinance();renderSchedule();setTimeout(renderDirectorV2Extras,20)}
  function bind(){
    document.querySelectorAll('.tab-button[data-tab^="usa"]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(renderAllV2,50)));
    el('usaAddStaffDemo')?.addEventListener('click',()=>{const d=staff(); d.push({id:id(),name:'Michael Brown',role:'Funeral Director',shift:'Today 8:00–17:00',assignment:'Viewing Room A',cert:addDaysIso(25)}); save(STAFF_KEY,d); renderAllV2();});
    el('usaAddFleetDemo')?.addEventListener('click',()=>{const d=fleet(); d.push({id:id(),name:'Hearse 1',type:'Hearse',mileage:84500,service:addDaysIso(12),insurance:addDaysIso(90),status:'Available'}); save(FLEET_KEY,d); renderAllV2();});
    el('usaStaffForm')?.addEventListener('submit',(e)=>{e.preventDefault(); const d=staff(); d.push({id:id(),name:el('usaStaffName')?.value||'Unnamed',role:el('usaStaffRole')?.value,shift:el('usaStaffShift')?.value,cert:el('usaStaffCert')?.value,assignment:'Available'}); save(STAFF_KEY,d); e.target.reset(); renderAllV2();});
    el('usaFleetForm')?.addEventListener('submit',(e)=>{e.preventDefault(); const d=fleet(); d.push({id:id(),name:el('usaFleetName')?.value||'Vehicle',type:el('usaFleetType')?.value,mileage:el('usaFleetMileage')?.value,service:el('usaFleetService')?.value,insurance:el('usaFleetInsurance')?.value,status:el('usaFleetStatus')?.value}); save(FLEET_KEY,d); e.target.reset(); renderAllV2();});
    document.addEventListener('click',(e)=>{const s=e.target.closest('[data-v2-staff-del]'); if(s){save(STAFF_KEY,staff().filter(x=>x.id!==s.dataset.v2StaffDel)); renderAllV2();} const f=e.target.closest('[data-v2-fleet-del]'); if(f){save(FLEET_KEY,fleet().filter(x=>x.id!==f.dataset.v2FleetDel)); renderAllV2();}});
    document.addEventListener('change',(e)=>{const cr=e.target.closest('.usa-v2-crem'); if(cr){setCaseNested(cr.dataset.case,'cremation',cr.dataset.step,cr.value)} const fld=e.target.closest('.usa-v2-field,.usa-v2-number'); if(fld){setCaseField(fld.dataset.case,fld.dataset.field,fld.value)}});
    document.addEventListener('blur',(e)=>{const fld=e.target.closest?.('.usa-v2-field,.usa-v2-number'); if(fld){setCaseField(fld.dataset.case,fld.dataset.field,fld.value)}},true);
  }
  document.addEventListener('DOMContentLoaded',()=>{bind();renderAllV2();});
})();

// ================================
// FuneralOS USA v3 - AI Operations Director
// Built as local-first intelligence layer on top of USA v2 data.
// ================================
(function(){
  const CASES_KEY = "funeralos_usa_cases_v1";
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
  const cases = ()=>load(CASES_KEY);
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
    score=Math.max(0,Math.min(100,Math.round(score)));
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
    const completeDocs=active.reduce((sum,c)=>sum+DOCS.filter(d=>((c.documents||{})[d]||"Missing")==="Complete").length,0);
    const documents=Math.round((completeDocs/totalDocs)*100);
    const scheduled=active.length?Math.round((active.filter(c=>c.serviceDate||c.viewingDate).length/active.length)*100):100;
    const paidBase=active.length||1;
    const payments=Math.round((active.filter(c=>Number(c.balance||0)<=0).length/paidBase)*100);
    const fleetScore=fl.length?Math.max(0,100-(fl.filter(v=>v.status==="Out of Service"||needsSoon(v.service,15)||needsSoon(v.insurance,15)).length*18)):85;
    const staffScore=st.length?Math.max(0,100-(st.filter(s=>needsSoon(s.cert,15)).length*15)):80;
    const score=Math.round(documents*.28 + scheduled*.22 + payments*.22 + fleetScore*.14 + staffScore*.14);
    return {score,documents,scheduled,payments,fleet:fleetScore,staff:staffScore};
  }
  function topAction(alerts, active){
    if(alerts.some(a=>a.level==="urgent" && /missing|documents|Service approaching/i.test(a.title+a.meta))) return "Fix docs";
    if(alerts.some(a=>/balance/i.test(a.title))) return "Collect AR";
    if(alerts.some(a=>/Vehicle|Fleet/i.test(a.title))) return "Check fleet";
    if(active.some(c=>!c.assignedStaff&&!c.driver)) return "Assign staff";
    return active.length ? "Review schedule" : "Create case";
  }
  function briefingHtml(kind){
    const cs=cases(); const active=cs.filter(isActive); const closedToday=cs.filter(c=>c.status==="Closed" && (c.closedAt||"").slice(0,10)===todayIso()).length;
    const upcoming=active.filter(isUpcoming); const alerts=smartAlerts(); const ops=operationsScore();
    const missing=active.reduce((s,c)=>s+missingDocs(c).length,0); const outstanding=active.reduce((s,c)=>s+Number(c.balance||0),0);
    if(kind==="evening"){
      return `<h4>End-of-Day Recap</h4><p><b>Operations Score:</b> ${ops.score}/100 · <b>Closed Today:</b> ${closedToday} · <b>Open Cases:</b> ${active.length}</p><ul><li>${missing} document item(s) still not complete.</li><li>${money(outstanding)} outstanding balance across active cases.</li><li>${upcoming.length} service/viewing item(s) in the next 7 days.</li><li>${alerts.filter(a=>a.level==="urgent").length} urgent alert(s) should be handled before tomorrow.</li></ul><div class="usa-v3-pill-row"><span class="usa-v3-pill">Tomorrow focus: ${topAction(alerts,active)}</span><span class="usa-v3-pill">Payments: ${ops.payments}/100</span><span class="usa-v3-pill">Docs: ${ops.documents}/100</span></div>`;
    }
    return `<h4>Good Morning, Director</h4><p><b>${active.length}</b> active case(s). <b>${alerts.length}</b> smart alert(s). <b>${upcoming.length}</b> upcoming service/viewing item(s).</p><ul><li>${missing} document item(s) need completion.</li><li>${money(outstanding)} in pending balances.</li><li>${active.filter(c=>caseHealth(c).level==="Risk").length} case(s) are at risk.</li><li>Recommended first move: <b>${topAction(alerts,active)}</b>.</li></ul><div class="usa-v3-pill-row"><span class="usa-v3-pill">Operations ${ops.score}/100</span><span class="usa-v3-pill">Staff ${ops.staff}/100</span><span class="usa-v3-pill">Fleet ${ops.fleet}/100</span></div>`;
  }
  function renderV3(){
    const cs=cases(); const active=cs.filter(isActive); const alerts=smartAlerts(); const ops=operationsScore();
    if(el("usaV3OpsScore")) el("usaV3OpsScore").textContent=ops.score;
    if(el("usaV3OpsLabel")) el("usaV3OpsLabel").textContent=ops.score>=90?"Healthy":ops.score>=75?"Needs attention":"Director action required";
    if(el("usaV3OpsBar")) el("usaV3OpsBar").style.width=ops.score+"%";
    if(el("usaV3RiskCases")) el("usaV3RiskCases").textContent=active.filter(c=>caseHealth(c).level==="Risk").length;
    if(el("usaV3AlertCount")) el("usaV3AlertCount").textContent=alerts.length;
    if(el("usaV3TopAction")) el("usaV3TopAction").textContent=topAction(alerts,active);
    if(el("usaV3MorningBrief")) el("usaV3MorningBrief").innerHTML=briefingHtml("morning");
    if(el("usaV3EveningRecap")) el("usaV3EveningRecap").innerHTML=briefingHtml("evening");
    const healthBox=el("usaV3CaseHealth");
    if(healthBox){
      const sorted=active.map(c=>({c,h:caseHealth(c)})).sort((a,b)=>a.h.score-b.h.score).slice(0,8);
      healthBox.innerHTML=sorted.length?sorted.map(({c,h})=>`<article class="usa-v3-health-card"><div class="usa-v3-health-top"><div><h4>${safe(c.decedent||"Unnamed case")}</h4><small>${safe(c.caseNumber||"")} · ${safe(c.status||"")}</small></div><span class="usa-v3-health-score ${h.score<70?'risk':h.score<90?'warn':''}">${h.score}%</span></div><small>${h.issues.length?safe(h.issues.join(" · ")):"No operational gaps detected."}</small></article>`).join(""):`<div class="usa-panel">No active cases yet. Add a demo case or create one from First Call.</div>`;
    }
    const alertBox=el("usaV3SmartAlerts");
    if(alertBox){
      alertBox.innerHTML=alerts.length?alerts.slice(0,12).map(a=>`<div class="usa-alert usa-v3-alert-${a.level}"><strong>${safe(a.title)}</strong><small>${safe(a.meta)}</small></div>`).join(""):`<div class="usa-alert usa-v3-alert-ok"><strong>No important alerts.</strong><small>Everything is clean enough to make coffee taste better.</small></div>`;
    }
  }
  function copyText(text){
    if(navigator.clipboard) navigator.clipboard.writeText(text).catch(()=>{});
  }
  function bindV3(){
    document.querySelectorAll('.tab-button[data-tab^="usa"]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(renderV3,120)));
    document.addEventListener('click',(e)=>{ if(e.target.closest('#usaSeedBtn')) setTimeout(renderV3,150); });
    document.addEventListener('change',()=>setTimeout(renderV3,120));
    document.addEventListener('blur',()=>setTimeout(renderV3,120),true);
    el('usaV3MorningBtn')?.addEventListener('click',()=>{renderV3(); copyText((el('usaV3MorningBrief')?.innerText||''));});
    el('usaV3EveningBtn')?.addEventListener('click',()=>{renderV3(); copyText((el('usaV3EveningRecap')?.innerText||''));});
  }
  document.addEventListener('DOMContentLoaded',()=>{bindV3(); setTimeout(renderV3,250);});
})();
