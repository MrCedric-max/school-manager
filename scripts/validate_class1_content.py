#!/usr/bin/env python3
"""Validate the Class 1 book content against the Integrated Scheme of Work.

    python3 scripts/expand_class1_content.py      # first, to build content.json
    python3 scripts/validate_class1_content.py

Checks
  * the hand-written scheme files parse and cover weeks 1..32 exactly once
  * each week has the scheme's four fields: core competency, grammar focus,
    phonics focus and mini-project component
  * each week has the seven CBA steps the book prints
  * every illustration the book will reference exists in illustrations/print
  * the generated content.json agrees with its own counts
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1] / "books" / "class-1"
SRC = ROOT / "content"
ART = ROOT / "illustrations" / "print"

errors, warnings = [], []


def load(p):
    try:
        return json.loads(p.read_text())
    except Exception as e:  # noqa: BLE001
        errors.append(f"{p.name}: {e}")
        return None


themes = load(SRC / "themes.json")
weeks = (load(SRC / "weeks-01-20.json") or []) + (load(SRC / "weeks-21-32.json") or [])
meta = load(SRC / "meta.json")
content = load(ROOT / "content.json")

if themes is not None:
    if len(themes) != 8:
        errors.append(f"expected 8 themes, found {len(themes)}")
    nums = [t["n"] for t in themes]
    if nums != list(range(1, 9)):
        errors.append(f"theme numbers: {nums}")
    for t in themes:
        for key in ("title", "weeks", "image", "blurb", "objectives",
                    "project", "projectSteps"):
            if key not in t:
                errors.append(f"theme {t.get('n')}: missing '{key}'")
        if not (ART / t["image"]).exists():
            errors.append(f"theme {t['n']}: image missing {t['image']}")
        if len(t["projectSteps"]) < 3:
            warnings.append(f"theme {t['n']}: only {len(t['projectSteps'])} project steps")

if weeks:
    weeks.sort(key=lambda w: w["n"])
    got = [w["n"] for w in weeks]
    if got != list(range(1, 33)):
        errors.append(f"weeks are not 1..32: {got}")
    for w in weeks:
        for key in ("title", "comp", "gram", "phon", "mini", "sit", "listen",
                    "read", "write", "words", "lit", "integ", "rubric"):
            if key not in w:
                errors.append(f"week {w['n']}: missing '{key}'")
        for field, sub in (("gram", ("focus", "box", "examples")),
                           ("phon", ("focus", "words")),
                           ("sit", ("t", "q")),
                           ("listen", ("t", "l")),
                           ("read", ("t", "i", "task")),
                           ("lit", ("k", "t", "l"))):
            block = w.get(field) or {}
            for s in sub:
                if s not in block or not block[s]:
                    errors.append(f"week {w['n']}: {field}.{s} is empty")
        if not 4 <= len(w["words"]) <= 7:
            warnings.append(f"week {w['n']}: {len(w['words'])} words")
        if len(w["rubric"]) != 3:
            warnings.append(f"week {w['n']}: {len(w['rubric'])} rubric criteria (3 expected)")
        if len(w["listen"]["l"]) < 3:
            warnings.append(f"week {w['n']}: only {len(w['listen']['l'])} listening lines")
        if len(w["sit"]["q"]) < 2:
            warnings.append(f"week {w['n']}: fewer than 2 situation questions")
        img = w.get("image")
        if img and not (ART / img).exists():
            errors.append(f"week {w['n']}: image missing {img}")
        for a, b in w["words"]:
            if not a.strip() or not b.strip():
                errors.append(f"week {w['n']}: incomplete word pair {a!r}/{b!r}")

if meta is not None:
    for key in ("title", "subtitle", "level", "edition", "school", "insideCover",
                "howToUse", "cba", "stripGuide", "usefulSentences", "certificate"):
        if key not in meta:
            errors.append(f"meta: missing '{key}'")

if content is not None:
    c = content["counts"]
    units = [u for t in content["themes"] for u in t["units"]]
    words = {w["en"].lower() for u in units for w in u["language"]["words"]}
    if c["units"] != 32 or len(units) != 32:
        errors.append(f"content.json has {len(units)} units (counts say {c['units']})")
    if c["themes"] != len(content["themes"]):
        errors.append("content.json theme count mismatch")
    if c["words"] != len(words):
        errors.append(f"content.json word count {c['words']} != actual {len(words)}")
    for u in units:
        if len(u["rubric"]["criteria"]) != 3:
            errors.append(f"unit {u['n']}: rubric needs 3 criteria")
        if u["rubric"]["levels"] != ["Not yet", "Getting there", "Yes, I can"]:
            errors.append(f"unit {u['n']}: unexpected rubric levels")
    for t in content["themes"]:
        if len(t["units"]) != 4:
            errors.append(f"theme {t['n']}: {len(t['units'])} units (4 expected)")

print(f"themes: {len(themes or [])}   weeks: {len(weeks)}")
if weeks:
    print(f"grammar foci: {len({w['gram']['focus'] for w in weeks})} distinct")
    print(f"phonics foci: {len({w['phon']['focus'] for w in weeks})} distinct")
    print(f"mini-project steps: {sum(1 for w in weeks if w['mini'])}/32")
    print(f"rhymes/songs/drama: " + ", ".join(
        f"{k}: {sum(1 for w in weeks if k in w['lit']['k'].lower())}"
        for k in ("rhyme", "song", "drama", "dialogue", "performance")))
if content is not None:
    print("content.json:", content["counts"])
for w in warnings:
    print("WARN:", w)
for e in errors:
    print("ERROR:", e)
print("\nRESULT:", "FAIL" if errors else "OK")
sys.exit(1 if errors else 0)
