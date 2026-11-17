// Everything you are likely to want to tweak lives in this file.

// --- Player feel -------------------------------------------------------------
// Speeds are pixels per second, accelerations pixels per second squared.
export const TUNING = {
  speed: 120,          // top walking speed
  acceleration: 900,   // how quickly the player gets up to speed (higher = snappier)
  friction: 1100,      // how quickly the player stops after letting go (lower = more slide)
  turnBoost: 1.8,      // extra push when reversing direction, so turning does not feel sluggish
  airControl: 0.55,    // share of acceleration and friction available in mid-air (0 = none, 1 = same as ground)

  gravity: 900,        // downward pull while rising
  fallGravity: 1.35,   // gravity multiplier while falling: above 1 makes the jump arc less floaty
  maxFall: 420,        // fastest falling speed
  jump: 320,           // take-off speed. Full jump height ≈ jump² / (2 × gravity) = 57 pixels
  jumpCut: 0.45,       // share of upward speed kept when the jump key is released early (tap = short hop)
  coyoteMs: 90,        // you can still jump this long after walking off an edge
  jumpBufferMs: 110,   // a jump pressed this long before landing still counts

  interactRange: 56,   // how close (in pixels) you must be to a building for "Press E"
};

// --- Screen and world --------------------------------------------------------
export const VIEW = {
  height: 270,   // logical screen height: the background art is drawn on a 480x270 grid
  maxWidth: 480, // widest the logical screen gets
  minWidth: 270, // narrowest it gets before the pixels scale down a step instead
};

export const WORLD = {
  width: 2400,  // five 480-pixel screens
  groundY: 238, // y of the surface the player walks on
  startX: 150,  // where a first-time visitor appears (outside the welcome hall)
  skyRows: 66,  // height of the sky above the horizon line in the background art
};

// How fast each background layer moves relative to the camera (0 = fixed, 1 = with the ground).
export const PARALLAX = { hills: 0.2, city: 0.5 };

// --- Day and night -----------------------------------------------------------
// The scene follows the visitor's own clock. Each entry is a time of day (0-24);
// the game blends smoothly between neighbouring entries.
//   sky    colour at the top of the sky
//   light  tint multiplied over buildings, props and the player (white = full daylight)
//   night  how much of the night-time background shows (0 = day art, 1 = night art)
//   stars  star brightness, glow = lamp-post glow
// To preview a time, add ?time=21.5 (or dawn, day, dusk, night, cycle) to the address.
export const DAY = [
  { hour: 0,    sky: 0x16223f, light: 0x6f82b8, night: 1,   stars: 1,   glow: 1 },
  { hour: 5,    sky: 0x16223f, light: 0x6f82b8, night: 1,   stars: 1,   glow: 1 },
  { hour: 6.5,  sky: 0x6f7fb8, light: 0xffd9c4, night: 0.3, stars: 0.1, glow: 0.4 },
  { hour: 8,    sky: 0x4f93d6, light: 0xffffff, night: 0,   stars: 0,   glow: 0 },
  { hour: 16.5, sky: 0x4f93d6, light: 0xffffff, night: 0,   stars: 0,   glow: 0 },
  { hour: 18.5, sky: 0x5a5a9c, light: 0xffc9a4, night: 0.3, stars: 0.1, glow: 0.6 },
  { hour: 20,   sky: 0x16223f, light: 0x6f82b8, night: 1,   stars: 1,   glow: 1 },
  { hour: 24,   sky: 0x16223f, light: 0x6f82b8, night: 1,   stars: 1,   glow: 1 },
];
export const SUN = { rise: 6, set: 19 }; // the moon is up for the rest of the day
// Colour of the horizon band at the top of the hills layer, by night and by day
// (printed by tools/process_assets.py). The sky fades down to meet it.
export const HORIZON = { night: 0x2a4e61, day: 0x7bacd3 };
export const CYCLE_SECONDS = 60; // length of a whole day with ?time=cycle

// --- Scenery -----------------------------------------------------------------
// Things standing on the street. `sprite` is a name from the props atlas
// (public/assets/props.json) or, with atlas: "buildings", from the buildings atlas.
//   back: true     drawn behind the buildings
//   platform: true the player can jump up and stand on it (but walks past it freely)
//   glow: true     lights up at night
export const SCENERY = [
  // the welcome hall where you start
  { x: 60, sprite: "home_base", atlas: "buildings" },
  { x: 14, sprite: "pine", back: true },
  { x: 200, sprite: "lamp", glow: true },
  { x: 245, sprite: "bush" },
  // between PackTherm (330) and Agile Flex (560)
  { x: 435, sprite: "bench", platform: true },
  { x: 488, sprite: "crates", platform: true },
  // between Agile Flex (560) and 790
  { x: 625, sprite: "charger" },
  { x: 690, sprite: "van", platform: true },
  { x: 742, sprite: "lamp", glow: true },
  // 790 to 1030
  { x: 880, sprite: "turbine_large", back: true },
  { x: 915, sprite: "barrel" },
  { x: 950, sprite: "h2_cylinder" },
  { x: 980, sprite: "pine", back: true },
  // 1030 to 1270
  { x: 1128, sprite: "lamp", glow: true },
  { x: 1150, sprite: "pylon", back: true },
  { x: 1195, sprite: "transformer" },
  // 1270 to 1510
  { x: 1345, sprite: "solar_panel" },
  { x: 1395, sprite: "forklift", platform: true },
  { x: 1455, sprite: "lamp", glow: true },
  // 1510 to 1750
  { x: 1590, sprite: "pine", back: true },
  { x: 1630, sprite: "flowers" },
  { x: 1680, sprite: "bench", platform: true },
  // 1750 to 1990
  { x: 1820, sprite: "lamp", glow: true },
  { x: 1870, sprite: "toolbox" },
  { x: 1925, sprite: "cart", platform: true },
  // 1990 to 2230
  { x: 2075, sprite: "bicycle" },
  { x: 2125, sprite: "lamp", glow: true },
  { x: 2165, sprite: "rock" },
  // the end of the street
  { x: 2310, sprite: "fence" },
  { x: 2350, sprite: "turbine_large", back: true },
  { x: 2385, sprite: "pine", back: true },
];

// People standing around. `frame` is a name from CHARACTER_FRAMES.
export const NPCS = [
  { x: 395, frame: "npc_scientist", faceLeft: true },
  { x: 1095, frame: "npc_delivery" },
  { x: 1605, frame: "npc_technician", faceLeft: true },
];

// Order of the 48x48 frames in public/assets/character.png (written by tools/process_assets.py).
export const CHARACTER_FRAMES = {
  idle0: 0, idle1: 1,
  walk0: 2, walk1: 3, walk2: 4, walk3: 5,
  jump_up: 6, jump_down: 7,
  vest: 8, hoodie: 9, // the same engineer in other outfits (standing pose only)
  npc_scientist: 10, npc_technician: 11, npc_delivery: 12,
};

// --- Assets ------------------------------------------------------------------
// See public/assets/assets.md for the art briefs.
export const ASSETS = {
  images: {
    bg_hills: "bg_hills.png",
    bg_city: "bg_city.png",
    bg_hills_day: "bg_hills_day.png",
    bg_city_day: "bg_city_day.png",
    moon: "moon.png",
  },
  sheets: {
    character: { file: "character.png", frameWidth: 48, frameHeight: 48 },
  },
  atlases: {
    buildings: { image: "buildings.png", data: "buildings.json" },
    props: { image: "props.png", data: "props.json" },
  },
};

export const STORAGE = {
  position: "portfolio.playerX",
  visited: "portfolio.visited",
};
