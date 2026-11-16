"""Turn the source art in art-src/ into game-ready pixel sprites in public/assets/.

Run from the repo root:  python3 tools/process_assets.py

The source images are large renders on a magenta background. For each one this
script removes the magenta, reduces the picture to a small palette, and shrinks
it to the pixel grid given in public/assets/assets.md by taking the most common
colour in each cell (which keeps edges crisp where averaging would blur them).

Outputs:
  bg_sky.png, bg_hills.png, bg_city.png   parallax layers cut from the background
  building.png                            128x128
  character.png                           32x32 frames: 0-1 idle, 2-5 walk, 6 jump
  props.png                               6 frames of 32x32
  ../favicon.png                          the battery prop, doubled
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src"
OUT = ROOT / "public" / "assets"


OUTLINE = (11, 22, 51)  # the dark navy used for outlines throughout the art


def magenta_mask(rgb):
    """True where a pixel is background magenta (either of the two shades used)."""
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    return (r > 150) & (b > 150) & (g < 110) & (abs(r - b) < 90)


def quantize(rgb, colours):
    """Return (index array, palette) for an RGB array."""
    img = Image.fromarray(rgb).quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(img.getpalette()[: colours * 3], dtype=np.uint8).reshape(-1, 3)
    return np.array(img), pal


def mode_downscale(rgb, out_w, out_h, colours, keyed=True):
    """Shrink to out_w x out_h by majority colour per cell. Returns RGBA array."""
    h, w = rgb.shape[:2]
    idx, pal = quantize(rgb, colours)
    if keyed:
        idx = np.where(magenta_mask(rgb), colours, idx)  # extra index = transparent
    n = colours + 1
    out = np.zeros((out_h, out_w, 4), dtype=np.uint8)
    ys = np.linspace(0, h, out_h + 1).round().astype(int)
    xs = np.linspace(0, w, out_w + 1).round().astype(int)
    for j in range(out_h):
        for i in range(out_w):
            cell = idx[ys[j] : ys[j + 1], xs[i] : xs[i + 1]]
            counts = np.bincount(cell.ravel(), minlength=n)
            if keyed and counts[colours] * 2 >= cell.size:
                continue  # mostly background: leave transparent
            counts[colours] = 0
            out[j, i, :3] = pal[counts.argmax()]
            out[j, i, 3] = 255
    if keyed:
        # Edge cells can pick up a purple blend of outline and background;
        # nothing in the art is purple, so repaint those as outline.
        r, g, b = (out[..., i].astype(int) for i in range(3))
        fringe = (out[..., 3] > 0) & (r > g + 25) & (b > g + 25)
        out[fringe, :3] = OUTLINE
    return out


def crop_to_content(rgb, box=None):
    if box:
        x0, y0, x1, y1 = box
        rgb = rgb[y0:y1, x0:x1]
    ys, xs = np.where(~magenta_mask(rgb))
    return rgb[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


def fit(rgb, max_w, max_h):
    h, w = rgb.shape[:2]
    s = min(max_w / w, max_h / h)
    return max(1, round(w * s)), max(1, round(h * s))


def place(sprite, frame_w, frame_h):
    """Centre horizontally, sit on the bottom edge of a frame."""
    frame = np.zeros((frame_h, frame_w, 4), dtype=np.uint8)
    h, w = sprite.shape[:2]
    x = (frame_w - w) // 2
    frame[frame_h - h :, x : x + w] = sprite
    return frame


def load(name):
    return np.array(Image.open(SRC / name).convert("RGB"))


def save(arr, name):
    Image.fromarray(arr).save(OUT / name, optimize=True)
    print(f"{name:16s} {arr.shape[1]}x{arr.shape[0]}  {(OUT / name).stat().st_size} bytes")


# --- building -----------------------------------------------------------------
def building():
    src = crop_to_content(load("building.jpg"))
    w, h = fit(src, 128, 128)
    save(place(mode_downscale(src, w, h, 24), 128, 128), "building.png")


# --- props --------------------------------------------------------------------
def props():
    src = load("props.jpg")
    # column ranges of the six items, measured from the source sheet
    cols = [(224, 494), (621, 902), (1040, 1213), (1319, 1611), (1662, 2018), (2060, 2437)]
    sheet = np.zeros((32, 32 * 6, 4), dtype=np.uint8)
    for n, (x0, x1) in enumerate(cols):
        item = crop_to_content(src, (x0, 440, x1, 960))
        w, h = fit(item, 30, 30)
        sheet[:, n * 32 : (n + 1) * 32] = place(mode_downscale(item, w, h, 16), 32, 32)
    save(sheet, "props.png")
    Image.fromarray(sheet[:, 32:64]).resize((64, 64), Image.NEAREST).save(ROOT / "public" / "favicon.png", optimize=True)


# --- character ----------------------------------------------------------------
def character():
    src = crop_to_content(load("character.jpg"))
    w, h = fit(src, 32, 32)
    base = mode_downscale(src, w, h, 20)

    legs_h = 6  # rows at the bottom that are legs and boots
    mid = w // 2
    body, legs = base[: h - legs_h], base[h - legs_h :]
    blank = np.zeros_like(legs)

    def shift(a, dx=0, dy=0):
        out = np.zeros_like(a)
        hh, ww = a.shape[:2]
        sx0, sx1 = max(0, -dx), min(ww, ww - dx)
        sy0, sy1 = max(0, -dy), min(hh, hh - dy)
        out[sy0 + dy : sy1 + dy, sx0 + dx : sx1 + dx] = a[sy0:sy1, sx0:sx1]
        return out

    def half(side):
        out = blank.copy()
        if side == "L":
            out[:, :mid] = legs[:, :mid]
        else:
            out[:, mid:] = legs[:, mid:]
        return out

    def over(a, b):  # b drawn on top of a
        return np.where(b[..., 3:4] > 0, b, a)

    def build(body_dy, left, right):
        f = np.zeros_like(base)
        f[h - legs_h :] = over(left, right)
        f[: h - legs_h] = over(f[: h - legs_h], shift(body, dy=body_dy))
        if body_dy > 0:  # body dropped: let it overlap the top leg row
            f[h - legs_h : h - legs_h + body_dy] = over(
                f[h - legs_h : h - legs_h + body_dy], body[-body_dy:]
            )
        return f

    L, R = half("L"), half("R")
    frames = [
        build(0, L, R),                                   # idle A
        build(1, L, R),                                   # idle B (breathing)
        build(0, shift(L, dx=-1), shift(R, dx=1, dy=-1)),  # walk: stride, right foot up
        build(1, L, R),                                   # walk: passing
        build(0, shift(L, dx=1, dy=-1), shift(R, dx=-1)),  # walk: stride, left foot up
        build(1, L, R),                                   # walk: passing
        build(0, shift(L, dx=-1, dy=-1), shift(R, dx=1, dy=-1)),  # jump: legs tucked
    ]
    sheet = np.concatenate([place(f, 32, 32) for f in frames], axis=1)
    save(sheet, "character.png")


# --- background ---------------------------------------------------------------
SKY_ROWS = 66  # the flat horizon line in the 270-row picture


def background():
    from scipy import ndimage

    full = mode_downscale(load("background.jpg"), 480, 270, 40, keyed=False)

    # Mirror-tile so the left and right edges always match when it repeats.
    def tile(a):
        return np.concatenate([a, a[:, ::-1]], axis=1)

    sky = full[:SKY_ROWS].copy()
    hills = full[SKY_ROWS:].copy()

    # The near skyline is the solid dark mass that touches the bottom edge.
    rgb = hills[..., :3].astype(int)
    dark = np.abs(rgb - rgb[-1, 0]).sum(axis=2) < 40
    solid = ndimage.binary_opening(dark, np.ones((3, 3)))  # drop 1px outlines (turbine towers)
    labels, _ = ndimage.label(solid)
    ground = np.isin(labels, np.unique(labels[-1][labels[-1] > 0]))
    near = ndimage.binary_dilation(ground, iterations=2) & dark
    # close up the lit windows and gaps inside the buildings
    near = ndimage.binary_fill_holes(ndimage.binary_closing(near, np.ones((3, 3)), border_value=1))

    city = np.zeros_like(hills)
    city[near] = hills[near]

    # Paint over the gap the skyline leaves behind with whatever sits above it.
    # (also catches building tops the mask missed, but not 1px turbine outlines)
    gap = ndimage.binary_dilation(near, iterations=3)
    wide = ndimage.binary_opening(dark, np.ones((1, 2))) | gap
    labels, _ = ndimage.label(wide)
    gap = np.isin(labels, np.unique(labels[gap]))
    gap = ndimage.binary_dilation(gap, iterations=2)
    tops = {x: np.where(gap[:, x])[0].min() for x in range(480) if gap[:, x].any()}
    above = np.array([hills[max(t - 1, 0), x, :3] for x, t in tops.items()])
    colours, counts = np.unique(above, axis=0, return_counts=True)
    hill = colours[counts.argmax()]  # the usual hill colour behind the skyline
    for x, top in tops.items():
        px = hills[max(top - 1, 0), x, :3]
        # darker than the hill means a turbine tower: carry it down; otherwise flat hill
        hills[top:, x, :3] = px if int(px.sum()) < int(hill.sum()) - 10 else hill

    save(sky, "bg_sky.png")
    save(tile(hills), "bg_hills.png")
    save(tile(city), "bg_city.png")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    building()
    props()
    character()
    background()
