# Books Pro — English Learning & Curriculum

A web app built **only** from the 8 books in the Google Drive folder **`books pro`**:

| Book (in `books pro`) | Used as |
|---|---|
| `GnGozbEwKKuzJeFZwlP44jd4P7XPAoUUz9lMqJEX.pdf` — **TEST MASTER** (Atalay Oguz) | Quiz module: 16,161 questions (Grammar 9,246 · Vocabulary 5,859 · Miscellaneous 1,056), answer key pp. 403–431, playable Elementary Tests 1–2 transcribed |
| `worksheets-grammar.pdf` | Worksheets module: all 60 worksheets catalogued by topic, with completion tracking |
| `Class 2 Integrated Scheme of Work.pdf` | Schemes module (EFEDI, Level 1) |
| `Class 3 Integrated Scheme of Work.pdf` | Schemes module (EFEDI) |
| `Class 4 Integrated Scheme of Work.pdf` | Schemes module (EFEDI) |
| `Class 5 Integrated Scheme of Work.pdf` | Schemes module (EFEDI) |
| `Class 6 Integrated Scheme of Work.pdf` | Schemes module, incl. the full 8-theme / 32-week programme browsable in-app |
| `digital-65ae24fecf49b7.61315711.pdf` | Listed as **unidentified** — Drive's reader could not extract it; open it in Drive to identify, then update `data/books-pro.json` |

## Run it

No build step, no dependencies — open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000   # http://localhost:8000
```

Worksheet ticks and quiz scores are saved in the browser (localStorage).

## Files

- `index.html`, `assets/` — the app (`assets/books-data.js` is generated, do not edit by hand)
- `data/books-pro.json` — the 8-book catalogue (Drive ids, links, descriptions)
- `scripts/build_books_data.py` — regenerates `assets/books-data.js` from the catalogue + transcribed contents (TEST MASTER structure/quizzes, Class 6 weeks, from the preserved copy in `azobe-school-manager/assets/school-data.js`)
- `NEW-REPOSITORY.md` — how this project is linked to its own repository (**MrCedric-max/Books-pro**)
- `azobe-school-manager/` — the earlier École Azobe school-manager app (whole-Drive scope), preserved as requested; open `azobe-school-manager/index.html`

## Note on scope

The previous version of this project used the whole Drive (84 files). At the owner's
request it was re-scoped to the `books pro` folder only (8 files). Nothing from the
other folders (Research Methodology, Citizenship, workbooks, personal files) is used here.
