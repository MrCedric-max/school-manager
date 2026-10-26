#!/usr/bin/env python3
"""Validate books/class-1/content.json before building the book.

    python3 scripts/validate_class1_content.py

Checks the structure the builder depends on, that every illustration exists,
and reports word/song/story counts.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1] / "books" / "class-1"
CONTENT = json.loads((ROOT / "content.json").read_text())
ART = ROOT / "illustrations" / "print"

errors = []
warnings = []
words_seen = {}

meta = CONTENT["meta"]
for key in ("title", "subtitle", "level", "edition", "school", "insideCover", "howToUse"):
    if key not in meta:
        errors.append(f"meta.{key} missing")

units = [u for th in CONTENT["themes"] for u in th["units"]]
if meta.get("units") != len(units):
    errors.append(f"meta.units={meta.get('units')} but {len(units)} units present")
if meta.get("themes") != len(CONTENT["themes"]):
    errors.append(f"meta.themes={meta.get('themes')} but {len(CONTENT['themes'])} themes present")

nums = [u["n"] for u in units]
if nums != list(range(1, len(units) + 1)):
    errors.append(f"unit numbers are not 1..{len(units)}: {nums}")

required = ("title", "week", "competence", "image", "caption", "words", "listen",
            "talk", "practice", "challenge", "song", "story", "check", "homework")
for th in CONTENT["themes"]:
    img = ART / th["image"]
    if not img.exists():
        errors.append(f"theme {th['n']} image missing: {th['image']}")
    for u in th["units"]:
        for key in required:
            if key not in u:
                errors.append(f"unit {u.get('n')} missing '{key}'")
        if not (ART / u["image"]).exists():
            errors.append(f"unit {u['n']} image missing: {u['image']}")
        if len(u["practice"]) < 4:
            warnings.append(f"unit {u['n']} has only {len(u['practice'])} exercises")
        for ex in u["practice"]:
            kind = ex["type"]
            need = {"match": ("left", "right"), "gaps": ("lines",), "trace": ("items",),
                    "tick": ("options", "rows"), "draw": (), "order": ("lines",),
                    "gap-sentence": ("lines",)}.get(kind)
            if need is None:
                errors.append(f"unit {u['n']} exercise {ex.get('id')}: unknown type {kind}")
                continue
            for k in need:
                if k not in ex:
                    errors.append(f"unit {u['n']} exercise {ex['id']}: needs '{k}'")
            if kind == "match" and len(ex.get("left", [])) != len(ex.get("right", [])):
                errors.append(f"unit {u['n']} exercise {ex['id']}: match columns differ in length")
        if len(u["song"]["lines"]) < 2:
            warnings.append(f"unit {u['n']}: song has fewer than 2 lines")
        if len(u["story"]["lines"]) < 4:
            warnings.append(f"unit {u['n']}: story is short ({len(u['story']['lines'])} lines)")
        if not u["story"].get("say"):
            errors.append(f"unit {u['n']}: story has no 'say' line")
        for w in u["words"]:
            if not w.get("en") or not w.get("fr"):
                errors.append(f"unit {u['n']}: incomplete word entry {w}")
            words_seen.setdefault(w["en"].lower(), []).append(u["n"])

# the builder adds an automatic A–Z index, so full coverage is guaranteed;
# what matters is that curated topic groups do not invent words
dict_words = {w.lower() for g in CONTENT["appendix"]["pictureDictionary"] for w in g["words"]}
invented = sorted(dict_words - set(words_seen))
if invented:
    warnings.append(f"picture dictionary has words never taught: {invented}")

print(f"themes: {len(CONTENT['themes'])}   units: {len(units)}")
print(f"word entries: {sum(len(u['words']) for u in units)}   unique: {len(words_seen)}")
print(f"picture-dictionary words: {len(dict_words)}")
print(f"songs: {len(units)}   stories: {len(units)}   exercises: "
      f"{sum(len(u['practice']) for u in units)}")
dupes = {w: n for w, n in words_seen.items() if len(n) > 1}
print(f"words taught twice: {len(dupes)}")

for w in warnings:
    print("WARN:", w)
for e in errors:
    print("ERROR:", e)
sys.exit(1 if errors else 0)
