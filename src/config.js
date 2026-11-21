// Everything you are likely to want to tweak lives in this file.

// --- Player feel -------------------------------------------------------------
// Speeds are pixels per second, accelerations pixels per second squared.
export const TUNING = {
  speed: 140,          // top walking speed
  acceleration: 1050,  // how quickly the player gets up to speed (higher = snappier)
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

  interactRange: 70,   // how close (in pixels) to a building's middle you must be for "Press E"
};

// --- Screen and world --------------------------------------------------------
export const VIEW = {
  height: 270,   // logical screen height: the background art is drawn on a 480x270 grid
  maxWidth: 480, // widest the logical screen gets
  minWidth: 270, // narrowest it gets before the pixels scale down a step instead
};

export const WORLD = {
  width: 3240,  // nine buildings 320 pixels apart, about seven screens
  groundY: 238, // y of the surface the player walks on
  startX: 240,  // where a first-time visitor appears (outside the welcome hall)
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

// --- Ambient life ------------------------------------------------------------
// Share of city windows lit at each hour of the night (0-1), blended between
// entries. Windows switch on and off one at a time, so the skyline is never still.
export const WINDOW_LIGHTS = [
  [0, 0.45], [3, 0.25], [6, 0.45], [8, 0.6], [17, 0.75], [20, 0.9], [23, 0.7], [24, 0.45],
];

export const AMBIENT = {
  clouds: 5,              // clouds in the sky at once
  wind: 4,                // cloud and smoke drift, pixels per second
  windowFlickerMs: 350,   // how often one window changes
  beaconPeriodMs: 2000,   // turbine aviation lights: one blink per period
  birdsEverySec: [18, 40],         // a flock crosses the daytime sky this often (random in range)
  shootingStarEverySec: [7, 20],   // at night
  planeEverySec: [35, 70],         // a blinking plane light at night
  lampFlickerEverySec: [6, 15],    // one street lamp stutters now and then
  rotorFps: { large: 7, medium: 9, small: 11 }, // rotor frames per second: big rotors turn slower
  flameFps: 18,           // how often the gas flame's fire moves on
};

// Where each building's door is, in building pixels from its centre (before
// BUILDING_SCALE). The project marker floats over it and "Press E" is measured from it.
export const DOORS = {
  battery_lab: 9,
  wind_solar_hub: -26,
  pcm_lab: 18,
  cold_station: -31,
  hydrogen_plant: 16,
  control_room: 14,
  sim_centre: 8,
  workshop: 2,
  library: 0,
  home_base: 1,
};

// Lights drawn into the building art that glow at night, in building pixels
// from the bottom centre of the sprite (before BUILDING_SCALE).
// `flare` is where a burning gas flame sits (the middle of its base) and gives off smoke.
export const FIXTURES = {
  battery_lab: { lights: [[10, -32]] },
  hydrogen_plant: { flare: [23, -90] },
  workshop: { lights: [[3, -52], [19, -8]] },
  control_room: { lights: [[-33, -48], [0, -48]] },
  home_base: { lights: [[-14, -23], [19, -23]] },
};

// --- Scenery -----------------------------------------------------------------
// One scale for the whole street, set by the people: the character is 38 pixels
// tall (about 1.75 m, so roughly 22 pixels to the metre).
//
// The character sheet is drawn with art pixels twice the size of the building
// and prop sheets. Buildings are therefore drawn at twice their size: their
// doors then come out a little taller than a person, and their pixels match the
// characters'. Props are drawn at 1x or 2x, whichever is closer to real life.
// Only whole-number scales are used, so every art pixel stays square and sharp.
export const BUILDING_SCALE = 2;
export const GROUND_SCALE = 2; // the paving, drawn at the same pixel size as the buildings

// Things standing on the street. `sprite` is a name from the props atlas
// (public/assets/props.json) or, with atlas: "buildings", from the buildings atlas.
//   scale: 2       drawn at twice its size (whole numbers only)
//   back: true     drawn behind the buildings
//   platform: true the player can jump up and stand on it (but walks past it freely);
//                  or a list of [left, top, width] surfaces in sprite pixels, for shapes like a stack
//   turbine: size  a wind turbine from turbines.png ("small", "medium", "large") with a turning rotor
//   glow: true     lights up at night
// Buildings stand every 320 pixels from x = 480; each gap holds a small scene.
export const SCENERY = [
  // the welcome hall where you start
  { x: 110, sprite: "home_base", atlas: "buildings", scale: 2 },
  { x: 205, sprite: "lamp", scale: 2, glow: true },
  { x: 285, sprite: "bush" },
  { x: 345, sprite: "pine", scale: 2, back: true },
  // PackTherm (480) to Agile Flex (800): crates waiting outside the lab
  { x: 610, sprite: "crates", platform: [[0, 28, 43], [10, 0, 23]] }, // two crates, one on top
  { x: 695, sprite: "lamp", scale: 2, glow: true },
  // Agile Flex to 1120: a van on charge
  { x: 906, sprite: "charger", platform: true }, // a step up onto the van
  { x: 980, sprite: "van", scale: 2, platform: true },
  // 1120 to 1440: a small turbine on the lawn
  { x: 1240, turbine: "small", scale: 2, back: true },
  { x: 1290, sprite: "lamp", scale: 2, glow: true },
  { x: 1325, sprite: "bush" },
  // 1440 to 1760: substation by the hydrogen plant
  { x: 1630, sprite: "transformer", scale: 2 },
  // 1760 to 2080: hydrogen storage and a forklift
  { x: 1870, sprite: "h2_cylinder", scale: 2 },
  { x: 1915, sprite: "lamp", scale: 2, glow: true },
  { x: 1955, sprite: "forklift", scale: 2 },
  // 2080 to 2400: a quiet corner
  { x: 2215, sprite: "pine", scale: 2, back: true },
  { x: 2285, sprite: "fence" },
  // 2400 to 2720: solar array outside the simulation centre
  { x: 2540, sprite: "solar_panel", scale: 2 },
  { x: 2605, sprite: "lamp", scale: 2, glow: true },
  // 2720 to 3040: parked outside the workshop
  { x: 2850, sprite: "cart", platform: true },
  { x: 2920, sprite: "bicycle" },
  // the end of the street
  { x: 3150, sprite: "lamp", scale: 2, glow: true },
  { x: 3200, turbine: "small", scale: 2, back: true },
];

// People standing around. `frame` is a name from CHARACTER_FRAMES.
export const NPCS = [
  { x: 655, frame: "npc_scientist", faceLeft: true },
  { x: 1560, frame: "npc_delivery" },
  { x: 2250, frame: "npc_technician", faceLeft: true },
];

// Order of the 48x48 frames in public/assets/character.png (written by tools/process_assets.py).
export const CHARACTER_FRAMES = {
  idle0: 0, idle1: 1,
  walk0: 2, walk1: 3, walk2: 4, walk3: 5,
  jump_up: 6, jump_down: 7,
  vest: 8, hoodie: 9, // the same engineer in other outfits (standing pose only)
  npc_scientist: 10, npc_technician: 11, npc_delivery: 12,
  // each NPC's breathing frame
  npc_scientist_b: 13, npc_technician_b: 14, npc_delivery_b: 15,
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
    bg_city_lights: "bg_city_lights.png",
    bg_hills_lights: "bg_hills_lights.png",
    bg_beacons: "bg_beacons.png",
  },
  json: {
    turbine_rig: "turbine_rig.json", // rotor and light positions, written by tools/process_assets.py
  },
  sheets: {
    character: { file: "character.png", frameWidth: 48, frameHeight: 48 },
  },
  atlases: {
    buildings: { image: "buildings.png", data: "buildings.json" },
    props: { image: "props.png", data: "props.json" },
    turbines: { image: "turbines.png", data: "turbines.json" },
  },
};

export const STORAGE = {
  position: "portfolio.playerX",
  visited: "portfolio.visited",
};
