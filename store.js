/* ============================================================================
   BTC Marine Conservation Hub — Data layer
   ----------------------------------------------------------------------------
   v1 stores everything locally in the browser (localStorage), so the app works
   immediately and offline. All reads/writes go through this module, so that
   swapping in a shared Supabase backend later only touches this one file.

   Shape of state:
     meta      {version}
     settings  {password, uploaders{}, diveLevels[], adhocTypes[]}
     modules   [{id, code, name, agency, elearning, dives, medium}]
     courses   [{id=code, name, kind, ... , moduleCodes[], packOf[], staffOnly, prereq}]
     staff     [{id, name, off:[{start,end}]}]
     students  [{id, name, email, courses[], ... , certs{code:{issued,date,staff}},
                 elearning{code:true}, compliance{medical,waiver,cdPaperwork},
                 startLevel{cert,loggedDives,priorModules[]}, archived, note}]
     sessions  [{id, date, start, end, kind, medium, courseCode, moduleCode,
                 section, diveIndex, staff, assist, shadow, surveyLead,
                 studentIds[], diveSite, note, adhocType}]
   ========================================================================== */

const Store = (() => {
  const KEY = "btc_hub_v1";
  let state = null;
  const subs = [];

  const uid = (p = "id") =>
    p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function seed() {
    const S = window.SEED;
    const modules = S.modules.map(m => ({
      id: m[0], code: m[0], name: m[1], agency: m[2],
      elearning: m[3], dives: m[4], medium: m[5]
    }));
    const courses = S.courses.map(c => ({
      id: c.code, ...c, moduleCodes: c.moduleCodes ? [...c.moduleCodes] : [],
      packOf: c.packOf ? [...c.packOf] : null
    }));
    const staff = S.staff.map(n => ({ id: uid("staff"), name: n, off: [] }));
    return {
      meta: { version: S.version, created: new Date().toISOString() },
      settings: {
        password: "BTC2026!",
        uploaders: { ...S.uploaders },
        diveLevels: [...S.diveLevels],
        adhocTypes: S.adhocTypes.map(a => ({ ...a }))
      },
      modules, courses, staff,
      students: [],
      sessions: []
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { state = JSON.parse(raw); return; }
    } catch (e) { console.warn("load failed", e); }
    state = seed();
    save();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn("save failed", e); }
    subs.forEach(fn => { try { fn(); } catch (e) {} });
  }

  // ---- subscriptions -------------------------------------------------------
  const subscribe = fn => { subs.push(fn); };

  // ---- generic getters -----------------------------------------------------
  const get = () => state;
  const modules = () => state.modules;
  const courses = () => state.courses;
  const staff = () => state.staff;
  const students = (includeArchived = false) =>
    includeArchived ? state.students : state.students.filter(s => !s.archived);
  const sessions = () => state.sessions;
  const settings = () => state.settings;

  const moduleByCode = code => state.modules.find(m => m.code === code);
  const courseByCode = code => state.courses.find(c => c.code === code);
  const staffById = id => state.staff.find(s => s.id === id);
  const studentById = id => state.students.find(s => s.id === id);

  // Expand a course to its required module codes (packs → component programs).
  function courseModuleCodes(course) {
    if (!course) return [];
    if (course.packOf) {
      const set = new Set();
      course.packOf.forEach(pc => {
        const p = courseByCode(pc);
        courseModuleCodes(p).forEach(mc => set.add(mc));
      });
      return [...set];
    }
    return course.moduleCodes || [];
  }

  // All required modules for a student, across every enrolment.
  function studentModuleCodes(student) {
    const set = new Set();
    (student.courses || []).forEach(cc => {
      const c = courseByCode(cc);
      courseModuleCodes(c).forEach(mc => set.add(mc));
    });
    return [...set];
  }

  // Sessions for a given student + module.
  function studentModuleSessions(studentId, moduleCode) {
    return state.sessions.filter(
      s => s.moduleCode === moduleCode && (s.studentIds || []).includes(studentId)
    );
  }

  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const isPast = dateISO => dateISO && dateISO < todayISO();     // strictly before today
  const isPastOrToday = dateISO => dateISO && dateISO <= todayISO();

  /* Stage status for one student + module. Completion is DERIVED from the
     schedule (so rescheduling to the future auto-reverts), except e-learning
     and certification, which are manual toggles. */
  function moduleStatus(student, moduleCode) {
    const mod = moduleByCode(moduleCode);
    if (!mod) return null;
    const sess = studentModuleSessions(student.id, moduleCode);
    const lectures = sess.filter(s => s.section === "lecture");
    const dives = sess.filter(s => s.section === "dive");

    const classroom = lectures.length > 0 && lectures.every(s => isPastOrToday(s.date));
    const needDives = mod.dives || 0;
    const divesDone = needDives === 0
      ? true
      : (dives.length >= needDives && dives.every(s => isPastOrToday(s.date)));

    const elearning = mod.elearning ? !!(student.elearning && student.elearning[moduleCode]) : null;
    const cert = (student.certs && student.certs[moduleCode] && student.certs[moduleCode].issued) || false;

    // Overall module progress (excluding cert which is the admin step)
    const stages = [];
    if (mod.elearning) stages.push(elearning);
    stages.push(classroom);
    if (needDives > 0) stages.push(divesDone);
    const doneCount = stages.filter(Boolean).length;

    return {
      elearning, classroom, dives: divesDone, cert,
      needDives, divesScheduled: dives.length,
      lectureScheduled: lectures.length > 0,
      ready: doneCount === stages.length,          // all pre-cert stages done
      pct: Math.round((doneCount / stages.length) * 100),
      scheduledAny: sess.length > 0
    };
  }

  // Course-level progress for a student (modules certified / total).
  function courseProgress(student) {
    const codes = studentModuleCodes(student);
    const total = codes.length;
    const certified = codes.filter(c => student.certs && student.certs[c] && student.certs[c].issued).length;
    return { total, certified, pct: total ? Math.round((certified / total) * 100) : 0 };
  }

  // Is a staff member marked OFF on a given date?
  function staffOff(staffId, dateISO) {
    const st = staffById(staffId);
    if (!st) return false;
    return (st.off || []).some(p => dateISO >= p.start && dateISO <= p.end);
  }

  // ---- mutations -----------------------------------------------------------
  function upsertStudent(stu) {
    if (stu.id) {
      const i = state.students.findIndex(s => s.id === stu.id);
      if (i >= 0) state.students[i] = stu; else state.students.push(stu);
    } else {
      stu.id = uid("stu");
      stu.certs = stu.certs || {};
      stu.elearning = stu.elearning || {};
      state.students.push(stu);
    }
    save(); return stu;
  }
  function deleteStudent(id) {
    state.students = state.students.filter(s => s.id !== id);
    state.sessions.forEach(s => { s.studentIds = (s.studentIds || []).filter(x => x !== id); });
    save();
  }

  function addSession(s) { s.id = s.id || uid("ses"); state.sessions.push(s); save(); return s; }
  function updateSession(id, patch) {
    const s = state.sessions.find(x => x.id === id);
    if (s) { Object.assign(s, patch); save(); }
    return s;
  }
  function deleteSession(id) { state.sessions = state.sessions.filter(s => s.id !== id); save(); }

  function setCert(studentId, moduleCode, issued, date, staffName) {
    const stu = studentById(studentId); if (!stu) return;
    stu.certs = stu.certs || {};
    if (issued) stu.certs[moduleCode] = { issued: true, date: date || todayISO(), staff: staffName || "" };
    else delete stu.certs[moduleCode];
    save();
  }
  function setElearning(studentId, moduleCode, done) {
    const stu = studentById(studentId); if (!stu) return;
    stu.elearning = stu.elearning || {};
    if (done) stu.elearning[moduleCode] = true; else delete stu.elearning[moduleCode];
    save();
  }

  function addStaffOff(staffId, start, end) {
    const st = staffById(staffId); if (!st) return;
    st.off = st.off || []; st.off.push({ id: uid("off"), start, end }); save();
  }
  function removeStaffOff(staffId, offId) {
    const st = staffById(staffId); if (!st) return;
    st.off = (st.off || []).filter(o => o.id !== offId); save();
  }
  function addStaff(name) { state.staff.push({ id: uid("staff"), name, off: [] }); save(); }

  function saveCourse(course) {
    const i = state.courses.findIndex(c => c.code === course.code);
    if (i >= 0) state.courses[i] = course; else state.courses.push(course);
    save();
  }
  function saveModule(mod) {
    const i = state.modules.findIndex(m => m.code === mod.code);
    if (i >= 0) state.modules[i] = mod; else state.modules.push(mod);
    save();
  }

  function setPassword(p) { state.settings.password = p; save(); }
  function setUploader(key, url) { state.settings.uploaders[key] = url; save(); }

  function resetCatalogue() {
    const fresh = seed();
    state.modules = fresh.modules;
    state.courses = fresh.courses;
    save();
  }
  function hardReset() { localStorage.removeItem(KEY); load(); }

  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(str) { state = JSON.parse(str); save(); }

  // init
  load();

  return {
    uid, get, save, subscribe,
    modules, courses, staff, students, sessions, settings,
    moduleByCode, courseByCode, staffById, studentById,
    courseModuleCodes, studentModuleCodes, studentModuleSessions,
    moduleStatus, courseProgress, staffOff,
    todayISO, isPast, isPastOrToday,
    upsertStudent, deleteStudent,
    addSession, updateSession, deleteSession,
    setCert, setElearning,
    addStaffOff, removeStaffOff, addStaff,
    saveCourse, saveModule,
    setPassword, setUploader, resetCatalogue, hardReset,
    exportJSON, importJSON
  };
})();

if (typeof window !== "undefined") window.Store = Store;
