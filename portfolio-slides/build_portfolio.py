"""Builds "Alexander Kim Portfolio" for the OCSA Production & Design portfolio.

Standard 16:9 PowerPoint (13.333 x 7.5 in). Run with python-pptx installed:
    python build_portfolio.py

This replaces build_hearth_slides.py: the four Hearth slides, the crew, Building & Making and
Encanto are all still here, restyled, plus every other project.

The shared design (what makes it one deck):
  - grid-paper background (dark grid for the game slides, blue grid for the CAD drawing sheet)
  - a numbered colour tab + category line + condensed poster title, always top left
  - What it is / My role / Why I included it, labelled the same way on every project
  - handwritten notes and arrows, in Alex's voice
  - real photos are taped prints; game and app shots sit in screen frames
  - the same footer on every slide
Each project gets its own accent colour, taken from the project itself, and its own layout.

Text is written in Alex's voice as a first draft for him to rewrite in his own words.
Speaker notes go to Alexander-Kim-Portfolio-notes.md, not into the deck: python-pptx notes
stop Keynote from opening the file.
"""
import os
import sys

from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "images")
MOCKUPS = os.path.join(HERE, "..", "hearth", "mockups")
OUT = os.path.join(HERE, "Alexander-Kim-Portfolio.pptx")
NOTES_OUT = os.path.join(HERE, "Alexander-Kim-Portfolio-notes.md")


def C(value):
    return RGBColor.from_string(value.lstrip("#").upper())


# ---------------------------------------------------------------- design tokens
INK = C("15181D")
INK2 = C("4A5058")       # secondary text on light
RULE = C("C9CED3")
WHITE = C("FFFFFF")
D_INK = C("F2F4F7")      # text on dark
D_INK2 = C("A3ADB9")
D_RULE = C("2C3440")
TAPE = C("EFE6B8")

TITLE = "Anton"            # condensed poster type
BODY = "Poppins"
MONO = "Source Code Pro"
# The handwriting font is "Nanum Pen" on this Mac (Keynote) but "Nanum Pen Script" in Google Slides.
# `python build_portfolio.py --google` writes a copy for uploading to Google Slides.
GOOGLE = "--google" in sys.argv
HAND = "Nanum Pen Script" if GOOGLE else "Nanum Pen"
if GOOGLE:
    OUT = os.path.join(HERE, "Alexander-Kim-Portfolio-GoogleSlides.pptx")

TOTAL = 19
W_IN, H_IN = 13.333, 7.5
M = 0.55                   # outer margin

prs = Presentation()
prs.slide_width = Inches(W_IN)
prs.slide_height = Inches(H_IN)
BLANK = prs.slide_layouts[6]
NOTES = []


def img(name):
    return os.path.join(IMG, name)


def luminance(rgb):
    r, g, b = (int(str(rgb)[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


# ---------------------------------------------------------------- low-level helpers
def set_alpha(color_parent, alpha):
    """Adds <a:alpha> to the srgbClr under a solidFill (alpha 0-1)."""
    clr = color_parent.find(qn("a:srgbClr"))
    a = etree.SubElement(clr, qn("a:alpha"))
    a.set("val", str(int(alpha * 100000)))


def shadow(shape, blur=0.08, dist=0.03, alpha=0.22):
    spPr = shape._element.spPr
    eff = etree.SubElement(spPr, qn("a:effectLst"))
    sh = etree.SubElement(eff, qn("a:outerShdw"))
    sh.set("blurRad", str(int(Inches(blur))))
    sh.set("dist", str(int(Inches(dist))))
    sh.set("dir", "5400000")
    sh.set("algn", "t")
    sh.set("rotWithShape", "0")
    clr = etree.SubElement(sh, qn("a:srgbClr"))
    clr.set("val", "000000")
    a = etree.SubElement(clr, qn("a:alpha"))
    a.set("val", str(int(alpha * 100000)))


def rect(slide, x, y, w, h, fill=None, line=None, line_w=0.75, name="Box", rot=0, alpha=None,
         shape=MSO_SHAPE.RECTANGLE):
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    s.name = name
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
        if alpha is not None:
            set_alpha(s.fill._xPr.find(qn("a:solidFill")), alpha)
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(line_w)
    s.shadow.inherit = False
    if rot:
        s.rotation = rot
    return s


def text(slide, x, y, w, h, runs, size=12, color=INK, font=BODY, bold=False, italic=False,
         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, name=None, spacing=None, line=None,
         rot=0, space_after=0):
    """runs: a string, or a list of paragraphs; each paragraph a string or a list of (text, overrides)."""
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    if name:
        box.name = name
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    paragraphs = runs if isinstance(runs, list) else [runs]
    for i, para in enumerate(paragraphs):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        if line:
            p.line_spacing = line
        if space_after:
            p.space_after = Pt(space_after)
        for t, o in (para if isinstance(para, list) else [(para, {})]):
            r = p.add_run()
            r.text = t
            f = r.font
            f.name = o.get("font", font)
            f.size = Pt(o.get("size", size))
            f.bold = o.get("bold", bold)
            f.italic = o.get("italic", italic)
            f.color.rgb = o.get("color", color)
            sp = o.get("spacing", spacing)
            if sp:
                r.font._element.set("spc", str(sp))
            if "space_before" in o:
                p.space_before = Pt(o["space_before"])
    if rot:
        box.rotation = rot
    return box


def picture(slide, path, x, y, w, h, alt, rot=0, cover=True):
    """Places an image in a w x h box, cropped to fill it (cover) so nothing is stretched."""
    pic = slide.shapes.add_picture(path, Inches(x), Inches(y), Inches(w), Inches(h))
    pic.name = alt
    pic._element.nvPicPr.cNvPr.set("descr", alt)
    if cover:
        iw, ih = pic.image.size
        box, im = w / h, iw / ih
        if im > box:      # image wider than box: crop the sides
            c = (1 - box / im) / 2
            pic.crop_left = pic.crop_right = c
        elif im < box:    # taller: crop top and bottom
            c = (1 - im / box) / 2
            pic.crop_top = pic.crop_bottom = c
    if rot:
        pic.rotation = rot
    return pic


def fit(path, w, h):
    """Size of the image when it fits inside w x h without cropping."""
    from PIL import Image
    iw, ih = Image.open(path).size
    s = min(w / iw, h / ih)
    return iw * s, ih * s


def tape(slide, cx, cy, w=0.95, h=0.26, rot=0):
    rect(slide, cx - w / 2, cy - h / 2, w, h, fill=TAPE, alpha=0.78, rot=rot, name="Tape")


def photo(slide, path, x, y, w, h, alt, rot=0, border=0.07, tapes=("top",), pad_bottom=None):
    """A printed photo: white border, soft shadow, and tape."""
    pb = border if pad_bottom is None else pad_bottom
    frame = rect(slide, x - border, y - border, w + 2 * border, h + border + pb, fill=WHITE,
                 rot=rot, name=f"Print {alt[:30]}")
    shadow(frame)
    # Frame and picture share a centre, so they rotate together.
    picture(slide, path, x, y, w, h, alt, rot=rot)
    for t in tapes:
        if t == "top":
            tape(slide, x + w / 2, y - border, rot=rot - 3)
        elif t == "tl":
            tape(slide, x + 0.1, y + 0.05, w=0.8, rot=rot - 38)
        elif t == "tr":
            tape(slide, x + w - 0.1, y + 0.05, w=0.8, rot=rot + 38)
        elif t == "left":
            tape(slide, x - border, y + h / 2, w=0.8, rot=rot + 87)
    return frame


def screen(slide, path, x, y, w, h, alt, frame=C("05070A"), pad=0.06, accent=None):
    """An app or game shot in a dark screen frame."""
    f = rect(slide, x - pad, y - pad, w + 2 * pad, h + 2 * pad, fill=frame, name=f"Screen {alt[:30]}",
             line=accent, line_w=1.25)
    shadow(f, alpha=0.3)
    return picture(slide, path, x, y, w, h, alt)


def note(slide, x, y, w, words, color, size=22, rot=0, align=PP_ALIGN.LEFT, h=0.5):
    """A handwritten note."""
    return text(slide, x, y, w, h, words, size=size, color=color, font=HAND, rot=rot, align=align,
                name=f"Note {words[:30]}", line=0.9)


def arrow(slide, x1, y1, x2, y2, color, width=1.75, curve=True):
    kind = MSO_CONNECTOR.CURVE if curve else MSO_CONNECTOR.STRAIGHT
    c = slide.shapes.add_connector(kind, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    c.line.color.rgb = color
    c.line.width = Pt(width)
    ln = c.line._get_or_add_ln()
    end = etree.SubElement(ln, qn("a:tailEnd"))
    end.set("type", "triangle")
    end.set("w", "med")
    end.set("len", "med")
    c.name = "Arrow"
    return c


def chips(slide, x, y, labels, color, max_w, dark=False, size=8.5):
    """Outlined label chips that wrap to the next row."""
    cx, cy = x, y
    for label in labels:
        w = len(label) * size * 0.62 / 72 + 0.26
        if cx + w > x + max_w:
            cx, cy = x, cy + 0.38
        b = rect(slide, cx, cy, w, 0.28, line=color, line_w=1, name=f"Chip {label}")
        tf = b.text_frame
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = label
        r.font.name = MONO
        r.font.size = Pt(size)
        r.font.bold = True
        r.font.color.rgb = D_INK if dark else INK
        r.font._element.set("spc", "60")
        cx += w + 0.1
    return cy + 0.28


# ---------------------------------------------------------------- shared slide pieces
def new_slide(bg="paper"):
    s = prs.slides.add_slide(BLANK)
    s.shapes.add_picture(img(f"bg-{bg}.png"), 0, 0, prs.slide_width, prs.slide_height).name = "Grid paper"
    return s


def header(slide, n, category, title, accent, dark=False, size=46, w=7.5):
    tab = rect(slide, M, 0.5, 0.52, 0.52, fill=accent, name="Number tab")
    tf = tab.text_frame
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = f"{n:02d}"
    r.font.name = TITLE
    r.font.size = Pt(20)
    r.font.color.rgb = INK if luminance(accent) > 0.55 else WHITE
    text(slide, M + 0.68, 0.5, max(w - 0.7, 3.9), 0.52, category.upper(), size=9.5, bold=True, font=MONO,
         color=D_INK2 if dark else INK2, anchor=MSO_ANCHOR.MIDDLE, spacing=180, name="Category")
    text(slide, M - 0.02, 1.08, w, 0.9, title.upper(), size=size, font=TITLE,
         color=D_INK if dark else INK, name="Title", line=0.9)


def footer(slide, n, dark=False):
    line = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(M), Inches(7.02), Inches(W_IN - M),
                                      Inches(7.02))
    line.line.color.rgb = D_RULE if dark else RULE
    line.line.width = Pt(0.75)
    line.name = "Footer rule"
    col = D_INK2 if dark else INK2
    text(slide, M, 7.1, 5, 0.25, "ALEXANDER KIM", size=7.5, font=MONO, bold=True, color=col,
         spacing=200, name="Footer name")
    text(slide, W_IN - M - 5, 7.1, 5, 0.25, f"PORTFOLIO  ·  {n:02d} / {TOTAL}", size=7.5, font=MONO,
         bold=True, color=col, spacing=200, align=PP_ALIGN.RIGHT, name="Footer page")


def described(slide, x, y, w, h, blocks, accent, dark=False, size=11.5, gap=9):
    """What it is / My role / Why I included it: one text box so the text flows."""
    paras = []
    for i, (label, body) in enumerate(blocks):
        paras.append([("■  ", {"font": BODY, "size": 8, "color": accent, "space_before": 0 if i == 0 else gap}),
                      (label.upper(), {"font": MONO, "size": 8.5, "bold": True, "spacing": 180,
                                       "color": D_INK2 if dark else INK2})])
        paras.append([(body, {"size": size, "color": D_INK if dark else INK, "space_before": 3})])
    return text(slide, x, y, w, h, paras, line=1.12, name="Description")


def label(slide, x, y, words, accent, dark=False, w=5, size=8.5):
    return text(slide, x, y, w, 0.25, [[("■  ", {"font": BODY, "size": 8, "color": accent}),
                                        (words.upper(), {})]],
                size=size, font=MONO, bold=True, spacing=180, color=D_INK2 if dark else INK2,
                name=f"Label {words[:24]}")


def badge(slide, x, y, n, accent, size=0.36):
    b = rect(slide, x, y, size, size, fill=accent, name=f"Badge {n}")
    tf = b.text_frame
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = str(n)
    r.font.name = TITLE
    r.font.size = Pt(15)
    r.font.color.rgb = INK if luminance(accent) > 0.55 else WHITE


# ================================================================= 01 Cover
s = new_slide("paper")
ACC = C("FF5A1F")
text(s, M, 0.55, 7, 0.3, "OCSA  ·  PRODUCTION & DESIGN CONSERVATORY", size=9.5, font=MONO, bold=True,
     color=INK2, spacing=180, name="Kicker")
text(s, M - 0.05, 0.8, 6.4, 1.5, "ALEXANDER", size=96, font=TITLE, color=INK, name="Title")
text(s, M - 0.05, 2.1, 6.4, 1.5, "KIM", size=96, font=TITLE, color=INK, name="Title 2")
text(s, M, 3.72, 6, 0.6, "PORTFOLIO", size=34, font=TITLE, color=ACC, spacing=900, name="Subtitle")
note(s, M, 4.42, 6, "stuff I build, code, draw and design", INK, size=30, rot=-2)

contents = [
    ("02", "Hearth (app)"), ("05", "Go-Kart Build"), ("06", "Meet the Crew"), ("07", "Go-Kart World"),
    ("08", "LEGO Virtual Portfolio"), ("09", "Wheelie Ride"), ("10", "The Lobby"), ("11", "Mercedes SL63"),
    ("12", "Poppin' Matcha Booth"), ("13", "Poppin' Matcha Ads"), ("14", "Alex & Mr. Fishy"),
    ("16", "The Fort"), ("17", "Birdhouse & Glider"), ("18", "Music Production"), ("19", "Encanto"),
]
for col in range(2):
    rows = contents[col * 8:(col + 1) * 8]
    text(s, M + col * 2.95, 5.1, 2.9, 1.8,
         [[(f"{n}  ", {"color": ACC, "bold": True}), (t, {"color": INK})] for n, t in rows],
         size=10, font=MONO, line=1.25, name=f"Contents {col + 1}")

photo(s, img("gokart-side.jpg"), 6.95, 0.75, 3.7, 2.08, "The go-kart Alex built at camp", rot=-3,
      tapes=("tl", "tr"))
photo(s, img("lego-mclaren.jpg"), 10.45, 0.6, 2.25, 1.69, "Alex's LEGO McLaren F1 car on the street",
      rot=4)
photo(s, img("gk-race.jpg"), 7.7, 3.05, 3.55, 2.0, "The start of a race in Go-Kart World", rot=2,
      tapes=("top",))
photo(s, img("sl63-hero.jpg"), 10.55, 2.75, 2.2, 1.26, "Alex's Mercedes SL63 model in Tinkercad",
      rot=-4, tapes=("tr",))
photo(s, img("cover-stage.jpg"), 6.85, 5.25, 2.75, 1.41, "Alex on stage with the cast of Encanto",
      rot=-2.5, tapes=("left",))
photo(s, img("cover-fort.jpg"), 11.0, 4.45, 1.6, 1.71, "Alex and his brother in front of their fort",
      rot=5)
photo(s, img("ads-banner.jpg"), 9.55, 6.3, 2.6, 0.37, "Poppin' Matcha web banner", rot=-1.5,
      border=0.05, tapes=())
NOTES.append(("Cover",
              "Cover: names the portfolio and previews what's inside. The photo pile shows the range: "
              "real builds, games, CAD, graphic design and theatre."))

# ================================================================= 02 Hearth
s = new_slide("paper")
ACC = C("D65332")
header(s, 2, "Design & Technology  ·  App design", "Hearth", ACC, size=54)
note(s, M, 2.02, 6, "a wellness app that grows with you", ACC, size=26)
described(s, M, 2.62, 5.35, 4.2, [
    ("What it is",
     "Hearth is a wellness app built around a daily ritual: each morning it asks “What would make "
     "today feel tended?” and you set three small intentions. A quick check-in on your mood, energy "
     "and stress shapes kinder goals, an “I’m feeling” page suggests ways to cope, and you get a "
     "companion that grows with your streak."),
    ("My role",
     "I was the designer and coder: I came up with the idea, designed every screen and feature, and "
     "coded it by directing an Agent coding tool for the OC Student AI Network."),
    ("Why I included it",
     "Like a lot of students, I juggle assignments, deadlines and social pressure, and I wanted a calm "
     "way to take each day one step at a time. I noticed a lot of people make games, so I wanted to make "
     "something that stood out and could actually help."),
], ACC, size=11)
w, h = fit(os.path.join(MOCKUPS, "combo-keeper.png"), 6.5, 4.4)
picture(s, os.path.join(MOCKUPS, "combo-keeper.png"), 6.3, 0.5, w, h,
        "Hearth on a laptop and a phone, showing the little keeper creature in its golden final form",
        cover=False)
stats = [("3", "intentions a day"), ("28", "days to the final form"), ("0", "data collected")]
x = 6.6
for i, (big, lab) in enumerate(stats):
    if i:
        ln = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x - 0.25), Inches(5.55), Inches(x - 0.25),
                                    Inches(6.75))
        ln.line.color.rgb = RULE
        ln.line.width = Pt(1)
    text(s, x, 5.35, 1.9, 0.9, big, size=50, font=TITLE, color=ACC, name=f"Stat {lab}")
    text(s, x, 6.35, 1.9, 0.4, lab.upper(), size=8, font=MONO, bold=True, color=INK2, spacing=120,
         name=f"Stat label {lab}")
    x += 2.1
note(s, 10.55, 5.05, 2.4, "no ads, no tracking!", ACC, size=20, rot=-4)
footer(s, 2)
NOTES.append(("Hearth",
              "Guidelines: project clearly labeled; description is 5 sentences (3-5 allowed) covering what "
              "it is, my role, and why I included it.\n"
              "Rubric: Creative Expression & Innovation (a wellness app with a personal reason, instead of "
              "another game). Communication (clear what / role / why).\n"
              "Interview: answers 'What types of creative projects do you enjoy?' and 'Describe a project "
              "you are proud of.'\n"
              "Check: the 'no ads, no tracking!' note goes with the '0 data collected' stat; cut it if "
              "that isn't how Alex would say it."))

# ================================================================= 03 Hearth colours
s = new_slide("paper")
header(s, 3, "Hearth  ·  Color & mood", "Colors that match your mood", ACC, size=40, w=12)
text(s, M, 1.92, 12.2, 0.5,
     "Colors change how people feel, so I designed four calm themes you can switch between depending on "
     "your mood. Each one comes from a place or memory that makes me feel calm.", size=11.5, color=INK,
     name="Intro", line=1.1)
themes = [
    ("ember", "Ember", "cozy + comforting",
     "From camping trips with my mom, where the campfire is one of the most comforting feelings I know.",
     ["181112", "392522", "F6BE6E", "F26D3D", "D65332", "FDF4E7"]),
    ("tidepool", "Tidepool", "serene + connected",
     "From exploring tide pools as a kid, where every animal was relaxed and the ecosystem worked as one.",
     ["0F1820", "1A2A36", "9FD0DE", "7FB3CF", "3A7593", "EAF2F5"]),
    ("meadow", "Morning Meadow", "fresh + hopeful",
     "From mornings lying in the grass under a blue sky, with nowhere to be and a whole new day ahead.",
     ["F6F1E7", "FFFCF6", "A0553B", "6E8F62", "56744B", "2F3A33"]),
    ("marshy", "Marshy", "soft + safe",
     "From Marshy, my sequined midnight-blue sheep, who kept me company on the darkest nights.",
     ["121838", "1E2652", "A9D4F5", "9CC8F0", "4660B5", "EEF3FC"]),
]
x = M + 0.06
for key, name, mood, story, colors in themes:
    screen(s, img(f"theme-{key}.jpg"), x, 2.75, 2.85, 2.85 / 1.452, f"Hearth in the {name} theme")
    sx = x
    for col in colors:   # a paint-chip strip right under the screen
        rect(s, sx - 0.06 if col == colors[0] else sx, 4.81 + 0.0, 2.97 / 6 + (0.06 if col == colors[0] else 0),
             0.22, fill=C(col), name=f"{name} chip")
        sx += 2.97 / 6
    text(s, x - 0.06, 5.12, 2.97, 0.4, name.upper(), size=20, font=TITLE, color=INK, name=f"Theme {name}")
    note(s, x - 0.04, 5.52, 2.9, mood, ACC, size=18, rot=-1.5, h=0.3)
    text(s, x - 0.06, 5.92, 2.97, 1.0, story, size=10.5, color=INK2, name=f"Story {name}", line=1.1)
    x += 3.1
footer(s, 3)
NOTES.append(("Colors that match your mood",
              "Rubric: Creative Expression (themes drawn from personal memories, a unique perspective), "
              "Creativity Ability (exploring four directions instead of one), Artistic Ability / "
              "Craftsmanship (consistent, readable palettes), Communication (the why behind each color).\n"
              "Stories: Ember is the campfire on camping trips with Alex's mom, and the reason the app is "
              "called Hearth. Tidepool is exploring tide pools as a kid. Morning Meadow is waking up "
              "hopeful. Marshy is his childhood stuffed sheep in midnight blue and sky blue sequins.\n"
              "Color talking points: blue is widely linked with calm; green with nature, growth and "
              "balance. Every theme is muted, avoids pure black and white, keeps text easy to read, and "
              "keeps one warm note so it still feels like a hearth.\n"
              "Interview: answers 'What is your personal favorite design aesthetic?'"))

# ================================================================= 04 Hearth process
s = new_slide("paper")
header(s, 4, "Hearth  ·  My process", "Turning problems into solutions", ACC, size=40, w=12)
steps = [
    ("Think", "I sat down and asked myself what tool could make the world better and isn’t out there enough."),
    ("Outline", "I wrote the main outline: a daily check-in, three goals, and a creature that grows."),
    ("Build", "I built it by prompting an Agent coding tool, one feature at a time."),
    ("Test & fix", "I tested each part, and when something broke I found another way."),
]
x = M
for i, (head, body) in enumerate(steps, start=1):
    text(s, x, 1.85, 0.6, 0.9, str(i), size=48, font=TITLE, color=ACC, name=f"Step {i} number")
    text(s, x + 0.55, 2.02, 2.4, 0.35, head.upper(), size=10, font=MONO, bold=True, color=INK,
         spacing=150, name=f"Step {i} title")
    text(s, x + 0.55, 2.32, 2.45, 0.9, body, size=10.5, color=INK2, name=f"Step {i} text", line=1.1)
    if i < 4:
        arrow(s, x + 2.72, 2.12, x + 2.98, 2.12, RULE, width=1.25, curve=False)
    x += 3.1
label(s, M, 3.42, "What didn’t work, and what I did about it", ACC)
problems = [
    ("The app wouldn’t load", "My first version wouldn’t run at all.",
     "I loaded it on a personal account, and it worked.", "FIXED", C("FFE98A"), -1.5),
    ("The Agent got stuck on goals",
     "It kept misreading the goals feature and handing back the same broken answer, no matter how I "
     "prompted it.",
     "I turned the problem into the solution: a goal tracker you set up yourself with short surveys.",
     "FIXED", C("C9EBC0"), 1.0),
    ("The shop locks free hats", "The Agent decided you have to buy the free hats for your creature.",
     "Still working on it, and it’s next on my list.", "IN PROGRESS", C("FFD3C2"), -0.8),
]
x = M + 0.1
for head, problem, fix, status, col, rot in problems:
    sticky = rect(s, x, 3.85, 3.8, 2.95, fill=col, rot=rot, name=f"Sticky {head}")
    shadow(sticky, blur=0.1, dist=0.05, alpha=0.18)
    tape(s, x + 1.9, 3.85, rot=rot - 2)
    text(s, x + 0.25, 4.1, 3.3, 0.6, head, size=14, bold=True, color=INK, name=f"Problem {head}", rot=rot)
    text(s, x + 0.25, 4.72, 3.3, 0.9, problem, size=10.5, color=INK2, name=f"Problem text {head}", rot=rot,
         line=1.1)
    text(s, x + 0.25, 5.6, 3.3, 0.9, [[("Fix: ", {"bold": True}), (fix, {})]], size=10.5, color=INK,
         name=f"Fix {head}", rot=rot, line=1.1)
    st = text(s, x + 2.15, 6.3, 1.5, 0.36, status, size=13, font=TITLE, color=ACC, align=PP_ALIGN.CENTER,
              anchor=MSO_ANCHOR.MIDDLE, rot=-8, name=f"Stamp {status}", spacing=100)
    st.line.color.rgb = ACC
    st.line.width = Pt(1.5)
    x += 4.1
footer(s, 4)
NOTES.append(("Turning problems into solutions",
              "Rubric: Growth Mindset & Problem Solving (three real problems; one turned into a new "
              "feature, one still in progress, which shows honest reflection). Creativity Ability (flexible "
              "thinking when the Agent got stuck). Communication (clear process steps).\n"
              "Interview tip: be ready to explain how the goal tracker changed, and why the shop bug is "
              "tricky. If asked about the planned Agent helper, mention the fail-safes so it always points "
              "someone who is struggling to real help, like 988, the Suicide & Crisis Lifeline."))

# ================================================================= 05 Go-kart build
s = new_slide("paper")
ACC = C("2457C5")   # Skyline blue
header(s, 5, "Building & Making  ·  Engineering", "Go-Kart Build", ACC, size=54, w=4.6)
described(s, M, 2.1, 4.25, 3.6, [
    ("What it is", "This summer I went to a go-kart camp and built my own kart."),
    ("My role",
     "I built the frame, added a stick shifter, and painted it. My favorite car is the Nissan Skyline, "
     "so I based the look on Brian’s Skyline from Fast & Furious: silver with blue stripes, plus blue "
     "underglow lights to make it more realistic."),
    ("Why I included it",
     "It’s the first real vehicle I’ve built, and it’s what inspired my racing game."),
], ACC)
label(s, M, 5.55, "The Skyline look", ACC)
for i, (col, words) in enumerate([("C9CDD2", "Silver body"), ("1F2A4D", "Navy stripes"),
                                  ("2F7BFF", "Blue underglow")]):
    y = 5.88 + i * 0.32
    rect(s, M, y, 0.24, 0.24, fill=C(col), line=RULE, name=f"Swatch {words}")
    text(s, M + 0.36, y - 0.02, 3, 0.3, words, size=10.5, color=INK, name=f"Swatch label {words}")

photo(s, img("gokart-side.jpg"), 5.25, 0.7, 4.75, 2.67, "The finished go-kart from the side, silver with "
      "navy stripes and a stick shifter", rot=-1.5, tapes=("tl", "tr"))
photo(s, img("gokart-grt.jpg"), 10.55, 0.62, 2.1, 2.8, "The front of the go-kart, with GTR drawn on the "
      "nose", rot=2.5)
photo(s, img("gokart-frame.jpg"), 5.4, 4.05, 1.95, 2.6, "The go-kart from above: the plywood frame and "
      "the seat board", rot=1.5)
photo(s, img("gokart-paint.jpg"), 7.75, 3.95, 1.95, 2.6, "The painted go-kart with its navy racing stripe",
      rot=-2)
photo(s, img("gokart-shifter.jpg"), 10.2, 4.15, 2.45, 2.45, "The stick shifter and steering wheel", rot=1.5)
for n, (bx, by) in enumerate([(5.25, 3.85), (10.05, 3.95), (7.6, 3.75), (10.4, 0.45)], start=1):
    badge(s, bx, by, n, ACC)
note(s, 5.35, 6.72, 2.3, "1  the frame", ACC, size=19, h=0.3)
note(s, 7.7, 6.68, 2.3, "3  paint + stripes", ACC, size=19, h=0.3)
note(s, 10.15, 6.68, 2.6, "2  stick shifter!", ACC, size=19, h=0.3)
note(s, 10.6, 3.47, 2.3, "4  GTR = the car name", ACC, size=19, rot=-2, h=0.3)
footer(s, 5)
NOTES.append(("Go-Kart Build",
              "Guidelines: Building & Making / Engineering projects.\n"
              "Rubric: Artistic Ability / Craftsmanship (a real, full-size build), Creative Expression "
              "(his own Skyline-inspired look), Communication (numbered build steps).\n"
              "Photos: assets/Go carts. The underglow lights aren't visible in any photo, so they're named "
              "in the text and the color legend instead. GTR is written on the nose, for the Skyline GT-R.\n"
              "Interview: be ready to say what was hardest about building the frame."))

# ================================================================= 06 Meet the crew
s = new_slide("paper")
ACC = C("7A4DD8")
header(s, 6, "Character design  ·  Sketch to 3D", "Meet the crew", ACC, size=46)
text(s, M, 1.92, 12.2, 0.75,
     "Jimbob, Srank, Jimmy, Ember and Bernie are five characters I invented and first drew in pen on paper. "
     "I turned each sketch into a 3D character, then tried every one in three looks inspired by cartoons "
     "and games I studied. I included them to show my process: how a quick doodle grows into a finished "
     "character without losing what made the drawing special. They’re the racers in my go-kart game.",
     size=11.5, color=INK, name="Intro", line=1.1)
label(s, M, 2.95, "1  Sketch on paper", ACC)
photo(s, img("characters-sketches.jpg"), M + 0.15, 3.4, 4.3, 4.3 / 1.558, "Alex's pen sketches of Jimbob, "
      "Srank, Jimmy, Ember and Bernie, with the name Sprout crossed out above Bernie", rot=-1.5,
      tapes=("tl", "tr"))
note(s, M + 0.2, 6.25, 4.4, "Bernie was almost named Sprout. It’s still crossed out!", ACC, size=19,
     rot=-1.5)
label(s, 5.55, 2.95, "2  Bring them to life in 3D, in three looks", ACC, w=7)
panel = rect(s, 5.55, 3.3, 7.23, 3.5, fill=C("F9F6F1"), line=RULE, name="Crew panel")
shadow(panel, alpha=0.12)
ROW_X, ROW_W, ROW_H = 7.55, 5.05, 5.05 / 5.867
for nm, frac in zip(["Jimbob", "Srank", "Jimmy", "Ember", "Bernie"], (0.107, 0.30, 0.495, 0.683, 0.88)):
    text(s, ROW_X + frac * ROW_W - 0.5, 3.42, 1.0, 0.25, nm.upper(), size=8, font=MONO, bold=True,
         color=INK2, align=PP_ALIGN.CENTER, name=f"Character {nm}")
y = 3.72
for key, look, tag in [("toon", "Toon", "flat + bold"), ("galaxy", "Galaxy", "shiny glow"),
                       ("carlo", "Painted", "fuzzy + wobbly")]:
    text(s, 5.8, y + 0.12, 1.7, 0.4, look.upper(), size=20, font=TITLE, color=INK, name=f"Look {look}")
    note(s, 5.8, y + 0.48, 1.7, tag, ACC, size=17, h=0.3)
    picture(s, img(f"crew-{key}.png"), ROW_X, y, ROW_W, ROW_H, f"The five characters in the {look} look")
    y += 1.0
footer(s, 6)
NOTES.append(("Meet the crew",
              "Rubric: Creative Expression & Innovation (five original characters, each with a name and "
              "personality). Creativity Ability (every character explored in three styles instead of one). "
              "Artistic Ability / Craftsmanship (the 3D versions keep details from the drawings, like "
              "Jimbob's uneven eyes, Srank's swirl and heart, and Ember having no mouth). Growth Mindset "
              "(the crossed-out name shows ideas changing right on the page).\n"
              "Placed right before Go-Kart World because the crew are the racers there.\n"
              "Interview tip: be ready to explain how the 3D versions were made, and which look is your "
              "favorite and why."))

# ================================================================= 07 Go-Kart World
s = new_slide("dark")
ACC = C("FF2F8E")
header(s, 7, "Coding  ·  Game design", "Go-Kart World", ACC, dark=True, size=50, w=4.7)
described(s, M, 2.12, 4.35, 3.7, [
    ("What it is",
     "I’m really into racing games, so I made a 3D racing game inspired by the go-kart I built and the "
     "Crazy Cart I’m customizing."),
    ("My role",
     "I drew the characters by hand, then built the game in Visual Studio Code using an agent "
     "orchestration harness with the Opus 5.5 model. I added different modes, a drift track and "
     "details like sponsor banners inspired by real racing brands, plus Brian’s Skyline turning on a "
     "stand in the middle."),
    ("Why I included it",
     "It shows how I turn something I built in real life into something people can play."),
], ACC, dark=True, size=10.5, gap=7)
label(s, M, 5.92, "Modes + features", ACC, dark=True)
chips(s, M, 6.2, ["RACE THE CREW", "FREE DRIVE", "DRIFT POINTS", "NIGHT", "4 CAMERAS", "VR", "RACE HUD"],
      ACC, 4.4, dark=True, size=8)
screen(s, img("gk-race.jpg"), 5.3, 0.6, 7.45, 7.45 / 1.778, "The start of a race in Go-Kart World: Alex's "
       "kart on the grid with the crew, the start lights and the sponsor walls", accent=D_RULE)
screen(s, img("gk-skyline.jpg"), 5.3, 5.05, 3.25, 3.25 / 1.974, "Brian's Skyline turning on its stand at "
       "night, with blue underglow", accent=D_RULE)
screen(s, img("gk-orbit.jpg"), 8.85, 5.05, 2.95, 2.95 / 1.778, "Alex's kart drifting past the crew, seen "
       "from the orbit camera", accent=D_RULE)
note(s, 10.0, 3.6, 2.7, "my crew, drawn by hand", ACC, size=20, rot=-3, h=0.4)
arrow(s, 10.1, 3.65, 9.7, 3.1, ACC)
note(s, 5.55, 3.3, 1.9, "racing brands on the walls", ACC, size=20, rot=3, h=0.7)
note(s, 5.42, 5.08, 2.2, "Brian’s Skyline", ACC, size=19, h=0.3)
note(s, 11.95, 5.15, 0.9, "drifting past the crew", ACC, size=17, h=1.0)
footer(s, 7, dark=True)
NOTES.append(("Go-Kart World",
              "Guidelines: Design & Technology / Coding projects.\n"
              "Rubric: Creative Expression & Innovation (his own build, characters and team turned into a "
              "game), Creativity Ability (modes, cameras, night, VR), Communication.\n"
              "Facts from gokart/v2.html: hold Space to drift; four cameras (orbit, chase, seat, stands); "
              "night mode shows the underglow; a racing HUD with a speedometer, minimap and pause menu; "
              "touch pedals on phones; works in a VR headset. The sponsor banners are lettering in the "
              "spirit of drift brands (HKS, GReddy, Advan, Tein, Work, Bride, Top Secret, 326 Power), plus "
              "his own team, GRT Racing.\n"
              "CHECK WITH ALEX: his draft stopped at 'I added a ...'. The slide fills it in with the Skyline "
              "on its stand; swap in whatever he meant."))

# ================================================================= 08 LEGO
s = new_slide("paper")
ACC = C("FF7A00")
header(s, 8, "Building & Making  →  3D concept", "LEGO Virtual Portfolio", ACC, size=46, w=9)
label(s, M, 1.98, "Real bricks", ACC)
label(s, 7.0, 1.98, "Virtual circuit (brick built)", ACC)
photo(s, img("lego-mclaren.jpg"), 0.75, 2.45, 2.95, 2.21, "Alex's orange LEGO McLaren F1 car shot at street "
      "level", rot=-2, tapes=("tl",))
photo(s, img("lego-instructions.jpg"), 3.95, 2.35, 1.2, 1.6, "Building from the instruction booklet", rot=3,
      tapes=())
photo(s, img("lego-shoot.jpg"), 5.3, 2.5, 1.2, 1.6, "Alex lying on the street photographing his LEGO cars",
      rot=-3, tapes=())
photo(s, img("lego-pair.jpg"), 4.1, 4.1, 1.95, 1.46, "The red and orange LEGO F1 cars side by side", rot=2,
      tapes=("tr",))
note(s, 0.8, 4.78, 3.1, "I shot them at street level so they look real", ACC, size=19, rot=-2, h=0.6)
screen(s, img("gp-brick.jpg"), 7.05, 2.4, 4.4, 4.4 / 1.778, "The brick-built race circuit from above: "
       "studded baseplate, brick curbs, displays on brick plinths")
screen(s, img("gp-chase.jpg"), 10.0, 3.95, 2.75, 2.75 / 1.778, "Driving the orange LEGO F1 car down the "
       "main straight")
arrow(s, 6.35, 3.05, 6.95, 3.25, ACC, width=2.25)
note(s, 7.1, 4.95, 2.8, "same orange car, now you drive it", ACC, size=19, rot=-2, h=0.6)
cols = [
    ("What it is",
     "I built two LEGO F1 cars and photographed them outside at street level, so they look like real "
     "race cars."),
    ("My role",
     "Then I used them to design a virtual portfolio: a LEGO-scale 3D race track where you drive my "
     "orange car and pull in to see each project."),
    ("Why I included it",
     "It shows how something I built with my hands became the idea for a bigger digital world."),
]
for i, blk in enumerate(cols):
    described(s, M + i * 4.12, 5.95, 3.9, 1.0, [blk], ACC, size=10)
footer(s, 8)
NOTES.append(("LEGO Virtual Portfolio",
              "Guidelines: LEGO creations, Photography, and a 3D concept.\n"
              "Rubric: Creativity Ability (one idea carried from bricks to photos to a 3D world), "
              "Creative Expression.\n"
              "Photos are the four Alex picked: 13-IMG_0574, 16-IMG_0571, 6-IMG_0587, 4-IMG_0592. "
              "Screenshots are from grand-prix/index.html, option B 'Brick Built'. The circuit is a "
              "concept for a virtual gallery: you drive the orange LEGO F1 car and pull into the infield at "
              "each display (go-kart, LEGO F1 cars, VR, Hearth).\n"
              "Interview: be ready to say why you shot the cars from so low."))

# ================================================================= 09 Wheelie Ride
s = new_slide("dark")
ACC = C("C8F03C")
header(s, 9, "Coding  ·  Game + real map data", "Wheelie Ride", ACC, dark=True, size=50, w=4.7)
described(s, M, 2.12, 4.35, 2.7, [
    ("What it is",
     "A 3D game where you pick a bike and hold a wheelie as long as you can without looping out. "
     "Version 1 was one straight road, so for Version 2 I rebuilt it in my own Orange County "
     "neighborhood with real map data."),
    ("My role", "I designed and built both versions, and I wrote down every problem and fix in a release log."),
    ("Why I included it", "It shows how I keep improving my projects after version 1."),
], ACC, dark=True, size=10, gap=6)
lb = rect(s, M, 4.82, 4.35, 2.05, line=D_RULE, line_w=1, name="Learned box")
label(s, M + 0.18, 4.92, "What I learned (from my release log)", ACC, dark=True, w=4.2, size=8)
lessons = [
    ("Test your data, not just your code.",
     " The ocean came out as dry land because the elevation data said the sea was 0 m high, same as a beach."),
    ("Faking movement is easy until you want to go somewhere.",
     " A real position and heading made maps, traffic and landmarks possible."),
    ("Always test the extremes.", " I only found a camera bug by testing the fastest bike."),
]
text(s, M + 0.18, 5.2, 4.0, 1.6,
     [[(f"{i}  ", {"font": TITLE, "color": ACC, "size": 10}), (a, {"bold": True, "color": D_INK}),
       (b, {"color": D_INK2})] for i, (a, b) in enumerate(lessons, start=1)],
     size=8.5, line=1.05, space_after=3, name="Lessons")

label(s, 5.3, 0.55, "Version 1  ·  one straight road", ACC, dark=True)
screen(s, img("wr1.jpg"), 5.3, 0.9, 3.3, 3.3 / 1.777, "Wheelie Ride version 1: a rider on a straight road "
       "with pine trees", accent=D_RULE)
arrow(s, 8.75, 1.85, 9.25, 1.85, ACC, width=2.25, curve=False)
stats = [("15,900", "real roads"), ("104,600", "real buildings"), ("15 × 21 km", "of my real map")]
y = 0.62
for big, lab in stats:
    text(s, 9.45, y, 2.2, 0.55, big, size=26, font=TITLE, color=ACC, name=f"Stat {lab}")
    text(s, 11.45, y + 0.2, 1.35, 0.3, lab.upper(), size=7.5, font=MONO, bold=True,
         color=D_INK2, spacing=100, name=f"Stat label {lab}")
    y += 0.68
label(s, 5.3, 2.98, "Version 2  ·  my neighborhood in Orange County", ACC, dark=True, w=7)
screen(s, img("wr2-handdrag.jpg"), 5.3, 3.33, 5.05, 5.05 / 1.778, "Wheelie Ride version 2: a hand drag on "
       "the Ninja H2R on Pacific Coast Highway at Anita Street Beach", accent=D_RULE)
screen(s, img("wr2-map.jpg"), 10.6, 3.33, 2.12, 2.12 / 0.71, "The real map of the area, from OpenStreetMap",
       accent=D_RULE)
note(s, 10.35, 6.33, 2.6, "click a road to ride there", ACC, size=18, rot=-2, h=0.4)
chips(s, 5.3, 6.32, ["REAL GEARS", "JUMPS", "CRASH PHYSICS", "LIVE SOUND"], ACC, 5.0, dark=True, size=8)
footer(s, 9, dark=True)
NOTES.append(("Wheelie Ride",
              "Guidelines: Coding projects / Design & Technology.\n"
              "Rubric: Growth Mindset & Problem Solving (version 1 to version 2, and a log of 26 problems "
              "with fixes and takeaways), Creativity Ability, Communication.\n"
              "Sources: wheelie-ride/README.md (what v2 covers) and wheelie-ride/RELEASE_LOG.md ('Best "
              "stories for slides' and the takeaways). Version 2 covers Laguna Hills down to Dana Point, "
              "and Laguna Beach to Mission Viejo. Map data © OpenStreetMap contributors.\n"
              "Interview: the ocean-that-was-land bug is the best story to tell."))

# ================================================================= 10 The Lobby
s = new_slide("dark")
ACC = C("3FE0F0")   # Bit's eyes
header(s, 10, "Coding  ·  3D / VR concept", "The Lobby", ACC, dark=True, size=54, w=4.4)
described(s, M, 2.1, 4.25, 2.9, [
    ("What it is",
     "A 3D game room for all my projects. Each project is a game cartridge you plug into my ALEX-2600 "
     "console, then you step through a portal into the game. Bit, a little robot, shows you around."),
    ("My role",
     "I sketched this concept to showcase my work, then turned it into a 3D experience you can explore in "
     "a browser or a VR headset."),
    ("Why I included it",
     "I love the idea of a gaming system that plays the games I’m building, with a virtual robot as your "
     "guide."),
], ACC, dark=True, size=10, gap=6)
screen(s, img("lobby-hero.jpg"), 5.05, 0.6, 7.7, 7.7 / 1.778, "The Lobby: a 70s game room with wood walls, "
       "a neon sign, the GO-KART cartridge plugged into the ALEX-2600 console under a wood TV, and Bit the "
       "robot talking next to a glowing portal", accent=D_RULE)
note(s, 5.2, 4.38, 3.2, "my projects, as game cartridges", ACC, size=19, rot=-3, h=0.4)
label(s, M, 5.17, "How it works", ACC, dark=True)
steps = [
    ("lobby-rack.jpg", "Pick a cartridge",
     "Every project is a cartridge on the rack. The “?” slots are for games I haven’t made yet.",
     "The cartridge rack with game cartridges and empty question-mark slots"),
    ("lobby-console.jpg", "Plug it in",
     "The ALEX-2600 console plays the game’s title screen on the TV.",
     "WHEELIE SIM plugged into the ALEX-2600 console, with its title screen on the TV"),
    ("lobby-bit.jpg", "Step through",
     "Bit tells you about the game, then a portal opens straight into it.",
     "Bit the robot floating in front of the glowing portal"),
]
for i, (pic, head, body, alt) in enumerate(steps):
    x = M + i * 4.12
    screen(s, img(pic), x + 0.06, 5.55, 1.95, 1.26, alt, accent=D_RULE)
    text(s, x + 2.22, 5.45, 0.5, 0.6, str(i + 1), size=30, font=TITLE, color=ACC, name=f"Step {i + 1} number")
    text(s, x + 2.6, 5.6, 1.5, 0.3, head.upper(), size=8.5, font=MONO, bold=True, color=D_INK, spacing=120,
         name=f"Step {i + 1} title")
    text(s, x + 2.22, 6.05, 1.8, 0.8, body, size=9.5, color=D_INK2, line=1.08, name=f"Step {i + 1} text")
    if i < 2:
        arrow(s, x + 3.98, 6.18, x + 4.12, 6.18, ACC, width=1.5, curve=False)
footer(s, 10, dark=True)
NOTES.append(("The Lobby",
              "Guidelines: Design & Technology / Coding, and a 3D concept.\n"
              "Rubric: Creative Expression & Innovation (the portfolio itself becomes a game console with a "
              "robot guide), Creativity Ability (one idea that ties every game together), Communication "
              "(three clear steps).\n"
              "Facts from lobby/v2.html and lobby/README.md: three cartridges so far (GO-KART, WHEELIE SIM, "
              "DRIFTING GAME); the rack has 6 slots and the empty ones show '?'; works in a browser (drag, "
              "WASD, click) and in a VR headset (grab a cartridge with the trigger or grip). Screenshots were "
              "taken from lobby/v2.html.\n"
              "CHECK WITH ALEX: if he has a photo of his original concept sketch, it could go on this slide "
              "next to the 3D version (sketch → 3D)."))

# ================================================================= 11 Mercedes SL63
s = new_slide("blueprint")
ACC = C("F2C200")
BLUE = C("2C5E8A")
header(s, 11, "CAD  ·  3D modeling", "Mercedes SL63", ACC, size=50, w=4.6)
described(s, M, 2.1, 4.15, 3.5, [
    ("What it is", "This is my 3D model of the Mercedes-AMG SL63, a famous roadster, made in Tinkercad."),
    ("My role",
     "I’m a big fan of cars and I like designing in Tinkercad, so I made this as practice and as a 3D "
     "model for a game I’m making. I built it from simple shapes, down to the seats, the grille, the "
     "wheels and a steering wheel full of buttons."),
    ("Why I included it",
     "It shows my sense of scale and design, how I assemble a model from parts, and how I’m learning "
     "spatial awareness."),
], ACC, size=11)
# Title block, like an engineering drawing
tb = [("MODEL", "Mercedes-AMG SL63"), ("TOOL", "Tinkercad"), ("DRAWN BY", "Alexander Kim"),
      ("FOR", "my racing game")]
rect(s, M, 5.75, 4.15, 1.05, fill=WHITE, line=BLUE, line_w=1, name="Title block")
for i, (k, v) in enumerate(tb):
    cx, cy = M + (i % 2) * 2.075, 5.75 + (i // 2) * 0.525
    rect(s, cx, cy, 2.075, 0.525, line=BLUE, line_w=0.5, name=f"Cell {k}")
    text(s, cx + 0.1, cy + 0.06, 1.9, 0.2, k, size=6.5, font=MONO, bold=True, color=BLUE, spacing=150)
    text(s, cx + 0.1, cy + 0.22, 1.9, 0.3, v, size=10.5, bold=True, color=INK)


def view(slide, path, x, y, w, h, name, alt, pad=0.12):
    rect(slide, x, y, w, h, fill=WHITE, line=BLUE, line_w=1, name=f"View {name}")
    text(slide, x + 0.1, y + 0.07, w - 0.2, 0.22, name, size=7.5, font=MONO, bold=True, color=BLUE,
         spacing=150, name=f"View label {name}")
    iw, ih = fit(path, w - 2 * pad, h - 0.32 - pad)
    picture(slide, path, x + (w - iw) / 2, y + 0.3 + (h - 0.3 - pad - ih) / 2, iw, ih, alt, cover=False)


view(s, img("sl63-hero.jpg"), 5.0, 0.55, 5.1, 3.0, "VIEW 1 · THREE-QUARTER", "Three-quarter view of the "
     "yellow SL63 model with its two seats and roll bar")
view(s, img("sl63-front.jpg"), 10.25, 0.55, 2.53, 1.45, "VIEW 2 · FRONT", "Front view showing the grille")
view(s, img("sl63-rear.jpg"), 10.25, 2.1, 2.53, 1.45, "VIEW 3 · REAR", "Rear three-quarter view with red "
     "tail lights and the spoiler")
view(s, img("sl63-side.jpg"), 5.0, 3.7, 4.6, 1.5, "VIEW 4 · SIDE", "Side view of the long, low roadster")
view(s, img("sl63-top.jpg"), 5.0, 5.35, 4.6, 1.5, "VIEW 5 · TOP", "Top view of the SL63 model")
view(s, img("sl63-dash.jpg"), 9.75, 3.7, 3.03, 3.15, "DETAIL A · STEERING WHEEL", "Close-up of the steering "
     "wheel with a screen and colored buttons")
note(s, 9.95, 3.98, 2.8, "even the wheel has buttons!", C("B07F00"), size=18, rot=-2, h=0.3)
footer(s, 11)
NOTES.append(("Mercedes SL63",
              "Guidelines: CAD drawings / 3D design.\n"
              "Rubric: Artistic Ability / Craftsmanship (proportions and details), Growth Mindset "
              "(practice toward a game asset), Communication (laid out like a real drawing sheet with "
              "numbered views and a title block).\n"
              "Screenshots: the Mercedes SL63 folder. The top view is rotated sideways to line up with the "
              "side view.\n"
              "Interview: be ready to explain how you kept the parts in scale with each other."))

# ================================================================= 12 Poppin' Matcha booth
s = new_slide("paper")
ACC = C("5E8C31")
PINK = C("D8648E")
header(s, 12, "Design & Technology  ·  CAD  ·  Real-world spaces", "Poppin’ Matcha Booth", ACC, size=46,
       w=9)
label(s, M, 1.98, "Plan  ·  from above", ACC)
rect(s, M, 2.3, 5.75, 3.8, fill=WHITE, line=RULE, name="Plan frame")
picture(s, img("booth-plan.jpg"), M + 0.08, 2.38, 5.59, 5.59 / 1.514, "Plan view of the booth from above: "
        "back wall, counter with a screen, pink rug, two lounge chairs and a round table", cover=False)
note(s, 1.45, 2.25, 1.4, "back wall", PINK, size=20, rot=-3)
note(s, 0.7, 4.95, 1.8, "counter + screen", PINK, size=20, rot=-2)
arrow(s, 1.4, 4.95, 1.75, 4.45, PINK, width=1.5)
note(s, 3.0, 5.62, 1.0, "rug", PINK, size=20, rot=2)
note(s, 4.85, 2.42, 1.5, "lounge chairs", PINK, size=20, rot=3)
arrow(s, 5.1, 2.8, 4.75, 3.25, PINK, width=1.5)
note(s, 5.4, 5.3, 1.0, "table", PINK, size=20, rot=-3)
label(s, 6.65, 1.98, "Front", ACC)
rect(s, 6.65, 2.3, 2.85, 1.8, fill=WHITE, line=RULE, name="Front frame")
iw, ih = fit(img("booth-front.jpg"), 2.75, 1.7)
picture(s, img("booth-front.jpg"), 6.65 + (2.85 - iw) / 2, 2.3 + (1.8 - ih) / 2, iw, ih,
        "Front view of the booth: black curtain wall with a banner, shelves, lounge chairs", cover=False)
label(s, 6.65, 4.27, "Side", ACC)
rect(s, 6.65, 4.59, 2.85, 1.51, fill=WHITE, line=RULE, name="Side frame")
iw, ih = fit(img("booth-side.jpg"), 2.75, 1.45)
picture(s, img("booth-side.jpg"), 6.65 + (2.85 - iw) / 2, 4.59 + (1.51 - ih) / 2, iw, ih,
        "Side view of the booth with the green side wall", cover=False)
described(s, 9.85, 2.0, 2.93, 3.4, [
    ("What it is",
     "This is a booth I designed in CAD for Poppin’ Matcha, the company my 7th and 8th grade class ran for "
     "Virtual Enterprises Junior Ventures."),
    ("My role", "I was a Senior Manager in Marketing, responsible for ads and promotions."),
    ("Why I included it",
     "It shows how I design real-world environments in CAD, from the back wall and shelves to the lounge "
     "chairs and rug."),
], ACC, size=10.5)
role = rect(s, 9.85, 5.45, 2.93, 1.0, fill=ACC, name="Role card")
text(s, 10.0, 5.53, 2.7, 0.3, "MY TEAM ROLE", size=7.5, font=MONO, bold=True, color=C("E4F0D6"), spacing=180)
text(s, 10.0, 5.76, 2.7, 0.7, ["SENIOR MANAGER,", "MARKETING"], size=17, font=TITLE, color=WHITE, line=0.95)
footer(s, 12)
NOTES.append(("Poppin' Matcha Booth",
              "Guidelines: CAD drawings / Architecture projects.\n"
              "Rubric: Communication (plan + views like an architect's sheet), Collaboration (a class "
              "company with roles), Artistic Ability.\n"
              "Brand spelling: the logo says 'Poppin' Matcha'.\n"
              "Check with Alex: the plan labels (back wall, counter + screen, rug, lounge chairs, table) are "
              "read from the screenshots; fix any he'd name differently. Was it made in Tinkercad?"))

# ================================================================= 13 Poppin' Matcha ads
s = new_slide("paper")
ACC = C("D8648E")
GREEN = C("5E8C31")
header(s, 13, "Visual art  ·  Graphic design in Canva", "Poppin’ Matcha Ads", ACC, size=46, w=6.5)
described(s, M, 2.0, 4.0, 3.2, [
    ("What it is",
     "These are ads and promotions for Poppin’ Matcha: a web banner, a vertical video ad and slides from "
     "our marketing plan."),
    ("My role",
     "My role was helping create ideas for them. I used Canva, starting with templates and then "
     "customizing them for our brand."),
    ("Why I included it", "It shows graphic design for a brand our class built together as a team."),
], ACC, size=11)
label(s, M, 5.4, "Our brand mission", GREEN)
note(s, M, 5.7, 4.1, "a boba with healthy benefits that still keeps its flavor", GREEN, size=25, rot=-1.5,
     h=1.0)
photo(s, img("ads-banner.jpg"), 4.95, 2.05, 5.9, 5.9 / 7.08, "Web banner: Poppin' Matcha, buy one get one 50% "
      "off", rot=-1, border=0.06, tapes=("tl", "tr"))
note(s, 9.3, 1.55, 1.6, "web banner", ACC, size=20, rot=3, h=0.35)
photo(s, img("ads-plan.jpg"), 5.0, 3.35, 2.7, 2.7 / 1.783, "Marketing plan title slide with the Poppin' "
      "Matcha logo", rot=-2.5)
photo(s, img("ads-what.jpg"), 8.05, 3.45, 2.6, 2.6 / 1.786, "Slide: What is Poppin' Matcha?", rot=2)
photo(s, img("ads-benefits.jpg"), 6.3, 5.0, 2.65, 2.65 / 1.793, "Slide: What are the benefits? Antioxidants, "
      "immune system, no added sugars", rot=-1)
note(s, 9.2, 5.35, 1.9, "slides from our marketing plan", ACC, size=19, rot=-3, h=0.6)
phone = rect(s, 11.15, 2.3, 1.65, 3.15, fill=C("111111"), name="Phone",
             shape=MSO_SHAPE.ROUNDED_RECTANGLE)
phone.adjustments[0] = 0.12
shadow(phone, alpha=0.3)
picture(s, img("ads-video.jpg"), 11.23, 2.42, 1.49, 2.91, "Vertical video ad: the Poppin' Matcha logo over "
        "a breaking wave")
note(s, 10.95, 5.5, 1.95, "vertical video ad", ACC, size=19, rot=2)
footer(s, 13)
NOTES.append(("Poppin' Matcha Ads",
              "Guidelines: Graphic design / Digital art.\n"
              "Rubric: Collaboration (the marketing plan was presented by Ava, Marcus, Grant, Cohen and "
              "Alex), Communication (a clear brand message), Artistic Ability.\n"
              "Images: the Popping matcha ads folder. The video and the 'What is Poppin' Matcha?' slide "
              "are stills from videos.\n"
              "Interview: be ready to show one template before and after you customized it."))

# ================================================================= 14-15 Alex & Mr. Fishy
FISH = C("F28C1E")   # Mr. Fishy orange
PW, PH, PGAP, PX0 = 2.1, 2.1 * 0.75, 0.13, 3.85


def storyboard_row(slide, y, ep, title, logline, frames, acc):
    """One episode: a label, title and one-line story on the left, numbered storyboard panels on the right."""
    label(slide, M, y, f"Episode {ep}", acc)
    text(slide, M, y + 0.27, 3.1, 0.5, title.upper(), size=26, font=TITLE, color=INK, name=f"Episode {ep} title")
    text(slide, M, y + 0.82, 3.0, 1.3, logline, size=10, color=INK2, line=1.1, name=f"Episode {ep} story")
    for i, (pic, caption, alt) in enumerate(frames):
        x = PX0 + i * (PW + PGAP)
        f = rect(slide, x - 0.04, y - 0.04, PW + 0.08, PH + 0.08, fill=WHITE, line=INK, line_w=1.25,
                 name=f"Panel {ep}-{i + 1}")
        shadow(f, alpha=0.12)
        picture(slide, img(pic), x, y, PW, PH, alt)
        b = rect(slide, x - 0.04, y - 0.04, 0.3, 0.26, fill=INK, name=f"Panel number {ep}-{i + 1}")
        tf = b.text_frame
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = f"{ep}.{i + 1}"
        r.font.name = MONO
        r.font.size = Pt(7.5)
        r.font.bold = True
        r.font.color.rgb = WHITE
        text(slide, x, y + PH + 0.1, PW, 0.42, caption, size=9, color=INK, line=1.05,
             name=f"Caption {ep}-{i + 1}")


s = new_slide("paper")
header(s, 14, "Animation  ·  Cartoon series  ·  Storyboards", "Alex & Mr. Fishy", FISH, size=46, w=6.6)
text(s, 7.3, 0.6, 5.45, 1.2,
     "Alex & Mr. Fishy is my cartoon series. In every episode, Mr. Fishy gets into a mess and learns something "
     "with help from his friend Alex. I picked frames from each cartoon and laid them out as storyboards.",
     size=10.5, color=INK, line=1.12, name="Intro")
storyboard_row(s, 1.98, 1, "Freak Out",
               "A storm is coming and Mr. Fishy is scared. His friend Alex comes along and helps him discover "
               "he can trust that everything will be OK, and he can ride the waves.", [
                   ("fishy-e1-1.jpg", "Title card: a giant wave is coming!",
                    "Episode 1 title card: Mr. Fishy and a crab in front of a giant wave"),
                   ("fishy-e1-2.jpg", "Mr. Fishy freaks out about the storm.",
                    "Mr. Fishy looking scared under the sea next to a crab"),
                   ("fishy-e1-3.jpg", "With Alex’s help, he rides the waves.",
                    "Mr. Fishy in sunglasses surfing a wave"),
               ], FISH)
note(s, PX0 + 3 * (PW + PGAP) + 0.1, 2.45, 1.95, "everything will be OK!", FISH, size=22, rot=-4, h=0.8)
arrow(s, PX0 + 3 * (PW + PGAP) + 0.25, 3.2, PX0 + 3 * (PW + PGAP) - 0.2, 3.0, FISH)
storyboard_row(s, 4.58, 2, "Wake Up",
               "Mr. Fishy and Alex help a school of fish rebuild their home after they made a mess “messing "
               "around.” Brick by brick, they build it back up together.", [
                   ("fishy-e2-1.jpg", "Mr. Fishy is fast asleep.",
                    "Mr. Fishy asleep in a blue nightcap, hugging a little purple pet"),
                   ("fishy-e2-2.jpg", "His friends need him to wake up.",
                    "A crab and two clownfish next to the sleeping Mr. Fishy"),
                   ("fishy-e2-3.jpg", "The fish’s home is a mess of bricks.",
                    "Building bricks floating everywhere while Mr. Fishy, a crab and a clownfish look worried"),
                   ("fishy-e2-4.jpg", "Brick by brick, they build it back up together.",
                    "The fish's home rebuilt from bricks, with Mr. Fishy, the crab and the clownfish smiling"),
               ], FISH)
footer(s, 14)

s = new_slide("paper")
header(s, 15, "Alex & Mr. Fishy  ·  Episodes 3 + 4", "The Big Race", FISH, size=46, w=6.6)
photo(s, img("fishy-memorial.jpg"), 11.35, 0.55, 1.3, 1.3 / 1.103, "The cartoon's ending card: In loving memory "
      "of Rocky Bal Beta, with a photo of the real betta fish", rot=3, border=0.05, tapes=("top",))
note(s, 7.4, 0.7, 3.8, "Rocky Bal Beta was our real pet betta fish", FISH, size=22, rot=-2, h=0.8,
     align=PP_ALIGN.RIGHT)
arrow(s, 10.6, 1.25, 11.2, 1.15, FISH)
storyboard_row(s, 1.98, 3, "Race",
               "Mr. Fishy is sure he’s the best and can win his race without training. He goes up against "
               "Rocky Bal Beta, who was our pet betta fish in real life. He loses, and learns that he needs to "
               "put the work in and practice humility.", [
                   ("fishy-e3-1.jpg", "Mr. Fishy, the “lean mean swimming machine.”",
                    "Mr. Fishy in a headband that says Lean Mean Swimming Machine, with a crab"),
                   ("fishy-e3-2.jpg", "His rival: Rocky Bal Beta.",
                    "Rocky Bal Beta, a blue and purple betta fish, in front of red sunburst stripes"),
                   ("fishy-e3-3.jpg", "Race day: he falls way behind.",
                    "Mr. Fishy far down the race track while a green dinosaur referee watches"),
                   ("fishy-e3-4.jpg", "Time to put the work in.",
                    "Mr. Fishy in sunglasses training on a treadmill called the Fish-O-Matic 3000"),
               ], FISH)
storyboard_row(s, 4.58, 4, "Stronger",
               "Mr. Fishy worked hard with Alex to get ready for the race, and he gets a rematch, with a lot "
               "of chaos.", [
                   ("fishy-e4-1.jpg", "The rematch!",
                    "Rocky Bal Beta and Mr. Fishy on the starting line with the dinosaur referee"),
                   ("fishy-e4-2.jpg", "Breaking news: “Banana Pants” interrupts the Tour de Fish.",
                    "A news anchor reporting that a dancing Banana Pants interrupts the Tour de Fish"),
                   ("fishy-e4-3.jpg", "A virus makes the computer sick.",
                    "A sick laptop with an ice pack and a thermometer, surrounded by virus germs"),
                   ("fishy-e4-4.jpg", "And the chaos keeps coming.",
                    "A crab holding a Go Fish card game box with Mr. Fishy on it, next to the dinosaur"),
               ], FISH)
footer(s, 15)
NOTES.append(("Alex & Mr. Fishy (episodes 1-2)",
              "Guidelines: Animation / Storyboards / Digital art.\n"
              "Rubric: Creative Expression & Innovation (an original cartoon series with its own characters), "
              "Communication (each episode told as a storyboard with one line per panel), Growth Mindset "
              "(every episode is about learning something).\n"
              "Frames: the Fishy cartoons folder, one folder per episode (the .swf files are the cartoons).\n"
              "CHECK WITH ALEX: the intro doesn't say what his role was (writing, drawing, animating, voices?) "
              "or how old he was. Add a sentence. Also check the panel captions, which were written from the "
              "frames and the episode summaries."))
NOTES.append(("Alex & Mr. Fishy: The Big Race (episodes 3-4)",
              "Rocky Bal Beta was the family's real pet betta fish; episode 3 ends with an 'In loving memory "
              "of rocky bal beta' card, shown top right.\n"
              "CHECK WITH ALEX: the spelling of Rocky Bal Beta (the card says 'rocky bal beta'), and the "
              "episode 4 captions: the frames show a news report about Banana Pants, a computer virus and a Go "
              "Fish game, but who wins the rematch isn't on the slide."))

# ================================================================= 16 The Fort
s = new_slide("paper")
ACC = C("B5702D")
header(s, 16, "Building & Making  ·  Woodworking", "The Fort", ACC, size=54)
described(s, M, 2.05, 7.0, 2.6, [
    ("What it is", "At a camp I went to with my brother, we built a fort out of wood."),
    ("My role",
     "We used posts for the frame, built the first floor above the ground using nails, built the walls, "
     "added a roof, and then decorated it. My role was assembling the fort."),
    ("Why I included it", "It’s where I got my experience building with wood."),
], ACC, size=12)
label(s, M, 4.6, "How we built it", ACC)
build = [("Posts", "for the frame"), ("Floor", "nailed together, above the ground"), ("Walls", "built and "
         "nailed on"), ("Roof", "added on top"), ("Decorate", "made it ours")]
ln = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(M + 0.25), Inches(5.2), Inches(M + 4 * 1.48 + 0.25),
                            Inches(5.2))
ln.line.color.rgb = ACC
ln.line.width = Pt(2)
ln.line.dash_style = 4
for i, (head, body) in enumerate(build):
    x = M + i * 1.48
    badge(s, x + 0.04, 5.0, i + 1, ACC, size=0.42)
    text(s, x, 5.55, 1.4, 0.35, head.upper(), size=18, font=TITLE, color=INK, name=f"Build {head}")
    text(s, x, 5.92, 1.35, 0.8, body, size=9.5, color=INK2, name=f"Build text {head}", line=1.05)
photo(s, img("build-fort1-cropped.jpg"), 8.15, 0.75, 2.4, 2.4 / 0.581, "The finished fort standing on its "
      "posts, with a roof and a painted wall", rot=-1.5, tapes=("tl", "tr"))
photo(s, img("build-fort2.jpg"), 10.75, 0.7, 2.0, 2.0 / 1.032, "Alex and his brother in front of the fort "
      "they built, holding their certificates", rot=3)
photo(s, img("build-fort1.jpg"), 10.75, 3.65, 2.0, 2.0 / 1.032, "The fort's decorated front wall", rot=-2.5)
note(s, 10.9, 2.78, 2.0, "me + my brother", ACC, size=20, rot=2)
note(s, 10.85, 5.8, 2.0, "we decorated it!", ACC, size=20, rot=-3)
note(s, 8.2, 5.35, 2.4, "posts hold the floor off the ground", ACC, size=18, rot=-3, h=0.6)
arrow(s, 8.35, 5.35, 8.6, 4.75, ACC, width=1.5)
footer(s, 16)
NOTES.append(("The Fort",
              "Guidelines: Woodworking / Building projects.\n"
              "Rubric: Artistic Ability / Craftsmanship (a real structure), Collaboration (built with his "
              "brother), Communication (numbered build steps).\n"
              "Photo note: the photo where Alex has his shirt off stays out; the cropped version shows only "
              "the structure. The original stays in the Building photos folder."))

# ================================================================= 17 Birdhouse & glider
s = new_slide("paper")
ACC = C("1E9C8A")
header(s, 17, "Building & Making  ·  Early builds", "Birdhouse & Glider", ACC, size=46, w=8)
label(s, M, 1.98, "Birdhouse: from bare wood to finished", ACC)
tw = 2.0
for i in range(4):
    x = M + 0.1 + i * 2.45
    photo(s, img(f"build-birdhouse{i + 1}.jpg"), x, 2.42, tw, tw / 0.75, f"Alex painting a wooden birdhouse, "
          f"step {i + 1} of 4", rot=[-2, 1.5, -1, 2][i], tapes=("top",) if i % 2 == 0 else ("tr",))
    badge(s, x - 0.12, 2.3, i + 1, ACC, size=0.34)
    if i < 3:
        arrow(s, x + tw + 0.1, 3.75, x + 2.35, 3.75, ACC, width=1.5, curve=False)
label(s, 10.4, 1.98, "Balsa-wood glider", ACC)
photo(s, img("build-buildplane.jpg"), 10.4, 2.42, 2.35, 2.35 / 1.032, "Alex assembling a balsa-wood glider",
      rot=2.5)
note(s, 10.45, 4.95, 2.4, "piece by piece", ACC, size=20, rot=-2)
for i, blk in enumerate([
    ("What it is",
     "Building has always been one of my favorite things to do. These photos show me painting a wooden "
     "birdhouse and putting together a balsa-wood glider."),
    ("My role", "I painted my own design on the birdhouse and assembled the glider piece by piece."),
    ("Why I included it",
     "These early projects are where my love of making things started, and they led to bigger builds "
     "like my fort and my go-kart."),
]):
    described(s, M + i * 4.12, 5.55, 3.9, 1.4, [blk], ACC, size=10.5)
footer(s, 17)
NOTES.append(("Birdhouse & Glider",
              "Rubric: Artistic Ability / Craftsmanship (hands-on making), Growth Mindset (the birdhouse "
              "shown step by step), Creativity Ability (his own painted designs).\n"
              "Interview: good for 'What types of creative projects do you enjoy?'"))

# ================================================================= 18 Music Production
s = new_slide("paper")
ACC = C("8A3FFC")
header(s, 18, "Music  ·  DJ mixing + production", "Music Production", ACC, size=36, w=4.6)
described(s, M, 2.05, 4.2, 3.1, [
    ("What it is",
     "I love playing music. I make and mix music with my MIDI keyboard, my laptop and my DJ controller."),
    ("My role",
     "I’ve created my own mixes, performed DJ mixing in my school talent show, and played at parties for my "
     "neighborhood."),
    ("Why I included it",
     "I like it when people are happy, dancing and enjoying music together."),
], ACC, size=11)
note(s, M, 4.95, 4.3, "the best part is when everyone starts dancing", ACC, size=24, rot=-2, h=0.8)
label(s, M, 5.95, "Where I’ve played", ACC)
chips(s, M, 6.27, ["TALENT SHOW 2026", "NEIGHBORHOOD PARTIES", "HOME STUDIO"], ACC, 4.5, size=8)

photo(s, img("music-studio.jpg"), 5.15, 0.68, 3.75, 3.75 / 1.251, "Alex smiling at his desk with his MIDI keyboard, "
      "laptop and music software on the monitor", rot=-1.5, tapes=("tl", "tr"))
photo(s, img("music-dj-2.jpg"), 9.25, 0.6, 1.62, 1.62 / 0.498, "Alex with headphones on, mixing on his DJ "
      "controller with the lights on", rot=2.5)
photo(s, img("music-dj-1.jpg"), 11.15, 0.78, 1.6, 1.6 / 0.566, "Alex mixing on his DJ controller, seen from "
      "behind", rot=-2, tapes=("tr",))
note(s, 5.3, 3.85, 2.6, "my home studio", ACC, size=20, rot=-2, h=0.35)
note(s, 11.1, 3.75, 1.8, "mixing live", ACC, size=20, rot=3, h=0.35)
photo(s, img("music-talent-1.jpg"), 5.25, 4.5, 2.5, 2.5 / 1.333, "Alex setting up his DJ table on stage at the "
      "talent show", rot=1.5, tapes=("top",))
photo(s, img("music-talent-2.jpg"), 8.15, 4.42, 1.85, 1.85 / 0.971, "Alex DJ mixing on stage under the Got Talent "
      "2026 banner", rot=-2)
photo(s, img("music-program.jpg"), 10.6, 4.4, 1.95, 1.95 / 1.077, "The talent show program: 2026 OPA's Got "
      "Talent, with DJ Mixing - Alexander Kim circled", rot=2.5, tapes=("top",))
note(s, 10.45, 6.4, 2.5, "my act was on the program!", ACC, size=18, rot=-2, h=0.35)
footer(s, 18)
NOTES.append(("Music Production",
              "Guidelines: Music / Performance / Digital media.\n"
              "Rubric: Creative Expression (music he makes and mixes), Communication (performing for an audience "
              "at the talent show and neighborhood parties), Collaboration (playing for other people).\n"
              "Photos: the Music Production folder. The studio photo (DJ-setup-remove-pelo) was cleaned up: the "
              "exercise bike, the sunglasses, the red tray and the loose cables were removed, and it's cropped "
              "above the dog. The other performers' names on the program are blurred.\n"
              "CHECK WITH ALEX: the request said 'I have created models'; the slide says 'created my own mixes'. "
              "Fix it if he meant something else. Also: what equipment/software does he use (the slide just says "
              "MIDI keyboard, laptop and DJ controller)?"))

# ================================================================= 19 Encanto
s = new_slide("dark")
ACC = C("F5B841")
picture(s, img("encanto-hero.jpg"), 5.15, 0, W_IN - 5.15, 4.75, "The full cast of Encanto on stage")
header(s, 19, "Theatre experience  ·  Performance", "Encanto", ACC, dark=True, size=54, w=4.4)
described(s, M, 2.05, 4.2, 4.7, [
    ("What it is",
     "Encanto was a youth musical theatre production I performed in, with a big cast, bright costumes and "
     "a painted set."),
    ("My role", "I was part of the cast, singing and acting on stage alongside everyone else to bring the "
     "story to life."),
    ("Why I included it",
     "Being on stage showed me how much the set, costumes and lighting shape a story, and that’s the side "
     "of theatre I want to learn next."),
], ACC, dark=True, size=11.5)
for i in range(4):
    x = 5.4 + i * 1.87
    screen(s, img(f"encanto-{i + 1}.jpg"), x, 5.0, 1.72, 1.85, f"Encanto on stage, photo {i + 1}",
           frame=C("0F1318"), pad=0.03)
note(s, M, 6.3, 4.4, "next: designing the set!", ACC, size=24, rot=-1.5, h=0.4)
footer(s, 19, dark=True)
NOTES.append(("Encanto",
              "Guidelines: Theatre Experience is one of the listed portfolio categories.\n"
              "Rubric: Communication (performing for an audience), Creative Expression.\n"
              "Check with Alex: add the character he played, the year and the theatre or school if he "
              "wants them on the slide.\n"
              "Interview: connects to 'Why are you interested in the Production & Design Conservatory?'"))

# ---------------------------------------------------------------- save
assert len(prs.slides) == TOTAL, len(prs.slides)
prs.save(OUT)
with open(NOTES_OUT, "w") as fh:
    fh.write("# Alexander Kim Portfolio: notes for Alex\n\n"
             "Every description is a first draft in Alex's voice. Rewrite them in your own words.\n\n")
    for i, (title, body) in enumerate(NOTES, start=1):
        fh.write(f"## Slide {i}: {title}\n\n{body}\n\n")
print("saved", OUT)
