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
- `scripts/build_books_data.py` — regenerates `assets/books-data.js` from the catalogue + transcribed contents (TEST MASTER structure/quizzes, Class 6 weeks). The transcription lives in `school-data.js`, which stays in the school-manager repo (`azobe-school-manager/assets/school-data.js`) and is deliberately not copied here — pass its path as an argument to rebuild; the generated file in this repo is already complete, so no rebuild is needed for normal use
- `docs/BOOKS-PRO.md` — provenance of the 8 books (sizes, ids, what was and was not extracted)
- `NEW-REPOSITORY.md` — why this project was split out of `school-manager`
- `azobe-school-manager/` — **excluded from this repository** (see `.gitignore`); the earlier École Azobe app remains in `MrCedric-max/school-manager`

## Class 1 Pupil's Book

`books/class-1/` holds a book written for this school: **My English Book — Pupil's Book,
Class 1** (A4, print-ready DOCX). The Drive `books pro` folder only has EFEDI schemes from
Class 2 up, so this one is original material, set in Cameroon and following the Class 2
scheme's shape.

- `books/class-1/My-English-Book-Class-1-Pupils-Book.docx` — the book (3 themes, 12 units,
  117 words, 12 songs, 12 stories, picture dictionary, progress record, certificate)
- `books/class-1/content.json` — all the text, editable
- `books/class-1/illustrations/` — print-resolution art + the prompts used to make it
- `books/class-1/README.md` — what is inside, how to rebuild, known gaps
- `scripts/build_class1_docx.py`, `scripts/validate_class1_content.py`

```bash
pip install python-docx
python3 scripts/validate_class1_content.py && python3 scripts/build_class1_docx.py
```

## Note on scope

The previous version of this project used the whole Drive (84 files). At the owner's
request it was re-scoped to the `books pro` folder only (8 files). Nothing from the
other folders (Research Methodology, Citizenship, workbooks, personal files) is used here.
