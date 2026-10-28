#!/usr/bin/env python3
"""Regenerate every app icon from design/logo-source.png (the iConnecto logo).

The source logo is a glyph on a white rounded tile with a soft shadow. To avoid
leaking the tile's own corners/shadow into other shapes (maskable, iOS, favicons),
we cut out a square region around the glyph and extend its background colour
(sampled from the logo's own vertical gradient) to fill any canvas.

Requires Pillow + numpy:  python3 scripts/generate_icons.py
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "design" / "logo-source.png"
OUT = ROOT / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

im = Image.open(SRC).convert("RGB")
G = (261, 246, 1035, 1020)  # square around the glyph, fully inside the tile
glyph = im.crop(G)
GS = glyph.width  # 774
arr = np.asarray(glyph).astype(float)
left_col = np.median(arr[:, 2:8, :], axis=1)  # (774, 3): background colour per row


def canvas(n: int, fraction: float) -> Image.Image:
    """n x n image: vertical-gradient background with the glyph crop centred,
    occupying `fraction` of the canvas width, edges feathered into the background."""
    scale = n * fraction / GS
    ys = (np.arange(n) - n / 2) / scale + GS / 2
    idx = np.clip(ys, 0, GS - 1)
    rows = np.stack([np.interp(idx, np.arange(GS), left_col[:, c]) for c in range(3)], axis=1)
    bg = np.repeat(rows[:, None, :], n, axis=1).astype(np.uint8)
    out = Image.fromarray(bg, "RGB")
    size = max(1, round(GS * scale))
    g = glyph.resize((size, size), Image.LANCZOS)
    feather = max(2, round(size * 0.03))
    ramp = np.minimum(np.arange(size), np.arange(size)[::-1]).astype(float)
    ramp = np.clip(ramp / feather, 0, 1)
    mask = Image.fromarray((np.minimum.outer(ramp, ramp) * 255).astype(np.uint8), "L")
    off = (n - size) // 2
    out.paste(g, (off, off), mask)
    return out


def rounded(img: Image.Image, radius_ratio: float) -> Image.Image:
    w, h = img.size
    s = 4
    mask = Image.new("L", (w * s, h * s), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w * s - 1, h * s - 1), radius=int(min(w, h) * s * radius_ratio), fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask.resize((w, h), Image.LANCZOS))
    return out


# "any" icons (rounded, transparent corners) - same glyph proportion as the source logo
for size in (512, 192, 128, 96):
    rounded(canvas(size, 0.81), 0.225).save(OUT / f"icon-{size}.png", optimize=True)

# maskable: full bleed, glyph kept inside Android's 80% safe zone
canvas(512, 0.66).save(OUT / "maskable-512.png", optimize=True)

# iOS home-screen icon: opaque, full bleed (iOS applies its own mask)
canvas(180, 0.74).save(OUT / "apple-touch-icon.png", optimize=True)

# favicons: glyph fills more of the frame so it stays legible at 16-48px
rounded(canvas(32, 0.95), 0.22).save(ROOT / "public" / "favicon-32.png", optimize=True)
rounded(canvas(48, 0.95), 0.22).save(ROOT / "public" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

for p in sorted(OUT.glob("*.png")):
    print(p.relative_to(ROOT), Image.open(p).size)
