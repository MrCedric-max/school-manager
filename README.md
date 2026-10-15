# School Manager — web version of the `School_Manager` workbook

A web app for **École AZOBE** that does everything the `School_Manager.xlsx` workbook does —
registration, calendar, roll call, weekly controls, daily performance, monthly and term marks,
class reports, official report cards and statistics — with the same rules, in English and French.

- **One admin login**, data stored in a local SQLite database (one file, easy to back up).
- **Imports the workbook directly** (pupils, calendar, roll marks, controls, performance, card marks, attitudes).
- **Prints the official report cards** on A4 — one pupil or the whole class in one go.
- Works on a school PC (Windows/macOS/Linux) or on any Node.js host.

> 🔒 Pupils' data lives only in the database file (`server/data/school.db`), which is **never committed**
> (this repository is public). Back it up from *Settings → Backup*.

---

## 1. Start it (Windows)

1. Install **Node.js 22 LTS or newer** from <https://nodejs.org>.
2. Double-click **`start.bat`** in this folder. The first start installs and builds the app (~1 minute),
   then opens <http://localhost:4000>.
3. Create the administrator account (first visit only).
4. Go to **Settings & import → Import the School_Manager workbook**, choose your `.xlsx`, check the preview
   and click **Import now**.

### Any system (command line)

```bash
cd school-manager
npm install          # installs server + client (no compiler needed)
npm run build        # builds the interface into client/dist
npm start            # http://localhost:4000
```

Other computers on the school network can use it at `http://<this-pc-ip>:4000`.

Forgot the password? Reset it from the command line (also creates the account if needed):

```bash
npm run create-admin -- admin "a-new-password"
```

Want to look around first? *Settings → Load demo data* (only when no pupils exist) creates **invented**
pupils and marks. Importing the workbook later replaces them automatically.

### Demo sign-in (to show the app to others)

Start the server with `DEMO_LOGIN=1` and the sign-in page shows a ready-made **demo account**
(`demo` / `demo2026`, change them with `DEMO_USERNAME` / `DEMO_PASSWORD`) with a one-click button:

```bash
npm run seed:demo                 # invented pupils and marks (empty database only)
DEMO_LOGIN=1 npm start            # Windows (cmd): set "DEMO_LOGIN=1" && npm start
```

It is safe by design:

- it only exists while the database holds **demo data** — importing the workbook, *Delete all data*
  or restoring a real backup deletes it and ends its sessions, so real pupils are never shown to it;
- it cannot import, download or restore backups, delete all data or change its password;
- it is not the administrator: on a new install you can still create your own account next to it.

---

## 2. Workbook → app

| Workbook sheet | In the app | Notes |
| --- | --- | --- |
| Dashboard | **Dashboard** | KPIs, per-class statistics, subject/area averages, cote distribution, roll marks — plus *today's roll call* progress per class |
| Statistics | **Statistics** | The 5 charts (per area, per subject, per discipline %, per competence %, attendance + year trend) |
| Lists | Built in (*Settings*, *Calendar*) | Classes & codes, months, terms & UA months, cote scale, competence framework |
| Registration | **Pupils** | Automatic IDs (`CE2-28`), status, gender, birth date/place, parent, phone, quarter; CSV export |
| Calendar | **Calendar** | Terms, UA months, public holidays, colour-coded months, week numbers from W1 |
| Roll_Call | **Roll call** | Weekly register; P/A/L/E by click or keyboard; "All P" per day; week & year % |
| Weekly_Controls | **Weekly controls** | 4 subjects /20 per pupil and week, average & cote |
| Daily_Performance | **Daily performance** | 7 areas /10 per pupil and school day |
| Month_Card_Entry | **Monthly marks** | 1A, 1B, 2A, 2B, 4A, 5A → C1 /80, C2, C4, C5, total /180, average, cote, overall |
| Term_Card_Entry | **Term marks** | Monthly marks shown grey; type 1C, 3A, 3B, 6A1, 6B + 8 attitude grades (A+ to C) |
| Weekly_Report | **Weekly report** | Controls, performance, attendance, rank; class average / highest / lowest |
| Monthly_Report | **Monthly report** | /180 scope, control averages over the month's weeks, performance, attendance, overall & rank |
| Term_Report | **Term report** | Averages of the UA months (/280), term performance & attendance, overall & rank |
| Report_Card_Month | **Report cards → Monthly card** | Official bilingual layout, A4 |
| Report_Card_Term | **Report cards → Term card** | UA1–UA3 + term note & cote, attitudes, A4 |

Data entry grids work like the spreadsheet: **Enter/↓** moves down, **↑** up, **Tab** right, **Esc** cancels,
and both `12,5` and `12.5` are accepted. Marks outside 0–max are refused. Everything saves automatically.

---

## 3. Calculation rules

These follow the workbook; the few places where the workbook was ambiguous are marked *(choice)*.

- **Weeks** are numbered from the Monday of W1 (7 Sep 2026). A month's weeks run from the week of its
  first weekday to the week of its last weekday (October = W4–W8), exactly like the *Lists* sheet.
- **School days** = weekdays inside a term that are not public holidays (180 in 2026/2027).
- **Cote**: A+ ≥ 90% · A ≥ 75% · ECA/B ≥ 50% · NA < 50% of the maximum.
- **Monthly card (/180)**: C1 = 1A + 1B (/80), C2 = 2A + 2B (/60), C4 = 4A, C5 = 5A. Average /20 = total ÷ 180 × 20.
- **Term framework (/280)**: C1 = 1A + 1B + 1C (/100), C2 /60, C3 = 3A + 3B (/40), C4, C5, C6 = 6A1 + 6B (/40).
- **Term values** = average of the term's **UA months** (Term 1 = Oct · Nov · Dec, Term 2 = Jan · Feb · Mar,
  Term 3 = Apr · May · Jun); months without marks are ignored.
- **Daily-performance average** = mean of each day's average /10 over the period's school days.
- **Overall /20** = 70% academic average + 30% performance average × 2 (the weight is editable in *Settings*).
  *(choice)* Without any performance mark, the academic average is used alone.
- **Attendance rate** *(choice)* = (Present + Late) ÷ days marked — late pupils were present.
- **Ranks** work like Excel `RANK.EQ` (ties share a rank). Weekly rank = controls average; monthly and term
  rank = overall score. *(choice)* The term card shows the **term** rank (the workbook showed the rank of the
  last month of the term).
- Totals add the marks entered; the grids flag pupils whose marks are incomplete.

---

## 4. Importing the workbook

*Settings → Import* reads the `.xlsx` (nothing leaves your server) and shows a preview before writing anything:
pupils per class, calendar, number of roll marks / controls / performance / card marks / attitudes, and
**warnings** for values that will be skipped (unknown student IDs, marks above the maximum, invalid grades…).

- **Replace** (first import, or when demo data is loaded): pupils and all their marks come only from the workbook.
- **Merge**: pupils are matched by student ID and their marks updated; details typed in the app (phone,
  birth date…) are kept when the workbook leaves them blank.

Sheets and columns are found by their header text, so added rows or columns in the workbook do not break the import.

---

## 5. Backups

- *Settings → Download backup* gives a `.db` file with **everything** (pupils, marks, settings). Keep copies on
  a USB key or in Google Drive (in a private folder).
- *Settings → Restore* replaces the data with a backup (a safety copy of the current data is kept in
  `server/data/backups/`).

---

## 6. Running it on a server

It is a single Node.js process serving the API and the interface on one port, with a SQLite file — so the
host needs a **persistent disk** (Netlify, used for the old frontend, cannot run it).

- **Docker**: `docker build -t school-manager .` then `docker run -p 4000:4000 -v school-data:/data school-manager`
- **Render / Railway / Fly.io / a VPS**: build with `npm ci && npm run build`, start with `npm start`,
  mount a disk and set `DATA_DIR` to it. Put it behind HTTPS.

### Signing in inside another site (preview panels, iframes)

The app is often looked at inside someone else's page (an editor's *preview panel*, a portal, a wiki).
Browsers treat that as **another site** and are strict there: Chrome — 155 and every recent
version — **drops the `sm_session` cookie** of a page shown in such an iframe, so the cookie alone
cannot keep a sign-in. The app therefore proves who it is on every call with the session token, and
picks the channel that actually arrives:

1. **`X-Session-Token` header** (and `Authorization: Bearer`, kept for older clients) — the normal
   path, and what a plain browser tab uses as well;
2. **`?sm_session=…` in the address** — used only when the app finds out that headers do not reach the
   server: before the first call it *asks* (`GET /api/auth/transport?probe=…` sends the same random
   value in both headers and in the address, and the answer says which arrived). Proxies in front of a
   preview rewrite or drop `Authorization`, which is exactly why the token has another way through;
3. **cookie** — a *partitioned* one (`SameSite=None; Secure; Partitioned`) as long as the app is
   embedded, which Chrome keeps even with third-party cookies blocked, next to a normal `SameSite=Lax`
   one in a browser tab.

Nothing to configure: the app detects the situation itself, and *Settings → Session & sign-in* shows
which channel the server received, whether the browser kept the cookie, and whether the page is
embedded. Start the server with `DEBUG_SESSIONS=1` to see the same for every request in the log.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` / `HOST` | `4000` / `0.0.0.0` | Where the server listens |
| `DATA_DIR` | `server/data` | Folder of the SQLite database (`school.db`) |
| `DB_FILE` | – | Full path of the database file (overrides `DATA_DIR`) |
| `SESSION_DAYS` | `14` | How long a sign-in lasts |
| `TRUST_PROXY` | private networks | Express "trust proxy" (for HTTPS behind a proxy) |
| `FRAME_ANCESTORS` | the app itself + the preview hosts (`https://*.e2b.app`, `https://*.arena.ai`) | Who may embed the app in an iframe |
| `COOKIE_SAMESITE` | automatic | `lax` in a normal tab, `none` (partitioned) when the app is embedded — force either one with `lax` / `none` |
| `DEBUG_SESSIONS` | off | `1` logs, for every API call, which channel the session token arrived in — the quickest way to see what a proxy forwards |
| `MAX_UPLOAD_MB` | `25` | Largest workbook / backup accepted |
| `DEMO_LOGIN` | off | `1` shows a demo account on the sign-in page — only while the data is invented (see §1) |
| `DEMO_USERNAME` / `DEMO_PASSWORD` | `demo` / `demo2026` | Demo account credentials |

---

## 7. Development

```bash
npm install
npm run dev        # API on :4000 (auto-restart) + Vite on :5173 with hot reload
npm test           # 51 tests: 46 server (calendar, grading, reports, importer, API & security, sessions)
                   #          5 client (which channel carries the session out of an iframe)
npm run typecheck  # TypeScript check of the interface
npm run seed:demo  # fill an empty database with invented pupils (+ demo account with DEMO_LOGIN=1)
```

```
school-manager/
├── server/                Node.js + Express 5 + SQLite (better-sqlite3)
│   ├── src/db/            schema, default reference data (from the workbook)
│   ├── src/lib/           calendar, grading rules, auth, validation
│   ├── src/services/      reports & report cards, dashboard & statistics, workbook importer, backups, demo data
│   ├── src/routes/        REST API (all under /api; admin session required except sign-in and the school logo)
│   └── test/              node:test suites (+ a fixture workbook with the School_Manager layout)
└── client/                React 19 + TypeScript + Vite + Tailwind CSS 4 + TanStack Query + Recharts
    ├── src/pages/         one page per workbook sheet
    └── test/              node:test suites that load src/lib/api.ts directly
```

Security: passwords hashed with scrypt, server-side sessions in an httpOnly cookie, CSRF header check on
every change, login rate limiting, strict Content-Security-Policy, input validation on every endpoint.
The session token is kept for the current browser tab only and sent on every call — in the
`X-Session-Token` header, or, where a proxy drops it, in the address (see §6) — so signing in works in
browsers that refuse cookies, for example when the app is shown inside another site.
