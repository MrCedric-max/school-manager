# Class 1 Pupil's Book — *My English Book*

**File:** `My-English-Book-Class-1-Pupils-Book.docx` (A4, print-ready, ~2.9 MB)
**Level:** Class 1 (Primary One), ages 5–6 · Cameroon
**Structure:** 3 themes · 12 units · 117 new words · 12 songs · 12 stories · 48 exercises

The book has no source PDF in the Drive `books pro` folder — the EFEDI schemes there
begin at Class 2. Everything here was written for this school, using the Class 2
scheme's pedagogy (theme → weekly topic → competence, listen/speak first, then read/write)
and a Cameroonian setting throughout: the school compound, the village market, the
moto-taxi, ndolé and koki, the mosquito net, the flag's green–red–yellow.

## Contents of the book

| Page | What is there |
|---|---|
| Cover | illustration + title + school |
| Title page | level, school, edition, scope, photocopy licence |
| This book belongs to | name/class/teacher fields, how to use the book, themes table |
| Contents | unit list by theme, end matter, songs |
| Theme opener (×3) | full-width illustration, blurb, units and competencies |
| Unit (×12, 2–3 pages each) | I can… · illustration + caption · 1 Listen and say · 2 New words (English/French) · 3 Talk with a friend · 4 Do it (4 exercises) · Challenge · Song · Story · Check yourself · At home |
| Picture dictionary | 7 topic groups + A–Z index of all 117 words with the unit where each is taught |
| Useful sentences | 10 classroom sentences, English and French |
| My progress record | unit / done / date / star |
| Certificate | for the pupil at the end of the year |

Every unit follows the same eight-step shape, so a pupil learns the routine once:
listen → words → speak → write → challenge → sing → story → self-check.

## Themes and units

**Theme 1 — Hello, My Family** (Weeks 1–4)
1. Hello! Good Morning · 2. My Family · 3. One, Two, Three — Count! · 4. Colours All Around

**Theme 2 — My Village, My Town** (Weeks 5–8)
5. My Home, My House · 6. At the Market · 7. In the Village, In the Town · 8. Animals Around Us

**Theme 3 — My School** (Weeks 9–12)
9. People and Jobs · 10. Up, Down, Here, There · 11. Food and Water · 12. My Body — Keep It Safe

Themes 4–5 of the Class 2 scheme (Travelling; Health, Safety and Sports) are **not** in
this edition. They are the natural next block if the school wants a second volume.

## Rebuild

```bash
pip install python-docx
python3 scripts/validate_class1_content.py    # structure + coverage checks
python3 scripts/build_class1_docx.py          # writes the .docx
```

- `content.json` — all the text: units, words, exercises, songs, stories, appendix.
- `illustrations/print/*.jpg` — the print-resolution art embedded in the book.
- `illustrations/PROMPTS.md` — the prompt used for each picture, so any of them can be
  regenerated or redrawn by a designer.
- The builder is deterministic: same `content.json` → same document.

## Before you print

- **Fonts:** body Verdana, headings Trebuchet MS — both ship with Word on Windows/macOS.
  If your machine substitutes them, the layout still holds.
- **Print A4, 100 % scale, double-sided.** Unit openers fall on right-hand pages.
- **Colour or black-and-white:** the tinted boxes (light green/orange/blue) still read as
  grey panels in mono, so the book works either way.
- **Re-use:** the "How to use this book" page tells pupils not to write in the book if the
  school re-uses copies. Exercises that need writing (trace, draw, gap-fill) are also
  usable in an exercise book.

## Known gaps — please review

1. **Not yet checked by a teacher.** The vocabulary load (117 words) and the two-week
   unit pace are assumptions; adjust `content.json` freely.
2. **Exercises 3A/4D etc. reference pictures loosely.** Word-to-picture matching in print
   relies on the illustration on the same page; a designer may want small icons beside
   each item.
3. **Songs are traditional/adapted** ("Finger Family", "Old MacDonald", "Head, Shoulders,
   Knees and Toes", "Wash Your Hands", "I Can Sing a Rainbow") plus new school chants;
   verify they are the tunes your teachers use.
4. **No teacher's guide yet.** The pupil's book references a Class 1 Teacher's Guide that
   does not exist; that is the next thing to write.
