"""Turn the source art in art-src/ into game-ready pixel sprites in public/assets/.

Run from the repo root:  python3 tools/process_assets.py

The source images are large renders on a magenta background. For each one this
script removes the magenta, reduces the picture to a small palette, and shrinks
it to the pixel grid given in public/assets/assets.md by taking the most common
colour in each cell (which keeps edges crisp where averaging would blur them).

Outputs:
  bg_hills.png, bg_city.png               night parallax layers cut from the background
  bg_hills_day.png, bg_city_day.png       the same layers recoloured for daylight
  moon.png                                the crescent moon lifted out of the sky
  building.png                            the first lab building, 128x128
  buildings.png + buildings.json          atlas of the ten themed buildings
  props.png + props.json                  atlas of every prop, tile, collectible and vehicle
  character.png                           32x32 frames, see CHARACTER_FRAMES
  ../favicon.png                          the battery prop, doubled

The atlases are in Phaser's JSON format: each sprite is looked up by name.
"""
import json
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


def cut(src, box, out_h, colours=24, out_w=None):
    """Crop a box to its content and shrink it to out_h pixels tall."""
    item = crop_to_content(src, box)
    h, w = item.shape[:2]
    w_out = out_w or max(1, round(w * out_h / h))
    return mode_downscale(item, w_out, out_h, colours)


# --- the first lab building (kept as the sprite key "building") ---------------
def building():
    src = crop_to_content(load("building.jpg"))
    w, h = fit(src, 128, 128)
    save(place(mode_downscale(src, w, h, 24), 128, 128), "building.png")


# --- the ten themed buildings -------------------------------------------------
# name: (x0, y0, x1, y1) in the source sheet. One scale for all, so they keep
# their relative sizes; the tallest comes out 128 pixels high.
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
BUILDING_SCALE = 128 / 581


def buildings():
    src = load("buildings.jpg")
    sprites = {}
    for name, box in BUILDINGS.items():
        item = crop_to_content(src, box)
        h, w = item.shape[:2]
        sprites[name] = mode_downscale(item, round(w * BUILDING_SCALE), round(h * BUILDING_SCALE), 32)
    pack_atlas(sprites, "buildings")


# --- props --------------------------------------------------------------------
# Rows of the source sheet: (top, bottom, [(name, x0, x1, height in game pixels)]).
PROP_ROWS = [
    (0, 258, [("turbine_small", 78, 241, 44), ("turbine_large", 340, 545, 96), ("solar_panel", 641, 886, 28),
              ("solar_stand", 948, 1097, 28), ("battery", 1167, 1382, 20), ("pylon", 1479, 1635, 72),
              ("charger", 1736, 1935, 34), ("transformer", 2009, 2219, 30)]),
    (261, 462, [("h2_cylinder", 100, 212, 24), ("gauge", 370, 530, 20), ("pipe_straight", 636, 910, 14),
                ("pipe_corner", 1034, 1221, 20), ("valve", 1334, 1570, 18), ("fan", 1678, 1887, 24),
                ("coil", 1988, 2242, 22), ("barrel", 2330, 2480, 24)]),
    (470, 656, [("thermometer", 110, 215, 22), ("beaker", 375, 522, 18), ("test_tubes", 647, 899, 16),
                ("oscilloscope", 1012, 1232, 18), ("laptop", 1344, 1564, 16), ("whiteboard", 1677, 1890, 28),
                ("microscope", 2026, 2166, 22), ("toolbox", 2311, 2498, 14)]),
    (657, 903, [("pine", 50, 260, 64), ("bush", 319, 572, 20), ("flowers", 605, 866, 14), ("rock", 909, 1131, 16),
                ("grass", 1188, 1424, 12), ("fence", 1468, 1742, 16), ("lamp", 1816, 1951, 48),
                ("bench", 2020, 2283, 16)]),
    (670, 897, [("signpost", 2325, 2519, 24)]),
    (905, 1184, [("catwalk", 1140, 1436, 20), ("platform_wood", 1516, 1800, 20), ("ladder", 1924, 2087, 40)]),
    (898, 1184, [("crates", 2230, 2508, 30)]),
    (1210, 1420, [("bulb", 56, 204, 16), ("orb", 250, 399, 16), ("star", 457, 599, 16), ("scroll", 662, 813, 16),
                  ("key", 883, 1022, 16), ("flag", 1097, 1264, 16), ("van", 1361, 1666, 38),
                  ("bicycle", 1677, 1939, 24), ("forklift", 1949, 2230, 36), ("cart", 2235, 2549, 32)]),
]
# Ground tiles: (name, box). The outline is trimmed off and each is mirrored
# into a 64x64 block so it repeats without a visible seam.
TILES = {
    "tile_grass": (58, 917, 328, 1176),
    "tile_dirt": (429, 928, 688, 1176),
    "tile_stone": (794, 928, 1052, 1176),
}


def props():
    src = load("props.jpg")
    sprites = {}
    for top, bottom, items in PROP_ROWS:
        for name, x0, x1, height in items:
            sprites[name] = cut(src, (x0, top, x1, bottom), height)
    # The lamp was drawn with a glow around it. The game adds its own glow at
    # night, so remove the drawn one: keep the post's own column, then eat away
    # any orange that is open to the outside (the lantern glass is enclosed).
    from scipy import ndimage
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

    for name, (x0, y0, x1, y1) in TILES.items():
        inner = src[y0 + 14 : y1 - 14, x0 + 14 : x1 - 14]
        t = mode_downscale(inner, 32, 32, 16, keyed=False)
        top_row = np.concatenate([t, t[:, ::-1]], axis=1)
        # grass has a top and a bottom, so only mirror it sideways
        sprites[name] = top_row if name == "tile_grass" else np.concatenate([top_row, top_row[::-1]], axis=0)
    pack_atlas(sprites, "props")
    icon = place(sprites["battery"], 32, 32)
    icon = np.roll(icon, -6, axis=0)
    Image.fromarray(icon).resize((64, 64), Image.NEAREST).save(ROOT / "public" / "favicon.png", optimize=True)


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
CHARACTER_SCALE = 32 / 409  # the standing figure is 409 source pixels tall


def character():
    src = load("characters.jpg")
    cells = {}
    for name, box in CHARACTER_BOXES:
        item = crop_to_content(src, box)
        h, w = item.shape[:2]
        spr = mode_downscale(item, round(w * CHARACTER_SCALE), min(32, round(h * CHARACTER_SCALE)), 24)
        # line frames up on the head, not the outline, so coat tails and held
        # tools do not make the body wobble between frames
        head = spr[: spr.shape[0] // 3, :, 3] > 0
        cx = int(round(np.where(head.any(axis=0))[0].mean()))
        frame = np.zeros((32, 32, 4), dtype=np.uint8)
        x = int(np.clip(16 - cx, 0, 32 - spr.shape[1]))
        frame[32 - spr.shape[0] :, x : x + spr.shape[1]] = spr
        cells[name] = frame

    # a second idle frame: everything above the legs sinks one pixel (breathing)
    idle0 = cells["coat"]
    idle1 = idle0.copy()
    legs = 9
    idle1[1 : 32 - legs] = idle0[: 32 - legs - 1]
    idle1[0] = 0
    cells["idle0"], cells["idle1"] = idle0, idle1

    save(np.concatenate([cells[n] for n in CHARACTER_FRAMES], axis=1), "character.png")


# --- background ---------------------------------------------------------------
SKY_ROWS = 66  # the flat horizon line in the 270-row picture

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

    full = mode_downscale(load("background.jpg"), 480, 270, 40, keyed=False)

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
    building()
    buildings()
    props()
    character()
    background()
