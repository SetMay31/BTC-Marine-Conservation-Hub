# BTC Marine Conservation Hub

Central student tracker for **Black Turtle Conservation's** Marine Conservation education department — students, scheduling, staff assignment, course progress and certification status in one place.

**Live:** https://setmay31.github.io/BTC-Marine-Conservation-Hub/
**Password:** set in Settings (default `BTC2026!`).

## What it does (v1)
- **Dashboard** — on-site students, this week's outings, e-learning due, certs this month, and warning flags (unstaffed sessions, prerequisites, incomplete compliance).
- **Schedule** — Master (week), Staff (week overview + day roster) and Student (list/calendar) views. "Schedule module" lays out a lecture + the module's dives in one step; every section is movable by drag-and-drop and progress follows automatically. Colour-coded by medium (land / snorkel / dive). Conservation surveys schedule as staff-only; flexible ad-hoc dive types supported.
- **Students** — profiles, starting level (incoming cert + logged dives + prior modules), compliance flags, multi-course enrolment with a combined module checklist, per-module stage tracking, and a manual certification toggle (date + staff). Auto-archives on departure.
- **Certifications** — student × module grid, per-student cards, and CSV exports (matrix + flat list).
- **Catalogue** — fully editable courses and modules (Conservation Diver vs BTC, e-learning flags, prerequisites).
- Light/dark theme, offline-tolerant PWA, data export/import.

## Architecture
Plain static PWA (no build step): `index.html`, `styles.css`, `app.js`, plus `data.js` (seed catalogue) and `store.js` (data layer). **v1 stores data locally in the browser** — all reads/writes go through `store.js` so a shared **Supabase** backend can be dropped in later without touching the UI.

## Roadmap
- **v1.5** — student-facing read-only progress pages
- **Shared data** — connect Supabase so the manager and bookings team share one dataset across devices
- Notifications (e.g. unassigned-staff alerts) and proper logins

Built with [Claude Code](https://claude.com/claude-code).
