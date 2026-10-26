"""Regenerate data/books-pro.json and assets/books-data.js.

The transcribed TEST MASTER and Class 6 contents live in school-data.js, which is
part of the earlier Azobe school-manager app and is NOT copied into this repository.
Point the script at a copy of that file if you have one:

    python3 scripts/build_books_data.py [/path/to/school-data.js]
    SCHOOL_DATA=/path/to/school-data.js python3 scripts/build_books_data.py
"""
import json, os, pathlib, re, sys
R=pathlib.Path(__file__).resolve().parents[1]
candidates=[pathlib.Path(p) for p in (sys.argv[1] if len(sys.argv)>1 else "", os.environ.get("SCHOOL_DATA","")) if p]
candidates.append(R/"azobe-school-manager/assets/school-data.js")
SRC_FILE=next((p for p in candidates if p.is_file()), None)
if SRC_FILE is None:
    sys.exit(
        "school-data.js not found — it is not part of this repository.\n"
        "Get it from the school-manager repo: azobe-school-manager/assets/school-data.js\n"
        "then run: python3 scripts/build_books_data.py /path/to/school-data.js\n"
        "(assets/books-data.js in this repo is already generated and needs no rebuild.)"
    )
src=SRC_FILE.read_text()
def extract(start_marker, end_marker=None):
    i=src.index(start_marker)
    j=src.index(end_marker, i) if end_marker else len(src)
    return src[i:j].strip().rstrip(";") 
tm = extract("window.TESTMASTER")
c6 = extract("window.CLASS6_ENGLISH", "/* Key dates")
# strip assignment prefixes -> will re-add
tm_obj = tm.split("=",1)[1].strip()
c6_obj = c6.split("=",1)[1].strip()

books=[
 {"id":"17kgwuVXTSw-aDHzHTnjXjkinAWoFNaye","file":"GnGozbEwKKuzJeFZwlP44jd4P7XPAoUUz9lMqJEX.pdf","title":"TEST MASTER — English Tests","author":"Atalay Oguz, Baskent Education Publication","kind":"Test book (PDF)","size":"2.30 MB","folder":"books pro","url":"https://drive.google.com/file/d/17kgwuVXTSw-aDHzHTnjXjkinAWoFNaye/view","desc":"16,161 multiple-choice questions: Book 1 Grammar (9,246), Book 2 Vocabulary (5,859), Book 3 Miscellaneous (1,056), with answer key (pp. 403-431). The same book you originally linked.","tags":["grammar","vocabulary","quiz","tests"]},
 {"id":"11Ur1WkxCP53s91_szS6G58dhDVIRwUzb","file":"digital-65ae24fecf49b7.61315711.pdf","title":"Unidentified PDF (digital-65ae24fecf49b7…)","author":"","kind":"PDF","size":"3.65 MB","folder":"books pro","url":"https://drive.google.com/file/d/11Ur1WkxCP53s91_szS6G58dhDVIRwUzb/view","desc":"Drive's text reader could not open this file on 2026-10-26, so its contents are NOT guessed here. Open it in Drive to identify it, then rename it in data/books-pro.json.","tags":["unidentified"]},
 {"id":"1IfFGS7AZsJFHt_0cNIBTWDbqtD4oFlVJ","file":"worksheets-grammar.pdf","title":"Grammar Worksheets — 60 Worksheets","author":"","kind":"Worksheets (PDF)","size":"0.82 MB","folder":"books pro","url":"https://drive.google.com/file/d/1IfFGS7AZsJFHt_0cNIBTWDbqtD4oFlVJ/view","desc":"60 printable grammar worksheets, from Subject Pronouns & Verb 'To Be' (WS1) to Rewrite (WS60). Full contents list is in the Worksheets module.","tags":["grammar","worksheets","printable"]},
 {"id":"1Qkb5iMEnpojr8AvISDgsPqr0Brq93XCB","file":"Class 2 Integrated Scheme of Work.pdf","title":"Class 2 Integrated Scheme of Work — English Language","author":"EFEDI Schools, Azobe-EFEDI (2025/2026)","kind":"Scheme of work (PDF)","size":"0.61 MB","folder":"books pro","url":"https://drive.google.com/file/d/1Qkb5iMEnpojr8AvISDgsPqr0Brq93XCB/view","desc":"Level 1 (Primary 2). Themes begin: 1 The Home (W1-4), 2 The Village/Town (W5-8), 3 The School (W9-12), 4 Occupations (W13-16), 5 Travelling (W17-20)…","tags":["scheme","class 2","EFEDI"]},
 {"id":"16Tu6hIuxCACCXlSD9lZ3BYE0EE9uwDnx","file":"Class 3 Integrated Scheme of Work.pdf","title":"Class 3 Integrated Scheme of Work — English Language","author":"EFEDI Schools, Azobe-EFEDI","kind":"Scheme of work (PDF)","size":"0.69 MB","folder":"books pro","url":"https://drive.google.com/file/d/16Tu6hIuxCACCXlSD9lZ3BYE0EE9uwDnx/view","desc":"Integrated English scheme of work for Class 3 (EFEDI). Weekly detail is inside the PDF — open in Drive.","tags":["scheme","class 3","EFEDI"]},
 {"id":"1c-d73YygDEigGLohUHM1XYGQbG6BSWLA","file":"Class 4 Integrated Scheme of Work.pdf","title":"Class 4 Integrated Scheme of Work — English Language","author":"EFEDI Schools, Azobe-EFEDI","kind":"Scheme of work (PDF)","size":"0.60 MB","folder":"books pro","url":"https://drive.google.com/file/d/1c-d73YygDEigGLohUHM1XYGQbG6BSWLA/view","desc":"Integrated English scheme of work for Class 4 (EFEDI). Weekly detail is inside the PDF — open in Drive.","tags":["scheme","class 4","EFEDI"]},
 {"id":"1YDGLL9zZQQ92sL_5TlRCrOKIqjbHXbXr","file":"Class 5 Integrated Scheme of Work.pdf","title":"Class 5 Integrated Scheme of Work — English Language","author":"EFEDI Schools, Azobe-EFEDI","kind":"Scheme of work (PDF)","size":"4.54 MB","folder":"books pro","url":"https://drive.google.com/file/d/1YDGLL9zZQQ92sL_5TlRCrOKIqjbHXbXr/view","desc":"Integrated English scheme of work for Class 5 (EFEDI). Weekly detail is inside the PDF — open in Drive.","tags":["scheme","class 5","EFEDI"]},
 {"id":"1kVJBerxx4glEN8IO0Ps14e7n3TDrFnne","file":"Class 6 Integrated Scheme of Work.pdf","title":"Class 6 Integrated Scheme of Work — English Language","author":"EFEDI Schools, Azobe-EFEDI (2025/2026)","kind":"Scheme of work (PDF)","size":"0.68 MB","folder":"books pro","url":"https://drive.google.com/file/d/1kVJBerxx4glEN8IO0Ps14e7n3TDrFnne/view","desc":"8 themes x 4 weeks = 32 weeks (Nature, Village/Town, School, Occupations, Travelling, Health & Safety, Sports & Leisure, Universe & Space). The full weekly programme is browsable in the Schemes module.","tags":["scheme","class 6","EFEDI"]},
]
ws_titles=["Subject Pronouns and Verb 'To Be'","Present Simple and Present Continuous","Present Simple and Present Continuous","Present Simple, Present Continuous, Simple Past","Past form of verb 'To Be'","Past form of verb 'To Be'","Simple Past Tense","Simple Past and Past Continuous","Simple Past and Past Continuous","Present Perfect Tense","Present Perfect Tense vs Present Perfect Continuous","Simple Past vs Present Perfect / Present Perfect vs Present Perfect Continuous","Past Perfect Tense","Past Perfect / Past Perfect Continuous","Going to","Future Continuous","Future Perfect / Future Perfect Continuous","Future in the Past","Future Forms","Tense Review","Tenses (Rewrite or Combine)","Correct Tense or Voice","Passive Form","Passive Form","Passive Form","Reported Speech","Reported Speech","Adjectives and Adverbs","Adjectives ending -ing or -ed","Conditionals","Conditionals","Wishes","Comparatives and Superlatives","Prepositions (at / in / on)","Prepositions","Relative Clause","Relative Clause","Modals","Modals","Used to / Would / Be used to","Some / Any / Much / Many / A lot of / (a) Few / (a) Little","Some- / Any- / No- with -body / -one / -thing / -where","Tag Questions","Causatives","Both...and / Neither...nor / Either...or / Not only...but also","Articles","Purpose: So that / to / In order to / In Case","Reason and Result: because (of), as, since, so, as a result, therefore","Contrast: although, even though, though, in spite of, despite, while, whereas, however","Gerund or Infinitive","Gerund or Infinitive","Pronouns","Pronouns","Reflexive Pronouns","Certainty, Possibility, Impossibility and Advisability","Perfect Modals","Possessive: apostrophe -s or of","So do I / Neither do I","Enough / Too","Rewrite"]
def group(n):
    if n==1: return "Foundations"
    if n<=22: return "Tenses"
    if n<=25: return "Passive Voice"
    if n<=27: return "Reported Speech"
    if n<=29: return "Adjectives & Adverbs"
    if n<=33: return "Conditionals, Wishes & Comparison"
    if n<=35: return "Prepositions"
    if n<=37: return "Relative Clauses"
    if n<=40: return "Modals & Used to"
    if n<=42: return "Quantifiers"
    if n<=45: return "Questions, Causatives & Linking"
    if n==46: return "Articles"
    if n<=49: return "Linking Words"
    if n<=51: return "Gerund & Infinitive"
    if n<=54: return "Pronouns"
    if n<=56: return "Modals"
    return "Revision & Misc"
worksheets=[{"n":i+1,"title":t,"group":group(i+1)} for i,t in enumerate(ws_titles)]
assert len(books)==8 and len(worksheets)==60
data={"sourceFolder":"books pro (Google Drive folder 1D1k3nsCLihorqXopnG1q880G7BYlU8fQ)","count":8,"books":books,"worksheets":worksheets}
(R/"data/books-pro.json").write_text(json.dumps(data,ensure_ascii=False,indent=1))
js = "/* Books Pro data — generated by scripts/build_books_data.py from data/books-pro.json + transcribed book contents. Do not edit by hand. */\n"
js += "window.BOOKS="+json.dumps(books,ensure_ascii=False)+";\n"
js += "window.WORKSHEETS="+json.dumps(worksheets,ensure_ascii=False)+";\n"
js += "window.TESTMASTER="+tm_obj+";\n"
js += "window.CLASS6_ENGLISH="+c6_obj+";\n"
(R/"assets/books-data.js").write_text(js)
print("books-pro.json + books-data.js written", len(js))
