# Class 1 Pupil's Book — *My English Book*

**File:** `My-English-Book-Class-1-Pupils-Book.docx` (A4, print-ready, ~3.5 MB)
**Follows:** the **Class 1 Integrated Scheme of Work**, EFEDI Schools, Azobe-EFEDI, 2025/2026
(Google Drive → `books pro` → `Class 1 Integrated Scheme of Work.pdf`, 48 pages)
**Level:** Class 1 (Primary One), ages 5–6 · Level I · English subsystem, Cameroon
**Scope:** 8 themes · 32 weeks · 127 new words · 8 culminating project strips

## What was taken from the scheme, word for word

Every week in the book is one week of the scheme, with the scheme's own title,
competence, grammar focus, phonics focus and mini-project step:

| Scheme field | Where it appears in the book |
|---|---|
| Week title | Unit title |
| Core Competency | `COMPETENCE:` box — "By the end of this week I can…" |
| Grammar Focus | `4 New words and grammar` — grammar box + examples |
| Phonics Focus | `5 Phonics` — sound/syllable focus and word cards |
| Mini Project Component | `MINI PROJECT` box at the end of the unit |
| Domain activities (Listening and Speaking, Reading, Writing, Grammar/Vocab/Pron, Phonics, Literature and Drama) | Steps 1–6, in the scheme's own order, with the scheme's example sentences, rhymes, songs and dialogues |
| Theme General Objectives | Theme opener — "By the end of this theme I can…" |
| Culminating Project + its 4 bullet steps | Theme opener box, and the full "I present my strip" page after week 4, 8, … |

The eight culminating projects are the scheme's: My Home Snapshot Strip · My Village/Town
Strip · My School Day Strip · What People Do Strip · How We Travel Strip · Staying Clean
Strip · My Game Strip · How We Communicate Strip.

## CBA structure (the part adapted from good practice)

The scheme gives the content; the shape of each unit follows the Competency-Based
Approach (APC-ESV) used in Cameroon and the project-based learning the national primary
curriculum prescribes. Each of the 32 units runs:

1. **Competence box** — what the pupil will be able to *do*, in the first person.
2. **Domains of the week** — the scheme's seven domains listed, so pupil and teacher see the cycle.
3. **Let's start** — an entry situation (a real-life scene) with two questions, before any reading or writing.
4. **Steps 1–6** — Listening and Speaking · Reading · Writing · New words and grammar · Phonics · Rhyme/Song/Drama.
5. **Step 7 — I integrate** — a new situation where the pupil must use the week's language (the integration moment APC requires, and the part most textbooks leave out).
6. **Mini project** — the scheme's weekly component, one part of the strip.
7. **Check yourself** — three criteria × three levels (Not yet / Getting there / Yes, I can): criterion-referenced self-assessment, the same criteria the teacher uses.
8. **Theme close** — "I present my strip" page: presentation checklist, project rubric, and a remediation instruction.

Sources behind those choices: MINEDUB *Cameroon Primary School Curriculum, Level I
(Class 1 & 2)*, which prescribes CBA with project-based learning supported by integrated
theme and cooperative learning; the APC-ESV literature on entry situations, families of
situations and integration; and the criterion-referenced rubric tradition in CBA
assessment (see `source/CBA-NOTES.md`).

## Contents of the book

| Part | What is there |
|---|---|
| Cover, title page | title, level, school, edition, scope, photocopy licence, scheme provenance |
| This book belongs to | name fields, how to use the book |
| How this book works | the five CBA principles in child language + "My strip: what I need" |
| Contents | all 32 weeks with each week's competence, grouped by theme |
| Theme opener (×8) | full-width illustration, theme objectives, culminating project with its steps, the four weeks |
| Unit (×32, ~2 pages) | the eight steps above |
| Project page (×8) | "I present my strip": checklists, rubric, remediation |
| Picture dictionary | all 127 words by theme, plus A–Z index with the week each is taught |
| Useful sentences | 12 classroom sentences, English and French |
| My progress record | all 32 weeks: done / date / star |
| Certificate | end-of-year |

## Rebuild

```bash
pip install python-docx
python3 scripts/expand_class1_content.py        # scheme files -> content.json
python3 scripts/validate_class1_content.py      # structure + coverage, exits 1 on error
python3 scripts/build_class1_docx.py            # -> the .docx
```

| Path | Role |
|---|---|
| `content/themes.json` | the 8 themes: objectives, culminating project, project steps, image |
| `content/weeks-01-20.json`, `content/weeks-21-32.json` | all 32 weeks: scheme fields + the language content |
| `content/meta.json` | front matter: how to use, CBA explainer, strip guide, useful sentences |
| `content.json` | **generated** — what the builder reads. Do not edit by hand |
| `content/` → `source/class1-scheme.txt` | full text extract of the 48-page scheme (audit trail) |
| `source/scheme-digest.json`, `source/themes-digest.json` | the scheme parsed into per-week and per-theme fields |
| `illustrations/print/*.jpg` | print-resolution art (1600 px, ~236 dpi at print width) |
| `illustrations/PROMPTS.md` | the prompt behind each picture, for regeneration |

## Before you print

- A4, 100 % scale, double-sided. Theme openers and project pages fall on right-hand pages.
- Body font Verdana, headings Trebuchet MS — both ship with Word. Substitution does not break the layout.
- Tinted boxes read as grey panels in mono, so black-and-white printing works.
- The "How to use this book" page tells pupils not to write in the book if copies are re-used; the writing steps are written to work in an exercise book instead.

## Known gaps — please review

1. **No teacher has taught from it yet.** The scheme fixes the content; the pace (five 30-minute lessons per week) is my reading of it.
2. **Scheme typos carried over and corrected.** The scheme prints "bromine" for *broom* in week 13 and "Pass the joke" in week 15; the book uses *broom* and *Pass the book*. Worth fixing in the scheme itself.
3. **Pagination is unverified visually** — no Word or LibreOffice in the build environment. Structure, table widths and XML were checked mechanically; please flip through once in Word before photocopying.
4. **No teacher's guide yet.** The rubric in the pupil's book assumes the teacher uses the same three criteria; a Class 1 Teacher's Guide with lesson timing, answers and remediation activities is the next document.
5. **Assessment tools and resources columns** of the scheme (the last three columns of each week's table) are teacher-facing and are *not* reproduced in the pupil's book; they belong in the teacher's guide.
