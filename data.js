/* ============================================================================
   BTC Marine Conservation Hub — Seed Catalogue  (v4)
   ----------------------------------------------------------------------------
   Starting data only. After first run the live copy is edited in-app (Catalogue).

   MODULES are reusable certifications (taught: e-learning + classroom + dives + cert).
   DIVE COMPONENTS are dive-only items (2 dives/one boat, no cert/classroom/e-learning).
   PROGRAMMES stack: each stacksOn the one below, so booking a higher programme pulls
   in the whole chain; modules the student already holds show complete and aren't re-run.

   module.agency : "CD" (Conservation Diver, has e-learning) | "BTC" (no e-learning)
   module.elearn : shared e-learning key (Coral Tax I/II/III/Review share "CORALTAX");
                   null for BTC modules.
   module.tmpl   : scheduling template key (see TEMPLATES); null = STANDARD.
   module.medium : land | snorkel | dive  (session colour)
   ========================================================================== */

const SEED = {
  version: 5,

  // --- TAUGHT MODULES (certifications) -------------------------------------
  // code, name, agency, elearnKey, medium, dives, tmpl, singlePrice(฿), noSingle?
  // singlePrice = price when sold as a standalone single course.
  // noSingle = true → not sold on its own (only inside programmes).
  modules: [
    ["EMP",      "Ecological Monitoring Program",            "CD",  "EMP",      "dive", 6, "EMP", 11900],
    ["CTAX1",    "Coral Tax I",                              "CD",  "CORALTAX", "dive", 2, null, 6000],
    ["CTAX2",    "Coral Tax II",                             "CD",  "CORALTAX", "dive", 2, null, 6000],
    ["CTAX3",    "Coral Tax III",                            "CD",  "CORALTAX", "dive", 2, null, 6000],
    ["CTAXR",    "Coral Tax Review",                         "CD",  "CORALTAX", "dive", 2, null, 0, true],
    ["RESTO",    "Coral Restoration",                        "CD",  "RESTO",    "dive", 2, null, 8000],
    ["AR",       "Artificial Reefs",                         "CD",  "AR",       "dive", 2, "AR", 6000],
    ["SHARK",    "Shark Ecology",                            "CD",  "SHARK",    "dive", 2, null, 6000],
    ["GIANTCLAM","Giant Clam Ecology",                       "CD",  "GIANTCLAM","dive", 2, null, 6000],
    ["ADVEMP",   "Advanced EMP",                             "CD",  "ADVEMP",   "dive", 2, null, 6000],
    ["DISEA",    "Coral Disease",                            "CD",  "DISEA",    "dive", 2, null, 6000],
    ["IMAGEJ",   "Image J",                                  "CD",  "IMAGEJ",   "dive", 2, null, 6000],
    ["NUDI",     "Nudibranch Ecology & ID",                  "CD",  "NUDI",     "dive", 2, null, 6000],
    ["MAD",      "Mineral Accretion Device",                 "CD",  "MAD",      "dive", 2, null, 6000],
    ["SH",       "Sea Horse Ecology & Population Studies",   "CD",  "SH",       "dive", 2, null, 6000],
    ["CITSCI",   "Citizen Science",                          "CD",  "CITSCI",   "dive", 2, null, 9900],
    ["TURTLE",   "Sea Turtle Ecology & Population Studies",  "CD",  "TURTLE",   "snorkel", 0, null, 6000],
    // BTC-certified (no e-learning)
    ["SLUG",     "Sea Slugs",                                "BTC", null,       "dive", 2, null, 6000],
    ["MPOL",     "Marine Pollution",                         "BTC", null,       "dive", 2, null, 6000],
    ["PRED",     "Coral Predators",                          "BTC", null,       "dive", 2, null, 6000],
    ["CLEAN",    "Cleaning Stations",                        "BTC", null,       "dive", 2, "CLEAN", 6000],
    ["PLAST",    "Plastic Pollution: Monitoring & Assessment","BTC", null,      "land", 0, null, 6000]
  ],

  // --- BUNDLES (a course that packages several modules at a set price) ------
  bundles: [
    { code:"ADVTAX", name:"Advanced Coral Taxonomy (Coral Tax II + III)", price:10000,
      moduleCodes:["CTAX2","CTAX3"], prereq:"AOW + EMP + Coral Taxonomy" }
  ],

  // --- DIVE-ONLY COMPONENTS (no cert; 2 dives / one boat) ------------------
  diveComponents: [
    ["ASSESS",   "Assessment Dives",     "dive", 2],
    ["INDPROJ",  "Independent Project",  "dive", 2],
    ["EMPDIVE",  "EMP Dive",             "dive", 2],
    ["RESDIVE",  "Research Dives",       "dive", 2],
    ["NIGHTRES", "Night Research Dive",  "dive", 2]
  ],

  // --- PROGRAMMES (stacking ladder) ---------------------------------------
  // modules = taught modules this level ADDS; diveComps = dive components it ADDS
  // (diveComps may repeat a key = that many separate 2-dive requirements).
  programs: [
    { code:"CC",  name:"Core Conservationist",    stacksOn:null, weeks:1, price:19900,
      modules:["EMP","CTAX1"], diveComps:["ASSESS"] },
    { code:"CS",  name:"Conservation Specialist",  stacksOn:"CC", weeks:2, price:33000,
      modules:["CTAX2","SLUG"], diveComps:["INDPROJ"] },
    { code:"RS",  name:"Reef Specialist",          stacksOn:"CS", weeks:2, price:30000,
      modules:["MPOL","CTAX3","CTAXR","AR","RESTO"], diveComps:["EMPDIVE"] },
    { code:"MC",  name:"Master Conservationist",   stacksOn:"RS", weeks:2, price:30000,
      modules:["SHARK","GIANTCLAM","PRED","CLEAN"], diveComps:["EMPDIVE","RESDIVE"] },
    { code:"SD",  name:"Scientific Diver",         stacksOn:"MC", weeks:2, price:30000,
      modules:["ADVEMP","DISEA","IMAGEJ"], diveComps:["RESDIVE","RESDIVE","EMPDIVE","NIGHTRES"] },
    { code:"CDM", name:"Conservation Divemaster",  stacksOn:"CS", weeks:4, price:96900,
      modules:[], diveComps:[], extras:["Course Assist","Survey Lead"] }
  ],

  // --- PACKS (bundles of programmes) --------------------------------------
  packs: [
    { code:"PK2", name:"Conservation Specialist + Reef Specialist", weeks:4, price:60000,
      prereq:"AOW + book in advance", packOf:["RS"] },
    { code:"PK3", name:"CS + RS + Master Conservationist", weeks:6, price:88000,
      prereq:"AOW + book in advance", packOf:["MC"] },
    { code:"PK4", name:"CS + RS + MC + Scientific Diver", weeks:8, price:115000,
      prereq:"AOW + book in advance", packOf:["SD"] }
  ],

  // --- DAY COURSES (non-diver / OW) ---------------------------------------
  dayCourses: [
    { code:"D_SHARK", name:"Shark Ecology & Population Studies", moduleCode:"SHARK", price:6000 },
    { code:"D_TURTLE",name:"Sea Turtle Ecology & Population Studies", moduleCode:"TURTLE", price:6000 },
    { code:"D_PLAST", name:"Plastic Pollution: Monitoring & Assessment", moduleCode:"PLAST", price:6000 }
  ],

  // --- RESEARCH ASSISTANT (flexible 2-week add-on) ------------------------
  addons: [
    { code:"RA", name:"Research Assistant (2 weeks)", weeks:2, price:12000, flexible:true }
  ],

  // --- CONSERVATION SURVEYS (staff-only outings) --------------------------
  surveys: [
    { code:"SV_SHARK", name:"Shark Survey — Snorkel", medium:"snorkel", uploader:"shark", price:600 },
    { code:"SV_TURTLE",name:"Turtle Survey — Snorkel", medium:"snorkel", uploader:"turtle", price:600 },
    { code:"SV_SLUG",  name:"Sea Slug Survey — 2 dives", medium:"dive", uploader:"slug", price:2200 },
    { code:"SV_COTS",  name:"Crown of Thorns Survey — 2 dives", medium:"dive", uploader:"cots", price:2200 }
  ],

  /* --- SCHEDULING TEMPLATES ------------------------------------------------
     Each row: {day, type:"lecture"|"dive"|"land", name, start, end, block}
     `day` = offset from the chosen start date. `block` groups dives that share
     one boat/outing (the "same info for both" default). STANDARD is used by any
     module with tmpl:null. AR has a programme-only Day 2 plus a Day-1 option. */
  templates: {
    STANDARD: [
      { day:0, type:"lecture", name:"Lecture",  start:"09:00", end:"10:30" },
      { day:0, type:"dive",    name:"Dive 1",   start:"12:00", end:"17:00", block:1 },
      { day:0, type:"dive",    name:"Dive 2",   start:"12:00", end:"17:00", block:1 }
    ],
    EMP: [
      { day:0, type:"lecture", name:"Marine Ecology Lecture", start:"13:00", end:"15:00" },
      { day:0, type:"lecture", name:"Invertebrate Lecture",   start:"15:00", end:"17:00" },
      { day:1, type:"lecture", name:"Chordate Lecture",       start:"09:00", end:"10:30" },
      { day:1, type:"dive",    name:"Dive 1: Fluid Mechanics", start:"12:00", end:"17:00", block:1 },
      { day:1, type:"dive",    name:"Dive 2: Reef Safari",     start:"12:00", end:"17:00", block:1 },
      { day:2, type:"dive",    name:"Dive 3: Chordate Survey", start:"12:00", end:"17:00", block:2 },
      { day:2, type:"dive",    name:"Dive 4: Invertebrate Survey", start:"12:00", end:"17:00", block:2 },
      { day:3, type:"lecture", name:"Substrate Lecture",       start:"09:00", end:"10:30" },
      { day:3, type:"dive",    name:"Dive 5: Substrate Survey", start:"12:00", end:"17:00", block:3 },
      { day:3, type:"dive",    name:"Dive 6: Survey Dive",      start:"12:00", end:"17:00", block:3 }
    ],
    CLEAN: [
      { day:0, type:"lecture", name:"Cleaning Stations Lecture", start:"13:00", end:"14:30" },
      { day:1, type:"dive",    name:"Cleaning Stations Dive 1",  start:"07:00", end:"11:00", block:1 },
      { day:1, type:"dive",    name:"Cleaning Stations Dive 2",  start:"07:00", end:"11:00", block:1 }
    ],
    // Artificial Reefs — programme layout. Day-1 afternoon is an OPTION chosen at
    // schedule time; Day-2 morning dives only appear in the programme version.
    AR: [
      { day:0, type:"lecture", name:"Artificial Reefs Lecture", start:"09:00", end:"10:30" }
    ],
    AR_options: {
      workshop: [{ day:0, type:"land", name:"Workshop Day", start:"12:00", end:"16:00" }],
      dives:    [{ day:0, type:"dive", name:"Artificial Reefs Dive 1", start:"12:00", end:"17:00", block:1 },
                 { day:0, type:"dive", name:"Artificial Reefs Dive 2", start:"12:00", end:"17:00", block:1 }]
    },
    AR_day2: [
      { day:1, type:"dive", name:"Artificial Reefs Dive 1", start:"07:00", end:"11:00", block:2 },
      { day:1, type:"dive", name:"Artificial Reefs Dive 2", start:"07:00", end:"11:00", block:2 }
    ]
  },

  // --- STAFF (flat list) ---------------------------------------------------
  staff: ["Cass", "Seth", "Maisie", "Kelly", "Irene", "C.J.", "Tereza", "Michael"],

  // --- SURVEY UPLOADER LINKS (verified live) -------------------------------
  uploaders: {
    shark:  "https://setmay31.github.io/BTC-Shark-Survey-Uploader/",
    turtle: "https://setmay31.github.io/BTC-Sea-Turtle-Survey-Uploader/",
    emp:    "https://setmay31.github.io/BTC-EMP-Survey-Uploader/",
    cots:   "https://setmay31.github.io/BTC-Crown-of-Thorns-Survey-Uploader/",
    slug:   "https://setmay31.github.io/BTC-Sea-Slug-Survey-Uploader/"
  },
  uploaderNames: {
    shark: "Shark Survey", turtle: "Turtle Survey", emp: "EMP Survey",
    cots: "Crown of Thorns Survey", slug: "Sea Slug Survey"
  },

  diveLevels: ["None / Non-diver", "Open Water", "Advanced Open Water",
               "Rescue Diver", "Divemaster", "Instructor"]
};

if (typeof window !== "undefined") window.SEED = SEED;
