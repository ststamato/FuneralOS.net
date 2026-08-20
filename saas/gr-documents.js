// FuneralOS — GR edition case document checklist (Έγγραφα υποθέσεων)
// Reuses the same case_documents table / case-documents Storage bucket the
// USA edition already uses (saas/usa.js) — the schema and RLS are
// edition-agnostic (keyed on office_id/case_id/doc_type), so no backend
// change was needed. Only the document checklist differs, reflecting Greek
// funeral-law requirements rather than the US ones in usa.js.
(function () {
  "use strict";

  const DOCS_BASE = [
    "Ταυτότητα θανόντος/-ούσας",
    "Ιατρικό πιστοποιητικό θανάτου",
    "Ληξιαρχική πράξη θανάτου",
    "Άδεια ταφής",
    "Εξουσιοδότηση συγγενών",
    "Αναγγελία θανάτου (νοσοκομείο)",
  ];
  // Cremation in Greece has grown sharply in recent years and needs its own
  // permit + a sworn declaration on top of the base checklist above.
  const DOCS_CREMATION = [
    "Άδεια αποτέφρωσης",
    "Ειδική υπεύθυνη δήλωση αποτέφρωσης",
  ];
  // Not every case needs a prosecutor's autopsy/necropsy order — only sudden
  // or unnatural deaths — but there's no field to detect that automatically,
  // so it's listed for every case and left "Λείπει" when not applicable.
  const DOCS_AUTOPSY = [
    "Παραγγελία νεκροψίας-νεκροτομής (Αστυνομικό Τμήμα)",
  ];

  function docsFor(c) {
    const list = DOCS_BASE.slice();
    if (c.burialType === "Αποτεφρωση") list.push(...DOCS_CREMATION);
    list.push(...DOCS_AUTOPSY);
    return list;
  }

  const safe = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const el = (id) => document.getElementById(id);
  const STATUS_LABEL = { Missing: "Λείπει", Pending: "Εκκρεμεί", Complete: "Ολοκληρώθηκε" };

  let caseDocsCache = {};
  let caseDocsLoaded = false;
  let caseDocsLoading = false;

  function allCeremonies() {
    const list = Array.isArray(window.ceremonies) ? window.ceremonies : (typeof ceremonies !== "undefined" ? ceremonies : []);
    return list.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }

  // Loaded lazily (not on every page load) — the documents tab is opt-in,
  // most sessions never open it, so this avoids an extra query per login.
  async function loadCaseDocuments() {
    if (caseDocsLoading || !window.__sb || typeof getCloudSession !== "function") return;
    caseDocsLoading = true;
    try {
      const session = await getCloudSession();
      if (!session) return;
      const { data, error } = await window.__sb
        .from("case_documents")
        .select("case_id,doc_type,storage_path,filename,uploaded_at")
        .eq("office_id", session.rowId);
      if (error) { console.warn("Could not load case documents", error); return; }
      const next = {};
      (data || []).forEach((row) => {
        if (!next[row.case_id]) next[row.case_id] = {};
        next[row.case_id][row.doc_type] = { storage_path: row.storage_path, filename: row.filename, uploaded_at: row.uploaded_at };
      });
      caseDocsCache = next;
      caseDocsLoaded = true;
      renderDocuments();
    } finally {
      caseDocsLoading = false;
    }
  }

  async function uploadCaseDocument(caseId, docType, file) {
    if (!window.__sb || typeof getCloudSession !== "function") { alert("Δεν υπάρχει σύνδεση. Δοκίμασε ξανά."); return; }
    const session = await getCloudSession();
    if (!session) { alert("Συνδέσου ξανά."); return; }

    const safeDoc = String(docType).replace(/[^\p{L}\p{N}]+/gu, "_");
    const path = `${session.rowId}/${caseId}/${Date.now()}_${safeDoc}_${file.name}`;

    const { error: upErr } = await window.__sb.storage.from("case-documents").upload(path, file, { upsert: false });
    if (upErr) { alert("Η μεταφόρτωση απέτυχε: " + upErr.message); return; }

    const oldPath = (caseDocsCache[caseId] || {})[docType]?.storage_path || null;

    const { error: dbErr } = await window.__sb.from("case_documents").upsert({
      office_id: session.rowId, case_id: caseId, doc_type: docType,
      storage_path: path, filename: file.name, uploaded_by: session.userId,
      uploaded_at: new Date().toISOString(),
    }, { onConflict: "office_id,case_id,doc_type" });
    if (dbErr) { alert("Το αρχείο ανέβηκε αλλά δεν καταγράφηκε: " + dbErr.message); return; }

    if (oldPath && oldPath !== path) await window.__sb.storage.from("case-documents").remove([oldPath]);

    if (!caseDocsCache[caseId]) caseDocsCache[caseId] = {};
    caseDocsCache[caseId][docType] = { storage_path: path, filename: file.name, uploaded_at: new Date().toISOString() };

    setDocStatus(caseId, docType, "Complete");
  }

  async function viewCaseDocument(caseId, docType) {
    const info = (caseDocsCache[caseId] || {})[docType];
    if (!info || !window.__sb) return;
    const { data, error } = await window.__sb.storage.from("case-documents").createSignedUrl(info.storage_path, 60);
    if (error || !data?.signedUrl) { alert("Δεν ήταν δυνατό το άνοιγμα του εγγράφου."); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function removeCaseDocument(caseId, docType) {
    const info = (caseDocsCache[caseId] || {})[docType];
    if (!info) return;
    if (!confirm("Αφαίρεση αυτού του εγγράφου;")) return;
    if (window.__sb) {
      await window.__sb.storage.from("case-documents").remove([info.storage_path]);
      const session = typeof getCloudSession === "function" ? await getCloudSession() : null;
      if (session) {
        await window.__sb.from("case_documents").delete()
          .eq("office_id", session.rowId).eq("case_id", caseId).eq("doc_type", docType);
      }
    }
    if (caseDocsCache[caseId]) delete caseDocsCache[caseId][docType];
    renderDocuments();
  }

  function setDocStatus(caseId, docType, status) {
    const c = allCeremonies().find((x) => x.id === caseId);
    if (!c) return;
    c.documents = Object.assign({}, c.documents || {}, { [docType]: status });
    if (typeof window.saveData === "function") window.saveData();
    renderDocuments();
  }

  function renderDocuments() {
    const list = el("grDocumentsList");
    if (!list) return;
    if (!caseDocsLoaded && !caseDocsLoading) loadCaseDocuments();
    const all = allCeremonies();
    list.innerHTML = all.length ? all.map((c) => {
      const docs = docsFor(c);
      return `<article class="usa-doc-card"><h3>${safe(c.name || "Χωρίς όνομα")}</h3><small>${safe(c.date || "χωρίς ημερομηνία")} · ${safe(c.burialType || "")}</small>${docs.map((d) => {
        const st = (c.documents || {})[d] || "Missing";
        const file = (caseDocsCache[c.id] || {})[d];
        const fileControls = file
          ? `<button type="button" class="usa-doc-view" data-id="${c.id}" data-doc="${safe(d)}" title="${safe(file.filename)}">📎 ${safe(file.filename.length > 18 ? file.filename.slice(0, 15) + "…" : file.filename)}</button><button type="button" class="usa-doc-remove" data-id="${c.id}" data-doc="${safe(d)}" title="Αφαίρεση αρχείου">✕</button>`
          : `<label class="usa-doc-upload">Επισύναψη<input type="file" class="usa-doc-file" data-id="${c.id}" data-doc="${safe(d)}" hidden></label>`;
        return `<div class="usa-doc-row"><b>${safe(d)}</b><div class="usa-doc-controls"><select class="usa-doc-status ${st.toLowerCase()}" data-id="${c.id}" data-doc="${safe(d)}"><option value="Missing" ${st === "Missing" ? "selected" : ""}>${STATUS_LABEL.Missing}</option><option value="Pending" ${st === "Pending" ? "selected" : ""}>${STATUS_LABEL.Pending}</option><option value="Complete" ${st === "Complete" ? "selected" : ""}>${STATUS_LABEL.Complete}</option></select>${fileControls}</div></div>`;
      }).join("")}</article>`;
    }).join("") : `<div class="usa-panel">Δεν υπάρχουν τελετές ακόμα.</div>`;
  }

  document.addEventListener("change", (e) => {
    const sel = e.target.closest(".usa-doc-status");
    if (sel && el("grDocumentsList")?.contains(sel)) setDocStatus(sel.dataset.id, sel.dataset.doc, sel.value);
    const file = e.target.closest(".usa-doc-file");
    if (file && el("grDocumentsList")?.contains(file) && file.files && file.files[0]) uploadCaseDocument(file.dataset.id, file.dataset.doc, file.files[0]);
  });

  document.addEventListener("click", (e) => {
    const view = e.target.closest(".usa-doc-view");
    if (view && el("grDocumentsList")?.contains(view)) viewCaseDocument(view.dataset.id, view.dataset.doc);
    const rem = e.target.closest(".usa-doc-remove");
    if (rem && el("grDocumentsList")?.contains(rem)) removeCaseDocument(rem.dataset.id, rem.dataset.doc);
  });

  window.__grRenderDocuments = renderDocuments;
})();
