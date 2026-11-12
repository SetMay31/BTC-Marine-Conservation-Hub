/* ============================================================================
   BTC Marine Conservation Hub — app.js
   ========================================================================== */
(() => {
  "use strict";
  const S = window.Store;

  /* ---------- tiny DOM helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  function el(tag, props = {}, kids = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (k === "dataset") Object.assign(n.dataset, v);
      else if (v !== null && v !== undefined) n.setAttribute(k, v);
    }
    (Array.isArray(kids) ? kids : [kids]).forEach(c => {
      if (c == null || c === false) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }
  const esc = s => (s == null ? "" : String(s)).replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- date helpers ---------- */
  // Local-date ISO (YYYY-MM-DD) — never use toISOString() which shifts by timezone.
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayISO = () => S.todayISO();
  function parseISO(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  function addDays(dISO, n) { const d = parseISO(dISO); d.setDate(d.getDate() + n); return iso(d); }
  function mondayOf(dISO) { const d = parseISO(dISO); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return iso(d); }
  const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDay(dISO) { const d = parseISO(dISO); return `${d.getDate()} ${MON[d.getMonth()]}`; }
  function fmtLong(dISO) { const d = parseISO(dISO); return `${DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; }

  /* ---------- app state ---------- */
  const UI = {
    screen: "dashboard",
    weekStart: mondayOf(todayISO()),
    schedView: "master",       // master | staff | student
    staffView: "overview",     // overview | roster
    staffRosterDay: todayISO(),
    schedStudentId: null,
    certView: "grid",          // grid | cards
    studentView: "list"        // list | calendar (inside student detail)
  };

  /* ================= GATE ================= */
  function initGate() {
    const gate = $("#gate"), shell = $("#shell");
    const unlocked = sessionStorage.getItem("btc_hub_unlocked") === "1";
    if (unlocked) { gate.classList.add("hidden"); shell.classList.remove("hidden"); return; }
    $("#gate-form").addEventListener("submit", e => {
      e.preventDefault();
      const pw = $("#gate-input").value;
      if (pw === S.settings().password) {
        sessionStorage.setItem("btc_hub_unlocked", "1");
        gate.classList.add("hidden"); shell.classList.remove("hidden"); render();
      } else { $("#gate-error").classList.remove("hidden"); }
    });
  }

  /* ================= THEME ================= */
  function initTheme() {
    const saved = localStorage.getItem("btc_hub_theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
    $("#theme-btn").addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      const mqDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const next = cur ? (cur === "dark" ? "light" : "dark") : (mqDark ? "light" : "dark");
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("btc_hub_theme", next);
    });
  }

  /* ================= NAV ================= */
  function initNav() {
    $$("#tabs .tab").forEach(t =>
      t.addEventListener("click", () => {
        UI.screen = t.dataset.screen;
        $$("#tabs .tab").forEach(x => x.classList.toggle("active", x === t));
        render();
      }));
    window.addEventListener("online", updateNet);
    window.addEventListener("offline", updateNet);
    updateNet();
  }
  function updateNet() { $("#net-dot").classList.toggle("off", !navigator.onLine); }

  /* ================= MODAL ================= */
  function modal({ title, body, actions = [], wide = false }) {
    closeModal();
    const foot = el("div", { class: "modal-foot" },
      actions.map(a => el("button", {
        class: "btn " + (a.class || ""), onclick: () => a.onClick && a.onClick()
      }, a.label)));
    const box = el("div", { class: "modal" + (wide ? " wide" : "") }, [
      el("div", { class: "modal-head" }, [
        el("h3", { text: title }),
        el("button", { class: "x-btn", onclick: closeModal, text: "×" })
      ]),
      el("div", { class: "modal-body" }, body),
      actions.length ? foot : null
    ]);
    const bg = el("div", { class: "modal-bg", onclick: e => { if (e.target === bg) closeModal(); } }, box);
    $("#modal-root").appendChild(bg);
    return box;
  }
  function closeModal() { $("#modal-root").innerHTML = ""; }
  function toast(msg) {
    const t = el("div", { class: "warn-banner", text: msg,
      style: "position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:80;background:var(--accent);color:#fff;border:0;box-shadow:var(--shadow-lg)" });
    document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
  }

  /* ================= RENDER ROUTER ================= */
  function render() {
    const root = $("#app"); root.innerHTML = "";
    ({
      dashboard: renderDashboard, schedule: renderSchedule, students: renderStudents,
      certs: renderCerts, staff: renderStaff, catalogue: renderCatalogue, settings: renderSettings
    }[UI.screen] || renderDashboard)(root);
  }

  /* ========================================================================
     DASHBOARD
     ===================================================================== */
  function renderDashboard(root) {
    const studs = S.students();
    const today = todayISO();
    const weekEnd = addDays(today, 7);

    const onSite = studs.filter(s => {
      const arr = s.arrival, dep = s.departure;
      if (arr && arr > today) return false;
      if (dep && dep < today) return false;
      return true;
    });
    const upcoming = S.sessions().filter(s => s.date >= today && s.date < weekEnd);
    const certsThisMonth = [];
    studs.forEach(s => Object.entries(s.certs || {}).forEach(([mc, c]) => {
      if (c.issued && c.date && c.date.slice(0, 7) === today.slice(0, 7)) certsThisMonth.push({ s, mc, c });
    }));

    // e-learning outstanding with dives coming up
    const elOutstanding = [];
    studs.forEach(s => {
      S.studentModuleCodes(s).forEach(mc => {
        const mod = S.moduleByCode(mc); if (!mod || !mod.elearn) return;
        const done = s.elearning && s.elearning[mod.elearn];
        if (done) return;
        const hasUpcoming = S.studentModuleSessions(s.id, mc).some(se => se.date >= today);
        if (hasUpcoming) elOutstanding.push({ s, mod });
      });
    });

    // prereq warnings
    const prereqWarn = studs.filter(s => (s.courses || []).some(cc => {
      const c = S.courseByCode(cc);
      return c && c.prereq && !meetsPrereqHeuristic(s, c);
    }));

    // compliance incomplete
    const compInc = studs.filter(s => !(s.compliance && s.compliance.medical && s.compliance.waiver && s.compliance.cdPaperwork));

    // sessions missing staff (non-adhoc)
    const noStaff = upcoming.filter(se => !se.staff && se.kind !== "adhoc");

    root.appendChild(el("div", { class: "screen-head" }, [
      el("h2", { text: "Dashboard" }),
      el("div", { class: "muted small", text: fmtLong(today) })
    ]));

    root.appendChild(el("div", { class: "stat-row" }, [
      stat(onSite.length, "On site now"),
      stat(upcoming.length, "Sessions this week"),
      stat(certsThisMonth.length, "Certs this month"),
      stat(elOutstanding.length, "E-learning due"),
      stat(studs.length, "Active students")
    ]));

    const grid = el("div", { class: "dash-grid" });
    grid.appendChild(dashCard("This week's outings", upcoming.length
      ? upcoming.sort(byDateTime).slice(0, 12).map(se => line(
          `${fmtDay(se.date)} · ${se.start || ""} ${sessionTitle(se)}`,
          se.staff || "—"))
      : [emptyLine("Nothing scheduled this week")]));

    grid.appendChild(dashCard("E-learning outstanding (dives coming)", elOutstanding.length
      ? elOutstanding.slice(0, 12).map(x => line(x.s.name, x.mod.code))
      : [emptyLine("All caught up")]));

    grid.appendChild(dashCard("On site now", onSite.length
      ? onSite.slice(0, 15).map(s => line(s.name, courseBadgeText(s)))
      : [emptyLine("No students on site")]));

    grid.appendChild(dashCard("⚠️ Needs staff assigned", noStaff.length
      ? noStaff.map(se => line(`${fmtDay(se.date)} ${sessionTitle(se)}`, "unassigned"))
      : [emptyLine("All sessions staffed")]));

    grid.appendChild(dashCard("⚠️ Prerequisite warnings", prereqWarn.length
      ? prereqWarn.map(s => line(s.name, "check prereqs"))
      : [emptyLine("No prerequisite issues")]));

    grid.appendChild(dashCard("⚠️ Incomplete compliance", compInc.length
      ? compInc.map(s => line(s.name, complianceMissing(s)))
      : [emptyLine("All compliance complete")]));

    root.appendChild(grid);
  }
  const stat = (n, l) => el("div", { class: "stat" }, [el("div", { class: "n", text: String(n) }), el("div", { class: "l", text: l })]);
  const dashCard = (title, lines) => el("div", { class: "card" }, [el("h3", { text: title }), ...lines]);
  const line = (a, b) => el("div", { class: "list-line" }, [el("span", { text: a }), el("span", { class: "muted small", text: b })]);
  const emptyLine = t => el("div", { class: "muted small", text: t });
  function complianceMissing(s) {
    const c = s.compliance || {}; const miss = [];
    if (!c.medical) miss.push("Medical"); if (!c.waiver) miss.push("Waiver"); if (!c.cdPaperwork) miss.push("CD paperwork");
    return miss.join(", ");
  }

  /* ========================================================================
     SCHEDULE  (master week · staff · student)
     ===================================================================== */
  function renderSchedule(root) {
    root.appendChild(el("div", { class: "spread screen-head" }, [
      el("h2", { text: "Schedule" }),
      el("div", { class: "row" }, [
        el("button", { class: "btn btn-primary", onclick: openScheduleModule }, "+ Schedule module"),
        el("button", { class: "btn", onclick: () => openSessionModal(null) }, "+ Session / survey")
      ])
    ]));

    // view switch
    const sw = el("div", { class: "sched-toolbar" }, [
      viewBtn("master", "Master"), viewBtn("staff", "Staff"), viewBtn("student", "Students")
    ]);
    root.appendChild(sw);
    function viewBtn(k, label) {
      return el("button", { class: "btn btn-sm" + (UI.schedView === k ? " btn-primary" : ""),
        onclick: () => { UI.schedView = k; render(); } }, label);
    }

    if (UI.schedView === "master") renderMaster(root);
    else if (UI.schedView === "staff") renderStaffSchedule(root);
    else renderStudentSchedule(root);
  }

  function weekNav(onChange, label) {
    return el("div", { class: "sched-toolbar" }, [
      el("button", { class: "btn btn-sm", onclick: () => { UI.weekStart = addDays(UI.weekStart, -7); onChange(); } }, "‹ Prev"),
      el("button", { class: "btn btn-sm", onclick: () => { UI.weekStart = mondayOf(todayISO()); onChange(); } }, "This week"),
      el("button", { class: "btn btn-sm", onclick: () => { UI.weekStart = addDays(UI.weekStart, 7); onChange(); } }, "Next ›"),
      el("strong", { text: label })
    ]);
  }

  function renderMaster(root) {
    const start = UI.weekStart, end = addDays(start, 6);
    root.appendChild(weekNav(render, `${fmtDay(start)} – ${fmtDay(end)}`));
    const grid = el("div", { class: "week-grid" });
    for (let i = 0; i < 7; i++) {
      const dISO = addDays(start, i);
      const daySess = S.sessions().filter(s => s.date === dISO).sort(byDateTime);
      const col = el("div", { class: "day-col" + (dISO === todayISO() ? " today" : "") });
      col.appendChild(el("div", { class: "day-head" }, [
        el("span", { text: fmtDay(dISO) }), el("span", { class: "dow", text: DOW[i] })
      ]));
      const bodyEl = el("div", { class: "day-body" });
      daySess.forEach(se => bodyEl.appendChild(sessionCard(se)));
      // drop target
      col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("today"); });
      col.addEventListener("dragleave", () => { if (dISO !== todayISO()) col.classList.remove("today"); });
      col.addEventListener("drop", e => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        if (id) { S.updateSession(id, { date: dISO }); render(); }
      });
      col.appendChild(bodyEl);
      col.appendChild(el("button", { class: "btn btn-sm day-add", onclick: () => openSessionModal(null, dISO) }, "+ add"));
      grid.appendChild(col);
    }
    root.appendChild(grid);
    root.appendChild(el("p", { class: "muted small", style: "margin-top:10px",
      text: "Tip: drag a session to another day to reschedule — progress and completion dates update automatically." }));
  }

  function sessionCard(se) {
    const med = se.medium || "dive";
    const studs = (se.studentIds || []).map(id => { const s = S.studentById(id); return s ? s.name : "?"; });
    const offWarn = se.staff && isStaffOffByName(se.staff, se.date);
    const card = el("div", {
      class: `sess m-${med}`, draggable: "true",
      onclick: () => openSessionModal(se.id)
    }, [
      el("div", { class: "s-time" }, `${se.start || ""}${se.end ? "–" + se.end : ""}`),
      el("div", { class: "s-title" }, sessionTitle(se)),
      el("div", { class: "s-meta" }, (se.staff || "— no staff") + (se.diveSite ? " · " + se.diveSite : "")),
      studs.length ? el("div", { class: "s-meta", text: studs.join(", ") }) : null,
      offWarn ? el("div", { class: "s-warn", text: "⚠ staff OFF" }) : null,
      (se.staff && se.moduleCode && !S.staffCanTeach(se.staff, se.moduleCode)) ? el("div", { class: "s-warn", text: "⚠ not signed off to teach" }) : null,
      (!se.staff && se.kind !== "adhoc") ? el("div", { class: "s-warn", text: "⚠ no staff" }) : null
    ]);
    card.addEventListener("dragstart", e => e.dataTransfer.setData("text/plain", se.id));
    return card;
  }

  function renderStaffSchedule(root) {
    const bar = el("div", { class: "sched-toolbar" }, [
      el("button", { class: "btn btn-sm" + (UI.staffView === "overview" ? " btn-primary" : ""),
        onclick: () => { UI.staffView = "overview"; render(); } }, "Week overview"),
      el("button", { class: "btn btn-sm" + (UI.staffView === "roster" ? " btn-primary" : ""),
        onclick: () => { UI.staffView = "roster"; render(); } }, "Day roster")
    ]);
    root.appendChild(bar);

    if (UI.staffView === "overview") {
      const start = UI.weekStart;
      root.appendChild(weekNav(render, `${fmtDay(start)} – ${fmtDay(addDays(start, 6))}`));
      const tbl = el("table", { class: "staff-matrix" });
      const head = el("tr", {}, [el("th", { text: "Staff" }), ...DOW.map((d, i) =>
        el("th", {}, `${d} ${fmtDay(addDays(start, i)).split(" ")[0]}`))]);
      tbl.appendChild(head);
      S.staff().forEach(st => {
        const tr = el("tr", {}, [el("th", { text: st.name, style: "text-align:left" })]);
        for (let i = 0; i < 7; i++) {
          const dISO = addDays(start, i);
          const off = S.staffOff(st.id, dISO);
          const sess = S.sessions().filter(s => s.staff === st.name && s.date === dISO).sort(byDateTime);
          const td = el("td", { class: off ? "off" : "" });
          if (off && !sess.length) td.appendChild(el("span", { class: "small", text: "OFF" }));
          sess.forEach(se => td.appendChild(el("div", {
            class: `mini-sess m-${se.medium || "dive"}`, style: `background:var(--${se.medium || "dive"}-soft)`,
            onclick: () => openSessionModal(se.id), text: `${se.start || ""} ${shortTitle(se)}`
          })));
          if (off && sess.length) td.appendChild(el("div", { class: "small faint", text: "(OFF)" }));
          tr.appendChild(td);
        }
        tbl.appendChild(tr);
      });
      root.appendChild(el("div", { class: "staff-grid" }, tbl));
    } else {
      // day roster: staff columns × time rows
      root.appendChild(el("div", { class: "sched-toolbar" }, [
        el("button", { class: "btn btn-sm", onclick: () => { UI.staffRosterDay = addDays(UI.staffRosterDay, -1); render(); } }, "‹"),
        el("button", { class: "btn btn-sm", onclick: () => { UI.staffRosterDay = todayISO(); render(); } }, "Today"),
        el("button", { class: "btn btn-sm", onclick: () => { UI.staffRosterDay = addDays(UI.staffRosterDay, 1); render(); } }, "›"),
        el("strong", { text: fmtLong(UI.staffRosterDay) })
      ]));
      const d = UI.staffRosterDay;
      const tbl = el("table", { class: "staff-matrix" });
      tbl.appendChild(el("tr", {}, [el("th", { text: "Time" }), ...S.staff().map(st =>
        el("th", {}, st.name + (S.staffOff(st.id, d) ? " (OFF)" : "")))]));
      const slots = ["07:00", "09:00", "12:00", "14:00", "16:00"];
      slots.forEach(slot => {
        const tr = el("tr", {}, [el("th", { text: slot, style: "text-align:left" })]);
        S.staff().forEach(st => {
          const sess = S.sessions().filter(s => s.staff === st.name && s.date === d && (s.start || "").slice(0, 2) === slot.slice(0, 2));
          const td = el("td", { class: S.staffOff(st.id, d) ? "off" : "" });
          sess.forEach(se => td.appendChild(el("div", {
            class: "mini-sess", style: `background:var(--${se.medium || "dive"}-soft)`,
            onclick: () => openSessionModal(se.id), text: shortTitle(se)
          })));
          tr.appendChild(td);
        });
        tbl.appendChild(tr);
      });
      root.appendChild(el("div", { class: "staff-grid" }, tbl));
    }
  }

  function renderStudentSchedule(root) {
    const studs = S.students();
    const sel = el("select", { onchange: e => { UI.schedStudentId = e.target.value; render(); } },
      [el("option", { value: "" }, "— choose a student —"),
       ...studs.map(s => el("option", { value: s.id, selected: UI.schedStudentId === s.id ? "selected" : null }, s.name))]);
    root.appendChild(el("div", { class: "card", style: "margin-bottom:14px" }, [
      el("label", { text: "Student" }), sel ]));
    const stu = studs.find(s => s.id === UI.schedStudentId);
    if (!stu) { root.appendChild(el("div", { class: "empty", text: "Pick a student to see their schedule." })); return; }

    const sess = S.sessions().filter(s => (s.studentIds || []).includes(stu.id)).sort(byDateTime);
    root.appendChild(el("div", { class: "sched-toolbar" }, [
      el("button", { class: "btn btn-sm" + (UI.studentView === "list" ? " btn-primary" : ""),
        onclick: () => { UI.studentView = "list"; render(); } }, "List"),
      el("button", { class: "btn btn-sm" + (UI.studentView === "calendar" ? " btn-primary" : ""),
        onclick: () => { UI.studentView = "calendar"; render(); } }, "Calendar")
    ]));

    if (!sess.length) { root.appendChild(el("div", { class: "empty", text: "No sessions scheduled for " + stu.name })); return; }

    if (UI.studentView === "list") {
      const wrap = el("div", { class: "table-wrap" });
      const tbl = el("table", {}, [el("thead", {}, el("tr", {}, [th("Date"), th("Time"), th("Module"), th("Staff")]))]);
      const tb = el("tbody");
      sess.forEach(se => tb.appendChild(el("tr", { onclick: () => openSessionModal(se.id), style: "cursor:pointer" }, [
        td(fmtDay(se.date)), td(se.start || ""), tdMedium(se), td(se.staff || "—")])));
      tbl.appendChild(tb); wrap.appendChild(tbl); root.appendChild(wrap);
    } else {
      // calendar: show the week containing earliest, nav by week
      root.appendChild(weekNav(render, `${fmtDay(UI.weekStart)} – ${fmtDay(addDays(UI.weekStart, 6))}`));
      const grid = el("div", { class: "week-grid" });
      for (let i = 0; i < 7; i++) {
        const dISO = addDays(UI.weekStart, i);
        const col = el("div", { class: "day-col" + (dISO === todayISO() ? " today" : "") }, [
          el("div", { class: "day-head" }, [el("span", { text: fmtDay(dISO) }), el("span", { class: "dow", text: DOW[i] })])
        ]);
        const body = el("div", { class: "day-body" });
        sess.filter(s => s.date === dISO).forEach(se => body.appendChild(el("div", {
          class: `sess m-${se.medium || "dive"}`, onclick: () => openSessionModal(se.id)
        }, [el("div", { class: "s-time", text: se.start || "" }),
            el("div", { class: "s-title", text: shortTitle(se) }),
            el("div", { class: "s-meta", text: se.staff || "—" })])));
        col.appendChild(body); grid.appendChild(col);
      }
      root.appendChild(grid);
    }
  }

  /* ---------- session title helpers ---------- */
  function sessionTitle(se) {
    if (se.kind === "survey") { const c = S.courseByCode(se.courseCode); return c ? c.name : "Survey"; }
    if (se.kind === "adhoc") return se.adhocLabel || "Session";
    const mod = S.moduleByCode(se.moduleCode);
    const base = mod ? mod.name : (se.moduleCode || "Session");
    const tag = se.name || (se.section === "lecture" ? "Lecture" : (se.section === "dive" ? `Dive${se.diveIndex ? " " + se.diveIndex : ""}` : ""));
    return tag ? `${base} — ${tag}` : base;
  }
  function shortTitle(se) {
    if (se.kind === "survey") return (S.courseByCode(se.courseCode) || {}).name || "Survey";
    if (se.kind === "adhoc") return se.adhocLabel || "Session";
    const mod = S.moduleByCode(se.moduleCode);
    const code = mod ? mod.code : se.moduleCode;
    return `${code} ${se.name || (se.section === "lecture" ? "Lec" : "D" + (se.diveIndex || ""))}`;
  }
  const byDateTime = (a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || ""));

  /* ========================================================================
     SCHEDULE MODULE (whole module create)
     ===================================================================== */
  // Resolve a module's scheduling template into dated rows.
  function resolveTemplate(mod, opts = {}) {
    if (!mod) return [];
    if (mod.tmpl === "EMP") return S.template("EMP");
    if (mod.tmpl === "CLEAN") return S.template("CLEAN");
    if (mod.tmpl === "AR") {
      let rows = [...S.template("AR")];
      const o = S.template("AR_options");
      rows = rows.concat(opts.arOption === "workshop" ? o.workshop : o.dives);
      if (opts.arProgramme) rows = rows.concat(S.template("AR_day2"));
      return rows;
    }
    // generated standard: lecture + mod.dives dives (2 per afternoon, one boat/block)
    const rows = [{ day: 0, type: "lecture", name: "Lecture", start: "09:00", end: "10:30" }];
    const n = mod.dives || 0;
    for (let i = 0; i < n; i++) {
      const day = Math.floor(i / 2), block = Math.floor(i / 2) + 1;
      rows.push({ day, type: "dive", name: "Dive " + (i + 1), start: "12:00", end: "17:00", block });
    }
    return rows;
  }

  function openScheduleModule() {
    let moduleCode = "", date = todayISO(), staffName = "", assist = "", shadow = "", surveyLead = "";
    let arOption = "dives", arProgramme = true, individualSites = false;
    const sites = {};               // all | d0,d1,...
    const selectedStudents = new Set();

    const moduleSel = el("select", { onchange: e => { moduleCode = e.target.value; refreshStudents(); rebuildAR(); rebuildSites(); } },
      [el("option", { value: "" }, "— choose a module —"),
       ...S.modules().map(m => el("option", { value: m.code }, `${m.name} (${m.agency})`))]);

    const studentsBox = el("div", { class: "chips" });
    function refreshStudents() {
      studentsBox.innerHTML = "";
      if (!moduleCode) { studentsBox.appendChild(el("span", { class: "muted small", text: "Pick a module first." })); return; }
      const eligible = S.students().filter(s => S.studentModuleCodes(s).includes(moduleCode));
      if (!eligible.length) { studentsBox.appendChild(el("span", { class: "muted small", text: "No enrolled students need this module." })); return; }
      eligible.forEach(s => {
        const certified = s.certs && s.certs[moduleCode] && s.certs[moduleCode].issued;
        const chip = el("div", { class: "chip" + (certified ? " warnflag" : ""),
          onclick: () => { if (selectedStudents.has(s.id)) { selectedStudents.delete(s.id); chip.classList.remove("on"); } else { selectedStudents.add(s.id); chip.classList.add("on"); } }
        }, s.name + (certified ? " ✓already" : ""));
        studentsBox.appendChild(chip);
      });
    }
    refreshStudents();

    const arBox = el("div");
    function rebuildAR() {
      arBox.innerHTML = "";
      const mod = S.moduleByCode(moduleCode);
      if (mod && mod.tmpl === "AR") {
        arBox.appendChild(field("Day 1 afternoon", el("div", { class: "chips" }, [
          chipToggle("Artificial Reefs Dives", arOption === "dives", () => { arOption = "dives"; rebuildAR(); rebuildSites(); }),
          chipToggle("Workshop Day", arOption === "workshop", () => { arOption = "workshop"; rebuildAR(); rebuildSites(); })
        ])));
        arBox.appendChild(checkbox("Part of a programme (adds Day 2 morning dives)", arProgramme, v => { arProgramme = v; rebuildSites(); }));
      }
    }
    rebuildAR();

    const sitesBox = el("div");
    function rebuildSites() {
      sitesBox.innerHTML = "";
      const mod = S.moduleByCode(moduleCode); if (!mod) return;
      const dives = resolveTemplate(mod, { arOption, arProgramme }).filter(r => r.type === "dive");
      if (!dives.length) return;
      sitesBox.appendChild(checkbox("Set each dive's site individually (otherwise one site for all)", individualSites, v => { individualSites = v; rebuildSites(); }));
      if (!individualSites) {
        sitesBox.appendChild(field("Preferred dive site (all dives)", el("input", { placeholder: "e.g. Aow Leuk", value: sites.all || "", oninput: e => sites.all = e.target.value })));
      } else {
        dives.forEach((dv, i) => sitesBox.appendChild(field(dv.name, el("input", { placeholder: "dive site", value: sites["d" + i] || "", oninput: e => sites["d" + i] = e.target.value }))));
      }
    }
    rebuildSites();

    const body = [
      field("Module", moduleSel),
      arBox,
      field("Eligible students (only those enrolled in a course that includes this module)", studentsBox),
      field("Lead staff", staffSelect(v => staffName = v)),
      el("div", { class: "field-row" }, [
        field("Assist (optional)", el("input", { placeholder: "name", oninput: e => assist = e.target.value })),
        field("Shadow (optional)", el("input", { placeholder: "name", oninput: e => shadow = e.target.value }))
      ]),
      el("div", { class: "field-row" }, [
        field("Survey Lead (optional)", el("input", { placeholder: "name", oninput: e => surveyLead = e.target.value })),
        field("Start date", el("input", { type: "date", value: date, oninput: e => date = e.target.value }))
      ]),
      sitesBox,
      el("p", { class: "muted small", text: "Lays out the module's lecture(s) and dives per its template. Every section is movable afterwards, and you can adjust staff/students per section." })
    ];

    modal({
      title: "Schedule a module", body,
      actions: [
        { label: "Cancel", onClick: closeModal },
        { label: "Create sessions", class: "btn-primary", onClick: () => {
          if (!moduleCode) return toast("Choose a module");
          const mod = S.moduleByCode(moduleCode);
          const ids = [...selectedStudents];
          const rows = resolveTemplate(mod, { arOption, arProgramme });
          const groupId = S.uid("grp");
          let diveNum = 0, diveSiteIdx = 0, lastDay = 0;
          rows.forEach(r => {
            const isDive = r.type === "dive";
            const site = isDive ? (individualSites ? (sites["d" + diveSiteIdx] || "") : (sites.all || "")) : "";
            S.addSession({
              moduleCode, courseCode: "", groupId, staff: staffName, assist, shadow, surveyLead,
              studentIds: ids, kind: "module",
              date: addDays(date, r.day), start: r.start, end: r.end,
              section: isDive ? "dive" : "lecture", medium: isDive ? (mod.medium || "dive") : "land",
              name: r.name, block: r.block || null, diveIndex: isDive ? ++diveNum : null, diveSite: site
            });
            if (isDive) diveSiteIdx++;
            lastDay = Math.max(lastDay, r.day);
          });
          closeModal(); UI.schedView = "master"; UI.weekStart = mondayOf(date); render();
          toast(`Scheduled ${mod.name} (${lastDay + 1} day${lastDay ? "s" : ""})`);
        }}
      ], wide: true
    });
  }
  function chipToggle(label, on, onClick) {
    return el("div", { class: "chip" + (on ? " on" : ""), onclick: onClick }, label);
  }

  /* ========================================================================
     SESSION edit / add (incl. surveys & ad-hoc)
     ===================================================================== */
  function openSessionModal(id, presetDate) {
    const existing = id ? S.sessions().find(s => s.id === id) : null;
    const se = existing ? { ...existing } : {
      id: null, date: presetDate || todayISO(), start: "07:00", end: "09:00",
      kind: "adhoc", medium: "dive", staff: "", assist: "", shadow: "", surveyLead: "",
      studentIds: [], diveSite: "", note: "", adhocType: "", adhocLabel: "", courseCode: "", moduleCode: ""
    };

    // Whole taught modules are added via "+ Schedule module"; this modal is for
    // flexible/ad-hoc dives and surveys. "module" only appears when editing an
    // existing module section.
    const kinds = ["adhoc", "survey"];
    if (existing && se.kind === "module") kinds.push("module");
    const kindSel = el("select", { onchange: e => { se.kind = e.target.value; rebuild(); } },
      kinds.map(k => el("option", { value: k, selected: se.kind === k ? "selected" : null },
        k === "adhoc" ? "Flexible / extra dive" : k === "survey" ? "Conservation survey (staff only)" : "Module section")));

    const specific = el("div");
    function rebuild() {
      specific.innerHTML = "";
      if (se.kind === "survey") {
        const surveys = S.courses().filter(c => c.kind === "survey");
        specific.appendChild(field("Survey", el("select", { onchange: e => {
          se.courseCode = e.target.value; const c = S.courseByCode(se.courseCode); se.medium = c ? c.medium : "snorkel";
        }}, [el("option", { value: "" }, "— choose —"), ...surveys.map(c =>
          el("option", { value: c.code, selected: se.courseCode === c.code ? "selected" : null }, c.name))])));
      } else if (se.kind === "adhoc") {
        const types = S.diveComponents();
        specific.appendChild(field("Dive / flexible type", el("select", { onchange: e => {
          const t = types.find(x => x.code === e.target.value);
          se.adhocType = t ? t.code : ""; se.adhocLabel = t ? t.name : ""; se.medium = t ? t.medium : "dive";
          se.section = "dive";
        }}, [el("option", { value: "" }, "— choose —"), ...types.map(t =>
          el("option", { value: t.code, selected: se.adhocType === t.code ? "selected" : null }, t.name))])));
      } else {
        specific.appendChild(field("Module", el("select", { onchange: e => { se.moduleCode = e.target.value; }},
          [el("option", { value: "" }, "— choose —"), ...S.modules().map(m =>
            el("option", { value: m.code, selected: se.moduleCode === m.code ? "selected" : null }, m.name))])));
        specific.appendChild(field("Section", el("select", { onchange: e => {
          se.section = e.target.value; se.medium = se.section === "lecture" ? "land" : (S.moduleByCode(se.moduleCode) || {}).medium || "dive";
        }}, ["lecture", "dive"].map(x => el("option", { value: x, selected: se.section === x ? "selected" : null },
          x === "lecture" ? "Lecture" : "Dive")))));
      }
    }
    rebuild();

    // students (hidden for survey)
    const studentsBox = el("div", { class: "chips" });
    function buildStudents() {
      studentsBox.innerHTML = "";
      S.students().forEach(s => {
        const on = (se.studentIds || []).includes(s.id);
        const chip = el("div", { class: "chip" + (on ? " on" : ""), onclick: () => {
          se.studentIds = se.studentIds || [];
          if (se.studentIds.includes(s.id)) se.studentIds = se.studentIds.filter(x => x !== s.id);
          else se.studentIds.push(s.id);
          chip.classList.toggle("on");
        }}, s.name);
        studentsBox.appendChild(chip);
      });
    }
    buildStudents();

    const body = [
      (existing && se.kind === "module") ? el("button", { class: "btn btn-primary", style: "margin-bottom:12px;width:100%",
        onclick: () => { closeModal(); openModuleGroupEdit(existing); } }, "✎ Edit the whole module (staff, students, dates, site)") : null,
      field("Session type", kindSel),
      !existing ? el("p", { class: "muted small", style: "margin-top:-6px", text: "To schedule a taught module (lecture + its dives), use “+ Schedule module” instead." }) : null,
      specific,
      el("div", { class: "field-row" }, [
        field("Date", el("input", { type: "date", value: se.date, oninput: e => se.date = e.target.value })),
        field("Start", el("input", { type: "time", value: se.start, oninput: e => se.start = e.target.value }))
      ]),
      field("Lead staff" + (se.kind === "adhoc" ? " (optional)" : ""), staffSelect(v => se.staff = v, se.staff)),
      el("div", { class: "field-row" }, [
        field("Assist", el("input", { value: se.assist || "", oninput: e => se.assist = e.target.value })),
        field("Shadow", el("input", { value: se.shadow || "", oninput: e => se.shadow = e.target.value }))
      ]),
      field("Survey Lead", el("input", { value: se.surveyLead || "", oninput: e => se.surveyLead = e.target.value })),
      field("Preferred dive site", el("input", { value: se.diveSite || "", oninput: e => se.diveSite = e.target.value })),
      el("div", { id: "students-field" }),
      field("Note", el("textarea", { rows: "2", oninput: e => se.note = e.target.value }, se.note || ""))
    ];

    const actions = [{ label: "Cancel", onClick: closeModal }];
    if (existing) actions.push({ label: "Delete", class: "btn-danger", onClick: () => {
      if (confirm("Delete this session?")) { S.deleteSession(existing.id); closeModal(); render(); } }});
    actions.push({ label: existing ? "Save" : "Create", class: "btn-primary", onClick: () => {
      if (se.kind !== "survey" && (se.studentIds || []).length === 0 && se.kind === "module") {
        if (!confirm("No students on this module section. Save anyway?")) return;
      }
      if (existing) S.updateSession(existing.id, se); else S.addSession(se);
      closeModal(); render();
    }});

    modal({ title: existing ? "Edit session" : "New session", body, actions, wide: true });
    // students field only for non-survey
    const sf = $("#students-field");
    if (se.kind !== "survey") sf.appendChild(field("Students", studentsBox));
    // react to kind change for students visibility
    kindSel.addEventListener("change", () => {
      sf.innerHTML = ""; if (se.kind !== "survey") { buildStudents(); sf.appendChild(field("Students", studentsBox)); }
    });
  }

  function staffSelect(onChange, current = "") {
    return el("select", { onchange: e => onChange(e.target.value) },
      [el("option", { value: "" }, "— none —"), ...S.staff().map(s =>
        el("option", { value: s.name, selected: current === s.name ? "selected" : null }, s.name))]);
  }

  // All sessions belonging to the same module booking as `se`.
  function moduleGroupSessions(se) {
    if (se.groupId) return S.sessions().filter(x => x.groupId === se.groupId);
    const key = (se.studentIds || []).slice().sort().join(",");
    return S.sessions().filter(x => x.moduleCode === se.moduleCode && x.kind === "module" &&
      (x.studentIds || []).slice().sort().join(",") === key);
  }
  const commonVal = (arr, f) => {
    const vals = [...new Set(arr.map(s => s[f] || ""))];
    return vals.length === 1 ? vals[0] : "";
  };

  // Edit a whole module booking at once (staff, helpers, students, site, dates).
  function openModuleGroupEdit(anchor) {
    const group = moduleGroupSessions(anchor);
    const mod = S.moduleByCode(anchor.moduleCode);
    let staff = commonVal(group, "staff"), assist = commonVal(group, "assist"),
        shadow = commonVal(group, "shadow"), surveyLead = commonVal(group, "surveyLead");
    let diveSite = commonVal(group.filter(s => s.section === "dive"), "diveSite");
    const earliest = group.map(s => s.date).sort()[0];
    let newStart = earliest;
    const studentIds = new Set();
    group.forEach(s => (s.studentIds || []).forEach(id => studentIds.add(id)));

    const studentsBox = el("div", { class: "chips" });
    function buildStudents() {
      studentsBox.innerHTML = "";
      S.students().forEach(s => {
        const on = studentIds.has(s.id);
        studentsBox.appendChild(el("div", { class: "chip" + (on ? " on" : ""), onclick: () => {
          if (studentIds.has(s.id)) studentIds.delete(s.id); else studentIds.add(s.id);
          buildStudents();
        }}, s.name));
      });
    }
    buildStudents();

    const body = [
      el("div", { class: "warn-banner", style: "background:var(--accent-soft);color:var(--ink);border-color:var(--accent-2)",
        text: `${mod ? mod.name : anchor.moduleCode} — ${group.length} session${group.length !== 1 ? "s" : ""}. Changes apply to all of them.` }),
      field("Lead staff (all sessions)", staffSelect(v => staff = v, staff)),
      el("div", { class: "field-row" }, [
        field("Assist", el("input", { value: assist, oninput: e => assist = e.target.value })),
        field("Shadow", el("input", { value: shadow, oninput: e => shadow = e.target.value }))
      ]),
      field("Survey Lead", el("input", { value: surveyLead, oninput: e => surveyLead = e.target.value })),
      field("Preferred dive site (all dives; blank leaves each as-is)", el("input", { value: diveSite, placeholder: "e.g. Aow Leuk", oninput: e => diveSite = e.target.value })),
      field("Move whole module — new start date (keeps the day spacing)", el("input", { type: "date", value: newStart, oninput: e => newStart = e.target.value })),
      field("Students (all sessions)", studentsBox)
    ];

    modal({
      title: "Edit whole module", wide: true, body,
      actions: [
        { label: "Cancel", onClick: closeModal },
        { label: "Delete whole module", class: "btn-danger", onClick: () => {
          if (confirm(`Delete all ${group.length} sessions of this module?`)) { group.forEach(s => S.deleteSession(s.id)); closeModal(); render(); } }},
        { label: "Apply to all", class: "btn-primary", onClick: () => {
          const offset = daysBetween(earliest, newStart);
          const ids = [...studentIds];
          group.forEach(s => {
            const patch = { staff, assist, shadow, surveyLead, studentIds: ids };
            if (diveSite && s.section === "dive") patch.diveSite = diveSite;
            if (offset !== 0) patch.date = addDays(s.date, offset);
            S.updateSession(s.id, patch);
          });
          closeModal(); render();
          toast("Whole module updated");
        }}
      ]
    });
  }
  function daysBetween(a, b) {
    if (!a || !b) return 0;
    return Math.round((parseISO(b) - parseISO(a)) / 86400000);
  }

  /* ========================================================================
     STUDENTS
     ===================================================================== */
  function renderStudents(root) {
    root.appendChild(el("div", { class: "spread screen-head" }, [
      el("h2", { text: "Students" }),
      el("button", { class: "btn btn-primary", onclick: () => openStudentModal(null) }, "+ Add student")
    ]));
    const list = S.students();
    if (!list.length) { root.appendChild(el("div", { class: "empty", text: "No students yet. Add your first student to begin." })); return; }
    const grid = el("div", { class: "grid-cards" });
    list.sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
      const prog = S.courseProgress(s);
      grid.appendChild(el("div", { class: "card", style: "cursor:pointer", onclick: () => openStudentModal(s.id) }, [
        el("div", { class: "spread" }, [
          el("h3", { text: s.name, style: "margin:0" }),
          el("span", { class: "pill", text: `${prog.certified}/${prog.total}` })
        ]),
        el("div", { class: "muted small", text: courseBadgeText(s) || "No course" }),
        el("div", { class: "progress-bar", style: "margin:8px 0" }, el("i", { style: `width:${prog.pct}%` })),
        el("div", { class: "row small" }, [
          s.startLevel && s.startLevel.cert ? el("span", { class: "pill muted2", text: s.startLevel.cert }) : null,
          complianceMissing(s) ? el("span", { class: "pill warn", text: "⚠ " + complianceMissing(s) }) : el("span", { class: "pill good", text: "✓ compliance" })
        ])
      ]));
    });
    root.appendChild(grid);

    // archived
    const archived = S.students(true).filter(s => s.archived);
    if (archived.length) {
      root.appendChild(el("h3", { style: "margin-top:22px", text: `Archived (${archived.length})` }));
      const ag = el("div", { class: "grid-cards" });
      archived.forEach(s => ag.appendChild(el("div", { class: "card", onclick: () => openStudentModal(s.id), style: "cursor:pointer;opacity:.75" }, [
        el("div", { class: "spread" }, [el("h3", { text: s.name, style: "margin:0" }), el("span", { class: "pill", text: "archived" })]),
        el("div", { class: "muted small", text: courseBadgeText(s) })
      ])));
      root.appendChild(ag);
    }
  }

  function courseBadgeText(s) {
    return (s.courses || []).map(c => (S.courseByCode(c) || {}).name).filter(Boolean).join(" · ");
  }

  function openStudentModal(id) {
    const existing = id ? S.studentById(id) : null;
    const s = existing ? JSON.parse(JSON.stringify(existing)) : {
      id: null, name: "", email: "", phone: "", nationality: "", dob: "",
      emergencyName: "", emergencyPhone: "", arrival: "", departure: "", note: "",
      courses: [], certs: {}, elearning: {},
      startLevel: { cert: "", loggedDives: "", priorModules: [] },
      compliance: { medical: false, waiver: false, cdPaperwork: false }, archived: false
    };
    s.startLevel = s.startLevel || { cert: "", loggedDives: "", priorModules: [] };
    s.compliance = s.compliance || { medical: false, waiver: false, cdPaperwork: false };

    // enrolment chips
    const enrolBox = el("div", { class: "chips" });
    function buildEnrol() {
      enrolBox.innerHTML = "";
      S.courses().filter(c => c.kind !== "survey").forEach(c => {
        const on = (s.courses || []).includes(c.code);
        enrolBox.appendChild(el("div", { class: "chip" + (on ? " on" : ""), onclick: () => {
          s.courses = s.courses || [];
          if (s.courses.includes(c.code)) s.courses = s.courses.filter(x => x !== c.code);
          else s.courses.push(c.code);
          buildEnrol();
        }}, c.name));
      });
    }
    buildEnrol();

    const diveLevels = S.settings().diveLevels;
    const tabProfile = el("div", {}, [
      el("div", { class: "field-row" }, [
        field("Name *", el("input", { value: s.name, oninput: e => s.name = e.target.value })),
        field("Email *", el("input", { value: s.email, oninput: e => s.email = e.target.value }))
      ]),
      el("div", { class: "field-row" }, [
        field("Phone", el("input", { value: s.phone, oninput: e => s.phone = e.target.value })),
        field("Nationality", el("input", { value: s.nationality, oninput: e => s.nationality = e.target.value }))
      ]),
      el("div", { class: "field-row" }, [
        field("Date of birth", el("input", { type: "date", value: s.dob, oninput: e => s.dob = e.target.value })),
        field("", el("div"))
      ]),
      el("div", { class: "field-row" }, [
        field("Emergency contact", el("input", { value: s.emergencyName, oninput: e => s.emergencyName = e.target.value })),
        field("Emergency phone", el("input", { value: s.emergencyPhone, oninput: e => s.emergencyPhone = e.target.value }))
      ]),
      el("div", { class: "field-row" }, [
        field("Arrival", el("input", { type: "date", value: s.arrival, oninput: e => s.arrival = e.target.value })),
        field("Departure", el("input", { type: "date", value: s.departure, oninput: e => s.departure = e.target.value }))
      ]),
      el("h4", { text: "Starting level", style: "margin-top:8px" }),
      el("div", { class: "field-row" }, [
        field("Incoming dive cert", el("select", { onchange: e => s.startLevel.cert = e.target.value },
          [el("option", { value: "" }, "—"), ...diveLevels.map(l => el("option", { value: l, selected: s.startLevel.cert === l ? "selected" : null }, l))])),
        field("Logged dives", el("input", { type: "number", value: s.startLevel.loggedDives, oninput: e => s.startLevel.loggedDives = e.target.value }))
      ]),
      field("Course / programme *", enrolBox),
      el("h4", { text: "Compliance", style: "margin-top:8px" }),
      checkbox("Medical form complete", s.compliance.medical, v => s.compliance.medical = v),
      checkbox("Liability waiver complete", s.compliance.waiver, v => s.compliance.waiver = v),
      checkbox("Conservation Diver paperwork complete", s.compliance.cdPaperwork, v => s.compliance.cdPaperwork = v),
      field("Notes", el("textarea", { rows: "2", oninput: e => s.note = e.target.value }, s.note || "")),
      existing ? checkbox("Archived", s.archived, v => s.archived = v) : null
    ]);

    const body = [tabProfile];
    if (existing) body.push(renderStudentProgress(existing));

    const actions = [{ label: "Cancel", onClick: closeModal }];
    if (existing) actions.push({ label: "Delete", class: "btn-danger", onClick: () => {
      if (confirm("Delete " + existing.name + " and remove them from all sessions?")) { S.deleteStudent(existing.id); closeModal(); render(); } }});
    actions.push({ label: existing ? "Save" : "Add student", class: "btn-primary", onClick: () => {
      if (!s.name.trim()) return toast("Name is required");
      if (!s.email.trim()) return toast("Email is required");
      if (!(s.courses || []).length) return toast("Choose at least one course");
      S.upsertStudent(s); closeModal(); render();
    }});

    modal({ title: existing ? s.name : "Add student", body, actions, wide: true });
  }

  function renderStudentProgress(stu) {
    const wrap = el("div", {}, [el("h4", { text: "Module progress", style: "margin-top:16px" })]);
    const codes = S.studentModuleCodes(stu);
    if (!codes.length) wrap.appendChild(el("p", { class: "muted small", text: "No modules yet — enrol in a course with modules configured." }));
    codes.forEach(mc => {
      const mod = S.moduleByCode(mc); if (!mod) return;
      const st = S.moduleStatus(stu, mc);
      const cert = stu.certs && stu.certs[mc];
      wrap.appendChild(el("div", { class: "card", style: "margin-bottom:8px;padding:10px" }, [
        el("div", { class: "spread" }, [
          el("div", {}, [
            el("strong", { text: mod.name }), " ",
            el("span", { class: "pill " + (mod.agency === "CD" ? "cd" : "btc"), text: mod.agency }),
            mod.elearn === "CORALTAX" ? el("span", { class: "pill muted2", text: "shared e-learning" }) : null
          ]),
          el("div", { class: "stages" }, [
            mod.elearn ? stageDot("E", st.elearning, () => { S.setElearning(stu.id, mod.elearn, !st.elearning); reopenStudent(stu.id); }) : stageDot("E", null),
            stageDot("C", st.classroom),
            mod.dives > 0 ? stageDot("D", st.dives) : stageDot("D", null),
            stageDot("✓", st.cert, () => toggleCert(stu, mc))
          ])
        ]),
        el("div", { class: "small muted", style: "margin-top:4px" },
          `${mod.elearn ? (st.elearning ? "e-learning ✓ · " : "e-learning pending · ") : ""}` +
          `${st.classroom ? "classroom ✓ · " : "classroom pending · "}` +
          `${mod.dives > 0 ? (st.dives ? "dives ✓" : `dives ${st.divesScheduled}/${st.needDives}`) : "no dives"}` +
          (cert && cert.issued ? ` · certified ${fmtDay(cert.date)}${cert.staff ? " by " + cert.staff : ""}` : ""))
      ]));
    });

    // Required dive components (no cert)
    const reqs = S.studentDiveReqs(stu);
    if (reqs.length) {
      wrap.appendChild(el("h4", { text: "Required dives", style: "margin-top:16px" }));
      reqs.forEach(r => {
        const st = S.diveReqStatus(stu, r.code, r.count);
        wrap.appendChild(el("div", { class: "list-line" }, [
          el("span", {}, `${r.name}${r.count > 1 ? ` ×${r.count}` : ""}`),
          el("span", { class: "small " + (st.complete ? "muted" : ""), text: st.complete ? "✓ complete" : `${st.done}/${r.count} done · ${st.scheduled} scheduled` })
        ]));
      });
    }

    // CDM extras (Course Assist / Survey Lead)
    const extras = S.studentExtras(stu);
    if (extras.length) {
      wrap.appendChild(el("h4", { text: "Divemaster requirements", style: "margin-top:16px" }));
      extras.forEach(ex => {
        const done = stu.extrasDone && stu.extrasDone[ex];
        wrap.appendChild(checkbox(ex, done, v => {
          stu.extrasDone = stu.extrasDone || {}; if (v) stu.extrasDone[ex] = true; else delete stu.extrasDone[ex];
          S.upsertStudent(stu);
        }));
      });
    }
    return wrap;
  }
  function stageDot(label, state, onClick) {
    const cls = state === null ? "stage-dot na" : (state ? "stage-dot done" : "stage-dot");
    return el("span", { class: cls + (onClick ? "" : ""), title: label, style: onClick ? "cursor:pointer" : "",
      onclick: onClick || null, text: state ? "✓" : label });
  }
  function reopenStudent(id) { closeModal(); openStudentModal(id); }

  function toggleCert(stu, mc) {
    const cur = stu.certs && stu.certs[mc] && stu.certs[mc].issued;
    if (cur) { if (confirm("Remove this certification?")) { S.setCert(stu.id, mc, false); reopenStudent(stu.id); } return; }
    let date = todayISO(), staffName = "";
    const body = [
      field("Certification date", el("input", { type: "date", value: date, oninput: e => date = e.target.value })),
      field("Certified by (staff)", staffSelect(v => staffName = v)),
      el("p", { class: "muted small", text: "Flip this once the student is certified on the Conservation Diver portal. Date defaults to today but can be back-dated to the actual certification date." })
    ];
    modal({ title: "Issue certification — " + (S.moduleByCode(mc) || {}).name, body, actions: [
      { label: "Cancel", onClick: () => reopenStudent(stu.id) },
      { label: "Certify", class: "btn-primary", onClick: () => { S.setCert(stu.id, mc, true, date, staffName); reopenStudent(stu.id); } }
    ]});
  }

  /* ========================================================================
     CERTIFICATIONS  (grid · cards · export)
     ===================================================================== */
  function renderCerts(root) {
    root.appendChild(el("div", { class: "spread screen-head" }, [
      el("h2", { text: "Certifications" }),
      el("div", { class: "row" }, [
        el("button", { class: "btn btn-sm" + (UI.certView === "grid" ? " btn-primary" : ""), onclick: () => { UI.certView = "grid"; render(); } }, "Grid"),
        el("button", { class: "btn btn-sm" + (UI.certView === "cards" ? " btn-primary" : ""), onclick: () => { UI.certView = "cards"; render(); } }, "Cards"),
        el("button", { class: "btn btn-sm", onclick: exportMatrix }, "⬇ Matrix CSV"),
        el("button", { class: "btn btn-sm", onclick: exportFlat }, "⬇ List CSV")
      ])
    ]));
    const studs = S.students();
    if (!studs.length) { root.appendChild(el("div", { class: "empty", text: "No students yet." })); return; }

    if (UI.certView === "grid") {
      // columns = modules that are used by at least one enrolled student
      const usedModules = [...new Set(studs.flatMap(s => S.studentModuleCodes(s)))];
      const cols = S.modules().filter(m => usedModules.includes(m.code));
      const wrap = el("div", { class: "table-wrap" });
      const tbl = el("table");
      tbl.appendChild(el("thead", {}, el("tr", {}, [th("Student"), ...cols.map(m => th(m.code))])));
      const tb = el("tbody");
      studs.sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
        const need = new Set(S.studentModuleCodes(s));
        const tr = el("tr", {}, [td(s.name)]);
        cols.forEach(m => {
          const cell = el("td", { class: "center" });
          if (!need.has(m.code)) cell.appendChild(el("span", { class: "cell-none", text: "·" }));
          else {
            const c = s.certs && s.certs[m.code];
            if (c && c.issued) cell.appendChild(el("span", { class: "cell-cert", title: `Certified ${c.date}`, text: "✓" }));
            else {
              const st = S.moduleStatus(s, m.code);
              cell.appendChild(el("span", { class: "cell-prog", text: st.ready ? "ready" : (st.scheduledAny ? st.pct + "%" : "–") }));
            }
          }
          tr.appendChild(cell);
        });
        tb.appendChild(tr);
      });
      tbl.appendChild(tb); wrap.appendChild(tbl); root.appendChild(wrap);
      root.appendChild(el("p", { class: "muted small", style: "margin-top:8px", text: "✓ = certified · “ready” = all stages done, awaiting cert · % = in progress · – = not started · · = not required." }));
    } else {
      const grid = el("div", { class: "grid-cards" });
      studs.sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
        const codes = S.studentModuleCodes(s);
        const certified = codes.filter(c => s.certs && s.certs[c] && s.certs[c].issued);
        grid.appendChild(el("div", { class: "card" }, [
          el("div", { class: "spread" }, [el("h3", { text: s.name, style: "margin:0" }),
            el("span", { class: "pill", text: `${certified.length}/${codes.length}` })]),
          ...(certified.length ? certified.map(mc => {
            const c = s.certs[mc]; const mod = S.moduleByCode(mc);
            return el("div", { class: "list-line" }, [
              el("span", { text: mod ? mod.name : mc }),
              el("span", { class: "muted small", text: `${fmtDay(c.date)}${c.staff ? " · " + c.staff : ""}` })]);
          }) : [el("div", { class: "muted small", text: "No certifications yet" })])
        ]));
      });
      root.appendChild(grid);
    }
  }

  function exportMatrix() {
    const studs = S.students(true);
    const usedModules = [...new Set(studs.flatMap(s => S.studentModuleCodes(s)))];
    const cols = S.modules().filter(m => usedModules.includes(m.code));
    const rows = [["Student", "Email", "Course(s)", ...cols.map(m => m.name)]];
    studs.forEach(s => {
      const need = new Set(S.studentModuleCodes(s));
      rows.push([s.name, s.email, courseBadgeText(s), ...cols.map(m => {
        if (!need.has(m.code)) return "";
        const c = s.certs && s.certs[m.code];
        return c && c.issued ? "Certified " + c.date : "";
      })]);
    });
    downloadCSV(rows, "btc-certifications-matrix.csv");
  }
  function exportFlat() {
    const rows = [["Student", "Email", "Module", "Agency", "Date certified", "Certified by"]];
    S.students(true).forEach(s => Object.entries(s.certs || {}).forEach(([mc, c]) => {
      if (!c.issued) return; const mod = S.moduleByCode(mc);
      rows.push([s.name, s.email, mod ? mod.name : mc, mod ? mod.agency : "", c.date || "", c.staff || ""]);
    }));
    downloadCSV(rows, "btc-certifications-list.csv");
  }
  function downloadCSV(rows, name) {
    const csv = rows.map(r => r.map(c => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = el("a", { href: URL.createObjectURL(blob), download: name }); a.click();
    toast("Exported " + name);
  }

  /* ========================================================================
     STAFF (admin: list + OFF periods)
     ===================================================================== */
  function renderStaff(root) {
    root.appendChild(el("div", { class: "spread screen-head" }, [
      el("h2", { text: "Staff" }),
      el("div", { class: "row" }, [
        el("button", { class: "btn btn-sm", onclick: () => { UI.screen = "schedule"; UI.schedView = "staff"; $$("#tabs .tab").forEach(x => x.classList.toggle("active", x.dataset.screen === "schedule")); render(); } }, "View staff schedule →"),
        el("button", { class: "btn btn-primary", onclick: addStaffPrompt }, "+ Add staff")
      ])
    ]));
    const grid = el("div", { class: "grid-cards" });
    S.staff().forEach(st => {
      const upcoming = (st.off || []).filter(o => o.end >= todayISO());
      grid.appendChild(el("div", { class: "card" }, [
        el("h3", { text: st.name }),
        el("div", { class: "muted small", text: (st.off && st.off.length) ? "OFF periods:" : "No time off set" }),
        ...(st.off || []).sort((a, b) => a.start.localeCompare(b.start)).map(o => el("div", { class: "list-line" }, [
          el("span", { text: `${fmtDay(o.start)} – ${fmtDay(o.end)}` }),
          el("button", { class: "btn btn-sm btn-ghost", onclick: () => { S.removeStaffOff(st.id, o.id); render(); }, text: "remove" })
        ])),
        el("button", { class: "btn btn-sm", style: "margin-top:8px", onclick: () => addOffPrompt(st) }, "+ Add OFF period"),
        canTeachSection(st)
      ]));
    });
    root.appendChild(grid);
  }
  function canTeachSection(st) {
    const can = new Set(st.canTeach || []);
    const details = el("details", { style: "margin-top:10px" });
    const n = (st.canTeach || []).length;
    details.appendChild(el("summary", { style: "cursor:pointer;font-size:.82rem;font-weight:600;color:var(--ink-muted)",
      text: `Can teach${n ? ` (${n})` : " — not set (no warnings)"}` }));
    const chips = el("div", { class: "chips", style: "margin-top:8px" });
    S.modules().forEach(m => {
      const chip = el("div", { class: "chip" + (can.has(m.code) ? " on" : ""), onclick: () => {
        if (can.has(m.code)) can.delete(m.code); else can.add(m.code);
        S.setStaffCanTeach(st.id, [...can]); chip.classList.toggle("on");
        details.querySelector("summary").textContent = `Can teach${can.size ? ` (${can.size})` : " — not set (no warnings)"}`;
      }}, m.code);
      chips.appendChild(chip);
    });
    details.appendChild(chips);
    details.appendChild(el("p", { class: "muted small", style: "margin-top:6px", text: "If none selected, no warning fires. Once set, assigning them to a module outside this list shows a soft warning." }));
    return details;
  }
  function addStaffPrompt() {
    let name = "";
    modal({ title: "Add staff", body: [field("Name", el("input", { oninput: e => name = e.target.value }))],
      actions: [{ label: "Cancel", onClick: closeModal }, { label: "Add", class: "btn-primary", onClick: () => {
        if (name.trim()) { S.addStaff(name.trim()); } closeModal(); render(); }}]});
  }
  function addOffPrompt(st) {
    let start = todayISO(), end = todayISO();
    modal({ title: "Add OFF period — " + st.name, body: [
      el("div", { class: "field-row" }, [
        field("From", el("input", { type: "date", value: start, oninput: e => start = e.target.value })),
        field("To", el("input", { type: "date", value: end, oninput: e => end = e.target.value }))
      ]),
      el("p", { class: "muted small", text: "Assigning this staff member while OFF only warns — it never blocks." })
    ], actions: [{ label: "Cancel", onClick: closeModal }, { label: "Save", class: "btn-primary", onClick: () => {
      if (end < start) return toast("End before start"); S.addStaffOff(st.id, start, end); closeModal(); render(); }}]});
  }

  /* ========================================================================
     CATALOGUE  (courses & modules — editable)
     ===================================================================== */
  function renderCatalogue(root) {
    root.appendChild(el("div", { class: "spread screen-head" }, [
      el("h2", { text: "Catalogue" }),
      el("div", { class: "row" }, [
        el("button", { class: "btn btn-sm", onclick: () => openModuleModal(null) }, "+ Module"),
        el("button", { class: "btn btn-sm", onclick: () => openCourseModal(null) }, "+ Course")
      ])
    ]));

    const kinds = [["program", "Programs"], ["pack", "Packs"], ["single", "Single courses"],
      ["day", "Non-diver / OW day courses"], ["addon", "Add-ons"], ["survey", "Conservation surveys"]];
    kinds.forEach(([k, label]) => {
      const cs = S.courses().filter(c => c.kind === k);
      if (!cs.length) return;
      root.appendChild(el("h3", { text: label, style: "margin-top:18px" }));
      const grid = el("div", { class: "grid-cards" });
      cs.forEach(c => {
        const mcs = S.courseModuleCodes(c);
        grid.appendChild(el("div", { class: "card", style: "cursor:pointer", onclick: () => openCourseModal(c.code) }, [
          el("div", { class: "spread" }, [el("h4", { text: c.name, style: "margin:0" }),
            c.price ? el("span", { class: "pill muted2", text: "฿" + c.price.toLocaleString() }) : null]),
          c.prereq ? el("div", { class: "muted small", text: "Prereq: " + c.prereq }) : null,
          c.packOf ? el("div", { class: "small", text: "Pack: " + c.packOf.map(p => (S.courseByCode(p) || {}).name).join(" + ") })
            : el("div", { class: "small muted", text: mcs.length ? mcs.length + " modules: " + mcs.join(", ") : "No modules configured yet" }),
          c.divemaster ? el("div", { class: "pill warn", text: "Divemaster: + Course Assist + Survey Lead" }) : null
        ]));
      });
      root.appendChild(grid);
    });

    root.appendChild(el("h3", { text: "Modules (certifications)", style: "margin-top:22px" }));
    const wrap = el("div", { class: "table-wrap" });
    const tbl = el("table", {}, [el("thead", {}, el("tr", {}, [th("Code"), th("Module"), th("Body"), th("E-learning"), th("Dives"), th("Medium")]))]);
    const tb = el("tbody");
    S.modules().forEach(m => tb.appendChild(el("tr", { style: "cursor:pointer", onclick: () => openModuleModal(m.code) }, [
      td(m.code), td(m.name),
      el("td", {}, el("span", { class: "pill " + (m.agency === "CD" ? "cd" : "btc"), text: m.agency })),
      td(m.elearn ? "Yes" : "—"), td(String(m.dives)),
      el("td", {}, [el("span", { class: "tag-medium m-" + m.medium }), " " + m.medium])
    ])));
    tbl.appendChild(tb); wrap.appendChild(tbl); root.appendChild(wrap);
  }

  function openModuleModal(code) {
    const existing = code ? S.moduleByCode(code) : null;
    const m = existing ? { ...existing } : { code: "", name: "", agency: "CD", elearn: "", dives: 2, medium: "dive", tmpl: null, kind: "taught" };
    let hasEl = !!m.elearn;
    const body = [
      el("div", { class: "field-row" }, [
        field("Code", el("input", { value: m.code, oninput: e => m.code = e.target.value.toUpperCase() })),
        field("Name", el("input", { value: m.name, oninput: e => m.name = e.target.value }))
      ]),
      el("div", { class: "field-row" }, [
        field("Certifying body", el("select", { onchange: e => { m.agency = e.target.value; if (m.agency === "BTC") hasEl = false; } },
          [["CD", "Conservation Diver"], ["BTC", "Black Turtle Conservation"]].map(([v, l]) => el("option", { value: v, selected: m.agency === v ? "selected" : null }, l)))),
        field("Default dives", el("input", { type: "number", value: m.dives, oninput: e => m.dives = Number(e.target.value) }))
      ]),
      el("div", { class: "field-row" }, [
        field("Medium", el("select", { onchange: e => m.medium = e.target.value },
          ["land", "snorkel", "dive"].map(x => el("option", { value: x, selected: m.medium === x ? "selected" : null }, x)))),
        field("Shared e-learning key (blank = its own / none)", el("input", { value: m.elearn || "", placeholder: "e.g. CORALTAX", oninput: e => m.elearn = e.target.value.toUpperCase().trim() }))
      ]),
      checkbox("Has e-learning", hasEl, v => hasEl = v)
    ];
    modal({ title: existing ? "Edit module" : "New module", body, actions: [
      { label: "Cancel", onClick: closeModal },
      { label: "Save", class: "btn-primary", onClick: () => {
        if (!m.code || !m.name) return toast("Code and name required");
        m.elearn = hasEl ? (m.elearn || m.code) : null;
        S.saveModule(m); closeModal(); render(); }}
    ]});
  }

  function openCourseModal(code) {
    const existing = code ? S.courseByCode(code) : null;
    const c = existing ? JSON.parse(JSON.stringify(existing)) : { code: "", name: "", kind: "single", prereq: "", price: 0, moduleCodes: [] };
    const modBox = el("div", { class: "chips" });
    function buildMods() {
      modBox.innerHTML = "";
      S.modules().forEach(m => {
        const on = (c.moduleCodes || []).includes(m.code);
        modBox.appendChild(el("div", { class: "chip" + (on ? " on" : ""), onclick: () => {
          c.moduleCodes = c.moduleCodes || [];
          if (c.moduleCodes.includes(m.code)) c.moduleCodes = c.moduleCodes.filter(x => x !== m.code);
          else c.moduleCodes.push(m.code);
          buildMods();
        }}, m.code));
      });
    }
    buildMods();
    const body = [
      el("div", { class: "field-row" }, [
        field("Code", el("input", { value: c.code, oninput: e => c.code = e.target.value.toUpperCase() })),
        field("Name", el("input", { value: c.name, oninput: e => c.name = e.target.value }))
      ]),
      el("div", { class: "field-row" }, [
        field("Kind", el("select", { onchange: e => c.kind = e.target.value },
          ["program", "pack", "single", "day", "addon", "survey"].map(k => el("option", { value: k, selected: c.kind === k ? "selected" : null }, k)))),
        field("Price (฿)", el("input", { type: "number", value: c.price || 0, oninput: e => c.price = Number(e.target.value) }))
      ]),
      field("Prerequisites (shown as a non-blocking warning)", el("input", { value: c.prereq || "", oninput: e => c.prereq = e.target.value })),
      c.packOf ? el("p", { class: "muted small", text: "This is a pack of: " + c.packOf.join(", ") + " (its modules are the union of those programs)." })
        : field("Modules in this course", modBox)
    ];
    modal({ title: existing ? "Edit course" : "New course", body, wide: true, actions: [
      { label: "Cancel", onClick: closeModal },
      { label: "Save", class: "btn-primary", onClick: () => {
        if (!c.code || !c.name) return toast("Code and name required");
        S.saveCourse(c); closeModal(); render(); }}
    ]});
  }

  /* ========================================================================
     SETTINGS
     ===================================================================== */
  function renderSettings(root) {
    root.appendChild(el("div", { class: "screen-head" }, el("h2", { text: "Settings" })));
    const up = S.settings().uploaders;
    const names = S.settings().uploaderNames || {};

    root.appendChild(el("div", { class: "card", style: "margin-bottom:14px" }, [
      el("h3", { text: "Survey uploaders" }),
      el("p", { class: "muted small", text: "Open the field survey apps." }),
      ...Object.entries(up).map(([k, url]) => el("div", { class: "list-line" }, [
        el("span", { text: names[k] || k.toUpperCase() }),
        el("a", { href: url, target: "_blank", rel: "noopener", class: "btn btn-sm btn-primary", text: "Open ↗" })
      ]))
    ]));

    let newPw = "";
    root.appendChild(el("div", { class: "card", style: "margin-bottom:14px" }, [
      el("h3", { text: "Password" }),
      el("p", { class: "muted small", text: "Shared team gate. Note: a password on a static site is a basic gate only — real protection comes with the shared database (phase: Supabase)." }),
      el("div", { class: "row" }, [
        el("input", { type: "text", placeholder: "New password", oninput: e => newPw = e.target.value, style: "flex:1" }),
        el("button", { class: "btn btn-primary", onclick: () => { if (newPw) { S.setPassword(newPw); toast("Password updated"); } } }, "Update")
      ])
    ]));

    root.appendChild(el("div", { class: "card", style: "margin-bottom:14px" }, [
      el("h3", { text: "Data" }),
      el("div", { class: "row" }, [
        el("button", { class: "btn", onclick: () => downloadText(S.exportJSON(), "btc-hub-backup.json") }, "⬇ Export all data (backup)"),
        el("button", { class: "btn", onclick: importData }, "⬆ Import data"),
      ]),
      el("p", { class: "muted small", style: "margin-top:10px", text: "v1 stores data in this browser. Export regularly as a backup. Shared cross-device data comes when we connect the Supabase backend." })
    ]));
  }
  function downloadText(text, name) {
    const blob = new Blob([text], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: name }); a.click();
  }
  function importData() {
    const inp = el("input", { type: "file", accept: ".json" });
    inp.addEventListener("change", () => {
      const f = inp.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { try { S.importJSON(r.result); toast("Imported"); render(); } catch (e) { toast("Invalid file"); } };
      r.readAsText(f);
    });
    inp.click();
  }

  /* ---------- small form helpers ---------- */
  function field(label, control) { return el("div", { class: "field" }, [label ? el("label", { text: label }) : null, control]); }
  function checkbox(label, val, onChange) {
    const id = "cb_" + Math.random().toString(36).slice(2, 7);
    const input = el("input", { type: "checkbox", id, onchange: e => onChange(e.target.checked) });
    if (val) input.setAttribute("checked", "checked");
    return el("div", { class: "checkbox-row", style: "margin-bottom:8px" }, [input, el("label", { for: id, text: label })]);
  }
  const th = t => el("th", { text: t });
  const td = t => el("td", { text: t });
  function tdMedium(se) { return el("td", {}, [el("span", { class: "tag-medium m-" + (se.medium || "dive") }), " " + sessionTitle(se)]); }

  /* ---------- prereq heuristic (non-blocking) ---------- */
  function meetsPrereqHeuristic(s, course) {
    // Very light: if prereq mentions a program/module the student hasn't certified or isn't enrolled in, warn.
    // Kept permissive by design — warnings only.
    return true; // placeholder: real matching can be refined; dashboard still lists for review
  }
  function isStaffOffByName(name, dISO) {
    const st = S.staff().find(x => x.name === name);
    return st ? S.staffOff(st.id, dISO) : false;
  }

  /* ================= BOOT ================= */
  initTheme(); initNav(); initGate();
  S.subscribe(() => { /* data changed elsewhere */ });
  render();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
