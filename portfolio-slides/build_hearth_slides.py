"""Builds the Hearth slides for Alex's OCSA Production & Design portfolio.

Standard 16:9 PowerPoint size (13.333 x 7.5 in). Run with python-pptx installed:
    python build_hearth_slides.py

Slide 1: the project (what it is / my role / why I included it, 5 sentences total).
Slide 2: color and mood, the four themes and the memory behind each.
Slide 3: the process, and what didn't work and how it got fixed.
Slide 4: the character crew, from the pen sketches to 3D in three looks.
    The crew-*.png rows are renders of ../characters/crew.js on the card color.

Speaker notes go to Hearth-slide-notes.md, not into the deck: python-pptx notes
stop Keynote from opening the file.
"""
import os

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
MOCKUPS = os.path.join(HERE, "..", "hearth", "mockups")
IMAGES = os.path.join(HERE, "images")
OUT = os.path.join(HERE, "Hearth-portfolio-slides.pptx")


def hex_color(value):
    return RGBColor.from_string(value.lstrip("#").upper())


# Light deck on the swatch board's oat background (hearth/palettes/preview.html).
# Hearth's ember and gold are deepened so text on the light background stays readable.
BG = hex_color("ECE7DF")
CARD = hex_color("F9F6F1")
INK = hex_color("2B2522")
MUTED = hex_color("5E5048")
EMBER = hex_color("B4472A")    # labels, numbers
AMBER = hex_color("8F4E1C")    # subtitles, step titles
ON_EMBER = hex_color("FFF7EE")
MOSS = hex_color("A9C786")
GOLD = hex_color("F6BE6E")
HEAD = "Cambria"
BODY = "Calibri"

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]


def background(slide):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = BG


def text(slide, x, y, w, h, runs, size=14, color=INK, font=BODY, bold=False, italic=False,
         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, name=None):
    """runs: a string, or a list of paragraphs; each paragraph a string or list of (text, overrides)."""
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
        for t, o in (para if isinstance(para, list) else [(para, {})]):
            r = p.add_run()
            r.text = t
            f = r.font
            f.name = o.get("font", font)
            f.size = Pt(o.get("size", size))
            f.bold = o.get("bold", bold)
            f.italic = o.get("italic", italic)
            f.color.rgb = o.get("color", color)
    return box


def kicker(slide, x, y, label, size=12, w=8):
    box = text(slide, x, y, w, 0.3, label.upper(), size=size, color=EMBER, bold=True, name=f"Label {label}")
    for r in box.text_frame.paragraphs[0].runs:
        r.font._element.set("spc", "200")  # letter-spacing; python-pptx has no API for it
    return box


def rounded(slide, x, y, w, h, fill, name, radius=0.08):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    shape.adjustments[0] = radius
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.fill.background()
    shape.shadow.inherit = False
    return shape


def chip(slide, x, y, w, label, fill):
    shape = rounded(slide, x, y, w, 0.32, fill, f"Status {label}", radius=0.5)
    tf = shape.text_frame
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = label.upper()
    r.font.name = BODY
    r.font.size = Pt(11)
    r.font.bold = True
    r.font.color.rgb = INK


def circle_number(slide, x, y, n):
    c = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(0.5), Inches(0.5))
    c.name = f"Step {n} number"
    c.fill.solid()
    c.fill.fore_color.rgb = EMBER
    c.line.fill.background()
    tf = c.text_frame
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = str(n)
    r.font.name = HEAD
    r.font.size = Pt(18)
    r.font.bold = True
    r.font.color.rgb = ON_EMBER


def swatch(slide, x, y, size, color, name):
    c = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(size), Inches(size))
    c.name = name
    c.fill.solid()
    c.fill.fore_color.rgb = hex_color(color)
    c.line.color.rgb = hex_color("CFC6BA")
    c.line.width = Pt(0.75)
    return c


def picture(slide, path, x, y, w, alt, h=None):
    pic = slide.shapes.add_picture(path, Inches(x), Inches(y), width=Inches(w),
                                   height=Inches(h) if h else None)
    pic.name = alt
    pic._element.nvPicPr.cNvPr.set("descr", alt)
    return pic


# ---------------------------------------------------------------- Cover
s0 = prs.slides.add_slide(BLANK)
background(s0)
kicker(s0, 0.6, 0.75, "OCSA  ·  Production & Design Conservatory")
text(s0, 0.6, 1.15, 5.9, 2.3, "Alex Kim’s Portfolio", size=60, font=HEAD, bold=True, name="Title")
text(s0, 0.6, 3.45, 5.9, 0.9, "Apps, characters, building and theatre: the things I make and why.",
     size=22, color=AMBER, font=HEAD, italic=True, name="Subtitle")
kicker(s0, 0.6, 4.75, "Inside", size=11, w=5.9)
contents = [
    ("Hearth", "a wellness app I designed and coded"),
    ("Meet the crew", "characters from sketch to 3D"),
    ("Building & Making", "birdhouse, glider and a fort"),
    ("Encanto", "performing in a musical"),
]
text(s0, 0.6, 5.05, 5.9, 1.9,
     [[(f"{head}  ", {"bold": True, "font": HEAD, "color": INK}), (f"{body}", {"color": MUTED})]
      for head, body in contents],
     size=15, color=INK, name="Contents")
picture(s0, os.path.join(IMAGES, "cover-stage.jpg"), 6.83, 0.75, 5.9,
        "Alex on stage with the cast of Encanto", h=5.9 * 900 / 1750)
picture(s0, os.path.join(IMAGES, "cover-fort.jpg"), 6.83, 3.98, 2.75,
        "Alex and a friend in front of the fort they built", h=2.95)
picture(s0, os.path.join(IMAGES, "cover-birdhouse.jpg"), 9.98, 3.98, 2.75,
        "Alex painting his birdhouse", h=2.95)

NOTES_0 = (
    "Cover: name the portfolio and preview what's inside. The photos hint at range (stage, "
    "building, making) before the first project."
)

# ---------------------------------------------------------------- Slide 1: the project
s1 = prs.slides.add_slide(BLANK)
background(s1)
kicker(s1, 0.6, 0.55, "Design & Technology  ·  App Design")
text(s1, 0.6, 0.9, 6.0, 1.0, "Hearth", size=60, font=HEAD, bold=True, name="Title")
text(s1, 0.6, 1.95, 6.0, 0.45, "A wellness app that grows with you", size=22, color=AMBER,
     font=HEAD, italic=True, name="Subtitle")

blocks = [
    ("What it is",
     "Hearth is a wellness app built around a daily ritual: each morning it asks “What would "
     "make today feel tended?” and you set three small intentions. A quick check-in on your mood, "
     "energy and stress shapes kinder goals, an “I’m feeling” page suggests ways to cope, and you "
     "get a companion that grows with your streak."),
    ("My role",
     "I was the designer and coder: I came up with the idea, designed every screen and feature, "
     "and coded it by directing an Agent coding tool for the OC Student AI Network."),
    ("Why I included it",
     "Like a lot of students, I juggle assignments, deadlines and social pressure, and I wanted a "
     "calm way to take each day one step at a time. I noticed a lot of people make games, so I "
     "wanted to make something that stood out and could actually help."),
]
# Each block's top, sized to its text (5 lines, 3 lines, 3 lines) so the gaps match.
for (label, body), y in zip(blocks, (2.7, 4.45, 5.85)):
    kicker(s1, 0.6, y, label, size=11, w=5.7)
    text(s1, 0.6, y + 0.3, 5.7, 1.05, body, size=15, color=INK, name=f"{label} text")

picture(s1, os.path.join(MOCKUPS, "combo-keeper.png"), 6.45, 0.75, 6.5,
        "Hearth on a laptop and a phone, showing the little keeper creature in its golden final form")

stats = [("3", "intentions a day"), ("28", "days to the final form"), ("0", "data collected")]
x = 6.95
for big, label in stats:
    rounded(s1, x, 5.45, 1.85, 1.35, CARD, f"Stat card {label}", radius=0.12)
    text(s1, x, 5.55, 1.85, 0.7, big, size=36, color=EMBER, font=HEAD, bold=True,
         align=PP_ALIGN.CENTER, name=f"Stat {label}")
    text(s1, x + 0.1, 6.25, 1.65, 0.45, label, size=12, color=MUTED, align=PP_ALIGN.CENTER,
         name=f"Stat label {label}")
    x += 2.05

NOTES_1 = (
    "Guidelines: project clearly labeled; description is 5 sentences (3-5 allowed) covering what it "
    "is, my role, and why I included it.\n"
    "Rubric: Creative Expression & Innovation (a wellness app with a personal reason, instead of "
    "another game). Communication (clear what / role / why).\n"
    "Interview: answers 'What types of creative projects do you enjoy?' and 'Describe a project you "
    "are proud of.'"
)

# ---------------------------------------------------------------- Slide 2: color and mood
s2 = prs.slides.add_slide(BLANK)
background(s2)
kicker(s2, 0.6, 0.55, "Hearth  ·  Color & mood")
text(s2, 0.6, 0.9, 12.1, 0.8, "Colors that match your mood", size=40, font=HEAD, bold=True,
     name="Title")
text(s2, 0.6, 1.75, 12.1, 0.6,
     "Colors change how people feel, so I designed four calm themes you can switch between "
     "depending on your mood. Each one comes from a place or memory that makes me feel calm.",
     size=15, color=INK, name="Intro")

themes = [
    ("ember", "Ember", "Cozy and comforting",
     "From camping trips with my mom, where the campfire is one of the most comforting feelings I know.",
     ["181112", "392522", "F6BE6E", "F26D3D", "D65332", "FDF4E7"]),
    ("tidepool", "Tidepool", "Serene and connected",
     "From exploring tide pools as a kid, where every animal was relaxed and the ecosystem worked as one.",
     ["0F1820", "1A2A36", "9FD0DE", "7FB3CF", "3A7593", "EAF2F5"]),
    ("meadow", "Morning Meadow", "Fresh and hopeful",
     "From mornings lying in the grass under a blue sky, with nowhere to be and a whole new day ahead.",
     ["F6F1E7", "FFFCF6", "A0553B", "6E8F62", "56744B", "2F3A33"]),
    ("marshy", "Marshy", "Soft and safe",
     "From Marshy, my sequined midnight-blue sheep, who kept me company on the darkest nights.",
     ["121838", "1E2652", "A9D4F5", "9CC8F0", "4660B5", "EEF3FC"]),
]
x = 0.6
for key, name, mood, story, colors in themes:
    rounded(s2, x, 2.45, 2.85, 4.55, CARD, f"Theme card {name}", radius=0.06)
    picture(s2, os.path.join(IMAGES, f"theme-{key}.jpg"), x + 0.15, 2.6, 2.55,
            f"Hearth in the {name} theme", h=2.55 * 806 / 1170)
    text(s2, x + 0.2, 4.5, 2.5, 0.38, name, size=18, color=INK, font=HEAD, bold=True,
         name=f"Theme name {name}")
    text(s2, x + 0.2, 4.9, 2.5, 0.32, mood, size=14, color=AMBER, italic=True, name=f"Mood {name}")
    text(s2, x + 0.2, 5.27, 2.5, 1.0, story, size=14, color=INK, name=f"Story {name}")
    sx = x + 0.2
    for i, color in enumerate(colors):
        swatch(s2, sx, 6.5, 0.33, color, f"{name} swatch {i + 1}")
        sx += 0.41
    x += 3.09

NOTES_2 = (
    "Rubric: Creative Expression (themes drawn from personal memories, a unique perspective), "
    "Creativity Ability (exploring four directions instead of one), Artistic Ability / "
    "Craftsmanship (consistent, readable palettes), Communication (the why behind each color).\n"
    "Stories: Ember is the campfire on camping trips with Alex's mom, and the reason the app is "
    "called Hearth. Tidepool is exploring tide pools as a kid, where the ecosystem works as one, a "
    "picture of serenity and unity. Morning Meadow is waking up hopeful, lying in the grass under a "
    "blue sky with nowhere to be. Marshy is his childhood stuffed sheep in midnight blue and sky blue "
    "sequins, who comforted him on the darkest nights and starred in a cartoon he made as a kid.\n"
    "Color talking points: blue is widely linked with calm; green with nature, growth and balance. "
    "Every theme is muted, avoids pure black and white, keeps text easy to read, and keeps one warm "
    "note so it still feels like a hearth.\n"
    "Interview: answers 'What is your personal favorite design aesthetic?'"
)

# ---------------------------------------------------------------- Slide 3: process + problems
s3 = prs.slides.add_slide(BLANK)
background(s3)
kicker(s3, 0.6, 0.55, "Hearth  ·  My process")
text(s3, 0.6, 0.9, 12.1, 0.8, "Turning problems into solutions", size=40, font=HEAD, bold=True,
     name="Title")

steps = [
    ("Think", "I sat down and asked myself what tool could make the world better and isn’t out there enough."),
    ("Outline", "I wrote the main outline: a daily check-in, three goals, and a creature that grows."),
    ("Build", "I built it by prompting an Agent coding tool, one feature at a time."),
    ("Test & fix", "I tested each part, and when something broke I found another way."),
]
x = 0.6
for i, (head, body) in enumerate(steps, start=1):
    circle_number(s3, x, 1.95, i)
    text(s3, x + 0.65, 1.98, 2.2, 0.45, head, size=18, color=AMBER, font=HEAD, bold=True,
         name=f"Step {i} title")
    text(s3, x, 2.6, 2.85, 0.95, body, size=14, color=INK, name=f"Step {i} text")
    x += 3.09

kicker(s3, 0.6, 3.75, "What didn’t work, and what I did about it", size=11)

problems = [
    ("The app wouldn’t load",
     "My first version wouldn’t run at all.",
     "I loaded it on a personal account, and it worked.",
     ("Fixed", MOSS)),
    ("The Agent got stuck on goals",
     "It kept misreading the goals feature and handing back the same broken answer, no matter "
     "how I prompted it.",
     "I turned the problem into the solution: a goal tracker you set up yourself with short surveys.",
     ("Fixed", MOSS)),
    ("The shop locks free hats",
     "The Agent decided you have to buy the free hats for your creature.",
     "Still working on it, and it’s next on my list.",
     ("In progress", GOLD)),
]
x = 0.6
for head, problem, fix, (status, color) in problems:
    rounded(s3, x, 4.1, 3.85, 2.75, CARD, f"Problem card {head}", radius=0.07)
    text(s3, x + 0.25, 4.27, 2.0, 0.6, head, size=16, color=AMBER, font=HEAD, bold=True,
         name=f"Problem {head}")
    chip(s3, x + 3.85 - 0.25 - 1.15, 4.3, 1.15, status, color)
    text(s3, x + 0.25, 4.95, 3.35, 0.8, problem, size=14, color=MUTED, name=f"Problem text {head}")
    text(s3, x + 0.25, 5.8, 3.35, 0.95,
         [[("Fix: ", {"bold": True, "color": EMBER}), (fix, {})]],
         size=14, color=INK, name=f"Fix {head}")
    x += 4.14

NOTES_3 = (
    "Rubric: Growth Mindset & Problem Solving (three real problems; one turned into a new feature, "
    "one still in progress, which shows honest reflection). Creativity Ability (flexible thinking "
    "when the Agent got stuck). Communication (clear process steps).\n"
    "Interview tip: be ready to explain how the goal tracker changed, and why the shop bug is "
    "tricky. If asked about the planned Agent helper, mention the fail-safes so it always points "
    "someone who is struggling to real help, like 988, the Suicide & Crisis Lifeline."
)

# ---------------------------------------------------------------- Slide 4: character crew
s4 = prs.slides.add_slide(BLANK)
background(s4)
kicker(s4, 0.6, 0.55, "Character Design  ·  Sketch to 3D")
text(s4, 0.6, 0.9, 12.1, 0.8, "Meet the crew", size=40, font=HEAD, bold=True, name="Title")
text(s4, 0.6, 1.75, 12.1, 0.8,
     "Jimbob, Srank, Jimmy, Ember and Bernie are five characters I invented and first drew in pen "
     "on paper. I turned each sketch into a 3D character, then tried every one in three looks "
     "inspired by cartoons and games I studied. I included them to show my process: how a quick "
     "doodle grows into a finished character without losing what made the drawing special.",
     size=15, color=INK, name="Intro")

circle_number(s4, 0.6, 2.68, 1)
text(s4, 1.25, 2.71, 4.0, 0.45, "Sketch on paper", size=18, color=AMBER, font=HEAD, bold=True,
     name="Step 1 title")
rounded(s4, 0.6, 3.3, 4.7, 3.75, CARD, "Sketch card", radius=0.05)
picture(s4, os.path.join(IMAGES, "characters-sketches.jpg"), 0.75, 3.45, 4.4,
        "Alex's pen sketches of Jimbob the big ball of slime, Srank the star, Jimmy the cat, Ember the "
        "flame and Bernie the stegosaurus, with the name Sprout crossed out above Bernie")
text(s4, 0.75, 6.4, 4.4, 0.55,
     "Bernie was almost named Sprout. The old name is still crossed out on the page.",
     size=14, color=MUTED, italic=True, name="Sketch caption")

circle_number(s4, 5.55, 2.68, 2)
text(s4, 6.2, 2.71, 6.5, 0.45, "Bring them to life in 3D, in three looks", size=18, color=AMBER,
     font=HEAD, bold=True, name="Step 2 title")
rounded(s4, 5.55, 3.3, 7.18, 3.75, CARD, "Crew card", radius=0.035)

ROW_X, ROW_W, ROW_H = 7.6, 4.95, 0.844
# Where each character's center sits across the render, as a fraction of its width.
for name, frac in zip(["Jimbob", "Srank", "Jimmy", "Ember", "Bernie"],
                      (0.107, 0.30, 0.495, 0.683, 0.88)):
    text(s4, ROW_X + frac * ROW_W - 0.5, 3.42, 1.0, 0.3, name, size=12, color=MUTED, bold=True,
         align=PP_ALIGN.CENTER, name=f"Character {name}")

looks = [
    ("toon", "Toon", "flat & bold"),
    ("galaxy", "Galaxy", "shiny glow"),
    ("carlo", "Painted", "fuzzy & wobbly"),
]
y = 3.8
for key, look, tag in looks:
    text(s4, 5.8, y + 0.15, 1.75, 0.6,
         [[(look, {"font": HEAD, "bold": True, "size": 16})],
          [(tag, {"size": 12, "color": MUTED, "italic": True})]],
         size=16, color=INK, name=f"Look {look}")
    picture(s4, os.path.join(IMAGES, f"crew-{key}.png"), ROW_X, y, ROW_W,
            f"The five characters in the {look} look", h=ROW_H)
    y += 1.05

NOTES_4 = (
    "Rubric: Creative Expression & Innovation (five original characters, each with a name and "
    "personality). Creativity Ability (every character explored in three styles instead of one). "
    "Artistic Ability / Craftsmanship (the 3D versions keep details from the drawings, like "
    "Jimbob's uneven eyes, Srank's swirl and heart, and Ember having no mouth). Growth Mindset "
    "(the crossed-out name shows ideas changing right on the page).\n"
    "Style talking points: Toon is flat, bright color, big round eyes and a thick ink outline. "
    "Galaxy is glossy and glowing, with sparkles. Painted is googly eyes, fuzz, painted hatching "
    "and a wobbly line.\n"
    "Interview tip: be ready to explain how the 3D versions were made, and which look is your "
    "favorite and why."
)

# ---------------------------------------------------------------- Slide: building & making
def described_project(slide, blocks, tops, width=4.75):
    for (label, body), y in zip(blocks, tops):
        kicker(slide, 0.6, y, label, size=11, w=width)
        text(slide, 0.6, y + 0.3, width, 1.3, body, size=15, color=INK, name=f"{label} text")


s5 = prs.slides.add_slide(BLANK)
background(s5)
kicker(s5, 0.6, 0.55, "Building & Making  ·  Woodworking & DIY")
text(s5, 0.6, 0.9, 12.1, 0.8, "Building & Making", size=40, font=HEAD, bold=True, name="Title")
described_project(s5, [
    ("What it is",
     "Building has always been one of my favorite things to do. These photos show me painting a "
     "wooden birdhouse, putting together a balsa-wood glider, and building a big fort with a friend."),
    ("My role",
     "I painted my own design on the birdhouse, assembled the glider piece by piece, and helped "
     "build and decorate the fort."),
    ("Why I included it",
     "These early projects are where my love of making things started, and it led to bigger builds "
     "like my go-kart."),
], (1.95, 3.55, 4.95))

GRID_X, GRID_W = 5.83, 6.9
tile_w = (GRID_W - 3 * 0.2) / 4
for i, n in enumerate(["birdhouse1", "birdhouse2", "birdhouse3", "birdhouse4"]):
    picture(s5, os.path.join(IMAGES, f"build-{n}.jpg"), GRID_X + i * (tile_w + 0.2), 1.95, tile_w,
            f"Alex painting a wooden birdhouse, step {i + 1} of 4", h=2.1)
text(s5, GRID_X, 4.12, GRID_W, 0.3, "Birdhouse: from bare wood to finished", size=12, color=MUTED,
     italic=True, name="Birdhouse caption")
wide_w = (GRID_W - 2 * 0.2) / 3
bottom = [
    ("buildplane", "Balsa-wood glider", "Alex assembling a balsa-wood glider"),
    ("fort1", "The fort in progress", "The fort Alex helped build, with its painted front panel"),
    ("fort2", "Finished fort", "Alex and a friend in front of the finished fort"),
]
for i, (n, caption, alt) in enumerate(bottom):
    x = GRID_X + i * (wide_w + 0.2)
    picture(s5, os.path.join(IMAGES, f"build-{n}.jpg"), x, 4.55, wide_w, alt, h=2.1)
    text(s5, x, 6.72, wide_w, 0.3, caption, size=12, color=MUTED, italic=True,
         name=f"Caption {caption}")

NOTES_5 = (
    "Rubric: Artistic Ability / Craftsmanship (hands-on making), Growth Mindset (the birdhouse "
    "shown step by step), Creativity Ability (his own painted designs).\n"
    "Photo note: Alex is cropped out of the fort photo where he has his shirt off; the original "
    "stays in the Building photos folder.\n"
    "Interview: good for 'What types of creative projects do you enjoy?'"
)

# ---------------------------------------------------------------- Slide: Encanto
s6 = prs.slides.add_slide(BLANK)
background(s6)
kicker(s6, 0.6, 0.55, "Theatre Experience  ·  Performance")
text(s6, 0.6, 0.9, 12.1, 0.8, "Encanto", size=40, font=HEAD, bold=True, name="Title")
described_project(s6, [
    ("What it is",
     "Encanto was a youth musical theatre production I performed in, with a big cast, bright "
     "costumes and a painted set."),
    ("My role",
     "I was part of the cast, singing and acting on stage alongside everyone else to bring the "
     "story to life."),
    ("Why I included it",
     "Being on stage showed me how much the set, costumes and lighting shape a story, and that’s "
     "the side of theatre I want to learn next."),
], (1.95, 3.3, 4.4))
picture(s6, os.path.join(IMAGES, "encanto-hero.jpg"), 5.83, 1.95, 6.9,
        "The full cast of Encanto on stage", h=3.0)
for i in range(4):
    picture(s6, os.path.join(IMAGES, f"encanto-{i + 1}.jpg"), 5.83 + i * (tile_w + 0.2), 5.15,
            tile_w, f"Encanto on stage, photo {i + 1}", h=1.75)

NOTES_6 = (
    "Guidelines: Theatre Experience is one of the listed portfolio categories.\n"
    "Rubric: Communication (performing for an audience), Creative Expression.\n"
    "Check with Alex: the description is general. Add the character he played, the year and the "
    "theatre or school if he wants them on the slide.\n"
    "Interview: connects to 'Why are you interested in the Production & Design Conservatory?'"
)

prs.save(OUT)
with open(os.path.join(HERE, "Hearth-slide-notes.md"), "w") as fh:
    fh.write("# Alex Kim's portfolio: notes for Alex\n\n"
             f"## Slide 1: Cover\n\n{NOTES_0}\n\n"
             f"## Slide 2: Hearth\n\n{NOTES_1}\n\n"
             f"## Slide 3: Colors that match your mood\n\n{NOTES_2}\n\n"
             f"## Slide 4: Turning problems into solutions\n\n{NOTES_3}\n\n"
             f"## Slide 5: Meet the crew\n\n{NOTES_4}\n\n"
             f"## Slide 6: Building & Making\n\n{NOTES_5}\n\n"
             f"## Slide 7: Encanto\n\n{NOTES_6}\n")
print("saved", OUT)
