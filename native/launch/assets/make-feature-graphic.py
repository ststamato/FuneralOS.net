#!/usr/bin/env python3
"""Play Store feature graphic (1024x500) for both FuneralOS editions.

Play shows this at the top of the listing, cropped in places and often
scaled down in carousels, so the safe design is: brand mark left, short
line of copy, everything inside a generous margin, no small text.
"""
import pathlib
from PIL import Image, ImageDraw, ImageFont

W, H = 1024, 500
INK = (15, 21, 35)          # #0f1523 brand ink
INK_2 = (32, 36, 51)        # #202433 icon card navy
GOLD = (200, 169, 110)      # #c8a96e brand gold
WHITE = (255, 255, 255)
MUTED = (154, 166, 189)     # #9aa6bd

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

REPO = pathlib.Path(__file__).resolve()
while REPO.name != "FuneralOS.net" and REPO.parent != REPO:
    REPO = REPO.parent
# script lives in the scratchpad, so locate the repo explicitly
REPO = pathlib.Path("/home/user/FuneralOS.net")

EDITIONS = {
    "gr": {
        "app": "gr-app",
        "tagline": "Διαχείριση γραφείου τελετών",
        "points": ["Τελετές & πελάτες", "Αποθήκη & κοστολόγηση", "Ομάδα & στατιστικά"],
    },
    "en": {
        "app": "en-app",
        "tagline": "Funeral home management",
        "points": ["Cases & families", "Inventory & pricing", "Staff & reporting"],
    },
}


def vertical_gradient(size, top, bottom):
    w, h = size
    base = Image.new("RGB", (1, h))
    px = base.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        px[0, y] = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return base.resize(size, Image.BICUBIC)


def build(edition, cfg):
    img = vertical_gradient((W, H), INK_2, INK)
    d = ImageDraw.Draw(img)

    # A soft gold arc bleeding off the right edge — carries the brand colour
    # without competing with the wordmark, and survives Play's cropping.
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(70):
        alpha = int(26 * (1 - i / 70))
        gd.ellipse([W - 300 - i * 5, -180 - i * 4, W + 240 + i * 5, H + 120 + i * 4],
                   outline=GOLD + (alpha,), width=3)
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    d = ImageDraw.Draw(img)

    # App icon, so the graphic reads as the same product as the listing tile.
    icon_path = REPO / f"native/{cfg['app']}/resources/icon.png"
    icon = Image.open(icon_path).convert("RGBA").resize((150, 150), Image.LANCZOS)
    mask = Image.new("L", (150, 150), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 149, 149], radius=34, fill=255)
    img.paste(icon, (74, 84), mask)

    # Wordmark: white "Funeral" + gold "OS", matching the in-app logo.
    f_mark = ImageFont.truetype(BOLD, 76)
    x, y = 74, 286
    d.text((x, y), "Funeral", font=f_mark, fill=WHITE)
    x += d.textlength("Funeral", font=f_mark)
    d.text((x, y), "OS", font=f_mark, fill=GOLD)

    # Tagline under the mark.
    f_tag = ImageFont.truetype(REG, 30)
    d.text((74, 382), cfg["tagline"], font=f_tag, fill=MUTED)

    # Three short proof points, right-hand column, gold bullets. Play crops
    # the edges in some placements, so shrink the type until the longest line
    # clears a 64px right margin rather than letting it run to the edge.
    bullet_x, text_x, margin = 560, 592, 64
    size = 29
    while size > 18:
        f_pt = ImageFont.truetype(BOLD, size)
        widest = max(d.textlength(p, font=f_pt) for p in cfg["points"])
        if text_x + widest <= W - margin:
            break
        size -= 1
    py = 150
    for pt in cfg["points"]:
        d.ellipse([bullet_x, py + 9, bullet_x + 12, py + 21], fill=GOLD)
        d.text((text_x, py), pt, font=f_pt, fill=WHITE)
        py += 68

    out = REPO / f"native/launch/assets/feature-graphic-{edition}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG", optimize=True)
    return out


for edition, cfg in EDITIONS.items():
    p = build(edition, cfg)
    im = Image.open(p)
    print(f"{p.relative_to(REPO)}  {im.size[0]}x{im.size[1]}  {p.stat().st_size // 1024} KB")
