"""Build public/og.png, the picture shown when the site's link is shared.

Run from the repo root after taking a screenshot of the game canvas at 2x zoom
(960x540) into og-raw.png:  python3 tools/make_preview_image.py og-raw.png

The screenshot is kept at its exact size (pixel art must not be resized) and
framed on a 1200x630 card with the owner's name and tagline from projects.json.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
NAVY, PANEL, TEXT, MUTED, GLOW = (11, 22, 51), (18, 34, 74), (232, 240, 234), (169, 191, 198), (246, 169, 74)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def main(raw):
    site = json.loads((ROOT / "public/projects.json").read_text())["site"]
    shot = Image.open(raw).convert("RGB")
    assert shot.size == (960, 540), f"expected a 960x540 screenshot, got {shot.size}"

    card = Image.new("RGB", (1200, 630), NAVY)
    card.paste(shot, (120, 0))
    d = ImageDraw.Draw(card)
    d.rectangle((0, 540, 1200, 630), fill=PANEL)
    d.line((0, 540, 1200, 540), fill=GLOW, width=3)
    d.text((120, 556), site["owner"], font=ImageFont.truetype(FONT, 34), fill=TEXT)
    d.text((120, 598), site["tagline"] + "  Walk the street, or read the list.", font=ImageFont.truetype(FONT_REG, 18), fill=MUTED)
    out = ROOT / "public/og.png"
    card.save(out, optimize=True)
    print(out, out.stat().st_size, "bytes")


if __name__ == "__main__":
    main(sys.argv[1])
