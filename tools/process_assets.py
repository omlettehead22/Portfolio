"""Turn the source art in art-src/ into game-ready pixel sprites in public/assets/.

Run from the repo root:  python3 tools/process_assets.py

The source images are pixel art rendered large on a magenta background, each on
a regular grid: buildings, props and the background use 480 art pixels across
the 2576-pixel picture (the game's own grid), the characters 240. This script
finds where that grid falls, reads one colour from the middle of every art
pixel, and so gets each sprite back pixel for pixel, with no resizing. It then
merges the near-identical shades left by JPEG compression into one palette per
sheet and cleans up single stray pixels.

Outputs:
  bg_hills.png, bg_city.png               night parallax layers cut from the background
  bg_hills_day.png, bg_city_day.png       the same layers recoloured for daylight
  moon.png                                the crescent moon lifted out of the sky
  buildings.png + buildings.json          atlas of the ten themed buildings
  props.png + props.json                  atlas of every prop, tile, collectible and vehicle
  character.png                           48x48 frames, see CHARACTER_FRAMES
  ../favicon.png                          the battery prop, doubled

The atlases are in Phaser's JSON format: each sprite is looked up by name.
art-src/building.jpg (the first concept building) is no longer used.
"""
import json
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src"
OUT = ROOT / "public" / "assets"

OUTLINE = (11, 22, 51)  # the dark navy used for outlines throughout the art

# Art pixels across each source picture, and how many colours to keep for it.
GRIDS = {
    "buildings.jpg": (480, 64),
    "props.jpg": (480, 64),
    "background.jpg": (480, 40),
    "characters.jpg": (240, 40),
}


def magenta_mask(rgb):
    """True where a pixel is background magenta (either of the two shades used)."""
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    return (r > 150) & (b > 150) & (g < 110) & (abs(r - b) < 90)


def load(name):
    return np.array(Image.open(SRC / name).convert("RGB"))


def save(arr, name):
    Image.fromarray(arr).save(OUT / name, optimize=True)
    print(f"{name:16s} {arr.shape[1]}x{arr.shape[0]}  {(OUT / name).stat().st_size} bytes")


def grid_phase(edges, pitch):
    """Offset of the grid lines: where the colour changes line up best."""
    best, phase = -1, 0.0
    for ph in np.arange(0, pitch, 0.05):
        idx = np.round(np.arange(ph, len(edges) - 1, pitch)).astype(int)
        score = edges[idx[idx < len(edges)]].mean()
        if score > best:
            best, phase = score, ph
    return phase


@lru_cache(maxsize=None)
def native(name):
    """The whole sheet at one pixel per art pixel, as RGBA (magenta made transparent).

    Also returns the grid (pitch, x offset, y offset) so source boxes can be mapped."""
    cells, colours = GRIDS[name]
    src = load(name)
    h, w = src.shape[:2]
    pitch = w / cells
    lum = src.astype(float).sum(axis=2)
    ox = grid_phase(np.abs(np.diff(lum, axis=1)).sum(axis=0), pitch) - pitch
    oy = grid_phase(np.abs(np.diff(lum, axis=0)).sum(axis=1), pitch) - pitch
    nx, ny = int((w - ox) // pitch), int((h - oy) // pitch)

    # sample a small square from the centre of each art pixel, away from the
    # blurred edges where neighbouring colours bleed into each other
    r = max(1, int(pitch * 0.3))
    cx = np.clip(np.round(ox + (np.arange(nx) + 0.5) * pitch).astype(int), r, w - r - 1)
    cy = np.clip(np.round(oy + (np.arange(ny) + 0.5) * pitch).astype(int), r, h - r - 1)
    offs = np.arange(-r, r + 1)
    ys = (cy[:, None] + offs[None, :])[:, None, :, None]
    xs = (cx[:, None] + offs[None, :])[None, :, None, :]
    patch = src[ys, xs]  # ny, nx, k, k, 3
    rgb = np.median(patch.reshape(ny, nx, -1, 3), axis=2).astype(np.uint8)
    keyed = magenta_mask(patch.reshape(ny, nx, -1, 3)).mean(axis=2) > 0.5

    rgb = reduce_palette(rgb, ~keyed, colours)
    out = np.dstack([rgb, np.where(keyed, 0, 255).astype(np.uint8)])
    out[keyed, :3] = 0
    clean(out)
    return out, (pitch, ox, oy)


def reduce_palette(rgb, solid, colours):
    """Merge the slightly different shades JPEG leaves behind into one palette."""
    pixels = rgb[solid].reshape(1, -1, 3)
    q = Image.fromarray(pixels).quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(q.getpalette()[: colours * 3], dtype=np.uint8).reshape(-1, 3)
    out = rgb.copy()
    out[solid] = pal[np.array(q)[0]]
    return out


def clean(img):
    """Tidy edges and specks, in place."""
    alpha = img[..., 3] > 0
    # Edge pixels can come out as a purple blend of outline and magenta; nothing
    # in the art is purple, so repaint those as outline.
    r, g, b = (img[..., i].astype(int) for i in range(3))
    img[alpha & (r > g + 25) & (b > g + 25), :3] = OUTLINE

    # Lone opaque pixels with no opaque neighbour on any side are noise.
    n4 = ndimage.convolve(alpha.astype(int), np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]]), mode="constant")
    img[alpha & (n4 == 0)] = 0

    # A pixel that matches none of its eight neighbours but is very close to one
    # of them is a compression speck: give it that neighbour's colour.
    h, w = alpha.shape
    rgb = img[..., :3].astype(int)
    alpha = img[..., 3] > 0
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if not alpha[y, x]:
                continue
            c = rgb[y, x]
            nb = [rgb[y + dy, x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                  if (dy or dx) and alpha[y + dy, x + dx]]
            if not nb or any((n == c).all() for n in nb):
                continue
            d = [np.abs(n - c).sum() for n in nb]
            if min(d) < 40:
                img[y, x, :3] = nb[int(np.argmin(d))]


def sprite(name, box):
    """Cut a sprite from a sheet by its box in source-picture pixels, trimmed to its content."""
    img, (pitch, ox, oy) = native(name)
    x0, y0, x1, y1 = box
    i0, i1 = int(np.floor((x0 - ox) / pitch)), int(np.ceil((x1 - ox) / pitch))
    j0, j1 = int(np.floor((y0 - oy) / pitch)), int(np.ceil((y1 - oy) / pitch))
    part = img[max(j0, 0) : j1, max(i0, 0) : i1]
    ys, xs = np.where(part[..., 3] > 0)
    return part[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1].copy()


def place(spr, frame_w, frame_h):
    """Centre horizontally, sit on the bottom edge of a frame."""
    frame = np.zeros((frame_h, frame_w, 4), dtype=np.uint8)
    h, w = spr.shape[:2]
    x = (frame_w - w) // 2
    frame[frame_h - h :, x : x + w] = spr
    return frame


def pack_atlas(sprites, name, width=512):
    """Lay named RGBA sprites out in rows and save name.png + name.json."""
    x = y = row_h = 0
    pos = {}
    for key, spr in sprites.items():
        h, w = spr.shape[:2]
        if x + w > width:
            x, y, row_h = 0, y + row_h + 1, 0
        pos[key] = (x, y)
        x += w + 1
        row_h = max(row_h, h)
    sheet = np.zeros((y + row_h, width, 4), dtype=np.uint8)
    frames = {}
    for key, spr in sprites.items():
        h, w = spr.shape[:2]
        px, py = pos[key]
        sheet[py : py + h, px : px + w] = spr
        frames[key] = {"frame": {"x": px, "y": py, "w": w, "h": h}}
    save(sheet, f"{name}.png")
    (OUT / f"{name}.json").write_text(json.dumps({"frames": frames}, separators=(",", ":")))


# --- the ten themed buildings -------------------------------------------------
# name: (x0, y0, x1, y1) in the source picture.
BUILDINGS = {
    "battery_lab": (40, 30, 555, 625),
    "pcm_lab": (582, 30, 1049, 625),
    "hydrogen_plant": (1082, 30, 1538, 625),
    "cold_station": (1569, 30, 2044, 625),
    "sim_centre": (2068, 30, 2536, 625),
    "control_room": (40, 825, 551, 1398),
    "wind_solar_hub": (582, 825, 1054, 1398),
    "workshop": (1065, 825, 1543, 1398),
    "library": (1580, 825, 2037, 1398),
    "home_base": (2068, 825, 2537, 1398),
}


def buildings():
    pack_atlas({name: sprite("buildings.jpg", box) for name, box in BUILDINGS.items()}, "buildings")


# --- props --------------------------------------------------------------------
# Rows of the source picture: (top, bottom, [(name, x0, x1)]).
PROP_ROWS = [
    (0, 258, [("turbine_small", 78, 241), ("turbine_large", 340, 545), ("solar_panel", 641, 886),
              ("solar_stand", 948, 1097), ("battery", 1167, 1382), ("pylon", 1479, 1635),
              ("charger", 1736, 1935), ("transformer", 2009, 2219)]),
    (261, 462, [("h2_cylinder", 100, 212), ("gauge", 370, 530), ("pipe_straight", 636, 910),
                ("pipe_corner", 1034, 1221), ("valve", 1334, 1570), ("fan", 1678, 1887),
                ("coil", 1988, 2242), ("barrel", 2330, 2480)]),
    (470, 656, [("thermometer", 110, 215), ("beaker", 375, 522), ("test_tubes", 647, 899),
                ("oscilloscope", 1012, 1232), ("laptop", 1344, 1564), ("whiteboard", 1677, 1890),
                ("microscope", 2026, 2166), ("toolbox", 2311, 2498)]),
    (657, 903, [("pine", 50, 260), ("bush", 319, 572), ("flowers", 605, 866), ("rock", 909, 1131),
                ("grass", 1188, 1424), ("fence", 1468, 1742), ("lamp", 1816, 1951),
                ("bench", 2020, 2283)]),
    (670, 897, [("signpost", 2325, 2519)]),
    (905, 1184, [("catwalk", 1140, 1436), ("platform_wood", 1516, 1800), ("ladder", 1924, 2087)]),
    (898, 1184, [("crates", 2230, 2508)]),
    (1210, 1420, [("bulb", 56, 204), ("orb", 250, 399), ("star", 457, 599), ("scroll", 662, 813),
                  ("key", 883, 1022), ("flag", 1097, 1264), ("van", 1361, 1666),
                  ("bicycle", 1677, 1939), ("forklift", 1949, 2230), ("cart", 2235, 2549)]),
]
# Ground tiles: (name, box). The outline is trimmed off and each is mirrored
# so it repeats without a visible seam.
TILES = {
    "tile_grass": (58, 917, 328, 1176),
    "tile_dirt": (429, 928, 688, 1176),
    "tile_stone": (794, 928, 1052, 1176),
}


def props():
    sprites = {}
    for top, bottom, items in PROP_ROWS:
        for name, x0, x1 in items:
            sprites[name] = sprite("props.jpg", (x0, top, x1, bottom))
    # The lamp was drawn with a glow around it. The game adds its own glow at
    # night, so remove the drawn one: keep the post's own column, then eat away
    # any orange that is open to the outside (the lantern glass is enclosed).
    lamp = sprites["lamp"]
    mid = lamp.shape[1] // 2
    lamp = lamp[:, mid - 6 : mid + 6].copy()
    r, g, b = (lamp[..., i].astype(int) for i in range(3))
    orange = (r > 170) & (g < 150) & (b < 110)
    outside = np.pad(lamp[..., 3] == 0, 1, constant_values=True)
    reach = ndimage.binary_propagation(outside, mask=outside | np.pad(orange, 1))[1:-1, 1:-1]
    lamp[reach] = 0
    labels, n = ndimage.label(lamp[..., 3] > 0)
    post = 1 + np.argmax(ndimage.sum(lamp[..., 3] > 0, labels, range(1, n + 1)))
    lamp[labels != post] = 0
    ys, xs = np.where(lamp[..., 3] > 0)
    sprites["lamp"] = lamp[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]

    for name, box in TILES.items():
        t = sprite("props.jpg", box)[3:-3, 3:-3]  # trim the outline
        # mirror sideways only: the ground strip is shorter than one tile, so it never repeats downwards
        sprites[name] = np.concatenate([t, t[:, ::-1]], axis=1)
    pack_atlas(sprites, "props")
    bat = sprites["battery"]
    side = max(bat.shape[:2]) + 2
    icon = np.roll(place(bat, side, side), -((side - bat.shape[0]) // 2), axis=0)
    Image.fromarray(icon).resize((side * 2, side * 2), Image.NEAREST).save(ROOT / "public" / "favicon.png", optimize=True)


# --- characters ---------------------------------------------------------------
# Boxes in the source sheet, in the order the frames are written.
CHARACTER_BOXES = [
    ("coat", (129, 40, 354, 465)),
    ("walk0", (119, 490, 375, 926)),
    ("walk1", (548, 490, 772, 926)),
    ("walk2", (956, 490, 1212, 926)),
    ("walk3", (1364, 490, 1631, 926)),
    ("jump_up", (1771, 490, 2050, 926)),
    ("jump_down", (2179, 490, 2468, 926)),
    ("vest", (558, 40, 783, 465)),
    ("hoodie", (956, 40, 1180, 465)),
    ("npc_scientist", (130, 985, 386, 1388)),
    ("npc_technician", (516, 985, 815, 1388)),
    ("npc_delivery", (956, 985, 1234, 1388)),
]
# Frame numbers in character.png (mirrored in src/config.js).
CHARACTER_FRAMES = ["idle0", "idle1", "walk0", "walk1", "walk2", "walk3", "jump_up", "jump_down",
                    "vest", "hoodie", "npc_scientist", "npc_technician", "npc_delivery"]
FRAME = 48


def character():
    cells = {}
    for name, box in CHARACTER_BOXES:
        spr = sprite("characters.jpg", box)
        # line frames up on the head, not the outline, so coat tails and held
        # tools do not make the body wobble between frames
        head = spr[: spr.shape[0] // 3, :, 3] > 0
        cx = int(round(np.where(head.any(axis=0))[0].mean()))
        frame = np.zeros((FRAME, FRAME, 4), dtype=np.uint8)
        x = int(np.clip(FRAME // 2 - cx, 0, FRAME - spr.shape[1]))
        frame[FRAME - spr.shape[0] :, x : x + spr.shape[1]] = spr
        cells[name] = frame

    # a second idle frame: everything above the legs sinks one pixel (breathing)
    idle0 = cells["coat"]
    height = int((idle0[..., 3] > 0).any(axis=1).sum())
    legs = round(height * 0.28)
    idle1 = idle0.copy()
    idle1[1 : FRAME - legs] = idle0[: FRAME - legs - 1]
    idle1[0] = 0
    cells["idle0"], cells["idle1"] = idle0, idle1

    save(np.concatenate([cells[n] for n in CHARACTER_FRAMES], axis=1), "character.png")


# --- background ---------------------------------------------------------------
SKY_ROWS = 66  # the flat horizon line in the background picture

# Daylight colours for the night-time layers, picked by brightness: (position 0-1, colour).
# The hills use two ramps, hazy blue for the far ridges at the top of the picture
# and green for the near ones lower down, blended by row.
DAY_FAR = [(0.0, (56, 84, 116)), (0.35, (104, 156, 200)), (0.6, (152, 198, 228)),
           (0.85, (208, 232, 242)), (1.0, (246, 250, 250))]
DAY_HILLS = [(0.0, (38, 70, 66)), (0.3, (62, 122, 92)), (0.55, (104, 170, 112)),
             (0.75, (150, 205, 150)), (0.9, (196, 228, 214)), (1.0, (244, 248, 244))]
DAY_CITY = [(0.0, (44, 84, 70)), (0.5, (70, 110, 96)), (1.0, (214, 226, 220))]


def gradient_map(rgba, stops):
    """Recolour by brightness: darkest pixel takes the first stop, brightest the last."""
    lum = rgba[..., :3].astype(float) @ np.array([0.299, 0.587, 0.114])
    solid = rgba[..., 3] > 0
    lo, hi = lum[solid].min(), lum[solid].max()
    t = np.clip((lum - lo) / max(hi - lo, 1), 0, 1)
    pos = [s[0] for s in stops]
    out = rgba.copy()
    for c in range(3):
        out[..., c] = np.interp(t, pos, [s[1][c] for s in stops]).round().astype(np.uint8)
    out[~solid] = 0
    return out


def background():
    from scipy import ndimage

    full, _ = native("background.jpg")
    full = full.copy()
    if full.shape[0] < 270:  # the picture is 268 art pixels tall: repeat the bottom row
        full = np.concatenate([full, np.repeat(full[-1:], 270 - full.shape[0], axis=0)], axis=0)

    # Mirror-tile so the left and right edges always match when it repeats.
    # The turbines cut off by the picture's edges are trimmed away first, or
    # each would meet its own reflection and look like a two-masted turbine.
    def tile(a):
        a = a[:, 26:452]
        return np.concatenate([a, a[:, ::-1]], axis=1)

    sky = full[:SKY_ROWS].copy()
    hills = full[SKY_ROWS:].copy()

    # The moon: the bright shape in the upper-left of the sky.
    region = sky[10:50, 55:110]
    bright = region[..., :3].astype(int).sum(axis=2) > sky[2, 2, :3].astype(int).sum() + 90
    labels, n = ndimage.label(bright)
    biggest = 1 + np.argmax(ndimage.sum(bright, labels, range(1, n + 1)))
    ys, xs = np.where(labels == biggest)
    moon = region[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1].copy()
    moon[labels[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1] != biggest] = 0
    save(moon, "moon.png")
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

    save(tile(hills), "bg_hills.png")
    save(tile(city), "bg_city.png")
    far, near_ramp = gradient_map(hills, DAY_FAR).astype(float), gradient_map(hills, DAY_HILLS).astype(float)
    w = np.clip((np.arange(hills.shape[0]) - 20) / 90, 0, 1)[:, None, None]
    hills_day = (far * (1 - w) + near_ramp * w).round().astype(np.uint8)
    # keep the flat look: snap the blend to bands of eight rows
    for y0 in range(0, hills.shape[0], 8):
        wb = np.clip((y0 - 20) / 90, 0, 1)
        hills_day[y0 : y0 + 8] = (far[y0 : y0 + 8] * (1 - wb) + near_ramp[y0 : y0 + 8] * wb).round().astype(np.uint8)
    save(tile(hills_day), "bg_hills_day.png")
    print("horizon colours (for HORIZON in src/config.js): night #%02x%02x%02x  day #%02x%02x%02x"
          % (*hills[0, 0, :3], *hills_day[0, 0, :3]))
    save(tile(gradient_map(city, DAY_CITY)), "bg_city_day.png")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    buildings()
    props()
    character()
    background()
