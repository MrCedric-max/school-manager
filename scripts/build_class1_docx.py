#!/usr/bin/env python3
"""Build the Class 1 Pupil's Book (.docx) from books/class-1/content.json.

    python3 scripts/build_class1_docx.py

Output: books/class-1/My-English-Book-Class-1-Pupils-Book.docx
A4, print-ready: cover, title page, how-to-use, contents, 5 theme openers,
12 units, picture dictionary, useful sentences, progress record, certificate.
Images come from books/class-1/illustrations/print/*.jpg
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

# ---------- palette ----------
INK = RGBColor(0x22, 0x22, 0x22)
GREY = RGBColor(0x66, 0x66, 0x66)
LIGHT = RGBColor(0x8A, 0x8A, 0x8A)
THEME_COLOURS = ["1F7A45", "D2691E", "1B5E9E", "6A3D9A", "B03A2E"]  # per theme
THEME_FILLS = ["E3F1E8", "FBEBE0", "E4EEF8", "EFE8F7", "FAE7E5"]

BODY_FONT = "Verdana"
HEAD_FONT = "Trebuchet MS"

_p = CONTENT["meta"]

# ---------------------------------------------------------------- xml helpers
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
    """edges: dict of side -> (val) e.g. {'top': 'single'} ; single element per side."""
    bdr = OxmlElement("w:pBdr" if pr.tag == qn("w:pPr") else "w:tcBorders")
    order = ("top", "left", "bottom", "right", "between", "bar")
    for side in order:
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


def table_borders(table, color="C9C9C9", size=8, inside=True):
    tblPr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    sides = ["top", "left", "bottom", "right"] + (["insideH", "insideV"] if inside else [])
    for side in sides:
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(size))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)
        borders.append(el)
    tblPr.insert_element_before(borders, *TBLPR_AFTER_BORDERS)


def keep_with_next(p, on=True):
    p.paragraph_format.keep_with_next = on


def page_break(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


# ---------------------------------------------------------------- text helpers
def style_defaults(doc):
    st = doc.styles["Normal"]
    st.font.name = BODY_FONT
    st.font.size = Pt(11.5)
    st.font.color.rgb = INK
    st.paragraph_format.space_after = Pt(4)
    st.paragraph_format.line_spacing = 1.12
    rpr = st.element.get_or_add_rPr().get_or_add_rFonts()
    rpr.set(qn("w:eastAsia"), BODY_FONT)
    rpr.set(qn("w:cs"), BODY_FONT)
    for name, size, colour, bold in (
        ("Heading 1", 22, RGBColor(0x1B, 0x5E, 0x9E), True),
        ("Heading 2", 15.5, INK, True),
        ("Heading 3", 13, INK, True),
    ):
        s = doc.styles[name]
        s.font.name = HEAD_FONT
        s.font.size = Pt(size)
        s.font.color.rgb = colour
        s.font.bold = bold
        s.paragraph_format.space_before = Pt(10)
        s.paragraph_format.space_after = Pt(5)
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
    """parts: list of (text, {bold, italic, colour, size, font})"""
    for text, fmt in parts:
        r = p.add_run(text)
        r.bold = fmt.get("bold", False)
        r.italic = fmt.get("italic", False)
        if fmt.get("colour"):
            r.font.color.rgb = fmt["colour"]
        r.font.size = Pt(fmt.get("size", size or 11.5))
        if fmt.get("font"):
            r.font.name = fmt["font"]
    return p


def heading(doc, text, level=2, colour=None, before=None):
    h = doc.add_heading(text, level=level)
    if colour is not None:
        for r in h.runs:
            r.font.color.rgb = colour
    if before is not None:
        h.paragraph_format.space_before = Pt(before)
    return h


def image(doc, name, width_cm=17.4, caption=None, caption_colour=None):
    path = ART / name
    if not path.exists():
        para(doc, f"[missing illustration: {name}]", italic=True, colour=LIGHT)
    else:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.space_after = Pt(2)
        p.add_run().add_picture(str(path), width=Cm(width_cm))
        keep_with_next(p)
    if caption:
        c = para(doc, caption, size=9.5, italic=True, colour=caption_colour or GREY,
                 align=WD_ALIGN_PARAGRAPH.CENTER, space_after=8)
        keep_with_next(c, False)


def boxed(doc, fill="F4F4F4", border="D0D0D0", width_cm=17.4):
    """One-cell shaded, bordered box; returns the cell to fill."""
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
    # remove the empty default paragraph and keep spacing tight
    cell.paragraphs[0].paragraph_format.space_after = Pt(0)
    no_split(t)
    return cell


def no_split(table):
    for row in table.rows:
        trPr = row._tr.get_or_add_trPr()
        cant = OxmlElement("w:cantSplit")
        trPr.insert_element_before(cant, "w:trHeight", "w:tblHeader", "w:tblCellSpacing",
                                   "w:jc", "w:hidden", "w:trPrChange")


def box_end(doc):
    """Small spacer after a boxed table."""
    para(doc, "", size=4, space_after=2)


def bullet(doc, text, size=11.5, marker="•", indent=0.4):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(indent)
    p.paragraph_format.first_line_indent = Cm(-0.4)
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(f"{marker}  {text}")
    r.font.size = Pt(size)
    return p


def checkbox_line(doc, text, size=11.5, fill=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.left_indent = Cm(0.2)
    add_runs(p, [("☐  ", {"size": size, "bold": True}), (text, {"size": size})])
    if fill:
        shade_paragraph(p, fill)
    return p


def rule(doc, colour="D9D9D9", space_before=2, space_after=8):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    _borders(p._p.get_or_add_pPr(), {"bottom": "single"}, color=colour, size=6, space=1)


def writing_lines(doc, n=2, colour="BFBFBF"):
    for _ in range(n):
        p = para(doc, "", size=11, space_after=10)
        _borders(p._p.get_or_add_pPr(), {"bottom": "dotted"}, color=colour, size=8, space=2)


def word_bank(cell, words, colour=GREY):
    p = cell.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    add_runs(p, [("Word bank: ", {"bold": True, "size": 10, "colour": colour}),
                 ("  ·  ".join(words), {"size": 10, "italic": True, "colour": colour})])


def set_col_widths(table, widths_cm):
    table.autofit = False
    for row in table.rows:
        for idx, w in enumerate(widths_cm):
            if idx < len(row.cells):
                row.cells[idx].width = Cm(w)


def add_footer(section, text):
    section.footer.is_linked_to_previous = False
    p = section.footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    r = p.add_run(text + "   ·   page ")
    r.font.size = Pt(8.5)
    r.font.color.rgb = GREY
    r.font.name = BODY_FONT
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    inner = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")
    sz = OxmlElement("w:sz")
    sz.set(qn("w:val"), "17")
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
    section.bottom_margin = Cm(1.5)
    section.footer_distance = Cm(0.8)


# ---------------------------------------------------------------- cover
def build_cover(doc):
    sec = doc.sections[0]
    setup_section(sec, margin=1.3)
    sec.top_margin = Cm(1.2)
    sec.bottom_margin = Cm(1.0)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(4)
    if (ART / "cover-front.jpg").exists():
        p.add_run().add_picture(str(ART / "cover-front.jpg"), width=Cm(18.0))

    t = para(doc, _p["title"], size=40, bold=True, colour=RGBColor(0x1B, 0x5E, 0x9E),
             align=WD_ALIGN_PARAGRAPH.CENTER, space_before=8, space_after=0, font=HEAD_FONT)
    para(doc, _p["subtitle"], size=17, bold=True, colour=RGBColor(0xD2, 0x69, 0x1E),
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2, font=HEAD_FONT)
    para(doc, "English for Class 1  ·  Cameroon", size=12, colour=GREY,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=6)
    band = doc.add_paragraph()
    band.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_runs(band, [("★  ", {"size": 13, "colour": RGBColor(0xB0, 0x3A, 0x2E)}),
                    (_p["school"], {"size": 11, "bold": True}),
                    ("   ·   ", {"size": 11, "colour": GREY}),
                    (_p["edition"], {"size": 11, "colour": GREY})])


# ---------------------------------------------------------------- front matter
def build_title_page(doc):
    para(doc, "", space_after=30)
    para(doc, _p["title"], size=30, bold=True, colour=RGBColor(0x1B, 0x5E, 0x9E),
         align=WD_ALIGN_PARAGRAPH.CENTER, font=HEAD_FONT, space_after=2)
    para(doc, _p["subtitle"], size=16, bold=True, colour=RGBColor(0xD2, 0x69, 0x1E),
         align=WD_ALIGN_PARAGRAPH.CENTER, font=HEAD_FONT, space_after=18)
    for line in (_p["level"], _p["school"], _p["country"], _p["edition"], _p["authors"]):
        para(doc, line, size=11, colour=GREY, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    para(doc, "", space_after=24)
    rule(doc)
    n_words = sum(len(u["words"]) for th in CONTENT["themes"] for u in th["units"])
    para(doc, f"{_p['units']} units · {_p['themes']} themes · {n_words} new words · "
              f"{_p['units']} songs · {_p['units']} stories",
         size=11, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10)
    para(doc, CONTENT["licence"], size=9, colour=LIGHT, align=WD_ALIGN_PARAGRAPH.CENTER,
         space_before=60)


def build_this_book(doc):
    page_break(doc)
    heading(doc, "This book belongs to", level=1,
            colour=RGBColor(0x1B, 0x5E, 0x9E))
    for line in _p["insideCover"]:
        if line == "":
            para(doc, "", space_after=6)
        else:
            para(doc, line, size=12.5, space_after=8)
    rule(doc, space_before=10)
    heading(doc, "How to use this book", level=2, before=14)
    for line in _p["howToUse"]:
        bullet(doc, line)
    rule(doc, space_before=10)
    heading(doc, "The themes", level=2, before=12)
    t = doc.add_table(rows=1, cols=3)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t)
    hdr = t.rows[0].cells
    for i, txt in enumerate(("Theme", "Weeks", "Title")):
        shade_cell(hdr[i], "EFEFEF")
        cell_padding(hdr[i])
        hdr[i].paragraphs[0].add_run(txt).bold = True
        hdr[i].paragraphs[0].runs[0].font.size = Pt(10)
    for th in CONTENT["themes"]:
        row = t.add_row().cells
        for i, txt in enumerate((str(th["n"]), th["weeks"], th["title"])):
            cell_padding(row[i])
            r = row[i].paragraphs[0].add_run(txt)
            r.font.size = Pt(10)
    set_col_widths(t, [1.6, 3.0, 12.4])


def build_contents(doc):
    page_break(doc)
    heading(doc, "Contents", level=1, colour=RGBColor(0x1B, 0x5E, 0x9E))
    t = doc.add_table(rows=1, cols=4)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t)
    head = t.rows[0].cells
    for i, txt in enumerate(("Unit", "Week", "Title", "New words")):
        shade_cell(head[i], "EFEFEF")
        cell_padding(head[i])
        r = head[i].paragraphs[0].add_run(txt)
        r.bold = True
        r.font.size = Pt(10)
    for th in CONTENT["themes"]:
        row = t.add_row().cells
        shade_cell(row[0], THEME_FILLS[th["n"] - 1])
        for i in range(4):
            cell_padding(row[i])
        merged = row[0].merge(row[3])
        p = merged.paragraphs[0]
        add_runs(p, [(f"THEME {th['n']}  ·  {th['title']}", {"bold": True, "size": 10.5,
                                                            "colour": RGBColor.from_string(
                                                                ("1F7A45", "D2691E", "1B5E9E",
                                                                 "6A3D9A", "B03A2E")[th["n"] - 1])}),
                    (f"   ({th['weeks']})", {"size": 9.5, "colour": GREY})])
        for u in th["units"]:
            r2 = t.add_row().cells
            for i in range(4):
                cell_padding(r2[i])
            for i, txt in enumerate((str(u["n"]), u["week"], u["title"],
                                     str(len(u["words"])))):
                rr = r2[i].paragraphs[0].add_run(txt)
                rr.font.size = Pt(10)
    set_col_widths(t, [1.5, 2.4, 11.2, 2.3])
    para(doc, "", space_after=8)
    n_words = len({w["en"].lower() for th in CONTENT["themes"] for u in th["units"]
                   for w in u["words"]})
    heading(doc, "At the end of the book", level=3)
    for line in (f"Picture dictionary — all {n_words} new words, by topic and A–Z",
                 "Useful sentences for the classroom",
                 "My progress record",
                 "Certificate for the pupil"):
        bullet(doc, line, size=10.5)
    heading(doc, "Songs in this book", level=3, before=10)
    songs = [u["song"]["title"].replace("Song: ", "").replace("Chant: ", "")
             for th in CONTENT["themes"] for u in th["units"]]
    para(doc, "  ·  ".join(songs), size=10, italic=True, colour=GREY)


# ---------------------------------------------------------------- theme opener
def build_theme_opener(doc, th):
    page_break(doc)
    colour = RGBColor.from_string(("1F7A45", "D2691E", "1B5E9E", "6A3D9A", "B03A2E")[th["n"] - 1])
    fill = THEME_FILLS[th["n"] - 1]
    image(doc, th["image"], width_cm=17.6)
    band = doc.add_paragraph()
    band.paragraph_format.space_before = Pt(6)
    band.paragraph_format.space_after = Pt(0)
    shade_paragraph(band, fill)
    add_runs(band, [(f"THEME {th['n']}", {"size": 12, "bold": True, "colour": colour}),
                    (f"   ·   {th['weeks']}", {"size": 11, "colour": GREY})])
    t = para(doc, th["title"], size=27, bold=True, colour=colour, font=HEAD_FONT,
             space_before=4, space_after=6)
    para(doc, th["blurb"], size=12, space_after=12)
    heading(doc, "In this theme", level=3, colour=colour, before=6)
    for u in th["units"]:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.2)
        p.paragraph_format.space_after = Pt(4)
        add_runs(p, [(f"Unit {u['n']}  ", {"bold": True, "size": 11.5, "colour": colour}),
                     (f"{u['title']}", {"size": 11.5, "bold": True}),
                     (f"   ({u['week']})", {"size": 10, "colour": GREY})])
        para(doc, u["competence"], size=10, italic=True, colour=GREY, indent=1.2,
             space_after=8)
    heading(doc, "A song to start", level=3, colour=colour, before=8)
    box = boxed(doc, fill=fill, border="D8D8D8")
    p = box.paragraphs[0]
    add_runs(p, [("♪  " + song_title_for(th), {"size": 11.5, "bold": True, "colour": colour})])
    para(box, "You will learn this song with your teacher at the end of the theme. "
              "Sing it together, with actions.", size=10, colour=GREY)


def song_title_for(th):
    titles = [u["song"]["title"].replace("Song: ", "").replace("Chant: ", "")
              for u in th["units"]]
    return " / ".join(titles[:2])


# ---------------------------------------------------------------- exercises
def exercise_header(doc, ex, colour):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(2)
    keep_with_next(p)
    add_runs(p, [(f"{ex['id']}   ", {"size": 12, "bold": True, "colour": colour}),
                 (ex["instructions"], {"size": 11, "bold": True})])
    return p


def numbered_lines(doc, lines, prefix="", size=11.5, gap=9):
    for i, line in enumerate(lines, 1):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.5)
        p.paragraph_format.space_after = Pt(gap)
        add_runs(p, [(f"{i}.  " if prefix == "num" else prefix, {"size": size, "bold": True}),
                     (line, {"size": size})])


def exercise(doc, ex, colour):
    exercise_header(doc, ex, colour)
    kind = ex["type"]

    if kind == "match":
        t = doc.add_table(rows=1, cols=3)
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        table_borders(t, color="DCDCDC", size=6)
        head = t.rows[0].cells
        for i, txt in enumerate(("", "", "")):
            shade_cell(head[i], "F7F7F7")
            cell_padding(head[i])
        rows = max(len(ex["left"]), len(ex["right"]))
        for i in range(rows):
            cells = t.add_row().cells
            for c in cells:
                cell_padding(c, top=130, bottom=130)
            if i < len(ex["left"]):
                r = cells[0].paragraphs[0].add_run(f"☐  {ex['left'][i]}")
                r.font.size = Pt(11)
            if i < len(ex["right"]):
                r = cells[1].paragraphs[0].add_run("· · · · · · · ·")
                r.font.size = Pt(10)
                r.font.color.rgb = LIGHT
                cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
                r2 = cells[2].paragraphs[0].add_run(f"☐  {ex['right'][i]}")
                r2.font.size = Pt(11)
        set_col_widths(t, [6.2, 4.0, 6.4])
        table_borders(t, color="DCDCDC", size=6)
        if ex.get("wordbank"):
            word_bank_simple(doc, ex["wordbank"])

    elif kind == "gaps":
        numbered_lines(doc, ex["lines"], prefix="num", gap=11)
        if ex.get("wordbank"):
            word_bank_simple(doc, ex["wordbank"])

    elif kind == "gap-sentence":
        numbered_lines(doc, ex["lines"], prefix="num", gap=11)

    elif kind == "trace":
        for item in ex["items"]:
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(2)
            keep_with_next(p)
            r = p.add_run(item)
            r.font.size = Pt(24)
            r.font.name = HEAD_FONT
            r.font.color.rgb = RGBColor(0xBF, 0xBF, 0xBF)
            writing_lines(doc, n=2)

    elif kind == "tick":
        t = doc.add_table(rows=1, cols=1 + len(ex["options"]))
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        table_borders(t)
        head = t.rows[0].cells
        cell_padding(head[0])
        shade_cell(head[0], "F7F7F7")
        head[0].paragraphs[0].add_run("").font.size = Pt(10)
        for i, opt in enumerate(ex["options"], start=1):
            shade_cell(head[i], "F7F7F7")
            cell_padding(head[i])
            p = head[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run(opt)
            r.bold = True
            r.font.size = Pt(9.5)
        for row_txt in ex["rows"]:
            cells = t.add_row().cells
            for c in cells:
                cell_padding(c)
            r = cells[0].paragraphs[0].add_run(row_txt)
            r.font.size = Pt(10.5)
            for i in range(1, len(ex["options"]) + 1):
                p = cells[i].paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.add_run("☐").font.size = Pt(12)
        widths = [10.9] + [6.5 / len(ex["options"])] * len(ex["options"])
        set_col_widths(t, widths)

    elif kind == "order":
        for line in ex["lines"]:
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.5)
            p.paragraph_format.space_after = Pt(8)
            p.add_run(line).font.size = Pt(11.5)

    elif kind == "draw":
        t = doc.add_table(rows=1, cols=1)
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        table_borders(t, color="C9C9C9", size=8, inside=False)
        cell = t.cell(0, 0)
        cell.width = Cm(17.4)
        t.rows[0].height = Cm(7.6)
        cell_padding(cell, top=60, bottom=60)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(f"[ {ex.get('caption', 'Draw here')} ]")
        r.font.size = Pt(9.5)
        r.italic = True
        r.font.color.rgb = LIGHT


def word_bank_simple(doc, words):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(6)
    add_runs(p, [("Word bank:  ", {"bold": True, "size": 10, "colour": GREY}),
                 ("   ·   ".join(words), {"size": 10, "italic": True, "colour": GREY})])


# ---------------------------------------------------------------- unit
def build_unit(doc, th, u):
    colour = RGBColor.from_string(("1F7A45", "D2691E", "1B5E9E", "6A3D9A", "B03A2E")[th["n"] - 1])
    fill = THEME_FILLS[th["n"] - 1]
    page_break(doc)

    band = doc.add_paragraph()
    band.paragraph_format.space_after = Pt(2)
    shade_paragraph(band, fill)
    add_runs(band, [(f"UNIT {u['n']}", {"size": 11, "bold": True, "colour": colour}),
                    (f"    ·    {u['week']}    ·    Theme {th['n']}: {th['title']}",
                     {"size": 9.5, "colour": GREY})])

    h = para(doc, u["title"], size=24, bold=True, colour=colour, font=HEAD_FONT,
             space_before=2, space_after=6)
    keep_with_next(h)

    # competence
    cell = boxed(doc, fill="FFFFFF", border="D8D8D8")
    p = cell.paragraphs[0]
    add_runs(p, [("I can…  ", {"size": 10, "bold": True, "colour": colour}),
                 (u["competence"], {"size": 10.5, "italic": True})])
    box_end(doc)

    image(doc, u["image"], width_cm=17.2, caption=u["caption"])

    # 1 listen
    heading(doc, "1  Listen and say", level=3, colour=colour, before=4)
    para(doc, u["listen"]["instructions"], size=10, italic=True, colour=GREY, space_after=5)
    for line in u["listen"]["lines"]:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.3)
        p.paragraph_format.space_after = Pt(3)
        if ":" in line:
            speaker, rest = line.split(":", 1)
            add_runs(p, [(f"♪ {speaker}:", {"bold": True, "size": 11, "colour": colour}),
                         (rest, {"size": 11.5})])
        else:
            add_runs(p, [(line, {"size": 11.5})])

    # 2 words
    heading(doc, "2  New words", level=3, colour=colour, before=10)
    words = u["words"]
    half = (len(words) + 1) // 2
    rows = half
    t = doc.add_table(rows=1, cols=4)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t)
    head = t.rows[0].cells
    for i, txt in enumerate(("English", "Français", "English", "Français")):
        shade_cell(head[i], "F0F0F0")
        cell_padding(head[i], top=50, bottom=50)
        r = head[i].paragraphs[0].add_run(txt)
        r.bold = True
        r.font.size = Pt(9)
        r.font.color.rgb = GREY
    for i in range(rows):
        cells = t.add_row().cells
        for c in cells:
            cell_padding(c, top=45, bottom=45)
        for col, idx in ((0, i), (2, i + half)):
            if idx < len(words):
                w = words[idx]
                r = cells[col].paragraphs[0].add_run(w["en"])
                r.bold = True
                r.font.size = Pt(10.5)
                r2 = cells[col + 1].paragraphs[0].add_run(w["fr"])
                r2.font.size = Pt(9.5)
                r2.font.color.rgb = GREY
    set_col_widths(t, [4.9, 4.1, 4.9, 3.5])

    # 3 talk
    heading(doc, "3  Talk with a friend", level=3, colour=colour, before=12)
    cell = boxed(doc, fill=fill, border="DBDBDB")
    para(cell, u["talk"]["instructions"], size=10.5, italic=True, space_after=5)
    for line in u["talk"]["questions"]:
        p = cell.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.left_indent = Cm(0.2)
        add_runs(p, [("»  ", {"size": 11, "bold": True, "colour": colour}),
                     (line, {"size": 11, "bold": line.strip().endswith(("?", ":", "______"))})])
    box_end(doc)

    # 4 practice
    heading(doc, "4  Do it", level=3, colour=colour, before=8)
    for ex in u["practice"]:
        exercise(doc, ex, colour)

    # challenge
    heading(doc, "Challenge", level=3, colour=colour, before=12)
    cell = boxed(doc, fill="FFFFFF", border="D8D8D8")
    p = cell.paragraphs[0]
    add_runs(p, [("★  ", {"size": 11, "colour": RGBColor(0xD2, 0x69, 0x1E)}),
                 (u["challenge"], {"size": 10.5})])
    box_end(doc)

    # song
    heading(doc, "Song", level=3, colour=colour, before=8)
    cell = boxed(doc, fill=fill, border="DBDBDB")
    p = cell.paragraphs[0]
    add_runs(p, [(u["song"]["title"], {"bold": True, "size": 11, "colour": colour})])
    for line in u["song"]["lines"]:
        para(cell, "♪  " + line, size=11, space_after=1, indent=0.3)
    box_end(doc)

    # story
    heading(doc, "Story", level=3, colour=colour, before=8)
    cell = boxed(doc, fill="FFFFFF", border="D8D8D8")
    p = cell.paragraphs[0]
    add_runs(p, [(u["story"]["title"], {"bold": True, "size": 11.5, "colour": colour})])
    for line in u["story"]["lines"]:
        para(cell, line, size=11.5, space_after=3)
    p = cell.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    add_runs(p, [("Say it together:  ", {"bold": True, "size": 10.5, "colour": colour}),
                 (u["story"]["say"], {"italic": True, "size": 11.5})])
    box_end(doc)

    # check
    heading(doc, "Check yourself", level=3, colour=colour, before=8)
    for line in u["check"]:
        checkbox_line(doc, line, size=11)

    # homework
    cell = boxed(doc, fill="FFF6E5", border="E8C98A")
    p = cell.paragraphs[0]
    add_runs(p, [("At home:  ", {"bold": True, "size": 10.5,
                                 "colour": RGBColor(0x8A, 0x5A, 0x14)}),
                 (u["homework"], {"size": 10.5})])
    box_end(doc)


# ---------------------------------------------------------------- appendix
def build_appendix(doc):
    page_break(doc)
    heading(doc, "Picture dictionary", level=1, colour=RGBColor(0x1B, 0x5E, 0x9E))
    para(doc, "All the new words in this book. Point, say, and then write the word in "
              "your exercise book.", size=10, italic=True, colour=GREY, space_after=8)
    for group in CONTENT["appendix"]["pictureDictionary"]:
        heading(doc, group["group"], level=3, before=8)
        words = group["words"]
        cols = 3
        rows = (len(words) + cols - 1) // cols
        t = doc.add_table(rows=rows, cols=cols)
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        table_borders(t, color="E2E2E2", size=6)
        for i, w in enumerate(words):
            cell = t.cell(i // cols, i % cols)
            cell_padding(cell, top=40, bottom=40)
            p = cell.paragraphs[0]
            add_runs(p, [("☐  ", {"size": 9, "colour": LIGHT}), (w, {"size": 10.5})])
        set_col_widths(t, [5.8, 5.8, 5.8])

    heading(doc, "All my words, A to Z", level=2, before=16)
    para(doc, "The number after each word is the unit where you learn it. Tick the word "
              "when you can read it and say it without help.",
         size=9.5, italic=True, colour=GREY, space_after=6)
    index = {}
    for th in CONTENT["themes"]:
        for u in th["units"]:
            for w in u["words"]:
                index.setdefault(w["en"], []).append(u["n"])
    keys = sorted(index, key=lambda w: w.lower())
    pairs = [[(k, index[k]) for k in keys[i:i + 3]] for i in range(0, len(keys), 3)]
    t = doc.add_table(rows=len(pairs), cols=3)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t, color="E2E2E2", size=6)
    for r, chunk in enumerate(pairs):
        for c, (word, unit_list) in enumerate(chunk):
            cell = t.cell(r, c)
            cell_padding(cell, top=30, bottom=30)
            p2 = cell.paragraphs[0]
            add_runs(p2, [("☐  ", {"size": 9, "colour": LIGHT}),
                          (word, {"size": 10}),
                          ("  " + ", ".join(str(n) for n in unit_list),
                           {"size": 8.5, "colour": LIGHT})])
    set_col_widths(t, [5.8, 5.8, 5.8])

    page_break(doc)
    heading(doc, "Useful sentences", level=1, colour=RGBColor(0x1B, 0x5E, 0x9E))
    para(doc, "Say these every day in class. Your teacher will help you.",
         size=10, italic=True, colour=GREY, space_after=8)
    t = doc.add_table(rows=1, cols=2)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t)
    head = t.rows[0].cells
    for i, txt in enumerate(("In English", "En français")):
        shade_cell(head[i], "EFEFEF")
        cell_padding(head[i])
        r = head[i].paragraphs[0].add_run(txt)
        r.bold = True
        r.font.size = Pt(10)
    for en, fr in CONTENT["appendix"]["usefulSentences"]:
        cells = t.add_row().cells
        for c in cells:
            cell_padding(c)
        r = cells[0].paragraphs[0].add_run(en)
        r.font.size = Pt(10.5)
        r2 = cells[1].paragraphs[0].add_run(fr)
        r2.font.size = Pt(9.5)
        r2.font.color.rgb = GREY
    set_col_widths(t, [9.6, 7.8])

    para(doc, "", space_after=12)
    heading(doc, "My progress record", level=2, before=12)
    para(doc, "Your teacher ticks a box when you finish a unit. Colour the star when "
              "you can sing the song.", size=10, italic=True, colour=GREY, space_after=6)
    t = doc.add_table(rows=1, cols=5)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    table_borders(t)
    head = t.rows[0].cells
    for i, txt in enumerate(("Unit", "Title", "Done", "Date", "Star")):
        shade_cell(head[i], "EFEFEF")
        cell_padding(head[i], top=50, bottom=50)
        r = head[i].paragraphs[0].add_run(txt)
        r.bold = True
        r.font.size = Pt(9.5)
    for th in CONTENT["themes"]:
        for u in th["units"]:
            cells = t.add_row().cells
            for c in cells:
                cell_padding(c, top=60, bottom=60)
            r = cells[0].paragraphs[0].add_run(str(u["n"]))
            r.font.size = Pt(10)
            r2 = cells[1].paragraphs[0].add_run(u["title"])
            r2.font.size = Pt(10)
            cells[2].paragraphs[0].add_run("☐").font.size = Pt(12)
            cells[3].paragraphs[0].add_run("__________").font.size = Pt(9)
            cells[4].paragraphs[0].add_run("☆").font.size = Pt(13)
    set_col_widths(t, [1.5, 9.6, 1.6, 3.0, 1.7])

    page_break(doc)
    heading(doc, "Certificate", level=1, colour=RGBColor(0x1B, 0x5E, 0x9E))
    para(doc, "", space_after=20)
    image(doc, "cover.jpg", width_cm=6.0)
    para(doc, "This is to certify that", size=12, align=WD_ALIGN_PARAGRAPH.CENTER,
         space_before=10, space_after=16)
    for _ in range(2):
        writing_lines(doc, 1)
    para(doc, "has finished My English Book — Class 1 (12 units)", size=11.5,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_before=8, space_after=22)
    para(doc, CONTENT["appendix"]["certificate"], size=11,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_before=6)
    para(doc, "", space_after=26)
    p = para(doc, "Well done!  ★  Bravo !", size=16, bold=True,
             colour=RGBColor(0xD2, 0x69, 0x1E), align=WD_ALIGN_PARAGRAPH.CENTER)
    para(doc, _p["school"] + "  ·  " + _p["edition"], size=9, colour=LIGHT,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10)


# ---------------------------------------------------------------- build
def main():
    doc = Document()
    style_defaults(doc)
    doc.core_properties.title = f"{_p['title']} — {_p['subtitle']}"
    doc.core_properties.author = _p["school"]
    doc.core_properties.subject = "Class 1 English pupil's book, Cameroon"
    doc.core_properties.language = "en-GB"
    doc.core_properties.comments = "Generated by scripts/build_class1_docx.py from content.json"

    build_cover(doc)

    # new section for the body, with a footer
    body = doc.add_section(WD_SECTION.NEW_PAGE)
    setup_section(body)
    add_footer(body, f"{_p['title']} · {_p['subtitle']}")

    build_title_page(doc)
    build_this_book(doc)
    build_contents(doc)

    for th in CONTENT["themes"]:
        colour = RGBColor.from_string(("1F7A45", "D2691E", "1B5E9E", "6A3D9A", "B03A2E")[th["n"] - 1])
        build_theme_opener(doc, th)
        for u in th["units"]:
            build_unit(doc, th, u)

    build_appendix(doc)

    doc.save(OUT)
    print(f"wrote {OUT}  ({OUT.stat().st_size/1024/1024:.1f} MB)")


if __name__ == "__main__":
    main()
