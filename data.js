/* ============================================================================
   BTC Marine Conservation Hub — Seed Catalogue
   ----------------------------------------------------------------------------
   This is the STARTING data only. Once the app has run once, the live copy
   lives in the browser's storage and is edited inside the app (Catalogue tab).
   To re-seed from scratch, use Settings → "Reset catalogue to defaults".

   Modules are reusable certifications. A course is a collection of modules.
   - agency:      "CD"  = Conservation Diver (has e-learning)
                  "BTC" = Black Turtle Conservation certified (NO e-learning)
   - elearning:   whether the "e-Learning Complete" toggle applies
   - dives:       default number of dive sections created with the module
   - medium:      default session medium for colour-coding
                  "land" (light teal) · "snorkel" (light blue) · "dive" (dark teal)
   ========================================================================== */

const SEED = {
  version: 3,

  // --- MODULES (each is its own certification) -----------------------------
  modules: [
    // code,  name,                                              agency, elearning, dives, medium
    ["EMP",   "Ecological Monitoring Program",                   "CD",  true,  4, "dive"],
    ["TAX",   "Coral Taxonomy and Identification",               "CD",  true,  2, "dive"],
    ["PRED",  "Coral Predator: Population Management & Monitoring","BTC", false, 2, "dive"],
    ["RESTO", "Coral Restoration Theory & Techniques",           "CD",  true,  2, "dive"],
    ["AR",    "Artificial Reef Theory & Techniques",             "CD",  true,  2, "dive"],
    ["NUDI",  "Nudibranch Ecology & ID",                         "CD",  true,  2, "dive"],
    ["ADVTAX","Advanced Coral Taxonomy & Identification",        "CD",  true,  2, "dive"],
    ["MAD",   "Mineral Accretion Device Basics & Techniques",    "CD",  true,  2, "dive"],
    ["SH",    "Sea Horse Ecology & Population Studies",          "CD",  true,  2, "dive"],
    ["DISEA", "Coral Diseases & Compromised Health",             "CD",  true,  2, "dive"],
    ["ADVEMP","Advanced EMP Diver",                              "CD",  true,  2, "dive"],
    ["MPOL",  "Marine Pollution",                                "BTC", false, 1, "dive"],
    ["SLUG",  "Sea Slug Ecology & Monitoring",                   "BTC", false, 2, "dive"],
    ["CLEAN", "Cleaning Stations",                               "BTC", false, 2, "dive"],
    ["SHARK", "Shark Ecology & Population Studies",              "CD",  true,  0, "snorkel"],
    ["TURTLE","Sea Turtle Ecology & Population Studies",         "CD",  true,  0, "snorkel"],
    ["PLAST", "Plastic Pollution: Monitoring & Assessment",      "BTC", false, 0, "land"],
    ["CITSCI","Citizen Science",                                 "CD",  true,  2, "dive"]
  ],

  // --- COURSES / PROGRAMS --------------------------------------------------
  // kind: program | pack | single | day | survey | addon
  // moduleCodes: the modules that make up this course (edit in Catalogue)
  // staffOnly: true => scheduled for staff only, no students (surveys)
  // prereq: free text shown as a non-blocking warning reference
  // packOf: for packs, the component program codes
  courses: [
    // PROGRAMS (multi-week)
    { code:"CS",  name:"Conservation Specialist",  kind:"program", weeks:2, price:33000,
      prereq:"AOW", moduleCodes:["EMP","TAX","RESTO","PRED"] },
    { code:"RS",  name:"Reef Specialist",          kind:"program", weeks:2, price:30000,
      prereq:"AOW + Conservation Specialist", moduleCodes:["AR","MAD","DISEA"] },
    { code:"MC",  name:"Master Conservationist",   kind:"program", weeks:2, price:30000,
      prereq:"AOW + Conservation Specialist + Reef Specialist", moduleCodes:["ADVTAX","SH","NUDI"] },
    { code:"SD",  name:"Scientific Diver",         kind:"program", weeks:2, price:30000,
      prereq:"AOW + Conservation Specialist + Reef Specialist + Master Conservationist",
      moduleCodes:["ADVEMP","SLUG","CLEAN"] },
    { code:"CDM", name:"Conservation Divemaster",  kind:"program", weeks:4, price:0,
      prereq:"Scientific Diver", moduleCodes:[], divemaster:true },

    // PACKS (bundles of programs)
    { code:"PK2", name:"Conservation Specialist + Reef Specialist", kind:"pack", weeks:4,
      price:60000, prereq:"AOW + book in advance", packOf:["CS","RS"] },
    { code:"PK3", name:"CS + RS + Master Conservationist", kind:"pack", weeks:6,
      price:88000, prereq:"AOW + book in advance", packOf:["CS","RS","MC"] },
    { code:"PK4", name:"CS + RS + MC + Scientific Diver", kind:"pack", weeks:8,
      price:115000, prereq:"AOW + book in advance", packOf:["CS","RS","MC","SD"] },

    // SINGLE COURSES (each = one module)
    { code:"C_EMP",   name:"Ecological Monitoring Program", kind:"single", days:4, price:11900,
      prereq:"AOW", moduleCodes:["EMP"] },
    { code:"C_TAX",   name:"Coral Taxonomy and Identification", kind:"single", days:1, price:6000,
      prereq:"AOW + EMP", moduleCodes:["TAX"] },
    { code:"C_PRED",  name:"Coral Predator: Population Management & Monitoring", kind:"single", days:1, price:6000,
      prereq:"AOW + EMP", moduleCodes:["PRED"] },
    { code:"C_RESTO", name:"Coral Restoration Theory & Techniques", kind:"single", days:1, price:6000,
      prereq:"AOW + EMP", moduleCodes:["RESTO"] },
    { code:"C_AR",    name:"Artificial Reef Theory & Techniques", kind:"single", days:1, price:6000,
      prereq:"AOW + EMP + Restoration", moduleCodes:["AR"] },
    { code:"C_NUDI",  name:"Nudibranch Ecology & ID", kind:"single", days:1, price:6000,
      prereq:"AOW + EMP", moduleCodes:["NUDI"] },
    { code:"C_ADVTAX",name:"Advanced Coral Taxonomy & Identification", kind:"single", days:2, price:12000,
      prereq:"AOW + EMP + Taxonomy", moduleCodes:["ADVTAX"] },
    { code:"C_MAD",   name:"Mineral Accretion Device Basics & Techniques", kind:"single", days:1, price:6000,
      prereq:"AOW + EMP + Restoration", moduleCodes:["MAD"] },
    { code:"C_SH",    name:"Sea Horse Ecology & Population Studies", kind:"single", days:1, price:6000,
      prereq:"AOW + EMP", moduleCodes:["SH"] },
    { code:"C_DISEA", name:"Coral Diseases & Compromised Health", kind:"single", days:1, price:6000,
      prereq:"AOW + EMP + Taxonomy", moduleCodes:["DISEA"] },
    { code:"C_ADVEMP",name:"Advanced EMP Diver", kind:"single", days:1, price:6000,
      prereq:"AOW + EMP + Tax + Disease + 3 monitoring courses", moduleCodes:["ADVEMP"] },
    { code:"C_CITSCI",name:"Citizen Science", kind:"single", days:1, price:6000,
      prereq:"", moduleCodes:["CITSCI"] },

    // NON-DIVER / OPEN WATER DAY COURSES
    { code:"D_SHARK", name:"Shark Ecology & Population Studies", kind:"day", days:1, price:6000,
      prereq:"", moduleCodes:["SHARK"] },
    { code:"D_TURTLE",name:"Sea Turtle Ecology & Population Studies", kind:"day", days:1, price:6000,
      prereq:"", moduleCodes:["TURTLE"] },
    { code:"D_PLAST", name:"Plastic Pollution: Monitoring & Assessment", kind:"day", days:1, price:6000,
      prereq:"", moduleCodes:["PLAST"] },

    // RESEARCH ASSISTANT (flexible 2-week add-on — ad-hoc sessions only)
    { code:"RA",      name:"Research Assistant (2 weeks)", kind:"addon", weeks:2, price:0,
      prereq:"", moduleCodes:[], flexible:true },

    // CONSERVATION SURVEYS (staff-only schedulable outings)
    { code:"SV_SHARK", name:"Shark Survey — Snorkel", kind:"survey", price:600,
      prereq:"Any level", staffOnly:true, medium:"snorkel", uploader:"shark" },
    { code:"SV_TURTLE",name:"Turtle Survey — Snorkel", kind:"survey", price:600,
      prereq:"Any level", staffOnly:true, medium:"snorkel", uploader:"turtle" },
    { code:"SV_SLUG",  name:"Sea Slug Survey — 2 dives", kind:"survey", price:2200,
      prereq:"AOW", staffOnly:true, medium:"dive", uploader:"slug" },
    { code:"SV_COTS",  name:"Crown of Thorns Survey — 2 dives", kind:"survey", price:2200,
      prereq:"AOW", staffOnly:true, medium:"dive", uploader:"cots" }
  ],

  // --- STAFF (flat list) ---------------------------------------------------
  staff: ["Cass", "Seth", "Maisie", "Kelly", "Irene", "C.J.", "Tereza", "Michael"],

  // --- SURVEY UPLOADER LINKS ----------------------------------------------
  uploaders: {
    shark:  "https://setmay31.github.io/shark-survey/",
    turtle: "https://setmay31.github.io/BTC-Sea-Turtle-Survey-Uploader/",
    emp:    "https://setmay31.github.io/ecological-monitoring-survey/",
    cots:   "https://setmay31.github.io/crown-of-thorns-survey/",
    slug:   "https://setmay31.github.io/sea-slug-survey/"
  },

  // --- INCOMING DIVE CERT LEVELS (for student start level) ------------------
  diveLevels: ["None / Non-diver", "Open Water", "Advanced Open Water",
               "Rescue Diver", "Divemaster", "Instructor"],

  // --- AD-HOC / FLEXIBLE SESSION TYPES (Research Assistant & extras) --------
  // staff optional on these. medium drives colour.
  adhocTypes: [
    { key:"research",   label:"Ad-hoc Research Dive",  medium:"dive" },
    { key:"project",    label:"Independent Project",   medium:"dive" },
    { key:"assessment", label:"Assessment Dive",       medium:"dive" },
    { key:"practice",   label:"Practice Dive",         medium:"dive" }
  ]
};

if (typeof window !== "undefined") window.SEED = SEED;
