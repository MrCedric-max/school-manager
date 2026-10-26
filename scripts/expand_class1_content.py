#!/usr/bin/env python3
"""Expand the Class 1 scheme files into the book's content.json.

    python3 scripts/expand_class1_content.py

Inputs  (hand-written):  books/class-1/content/meta.json
                         books/class-1/content/themes.json
                         books/class-1/content/weeks-01-20.json
                         books/class-1/content/weeks-21-32.json
Output  (generated):     books/class-1/content.json   -> read by build_class1_docx.py

The unit anatomy follows the Competency-Based Approach (APC-ESV) used in Cameroon
and the seven domains of the EFEDI Class 1 Integrated Scheme of Work:

  entry situation -> Listening and Speaking -> Reading -> Writing ->
  Grammar, Vocabulary and Pronunciation -> Phonics -> Literature and Drama ->
  integration task -> mini project -> criterion-referenced self-assessment
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1] / "books" / "class-1"
SRC = ROOT / "content"
OUT = ROOT / "content.json"

DOMAINS = [
    "Listening and Speaking",
    "Reading",
    "Writing",
    "Grammar, Vocabulary and Pronunciation",
    "Phonics",
    "Literature and Drama",
]
WEEKS_PER_THEME = 4

INSTRUCTION = {
    "listen": "Listen to your teacher. Then say each line with your teacher.",
    "read": "Read with your teacher. Point to each word with your finger.",
    "write": "Write in your exercise book. Sit well and hold your pencil well.",
    "sounds": "Say the sound. Then find the sound in each word.",
    "syllables": "Clap the syllables. Then write the word.",
    "integrate": "Work with a friend. Use all the English you have learned this week.",
    "rhyme": "Say the rhyme with your teacher. Clap the beat.",
    "song": "Sing with your teacher. Add actions.",
    "drama": "Act it out in pairs. Speak loudly and politely.",
    "performance": "Present your strip to the class. Speak clearly and smile.",
    "grammar": "Look at the box with your teacher. Then say the examples.",
}

RUBRIC_LEVELS = ["Not yet", "Getting there", "Yes, I can"]


def instructions_for_literature(kind):
    k = kind.lower()
    if "song" in k:
        return INSTRUCTION["song"]
    if "performance" in k:
        return INSTRUCTION["performance"]
    if "drama" in k or "dialogue" in k:
        return INSTRUCTION["drama"]
    return INSTRUCTION["rhyme"]


def load(name):
    return json.loads((SRC / name).read_text())


def build_unit(w, theme):
    phon_words = w["phon"]["words"]
    syllable = any("-" in x for x in phon_words)
    lit_kind = w["lit"]["k"]
    return {
        "n": w["n"],
        "week": w["n"],
        "title": w["title"],
        "competence": w["comp"],
        "compSentence": f"By the end of this week I can {w['comp']}.",
        "themeN": theme["n"],
        "domains": DOMAINS,
        "situation": {
            "label": "Let's start",
            "text": w["sit"]["t"],
            "questions": w["sit"]["q"],
        },
        "listen": {
            "domain": "Listening and Speaking",
            "title": w["listen"]["t"],
            "instruction": INSTRUCTION["listen"],
            "lines": w["listen"]["l"],
        },
        "read": {
            "domain": "Reading",
            "title": w["read"]["t"],
            "instruction": INSTRUCTION["read"],
            "items": w["read"]["i"],
            "task": w["read"]["task"],
        },
        "write": {
            "domain": "Writing",
            "title": "Writing",
            "instruction": INSTRUCTION["write"],
            "task": w["write"]["task"],
        },
        "language": {
            "domain": "Grammar, Vocabulary and Pronunciation",
            "grammarFocus": w["gram"]["focus"],
            "grammarInstruction": INSTRUCTION["grammar"],
            "box": w["gram"]["box"],
            "examples": w["gram"]["examples"],
            "words": [{"en": a, "fr": b} for a, b in w["words"]],
        },
        "phonics": {
            "domain": "Phonics",
            "focus": w["phon"]["focus"],
            "words": phon_words,
            "syllables": syllable,
            "instruction": INSTRUCTION["syllables"] if syllable else INSTRUCTION["sounds"],
        },
        "literature": {
            "domain": "Literature and Drama",
            "kind": lit_kind,
            "title": w["lit"]["t"],
            "lines": w["lit"]["l"],
            "instruction": instructions_for_literature(lit_kind),
        },
        "integrate": {
            "label": "I integrate — I use my English",
            "instruction": INSTRUCTION["integrate"],
            "task": w["integ"],
        },
        "miniProject": {
            "label": "Mini project",
            "instruction": "Add this to your theme strip.",
            "text": w["mini"],
        },
        "rubric": {
            "title": "Check yourself",
            "instruction": "Tick how you are doing. Colour a star when you can do it alone.",
            "levels": RUBRIC_LEVELS,
            "criteria": [f"I can {c}." for c in w["rubric"]],
        },
        "image": w.get("image") or "",
    }


def lit_bucket(kind):
    """Classify a Literature and Drama step. Every week must land in exactly one bucket."""
    k = kind.lower()
    if "rhyme" in k:
        return "rhymes"
    if "song" in k:
        return "songs"
    if "chant" in k:
        return "chants"
    if "dialogue" in k:
        return "dialogues"
    if "drama" in k:
        return "dramas"
    if "performance" in k:
        return "presentations"
    return "other"


def build_counts(themes, weeks, seen):
    buckets = {"rhymes": 0, "chants": 0, "songs": 0, "dialogues": 0, "dramas": 0,
               "presentations": 0, "other": 0}
    for w in weeks:
        buckets[lit_bucket(w["lit"]["k"])] += 1
    total = sum(buckets.values())
    if total != len(weeks) or buckets["other"]:
        raise SystemExit(f"literature buckets do not add up: {buckets} (weeks {len(weeks)})")
    buckets.update({"themes": len(themes), "units": len(weeks), "words": len(seen)})
    return buckets


def main():
    meta = load("meta.json")
    themes = load("themes.json")
    weeks = load("weeks-01-20.json") + load("weeks-21-32.json")
    weeks.sort(key=lambda w: w["n"])

    if len(weeks) != 32:
        raise SystemExit(f"expected 32 weeks, found {len(weeks)}")
    if [w["n"] for w in weeks] != list(range(1, 33)):
        raise SystemExit("week numbers are not 1..32")

    out_themes = []
    for i, th in enumerate(themes):
        chunk = weeks[i * WEEKS_PER_THEME:(i + 1) * WEEKS_PER_THEME]
        units = [build_unit(w, th) for w in chunk]
        out_themes.append({
            "n": th["n"],
            "title": th["title"],
            "weeks": th["weeks"],
            "weekRange": f"{chunk[0]['n']}–{chunk[-1]['n']}",
            "image": th["image"],
            "blurb": th["blurb"],
            "objectives": th["objectives"],
            "culminatingProject": th["project"],
            "projectSteps": th["projectSteps"],
            "units": units,
        })

    # picture dictionary: words grouped by theme, in teaching order
    seen = {}
    groups = []
    for th in out_themes:
        words = []
        for u in th["units"]:
            for w in u["language"]["words"]:
                if w["en"].lower() in seen:
                    continue
                seen[w["en"].lower()] = u["n"]
                words.append(w["en"])
        if words:
            groups.append({"group": f"Theme {th['n']} — {th['title']}", "words": words})

    content = {
        "meta": meta,
        "domains": DOMAINS,
        "themes": out_themes,
        "appendix": {
            "pictureDictionary": groups,
            "usefulSentences": meta["usefulSentences"],
            "certificate": meta["certificate"],
        },
        "counts": build_counts(out_themes, weeks, seen),
        "licence": "Written for École Azobe (Cameroon). Free to photocopy for the school's pupils; not for sale.",
        "provenance": {
            "scheme": "Class 1 Integrated Scheme of Work, EFEDI Schools, Azobe-EFEDI, 2025/2026 "
                      "(Google Drive: books pro folder, file 1sndXUg8Xq4gkSvzNIC7QEqrhU9ljXNei)",
            "structure": "Competency-Based Approach (APC-ESV) with the scheme's seven domains; "
                         "entry situation, integration task, mini project and self-assessment rubric "
                         "in every week",
        },
    }

    OUT.write_text(json.dumps(content, ensure_ascii=False, indent=1) + "\n")
    c = content["counts"]
    print(f"wrote {OUT}")
    print(f"themes {c['themes']} · weeks {c['units']} · words {c['words']}")
    print(f"literature: {c['rhymes']} rhymes · {c['chants']} chants · {c['songs']} songs · "
          f"{c['dialogues']} dialogues · {c['dramas']} dramas · "
          f"{c['presentations']} presentations")


if __name__ == "__main__":
    main()
