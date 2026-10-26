# École Azobe — School Manager

A web school-manager for **ÉCOLE AZOBE (AZOBE – EFEDI), 2026/2027**, built from the
school's Google Drive folder (84 documents). Open `index.html` in a browser, or serve
the folder with any static server:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## What it does

| Module | Drive source it uses |
|---|---|
| **Dashboard** | `School_Manager` workbook — 244 pupils, 11 classes (SIL → 2nde), 180 school days; recorded CM1 data from `TRUE MANANGER` |
| **Pupils & Classes** | Workbook *Registration* sheet: ID pattern (`CE2-13`), class sizes, statuses. Names are entered/imported locally — real pupil names are **not** stored in this repo |
| **Roll Call** | *Roll_Call*: P / A / L / E marks, attendance % |
| **Weekly Controls** | *Weekly_Controls*: English, Mathematics, French, Science & Technology /20 |
| **Daily Performance** | *Daily_Performance*: 7 areas /10 (Assignments … Obedience) |
| **Grades & Report Card** | Competence framework /280 (term) and /180 (monthly card), cotes A+ ≥90% · A ≥75% · ECA/B ≥50% · NA, overall = 70% academic + 30% daily performance, print-ready |
| **Curriculum** | Class 6 English integrated scheme (8 themes × 32 weeks), Class 1–6 integrated schemes, Class 1 Citizenship, Class 6 Access Pack & Autism/EAL guide, Research Methodology library |
| **Calendar 2026-27** | `Azobe Calendrier_scolaire_2026_2027` — terms and key dates |
| **Document Library** | All **84 Drive files** catalogued, searchable, open-in-Drive; duplicates and private files flagged |
| **TEST MASTER Quiz** | *TEST MASTER* book (16,161 questions: Grammar 9,246 · Vocabulary 5,859 · Miscellaneous 1,056) — structure + playable Elementary Tests 1–2 |
| **Import & Data** | Import the Registration CSV, export/import app data (JSON), reset to the clean workbook roll |

Data you enter is saved in the browser (localStorage) — export JSON regularly for backup.

## Files

- `index.html`, `assets/` — the app (no build step, no dependencies)
- `data/catalog.json` — all 84 Drive documents (id, title, category, Drive link, how used)
- `data/school.json` — school structure extracted from the workbooks
- `docs/INVENTORY.md` — full inventory, workbook facts, duplicates and privacy notes
- `scripts/build_data.py`, `scripts/make_school_json.py` — generators for the data files

## Notes

- `School_Manager` (244 pupils) is treated as canonical; `TRUE MANANGER` (241) is the
  earlier working copy with recorded CM1 results, shown on the Dashboard.
- Personal files in the folder (`My Passport`, `Capiemp certificate`, `OLALHND`) are
  catalogued as **PRIVATE** and are never used with pupils.
