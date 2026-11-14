/* ============================================================================
   BTC Marine Conservation Hub — Data layer (v4)
   Local-first (localStorage). All reads/writes go through here so a shared
   Supabase backend can replace it without touching the UI.
   ========================================================================== */

const Store = (() => {
  const KEY = "btc_hub_v1";
  let state = null;
  const subs = [];
  const uid = (p = "id") => p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function seed() {
    const S = window.SEED;
    const modules = S.modules.map(m => ({
      id: m[0], code: m[0], name: m[1], agency: m[2], elearn: m[3],
      medium: m[4], dives: m[5], tmpl: m[6], price: m[7] || 0, noSingle: !!m[8], kind: "taught"
    }));
    const diveComponents = S.diveComponents.map(d => ({
      code: d[0], name: d[1], medium: d[2], dives: d[3]
    }));

    // Build the unified courses list
    const courses = [];
    S.programs.forEach(p => courses.push({
      id: p.code, code: p.code, name: p.name, kind: "program",
      stacksOn: p.stacksOn || null, moduleCodes: [...p.modules],
      diveComps: [...(p.diveComps || [])], extras: p.extras ? [...p.extras] : null,
      weeks: p.weeks, price: p.price, prereq: p.prereq || prereqFromStack(p.stacksOn)
    }));
    (S.packs || []).forEach(p => courses.push({
      id: p.code, code: p.code, name: p.name, kind: "pack",
      packOf: [...p.packOf], weeks: p.weeks, price: p.price, prereq: p.prereq || ""
    }));
    (S.dayCourses || []).forEach(d => courses.push({
      id: d.code, code: d.code, name: d.name, kind: "day",
      moduleCodes: [d.moduleCode], price: d.price, prereq: "" }));
    (S.addons || []).forEach(a => courses.push({
      id: a.code, code: a.code, name: a.name, kind: "addon",
      moduleCodes: [], diveComps: [], flexible: true, weeks: a.weeks, price: a.price, prereq: "" }));
    // one single-course offering per taught module (unless not sold separately)
    modules.forEach(m => {
      if (m.noSingle) return;
      courses.push({ id: "C_" + m.code, code: "C_" + m.code, name: m.name, kind: "single",
        moduleCodes: [m.code], price: m.price || 0, prereq: "" });
    });
    // bundles (a course that packages several modules at a set price)
    (S.bundles || []).forEach(b => courses.push({
      id: b.code, code: b.code, name: b.name, kind: "single", bundle: true,
      moduleCodes: [...b.moduleCodes], price: b.price || 0, prereq: b.prereq || "" }));
    (S.surveys || []).forEach(s => courses.push({
      id: s.code, code: s.code, name: s.name, kind: "survey", staffOnly: true,
      medium: s.medium, uploader: s.uploader, price: s.price, prereq: "Any level" }));

    function prereqFromStack(on) {
      if (!on) return "";
      const names = []; let c = on;
      while (c) { const pr = S.programs.find(x => x.code === c); if (!pr) break; names.unshift(pr.name); c = pr.stacksOn; }
      return names.length ? "Previous level: " + names[names.length - 1] : "";
    }

    const staff = S.staff.map(n => ({ id: uid("staff"), name: n, off: [], canTeach: [] }));

    return {
      meta: { version: S.version, created: new Date().toISOString() },
      settings: {
        password: "BTC2026!",
        uploaders: { ...S.uploaders },
        uploaderNames: { ...S.uploaderNames },
        diveLevels: [...S.diveLevels],
        templates: JSON.parse(JSON.stringify(S.templates))
      },
      modules, diveComponents, courses, staff,
      students: [], sessions: []
    };
  }

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { state = JSON.parse(raw); migrate(); return; } }
    catch (e) { console.warn(e); }
    state = seed(); save();
  }
  // Stores at/above this version KEEP their in-app catalogue edits across updates.
  // Only a store older than the baseline is reseeded (one-time catch-up), and
  // only a deliberate bump of this number ever force-refreshes the catalogue.
  const CATALOGUE_BASELINE = 7;
  function migrate() {
    const stored = (state.meta && state.meta.version) || 0;
    if (stored < CATALOGUE_BASELINE) {
      // one-time catch-up: adopt the current catalogue, keep students/sessions/password
      const fresh = seed();
      fresh.students = state.students || [];
      fresh.sessions = state.sessions || [];
      if (state.settings && state.settings.password) fresh.settings.password = state.settings.password;
      state = fresh; persist();
      return;
    }
    // at/above baseline: preserve the catalogue and every edit; patch structure only
    const def = seed();
    if (!state.meta) state.meta = {};
    state.meta.version = window.SEED.version;
    state.settings = state.settings || def.settings;
    state.diveComponents = state.diveComponents || def.diveComponents;
    state.staff = state.staff || [];
    state.staff.forEach(s => { if (!s.canTeach) s.canTeach = []; });
    state.students = state.students || [];
    state.sessions = state.sessions || [];
    persist();
  }
  // --- undo (in-memory history of pre-change snapshots) ---
  let undoStack = [];
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn(e); }
    subs.forEach(fn => { try { fn(); } catch (e) {} });
  }
  function save() {
    try { const prev = localStorage.getItem(KEY); if (prev) { undoStack.push(prev); if (undoStack.length > 50) undoStack.shift(); } }
    catch (e) {}
    persist(); pushRemote();
  }
  function undo() {
    if (!undoStack.length) return false;
    try { state = JSON.parse(undoStack.pop()); } catch (e) { return false; }
    persist(); pushRemote();
    return true;
  }
  const canUndo = () => undoStack.length > 0;
  const subscribe = fn => subs.push(fn);

  // ---- Supabase shared sync (single jsonb row, last-write-wins + realtime) ----
  const ROW_ID = "main";
  let supa = null, applyingRemote = false, pushTimer = null, lastSyncJSON = null;
  let syncStatus = window.SUPABASE_CONFIG ? "connecting" : "off";
  const uiSubs = [];
  const onUI = fn => uiSubs.push(fn);
  const notifyUI = () => uiSubs.forEach(fn => { try { fn(); } catch (e) {} });
  const syncInfo = () => ({ enabled: !!window.SUPABASE_CONFIG, status: syncStatus });
  function adoptRemote(remote) {
    applyingRemote = true;
    state = remote;
    migrate();                      // reseed catalogue if older; persists locally
    applyingRemote = false;
    lastSyncJSON = JSON.stringify(state);
    notifyUI();
  }
  function pushRemote() {
    if (!supa || applyingRemote) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      const js = JSON.stringify(state); lastSyncJSON = js;
      supa.from("hub_state").upsert({ id: ROW_ID, data: state, updated_at: new Date().toISOString() })
        .then(({ error }) => { syncStatus = error ? "error" : "synced"; if (error) console.warn("sync push", error); });
    }, 700);
  }
  function initSupabase() {
    const cfg = window.SUPABASE_CONFIG;
    if (!cfg || !cfg.url || !cfg.key || !window.supabase) { syncStatus = "off"; return; }
    try { supa = window.supabase.createClient(cfg.url, cfg.key); }
    catch (e) { console.warn("supabase init", e); syncStatus = "error"; notifyUI(); return; }
    supa.from("hub_state").select("data").eq("id", ROW_ID).maybeSingle().then(({ data, error }) => {
      if (error) { console.warn("sync load", error); syncStatus = "error"; notifyUI(); }
      else if (data && data.data) {
        // first-connect reconciliation: the copy with more content wins (avoids
        // an emptier device overwriting a fuller one). Realtime is last-write-wins after.
        const weight = s => ((s.students || []).length + (s.sessions || []).length);
        if (weight(data.data) >= weight(state)) adoptRemote(data.data);
        else { lastSyncJSON = null; pushRemote(); }   // local has more → seed remote from local
        syncStatus = "synced"; notifyUI();
      }
      else { lastSyncJSON = null; syncStatus = "synced"; pushRemote(); notifyUI(); }  // no remote yet → seed from local
      supa.channel("hub").on("postgres_changes",
        { event: "*", schema: "public", table: "hub_state", filter: "id=eq." + ROW_ID },
        payload => {
          const d = payload.new && payload.new.data; if (!d) return;
          if (JSON.stringify(d) === lastSyncJSON) return;   // ignore our own echo
          adoptRemote(d);
        }).subscribe();
    });
  }

  // ---- getters ----
  const get = () => state;
  const modules = () => state.modules;
  const diveComponents = () => state.diveComponents;
  const courses = () => state.courses;
  const staff = () => state.staff;
  const students = (all = false) => all ? state.students : state.students.filter(s => !s.archived);
  const sessions = () => state.sessions;
  const settings = () => state.settings;
  const template = key => (state.settings.templates || {})[key];

  const moduleByCode = c => state.modules.find(m => m.code === c);
  const diveCompByCode = c => state.diveComponents.find(d => d.code === c);
  const courseByCode = c => state.courses.find(x => x.code === c);
  const staffById = id => state.staff.find(s => s.id === id);
  const studentById = id => state.students.find(s => s.id === id);

  // programme chain (self + everything it stacks on)
  function programChain(code) {
    const out = []; let c = code;
    while (c) { const p = courseByCode(c); if (!p) break; out.push(p); c = p.stacksOn; }
    return out;
  }

  // taught module codes a course requires
  function courseModuleCodes(course) {
    if (!course) return [];
    if (course.kind === "pack") {
      const set = new Set();
      course.packOf.forEach(pc => courseModuleCodes(courseByCode(pc)).forEach(m => set.add(m)));
      return [...set];
    }
    if (course.kind === "program") {
      const set = new Set();
      // base-first (chronological): CC → CS → RS → MC → SD
      programChain(course.code).reverse().forEach(p => (p.moduleCodes || []).forEach(m => set.add(m)));
      return [...set];
    }
    return course.moduleCodes || [];
  }

  // dive-component requirements a course adds (summed across chain; may repeat)
  function courseDiveComps(course) {
    if (!course) return [];
    if (course.kind === "pack") {
      let out = []; course.packOf.forEach(pc => out = out.concat(courseDiveComps(courseByCode(pc)))); return out;
    }
    if (course.kind === "program") {
      let out = []; programChain(course.code).forEach(p => out = out.concat(p.diveComps || [])); return out;
    }
    return course.diveComps || [];
  }
  // Ordered curriculum items (taught modules + dive components) in sequence:
  // base-first, and within each level modules then that level's dive components.
  function courseItemsOrdered(course) {
    const out = [];
    const pushLevel = p => {
      (p.moduleCodes || []).forEach(mc => { const m = moduleByCode(mc); out.push({ kind: "module", code: mc, name: m ? m.name : mc }); });
      (p.diveComps || []).forEach(dc => { const d = diveCompByCode(dc); out.push({ kind: "dive", code: dc, name: d ? d.name : dc }); });
    };
    if (!course) return out;
    if (course.kind === "program") programChain(course.code).reverse().forEach(pushLevel);
    else if (course.kind === "pack") course.packOf.forEach(pc => courseItemsOrdered(courseByCode(pc)).forEach(it => out.push(it)));
    else (course.moduleCodes || []).forEach(mc => { const m = moduleByCode(mc); out.push({ kind: "module", code: mc, name: m ? m.name : mc }); });
    return out;
  }
  function courseExtras(course) {
    if (course && course.kind === "program") {
      let out = []; programChain(course.code).forEach(p => { if (p.extras) out = out.concat(p.extras); }); return out;
    }
    return [];
  }

  function studentModuleCodes(stu) {
    const set = new Set();
    (stu.courses || []).forEach(cc => courseModuleCodes(courseByCode(cc)).forEach(m => set.add(m)));
    return [...set];
  }
  // aggregated dive requirements: [{code,name,count}]
  function studentDiveReqs(stu) {
    const counts = {};
    (stu.courses || []).forEach(cc => courseDiveComps(courseByCode(cc)).forEach(k => counts[k] = (counts[k] || 0) + 1));
    return Object.entries(counts).map(([code, count]) => {
      const d = diveCompByCode(code); return { code, name: d ? d.name : code, count };
    });
  }
  function studentExtras(stu) {
    const set = new Set();
    (stu.courses || []).forEach(cc => courseExtras(courseByCode(cc)).forEach(e => set.add(e)));
    return [...set];
  }

  function studentModuleSessions(studentId, moduleCode) {
    return state.sessions.filter(s => s.moduleCode === moduleCode && (s.studentIds || []).includes(studentId));
  }
  function studentCompSessions(studentId, compCode) {
    return state.sessions.filter(s => s.adhocType === compCode && (s.studentIds || []).includes(studentId));
  }

  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const isPastOrToday = d => d && d <= todayISO();

  function elearnDone(stu, mod) {
    if (!mod.elearn) return null;
    return !!(stu.elearning && stu.elearning[mod.elearn]);
  }

  function moduleStatus(stu, moduleCode) {
    const mod = moduleByCode(moduleCode); if (!mod) return null;
    const sess = studentModuleSessions(stu.id, moduleCode);
    const lectures = sess.filter(s => s.section === "lecture");
    const dives = sess.filter(s => s.section === "dive");
    const classroom = lectures.length > 0 && lectures.every(s => isPastOrToday(s.date));
    const needDives = mod.dives || 0;
    const divesDone = needDives === 0 ? true : (dives.length >= needDives && dives.every(s => isPastOrToday(s.date)));
    const elearning = elearnDone(stu, mod);
    const cert = !!(stu.certs && stu.certs[moduleCode] && stu.certs[moduleCode].issued);
    const stages = [];
    if (mod.elearn) stages.push(elearning);
    stages.push(classroom);
    if (needDives > 0) stages.push(divesDone);
    const done = stages.filter(Boolean).length;
    return {
      elearning, classroom, dives: divesDone, cert,
      needDives, divesScheduled: dives.length, lectureScheduled: lectures.length > 0,
      ready: done === stages.length, pct: Math.round((done / stages.length) * 100),
      scheduledAny: sess.length > 0
    };
  }
  function diveReqStatus(stu, compCode, needCount) {
    const sess = studentCompSessions(stu.id, compCode);
    // Count boat trips (a 2-dive outing shares one groupId), not individual dives.
    const boats = ss => [...new Set(ss.map(s => s.groupId || s.id))].length;
    const scheduled = boats(sess);
    const done = boats(sess.filter(s => isPastOrToday(s.date)));
    return { scheduled, done, need: needCount, complete: done >= needCount };
  }

  function courseProgress(stu) {
    const codes = studentModuleCodes(stu);
    const total = codes.length;
    const certified = codes.filter(c => stu.certs && stu.certs[c] && stu.certs[c].issued).length;
    return { total, certified, pct: total ? Math.round((certified / total) * 100) : 0 };
  }

  function staffOff(staffId, dISO) {
    const st = staffById(staffId); if (!st) return false;
    return (st.off || []).some(p => dISO >= p.start && dISO <= p.end);
  }
  // warn only if a canTeach list is set and this module isn't in it
  function staffCanTeach(staffName, moduleCode) {
    const st = state.staff.find(s => s.name === staffName); if (!st) return true;
    if (!st.canTeach || !st.canTeach.length) return true;
    return st.canTeach.includes(moduleCode);
  }

  // ---- mutations ----
  function upsertStudent(s) {
    if (s.id) { const i = state.students.findIndex(x => x.id === s.id); if (i >= 0) state.students[i] = s; else state.students.push(s); }
    else { s.id = uid("stu"); s.certs = s.certs || {}; s.elearning = s.elearning || {}; state.students.push(s); }
    save(); return s;
  }
  function deleteStudent(id) {
    state.students = state.students.filter(s => s.id !== id);
    state.sessions.forEach(s => s.studentIds = (s.studentIds || []).filter(x => x !== id));
    save();
  }
  function addSession(s) { s.id = s.id || uid("ses"); state.sessions.push(s); save(); return s; }
  function updateSession(id, patch) { const s = state.sessions.find(x => x.id === id); if (s) { Object.assign(s, patch); save(); } return s; }
  function deleteSession(id) { state.sessions = state.sessions.filter(s => s.id !== id); save(); }

  function setCert(studentId, moduleCode, issued, date, staffName) {
    const stu = studentById(studentId); if (!stu) return; stu.certs = stu.certs || {};
    if (issued) stu.certs[moduleCode] = { issued: true, date: date || todayISO(), staff: staffName || "" };
    else delete stu.certs[moduleCode];
    save();
  }
  function setElearning(studentId, elearnKey, done) {
    const stu = studentById(studentId); if (!stu) return; stu.elearning = stu.elearning || {};
    if (done) stu.elearning[elearnKey] = true; else delete stu.elearning[elearnKey];
    save();
  }
  function addStaffOff(id, start, end) { const st = staffById(id); if (!st) return; st.off = st.off || []; st.off.push({ id: uid("off"), start, end }); save(); }
  function removeStaffOff(id, offId) { const st = staffById(id); if (!st) return; st.off = (st.off || []).filter(o => o.id !== offId); save(); }
  function addStaff(name) { state.staff.push({ id: uid("staff"), name, off: [], canTeach: [] }); save(); }
  function setStaffCanTeach(id, codes) { const st = staffById(id); if (!st) return; st.canTeach = codes; save(); }

  function saveCourse(c) { const i = state.courses.findIndex(x => x.code === c.code); if (i >= 0) state.courses[i] = c; else state.courses.push(c); save(); }
  function saveModule(m) { const i = state.modules.findIndex(x => x.code === m.code); if (i >= 0) state.modules[i] = m; else state.modules.push(m); save(); }
  function setPassword(p) { state.settings.password = p; save(); }

  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(str) { state = JSON.parse(str); save(); }

  load();
  initSupabase();

  return {
    uid, get, save, subscribe, undo, canUndo, onUI, syncInfo,
    modules, diveComponents, courses, staff, students, sessions, settings, template,
    moduleByCode, diveCompByCode, courseByCode, staffById, studentById,
    programChain, courseModuleCodes, courseDiveComps, courseItemsOrdered, courseExtras,
    studentModuleCodes, studentDiveReqs, studentExtras,
    studentModuleSessions, studentCompSessions,
    moduleStatus, diveReqStatus, courseProgress, staffOff, staffCanTeach,
    todayISO, isPastOrToday,
    upsertStudent, deleteStudent, addSession, updateSession, deleteSession,
    setCert, setElearning, addStaffOff, removeStaffOff, addStaff, setStaffCanTeach,
    saveCourse, saveModule, setPassword, exportJSON, importJSON
  };
})();
if (typeof window !== "undefined") window.Store = Store;
