#!/usr/bin/env python3
"""Build the Class 1 Pupil's Book (.docx) from books/class-1/content.json.

    python3 scripts/build_class1_docx.py

The book follows the EFEDI Class 1 Integrated Scheme of Work (2025/2026): 8 themes,
32 weeks, the scheme's seven domains per week, its mini-project steps and its eight
culminating "strip" projects. The unit anatomy is the Competency-Based Approach
(APC-ESV): entry situation -> domains -> integration task -> mini project ->
criterion-referenced self-assessment.

Output: books/class-1/My-English-Book-Class-1-Pupils-Book.docx  (A4, print-ready)
"""
import json
import pathlib

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = pathlib.Path(__file__).resolve().parents[1] / "books" / "class-1"
CONTENT = json.loads((ROOT / "content.json").read_text())
ART = ROOT / "illustrations" / "print"
OUT = ROOT / "My-English-Book-Class-1-Pupils-Book.docx"

META = CONTENT["meta"]
COUNTS = CONTENT["counts"]

INK = RGBColor(0x22, 0x22, 0x22)
GREY = RGBColor(0x66, 0x66, 0x66)
LIGHT = RGBColor(0x8F, 0x8F, 0x8F)
BLUE = RGBColor(0x1B, 0x5E, 0x9E)
ORANGE = RGBColor(0xD2, 0x69, 0x1E)
GREEN = RGBColor(0x1F, 0x7A, 0x45)

THEME_HEX = ["1F7A45", "D2691E", "1B5E9E", "6A3D9A", "B03A2E", "0F6E6E", "A35D00", "2E5A88"]
THEME_FILLS = ["E3F1E8", "FBEBE0", "E4EEF8", "EFE8F7", "FAE7E5", "E0F0F0", "FBF0DC", "E7ECF5"]

BODY_FONT = "Verdana"
HEAD_FONT = "Trebuchet MS"

_us = CONTENT["appendix"]["usefulSentences"]

# ------------------------------------------------------------------ xml helpers
PPR_AFTER_SHD = (
    "w:tabs", "w:suppressAutoHyphens", "w:kinsoku", "w:wordWrap", "w:overflowPunct",
    "w:topLinePunct", "w:autoSpaceDE", "w:autoSpaceDN", "w:bidi", "w:adjustRightInd",
    "w:snapToGrid", "w:spacing", "w:ind", "w:contextualSpacing", "w:mirrorIndents",
    "w:suppressOverlap", "w:jc", "w:textDirection", "w:textAlignment",
    "w:textboxTightWrap", "w:outlineLvl", "w:divId", "w:cnfStyle", "w:rPr",
    "w:sectPr", "w:pPrChange",
)
PPR_AFTER_BDR = ("w:shd",) + PPR_AFTER_SHD
TCPR_AFTER_SHD = ("w:noWrap", "w:tcMar", "w:textDirection", "w:tcFitText", "w:vAlign",
                  "w:hideMark", "w:headers", "w:cellIns", "w:cellDel", "w:cellMerge",
                  "w:tcPrChange")
TCPR_AFTER_BDR = ("w:shd",) + TCPR_AFTER_SHD
TBLPR_AFTER_BORDERS = ("w:shd", "w:tblLayout", "w:tblCellMar", "w:tblLook",
                       "w:tblCaption", "w:tblDescription", "w:tblPrChange")


def _shd(pr, fill):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    if pr.tag == qn("w:pPr"):
        pr.insert_element_before(shd, *PPR_AFTER_SHD)
    elif pr.tag == qn("w:tcPr"):
        pr.insert_element_before(shd, *TCPR_AFTER_SHD)
    else:
        pr.insert_element_before(shd, *TBLPR_AFTER_BORDERS)


def _borders(pr, edges, color="C9C9C9", size=8, space=6):
    bdr = OxmlElement("w:pBdr" if pr.tag == qn("w:pPr") else "w:tcBorders")
    for side in ("top", "left", "bottom", "right"):
        if side not in edges:
            continue
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:val"), edges[side])
        el.set(qn("w:sz"), str(size))
        el.set(qn("w:space"), str(space))
        el.set(qn("w:color"), color)
        bdr.append(el)
    if pr.tag == qn("w:pPr"):
        pr.insert_element_before(bdr, *PPR_AFTER_BDR)
    else:
        pr.insert_element_before(bdr, *TCPR_AFTER_BDR)


def shade_paragraph(p, fill):
    _shd(p._p.get_or_add_pPr(), fill)


def shade_cell(cell, fill):
    _shd(cell._tc.get_or_add_tcPr(), fill)


def cell_padding(cell, top=80, start=110, bottom=80, end=110):
    tcPr = cell._tc.get_or_add_tcPr()
    mar = OxmlElement("w:tcMar")
    for side, val in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:w"), str(val))
        el.set(qn("w:type"), "dxa")
        mar.append(el)
    tcPr.insert_element_before(mar, "w:textDirection", "w:tcFitText", "w:vAlign",
                               "w:hideMark", "w:headers", "w:cellIns", "w:cellDel",
                               "w:cellMerge", "w:tcPrChange")


def table_borders(table, color="C9C9C9", size=8):
    tblPr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(size))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)
        borders.append(el)
    tblPr.insert_element_before(borders, *TBLPR_AFTER_BORDERS)


def no_split(table):
    for row in table.rows:
        trPr = row._tr.get_or_add_trPr()
        trPr.insert_element_before(OxmlElement("w:cantSplit"), "w:trHeight", "w:tblHeader",
                                   "w:tblCellSpacing", "w:jc", "w:hidden", "w:trPrChange")


def keep_with_next(p, on=True):
    p.paragraph_format.keep_with_next = on


def page_break(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


# ------------------------------------------------------------------ text helpers
def style_defaults(doc):
    st = doc.styles["Normal"]
    st.font.name = BODY_FONT
    st.font.size = Pt(11)
    st.font.color.rgb = INK
    st.paragraph_format.space_after = Pt(4)
    st.paragraph_format.line_spacing = 1.1
    rpr = st.element.get_or_add_rPr().get_or_add_rFonts()
    rpr.set(qn("w:eastAsia"), BODY_FONT)
    rpr.set(qn("w:cs"), BODY_FONT)
    for name, size in (("Heading 1", 21), ("Heading 2", 15), ("Heading 3", 12.5)):
        s = doc.styles[name]
        s.font.name = HEAD_FONT
        s.font.size = Pt(size)
        s.font.color.rgb = BLUE
        s.font.bold = True
        s.paragraph_format.space_before = Pt(8)
        s.paragraph_format.space_after = Pt(4)
        s.paragraph_format.keep_with_next = True


def para(doc_or_cell, text="", size=None, bold=False, italic=False, colour=None,
         align=None, space_before=None, space_after=None, font=None, indent=None,
         line_spacing=None):
    p = doc_or_cell.add_paragraph()
    if text:
        r = p.add_run(text)
        r.bold = bold
        r.italic = italic
        if size:
            r.font.size = Pt(size)
        if colour:
            r.font.color.rgb = colour
        if font:
            r.font.name = font
    if align is not None:
        p.alignment = align
    pf = p.paragraph_format
    if space_before is not None:
        pf.space_before = Pt(space_before)
    if space_after is not None:
        pf.space_after = Pt(space_after)
    if indent is not None:
        pf.left_indent = Cm(indent)
    if line_spacing is not None:
        pf.line_spacing = line_spacing
    return p


def add_runs(p, parts, size=None):
    for text, fmt in parts:
        r = p.add_run(text)
        r.bold = fmt.get("bold", False)
        r.italic = fmt.get("italic", False)
        if fmt.get("colour"):
            r.font.color.rgb = fmt["colour"]
        r.font.size = Pt(fmt.get("size", size or 11))
        if fmt.get("font"):
            r.font.name = fmt["font"]
    return p


def heading(doc, text, level=2, colour=None, before=None, after=None):
    h = doc.add_heading(text, level=level)
    if colour is not None:
        for r in h.runs:
            r.font.color.rgb = colour
    if before is not None:
        h.paragraph_format.space_before = Pt(before)
    if after is not None:
        h.paragraph_format.space_after = Pt(after)
    return h


def image(doc, name, width_cm=17.2, caption=None):
    if not name:
        return
    path = ART / name
    if not path.exists():
        para(doc, f"[missing illustration: {name}]", italic=True, colour=LIGHT, size=9)
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(str(path), width=Cm(width_cm))
    keep_with_next(p)
    if caption:
        para(doc, caption, size=9, italic=True, colour=GREY,
             align=WD_ALIGN_PARAGRAPH.CENTER, space_after=6)


def boxed(doc, fill="F7F7F7", border="D0D0D0", width_cm=17.4):
    t = doc.add_table(rows=1, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    cell = t.cell(0, 0)
    cell.width = Cm(width_cm)
    shade_cell(cell, fill)
    _borders(cell._tc.get_or_add_tcPr(),
             {"top": "single", "left": "single", "bottom": "single", "right": "single"},
             color=border, size=8, space=4)
    cell_padding(cell, top=110, bottom=110, start=150, end=150)
    cell.paragraphs[0].paragraph_format.space_after = Pt(0)
    no_split(t)
    return cell


def box_end(doc, gap=3):
    para(doc, "", size=gap, space_after=1)


def bullet(doc, text, size=10.5, indent=0.4, marker="•"):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(indent)
    p.paragraph_format.first_line_indent = Cm(-0.35)
    p.paragraph_format.space_after = Pt(2)
    add_runs(p, [(f"{marker}  ", {"size": size}), (text, {"size": size})])
    return p


def checkbox_line(doc, text, size=10.5):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.2)
    p.paragraph_format.space_after = Pt(2)
    add_runs(p, [("☐  ", {"size": size, "bold": True}), (text, {"size": size})])
    return p


def rule(doc, colour="D9D9D9", space_before=2, space_after=8):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    _borders(p._p.get_or_add_pPr(), {"bottom": "single"}, color=colour, size=6, space=1)


def writing_lines(doc, n=2, colour="C4C4C4"):
    for _ in range(n):
        p = para(doc, "", size=11, space_after=10)
        _borders(p._p.get_or_add_pPr(), {"bottom": "dotted"}, color=colour, size=8, space=2)


def set_col_widths(table, widths_cm):
    table.autofit = False
    for row in table.rows:
        for idx, w in enumerate(widths_cm):
            if idx < len(row.cells):
                row.cells[idx].width = Cm(w)


def step_heading(doc, number, label, domain, colour):
    """e.g.  1  Listen and say            Listening and Speaking"""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(9)
    p.paragraph_format.space_after = Pt(1)
    keep_with_next(p)
    add_runs(p, [(f"{number}  ", {"size": 12.5, "bold": True, "colour": colour}),
                 (label, {"size": 11.5, "bold": True})])
    d = doc.add_paragraph()
    d.paragraph_format.space_after = Pt(3)
    keep_with_next(d)
    add_runs(d, [(domain.upper(), {"size": 7.5, "colour": GREY, "bold": False})])
    return p


def domains_strip(doc, domains, colour):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    add_runs(p, [("DOMAINS OF THE WEEK:  ", {"size": 7.5, "bold": True, "colour": colour}),
                 ("  ·  ".join(domains), {"size": 7.5, "colour": GREY})])


def add_footer(section, text):
    section.footer.is_linked_to_previous = False
    p = section.footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    r = p.add_run(text + "   ·   page ")
    r.font.size = Pt(8)
    r.font.color.rgb = GREY
    r.font.name = BODY_FONT
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    inner = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")
    sz = OxmlElement("w:sz")
    sz.set(qn("w:val"), "16")
    rpr.append(sz)
    inner.append(rpr)
    t = OxmlElement("w:t")
    t.text = "1"
    inner.append(t)
    fld.append(inner)
    p._p.append(fld)


def setup_section(section, margin=1.65):
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(margin)
    section.right_margin = Cm(margin)
    section.top_margin = Cm(1.5)
    section.bottom_margin = Cm(1.4)
    section.footer_distance = Cm(0.8)


# ------------------------------------------------------------------ front matter
def build_cover(doc):
    sec = doc.sections[0]
    setup_section(sec, margin=1.3)
    sec.top_margin = Cm(1.2)
    sec.bottom_margin = Cm(1.0)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(4)
    if (ART / "cover-front.jpg").exists():
        p.add_run().add_picture(str(ART / "cover-front.jpg"), width=Cm(17.6))

    para(doc, META["title"], size=40, bold=True, colour=BLUE,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_before=8, space_after=0, font=HEAD_FONT)
    para(doc, META["subtitle"], size=17, bold=True, colour=ORANGE,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2, font=HEAD_FONT)
    para(doc, "English Language · Level I · Cameroon", size=11.5, colour=GREY,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=5)
    band = doc.add_paragraph()
    band.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_runs(band, [("★  ", {"size": 12, "colour": THEME_FILLS and ORANGE}),
                    (META["school"], {"size": 10.5, "bold": True}),
                    ("   ·   ", {"size": 10.5, "colour": GREY}),
                    (META["edition"], {"size": 10.5, "colour": GREY})])
    para(doc, "Follows the Class 1 Integrated Scheme of Work — 8 themes · 32 weeks",
         size=9.5, italic=True, colour=GREY, align=WD_ALIGN_PARAGRAPH.CENTER,
         space_before=2)


def build_title_page(doc):
    para(doc, "", space_after=24)
    para(doc, META["title"], size=28, bold=True, colour=BLUE,
         align=WD_ALIGN_PARAGRAPH.CENTER, font=HEAD_FONT, space_after=2)
    para(doc, META["subtitle"], size=15, bold=True, colour=ORANGE,
         align=WD_ALIGN_PARAGRAPH.CENTER, font=HEAD_FONT, space_after=16)
    for line in (META["level"], META["school"], META["country"], META["edition"]):
        para(doc, line, size=10.5, colour=GREY, align=WD_ALIGN_PARAGRAPH.CENTER,
             space_after=2)
    para(doc, META["authors"], size=9.5, colour=GREY, align=WD_ALIGN_PARAGRAPH.CENTER,
         space_before=8, space_after=2)
    para(doc, "", space_after=18)
    rule(doc)
    para(doc, f"{COUNTS['themes']} themes · {COUNTS['units']} weeks · "
              f"{COUNTS['words']} new words · {COUNTS['songs']} songs · "
              f"{COUNTS['rhymes']} rhymes · {COUNTS['drama']} dramas and presentations",
         size=10.5, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=8)
    para(doc, CONTENT["licence"], size=8.5, colour=LIGHT,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_before=48)
    para(doc, CONTENT["provenance"]["scheme"], size=7.5, colour=LIGHT,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_before=4)


def build_this_book(doc):
    page_break(doc)
    heading(doc, "This book belongs to", level=1)
    for line in META["insideCover"]:
        if line == "":
            para(doc, "", space_after=5)
        else:
            para(doc, line, size=12, space_after=7)
    rule(doc, space_before=8)
    heading(doc, "How to use this book", level=2, before=12)
    for line in META["howToUse"]:
        bullet(doc, line)


def build_cba_page(doc):
    page_break(doc)
    heading(doc, META["cba"]["title"], level=1)
    para(doc, META["cba"]["intro"], size=10.5, italic=True, colour=GREY, space_after=8)
    for block in META["cba"]["blocks"]:
        heading(doc, block["title"], level=3, colour=GREEN, before=8)
        para(doc, block["text"], size=10.5, space_after=4)

    heading(doc, META["stripGuide"]["title"], level=2, before=14)
    para(doc, META["stripGuide"]["intro"], size=10.5, space_after=6)
    t = doc.add_table(rows=1, cols=2)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t, color="E0E0E0", size=6)
    left, right = t.rows[0].cells
    for c in (left, right):
        cell_padding(c, top=90, bottom=90, start=140, end=140)
    left.paragraphs[0].add_run("What I need").bold = True
    for m in META["stripGuide"]["materials"]:
        checkbox_line(left, m, size=9.5)
    right.paragraphs[0].add_run("How to do it well").bold = True
    for r in META["stripGuide"]["rules"]:
        bullet(right, r, size=9.5, marker="·")
    set_col_widths(t, [8.7, 8.7])
    no_split(t)


def build_contents(doc):
    page_break(doc)
    heading(doc, "Contents — the 32 weeks of Class 1", level=1)
    para(doc, "Each theme lasts four weeks and ends with a culminating project strip.",
         size=9.5, italic=True, colour=GREY, space_after=6)
    t = doc.add_table(rows=1, cols=3)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t)
    head = t.rows[0].cells
    for i, txt in enumerate(("Wk", "Week topic", "By the end of the week the pupil can…")):
        shade_cell(head[i], "EFEFEF")
        cell_padding(head[i], top=40, bottom=40)
        r = head[i].paragraphs[0].add_run(txt)
        r.bold = True
        r.font.size = Pt(8.5)
        r.font.color.rgb = GREY
    for th in CONTENT["themes"]:
        row = t.add_row().cells
        merged = row[0].merge(row[2])
        shade_cell(merged, THEME_FILLS[th["n"] - 1])
        cell_padding(merged, top=50, bottom=50)
        p = merged.paragraphs[0]
        add_runs(p, [(f"THEME {th['n']}  ·  {th['title']}",
                      {"bold": True, "size": 9.5,
                       "colour": RGBColor.from_string(THEME_HEX[th["n"] - 1])}),
                    (f"   ({th['weeks']})", {"size": 8.5, "colour": GREY})])
        for u in th["units"]:
            cells = t.add_row().cells
            for c in cells:
                cell_padding(c, top=30, bottom=30)
            r = cells[0].paragraphs[0].add_run(str(u["week"]))
            r.font.size = Pt(8.5)
            r.font.color.rgb = GREY
            r2 = cells[1].paragraphs[0].add_run(u["title"])
            r2.font.size = Pt(8.5)
            r3 = cells[2].paragraphs[0].add_run(u["competence"])
            r3.font.size = Pt(8)
            r3.font.color.rgb = GREY
    set_col_widths(t, [1.4, 7.4, 8.6])

    para(doc, "", space_after=6)
    heading(doc, "At the end of the book", level=3)
    for line in ("Picture dictionary — every new word, by theme and A–Z",
                 "Useful sentences for the classroom (English and French)",
                 "My progress record — all 32 weeks",
                 "Certificate"):
        bullet(doc, line, size=9.5)


# ------------------------------------------------------------------ theme pages
def build_theme_opener(doc, th):
    page_break(doc)
    colour = RGBColor.from_string(THEME_HEX[th["n"] - 1])
    fill = THEME_FILLS[th["n"] - 1]
    image(doc, th["image"], width_cm=17.4)

    band = doc.add_paragraph()
    band.paragraph_format.space_before = Pt(6)
    band.paragraph_format.space_after = Pt(0)
    shade_paragraph(band, fill)
    add_runs(band, [(f"THEME {th['n']}", {"size": 11.5, "bold": True, "colour": colour}),
                    (f"   ·   {th['weeks']}   ·   weeks {th['weekRange']}",
                     {"size": 10, "colour": GREY})])
    para(doc, th["title"], size=26, bold=True, colour=colour, font=HEAD_FONT,
         space_before=4, space_after=5)
    para(doc, th["blurb"], size=11.5, space_after=9)

    heading(doc, "By the end of this theme I can…", level=3, colour=colour, before=4)
    for obj in th["objectives"]:
        bullet(doc, obj, size=10)

    heading(doc, "Culminating project", level=3, colour=colour, before=10)
    cell = boxed(doc, fill=fill, border="D8D8D8")
    p = cell.paragraphs[0]
    add_runs(p, [("★  ", {"size": 11, "colour": ORANGE}),
                 (th["culminatingProject"], {"size": 12, "bold": True, "colour": colour})])
    for i, step in enumerate(th["projectSteps"], 1):
        p = cell.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.left_indent = Cm(0.4)
        p.paragraph_format.first_line_indent = Cm(-0.4)
        add_runs(p, [(f"☐  {i}. ", {"size": 10, "bold": True}), (step, {"size": 10})])
    box_end(doc)

    heading(doc, "In this theme — four weeks", level=3, colour=colour, before=8)
    for u in th["units"]:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.2)
        p.paragraph_format.space_after = Pt(3)
        add_runs(p, [(f"Week {u['week']}  ", {"bold": True, "size": 10.5, "colour": colour}),
                     (u["title"], {"size": 10.5, "bold": True})])
        para(doc, "I can " + u["competence"] + ".", size=9.5, italic=True, colour=GREY,
             indent=1.0, space_after=6)


def build_project_page(doc, th):
    """'I present' page after the four units of a theme."""
    colour = RGBColor.from_string(THEME_HEX[th["n"] - 1])
    fill = THEME_FILLS[th["n"] - 1]
    page_break(doc)
    band = doc.add_paragraph()
    band.paragraph_format.space_after = Pt(2)
    shade_paragraph(band, fill)
    add_runs(band, [(f"THEME {th['n']}  ·  CULMINATING PROJECT",
                     {"size": 9.5, "bold": True, "colour": colour})])
    para(doc, "I present my strip", size=24, bold=True, colour=colour, font=HEAD_FONT,
         space_before=2, space_after=4)
    para(doc, th["culminatingProject"], size=14, bold=True, space_after=6)
    para(doc, "Today you show the class what you have built for four weeks. "
              "Take your time. Stand up. Breathe. Smile. Speak loudly.",
         size=10.5, italic=True, colour=GREY, space_after=10)

    heading(doc, "My strip has…", level=3, colour=colour, before=4)
    for step in th["projectSteps"]:
        checkbox_line(doc, step)

    heading(doc, "When I present, I…", level=3, colour=colour, before=10)
    for line in ("stand up and look at my friends",
                 "speak loudly and slowly",
                 "point to my drawing when I speak about it",
                 "say at least three English sentences",
                 "say \"Thank you for listening!\" at the end"):
        checkbox_line(doc, line)

    heading(doc, "My project mark", level=3, colour=colour, before=10)
    para(doc, "Your teacher uses the same three criteria as you. "
              "Tick together and talk about what to improve.",
         size=9.5, italic=True, colour=GREY, space_after=4)
    criteria = ["My strip is complete (all four weeks).",
                "My drawings and labels are neat and clear.",
                "I spoke in English without reading everything."]
    t = doc.add_table(rows=1, cols=4)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t)
    head = t.rows[0].cells
    cell_padding(head[0])
    shade_cell(head[0], "F2F2F2")
    head[0].paragraphs[0].add_run("Criterion").bold = True
    for i, lvl in enumerate(("Not yet", "Getting there", "Yes, I can"), start=1):
        shade_cell(head[i], "F2F2F2")
        cell_padding(head[i])
        p = head[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(lvl)
        r.bold = True
        r.font.size = Pt(8.5)
    for crit in criteria:
        cells = t.add_row().cells
        for c in cells:
            cell_padding(c, top=70, bottom=70)
        cells[0].paragraphs[0].add_run(crit).font.size = Pt(9.5)
        for i in range(1, 4):
            p = cells[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.add_run("☐").font.size = Pt(11)
    set_col_widths(t, [10.7, 2.2, 2.3, 2.2])
    no_split(t)

    heading(doc, "After the presentation — what next?", level=3, colour=colour, before=12)
    cell = boxed(doc, fill="FFF6E5", border="E8C98A")
    p = cell.paragraphs[0]
    add_runs(p, [("Remediation:  ", {"bold": True, "size": 10, "colour": RGBColor(0x8A, 0x5A, 0x14)}),
                 ("If you ticked \"Not yet\" or \"Getting there\" anywhere, do the practice "
                  "again with your teacher this week. You do not move on until you can say "
                  "\"Yes, I can\".", {"size": 10})])
    box_end(doc)


# ------------------------------------------------------------------ units
def build_unit(doc, th, u):
    colour = RGBColor.from_string(THEME_HEX[th["n"] - 1])
    fill = THEME_FILLS[th["n"] - 1]
    page_break(doc)

    band = doc.add_paragraph()
    band.paragraph_format.space_after = Pt(2)
    shade_paragraph(band, fill)
    add_runs(band, [(f"WEEK {u['week']}", {"size": 10.5, "bold": True, "colour": colour}),
                    (f"    ·    Theme {th['n']}: {th['title']}",
                     {"size": 9, "colour": GREY})])

    h = para(doc, u["title"], size=21, bold=True, colour=colour, font=HEAD_FONT,
             space_before=2, space_after=5)
    keep_with_next(h)

    # competence
    cell = boxed(doc, fill="FFFFFF", border="D8D8D8")
    p = cell.paragraphs[0]
    add_runs(p, [("COMPETENCE:  ", {"size": 8, "bold": True, "colour": colour}),
                 (u["compSentence"], {"size": 10.5, "bold": True})])
    p2 = cell.add_paragraph()
    p2.paragraph_format.space_before = Pt(3)
    add_runs(p2, [("Knowledge · skills · attitudes: ", {"size": 8, "italic": True, "colour": GREY}),
                  ("listening, speaking, reading, writing, phonics, drama, and the mini project.",
                   {"size": 8, "italic": True, "colour": GREY})])
    box_end(doc)
    domains_strip(doc, u["domains"], colour)

    if u["image"]:
        image(doc, u["image"], width_cm=16.6)
    else:
        image(doc, th["image"], width_cm=16.6)

    # entry situation
    s = u["situation"]
    cell = boxed(doc, fill=fill, border="DBDBDB")
    p = cell.paragraphs[0]
    add_runs(p, [(s["label"].upper() + "   ", {"size": 8, "bold": True, "colour": colour}),
                 (s["text"], {"size": 10.5, "italic": True})])
    for q in s["questions"]:
        p = cell.add_paragraph()
        p.paragraph_format.space_after = Pt(1)
        p.paragraph_format.left_indent = Cm(0.2)
        add_runs(p, [("»  ", {"size": 10, "bold": True, "colour": colour}),
                     (q, {"size": 10.5, "bold": True})])
    box_end(doc)

    # 1 listening and speaking
    L = u["listen"]
    step_heading(doc, "1", "Listen and say", L["domain"], colour)
    para(doc, L["instruction"], size=9, italic=True, colour=GREY, space_after=3)
    para(doc, L["title"], size=9.5, bold=True, space_after=3)
    for line in L["lines"]:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.35)
        p.paragraph_format.space_after = Pt(2)
        if ":" in line:
            speaker, rest = line.split(":", 1)
            add_runs(p, [("♪ " + speaker + ":", {"bold": True, "size": 10, "colour": colour}),
                         (rest, {"size": 10.5})])
        else:
            add_runs(p, [("♪ ", {"size": 10, "colour": colour}), (line, {"size": 10.5})])

    # 2 reading
    R = u["read"]
    step_heading(doc, "2", "Read", R["domain"], colour)
    para(doc, R["instruction"], size=9, italic=True, colour=GREY, space_after=3)
    para(doc, R["title"], size=9.5, bold=True, space_after=3)
    t = doc.add_table(rows=len(R["items"]), cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t, color="E4E4E4", size=6)
    for i, item in enumerate(R["items"]):
        cell = t.cell(i, 0)
        cell.width = Cm(17.4)
        cell_padding(cell, top=40, bottom=40)
        p = cell.paragraphs[0]
        add_runs(p, [("▸  ", {"size": 10, "colour": colour}), (item, {"size": 11})])
    no_split(t)
    para(doc, R["task"], size=9, italic=True, colour=GREY, space_before=3, space_after=4)

    # 3 writing
    W = u["write"]
    step_heading(doc, "3", "Write", W["domain"], colour)
    para(doc, W["instruction"], size=9, italic=True, colour=GREY, space_after=3)
    para(doc, W["task"], size=10.5, space_after=4)
    writing_lines(doc, n=2)

    # 4 grammar, vocabulary, pronunciation
    G = u["language"]
    step_heading(doc, "4", "New words and grammar", G["domain"], colour)
    para(doc, G["grammarInstruction"], size=9, italic=True, colour=GREY, space_after=3)
    cell = boxed(doc, fill="F7F7F7", border="DCDCDC")
    p = cell.paragraphs[0]
    add_runs(p, [("Grammar focus: ", {"size": 8, "bold": True, "colour": colour}),
                 (G["grammarFocus"], {"size": 9.5, "bold": True})])
    for line in G["box"]:
        p = cell.add_paragraph()
        p.paragraph_format.space_after = Pt(1)
        add_runs(p, [("· ", {"size": 9.5}), (line, {"size": 9.5})])
    p = cell.add_paragraph()
    p.paragraph_format.space_before = Pt(3)
    add_runs(p, [("Say: ", {"size": 8, "bold": True, "colour": GREY}),
                 ("   ".join(f"“{e}”" for e in G["examples"]), {"size": 9.5, "italic": True})])
    box_end(doc)

    words = G["words"]
    half = (len(words) + 1) // 2
    t = doc.add_table(rows=half + 1, cols=4)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t)
    for i, txt in enumerate(("English", "Français", "English", "Français")):
        cell = t.rows[0].cells[i]
        shade_cell(cell, "F0F0F0")
        cell_padding(cell, top=30, bottom=30)
        r = cell.paragraphs[0].add_run(txt)
        r.bold = True
        r.font.size = Pt(8)
        r.font.color.rgb = GREY
    for i in range(half):
        cells = t.rows[i + 1].cells
        for c in cells:
            cell_padding(c, top=35, bottom=35)
        for col, idx in ((0, i), (2, i + half)):
            if idx < len(words):
                w = words[idx]
                r = cells[col].paragraphs[0].add_run(w["en"])
                r.bold = True
                r.font.size = Pt(10)
                r2 = cells[col + 1].paragraphs[0].add_run(w["fr"])
                r2.font.size = Pt(9)
                r2.font.color.rgb = GREY
    set_col_widths(t, [4.9, 4.1, 4.9, 3.5])
    no_split(t)

    # 5 phonics
    P = u["phonics"]
    step_heading(doc, "5", "Phonics", P["domain"], colour)
    para(doc, P["instruction"], size=9, italic=True, colour=GREY, space_after=3)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    add_runs(p, [("Sound focus: ", {"size": 8, "bold": True, "colour": colour}),
                 (P["focus"], {"size": 9.5, "bold": True})])
    t = doc.add_table(rows=1, cols=len(P["words"]))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t, color="E4E4E4", size=6)
    for i, wd in enumerate(P["words"]):
        cell = t.cell(0, i)
        cell_padding(cell, top=60, bottom=60)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(wd)
        r.font.size = Pt(11)
        r.bold = True
        r.font.name = HEAD_FONT
    set_col_widths(t, [17.4 / max(1, len(P["words"]))] * len(P["words"]))
    no_split(t)

    # 6 literature and drama
    Lit = u["literature"]
    step_heading(doc, "6", f"{Lit['kind']}: {Lit['title']}", Lit["domain"], colour)
    para(doc, Lit["instruction"], size=9, italic=True, colour=GREY, space_after=3)
    cell = boxed(doc, fill=fill, border="DBDBDB")
    for line in Lit["lines"]:
        p = cell.paragraphs[0] if line == Lit["lines"][0] else cell.add_paragraph()
        p.paragraph_format.space_after = Pt(1)
        p.paragraph_format.left_indent = Cm(0.3)
        add_runs(p, [("♪  " if "song" in Lit["kind"].lower() else "", {"size": 9.5, "colour": colour}),
                     (line, {"size": 10.5})])
    box_end(doc)

    # 7 integrate
    I = u["integrate"]
    step_heading(doc, "7", I["label"], "Integration — a new situation", colour)
    para(doc, I["instruction"], size=9, italic=True, colour=GREY, space_after=3)
    cell = boxed(doc, fill="FFF6E5", border="E8C98A")
    p = cell.paragraphs[0]
    add_runs(p, [("★  ", {"size": 10, "colour": ORANGE}), (I["task"], {"size": 10.5})])
    box_end(doc)

    # mini project
    M = u["miniProject"]
    cell = boxed(doc, fill="FFFFFF", border="BFD3E6")
    p = cell.paragraphs[0]
    add_runs(p, [("MINI PROJECT  ", {"size": 8, "bold": True, "colour": BLUE}),
                 (M["text"], {"size": 10, "bold": True})])
    p2 = cell.add_paragraph()
    p2.paragraph_format.space_before = Pt(2)
    add_runs(p2, [(M["instruction"], {"size": 8.5, "italic": True, "colour": GREY})])
    box_end(doc)

    # rubric
    RB = u["rubric"]
    heading(doc, RB["title"], level=3, colour=colour, before=8, after=2)
    para(doc, RB["instruction"], size=8.5, italic=True, colour=GREY, space_after=3)
    t = doc.add_table(rows=1, cols=4)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t)
    head = t.rows[0].cells
    cell_padding(head[0])
    shade_cell(head[0], "F2F2F2")
    head[0].paragraphs[0].add_run("I can…").bold = True
    head[0].paragraphs[0].runs[0].font.size = Pt(8.5)
    for i, lvl in enumerate(RB["levels"], start=1):
        shade_cell(head[i], "F2F2F2")
        cell_padding(head[i])
        p = head[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(lvl)
        r.bold = True
        r.font.size = Pt(8)
    for crit in RB["criteria"]:
        cells = t.add_row().cells
        for c in cells:
            cell_padding(c, top=55, bottom=55)
        cells[0].paragraphs[0].add_run(crit).font.size = Pt(9.5)
        for i in range(1, 4):
            p = cells[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.add_run("☐").font.size = Pt(11)
    set_col_widths(t, [10.7, 2.2, 2.3, 2.2])
    no_split(t)


# ------------------------------------------------------------------ appendix
def build_appendix(doc):
    page_break(doc)
    heading(doc, "Picture dictionary", level=1)
    para(doc, "Every new word in this book, by theme. Point, say the word, then write it in "
              "your exercise book.", size=9.5, italic=True, colour=GREY, space_after=6)
    for group in CONTENT["appendix"]["pictureDictionary"]:
        heading(doc, group["group"], level=3, before=6, after=2)
        words = group["words"]
        cols = 3
        rows = (len(words) + cols - 1) // cols
        t = doc.add_table(rows=rows, cols=cols)
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        table_borders(t, color="E2E2E2", size=6)
        for i, w in enumerate(words):
            cell = t.cell(i // cols, i % cols)
            cell_padding(cell, top=30, bottom=30)
            p = cell.paragraphs[0]
            add_runs(p, [("☐  ", {"size": 9, "colour": LIGHT}), (w, {"size": 10})])
        set_col_widths(t, [5.8, 5.8, 5.8])
        no_split(t)

    heading(doc, "All my words, A to Z", level=2, before=12)
    para(doc, "The number after each word is the week where you learn it.",
         size=8.5, italic=True, colour=GREY, space_after=4)
    index = {}
    for th in CONTENT["themes"]:
        for u in th["units"]:
            for w in u["language"]["words"]:
                index.setdefault(w["en"], []).append(u["week"])
    keys = sorted(index, key=lambda w: w.lower())
    pairs = [[(k, index[k]) for k in keys[i:i + 3]] for i in range(0, len(keys), 3)]
    t = doc.add_table(rows=len(pairs), cols=3)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t, color="E2E2E2", size=6)
    for r, chunk in enumerate(pairs):
        for c, (word, wks) in enumerate(chunk):
            cell = t.cell(r, c)
            cell_padding(cell, top=20, bottom=20)
            p = cell.paragraphs[0]
            add_runs(p, [("☐  ", {"size": 8, "colour": LIGHT}), (word, {"size": 8.5}),
                         ("  " + ", ".join(str(n) for n in wks), {"size": 7.5, "colour": LIGHT})])
    set_col_widths(t, [5.8, 5.8, 5.8])

    page_break(doc)
    heading(doc, "Useful sentences", level=1)
    para(doc, "Say these every day in class. Your teacher will help you.",
         size=9.5, italic=True, colour=GREY, space_after=6)
    t = doc.add_table(rows=1, cols=2)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t)
    head = t.rows[0].cells
    for i, txt in enumerate(("In English", "En français")):
        shade_cell(head[i], "EFEFEF")
        cell_padding(head[i], top=40, bottom=40)
        r = head[i].paragraphs[0].add_run(txt)
        r.bold = True
        r.font.size = Pt(9.5)
    for en, fr in _us:
        cells = t.add_row().cells
        for c in cells:
            cell_padding(c, top=40, bottom=40)
        r = cells[0].paragraphs[0].add_run(en)
        r.font.size = Pt(10)
        r2 = cells[1].paragraphs[0].add_run(fr)
        r2.font.size = Pt(9)
        r2.font.color.rgb = GREY
    set_col_widths(t, [9.6, 7.8])
    no_split(t)

    heading(doc, "My progress record", level=2, before=14)
    para(doc, "Your teacher ticks a box when you finish a week. Colour the star when you "
              "presented your strip.", size=8.5, italic=True, colour=GREY, space_after=4)
    t = doc.add_table(rows=1, cols=5)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t)
    head = t.rows[0].cells
    for i, txt in enumerate(("Wk", "Week topic", "Done", "Date", "Star")):
        shade_cell(head[i], "EFEFEF")
        cell_padding(head[i], top=25, bottom=25)
        r = head[i].paragraphs[0].add_run(txt)
        r.bold = True
        r.font.size = Pt(8)
        r.font.color.rgb = GREY
    for th in CONTENT["themes"]:
        for u in th["units"]:
            cells = t.add_row().cells
            for c in cells:
                cell_padding(c, top=25, bottom=25)
            r = cells[0].paragraphs[0].add_run(str(u["week"]))
            r.font.size = Pt(8)
            r2 = cells[1].paragraphs[0].add_run(u["title"])
            r2.font.size = Pt(8)
            cells[2].paragraphs[0].add_run("☐").font.size = Pt(10)
            cells[3].paragraphs[0].add_run("________").font.size = Pt(7.5)
            cells[4].paragraphs[0].add_run("☆").font.size = Pt(11)
    set_col_widths(t, [1.2, 10.2, 1.4, 2.8, 1.6])

    page_break(doc)
    heading(doc, "Certificate", level=1)
    para(doc, "", space_after=14)
    if (ART / "cover.jpg").exists():
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(str(ART / "cover.jpg"), width=Cm(5.4))
    para(doc, "This is to certify that", size=11.5, align=WD_ALIGN_PARAGRAPH.CENTER,
         space_before=8, space_after=14)
    writing_lines(doc, 1)
    para(doc, f"has completed My English Book — Class 1: {COUNTS['themes']} themes and "
              f"{COUNTS['units']} weeks, with {COUNTS['themes']} project strips presented.",
         size=10.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=8, space_after=18)
    para(doc, CONTENT["appendix"]["certificate"], size=10.5,
         align=WD_ALIGN_PARAGRAPH.CENTER)
    para(doc, "", space_after=22)
    para(doc, "Well done!  ★  Bravo !", size=16, bold=True, colour=ORANGE,
         align=WD_ALIGN_PARAGRAPH.CENTER)
    para(doc, META["school"] + "  ·  " + META["edition"], size=8.5, colour=LIGHT,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_before=8)


# ------------------------------------------------------------------ build
def main():
    doc = Document()
    style_defaults(doc)
    doc.core_properties.title = f"{META['title']} — {META['subtitle']}"
    doc.core_properties.author = META["school"]
    doc.core_properties.subject = ("Class 1 English pupil's book following the EFEDI Class 1 "
                                   "Integrated Scheme of Work (CBA)")
    doc.core_properties.language = "en-GB"
    doc.core_properties.comments = ("Generated by scripts/build_class1_docx.py from "
                                    "content.json; text written from the scheme of work.")

    build_cover(doc)

    body = doc.add_section(WD_SECTION.NEW_PAGE)
    setup_section(body)
    add_footer(body, f"{META['title']} · {META['subtitle']}")

    build_title_page(doc)
    build_this_book(doc)
    build_cba_page(doc)
    build_contents(doc)

    for th in CONTENT["themes"]:
        build_theme_opener(doc, th)
        for u in th["units"]:
            build_unit(doc, th, u)
        build_project_page(doc, th)

    build_appendix(doc)

    doc.save(OUT)
    print(f"wrote {OUT}  ({OUT.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
