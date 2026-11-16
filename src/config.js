// Everything you are likely to want to tweak lives in this file.

// --- Player feel -------------------------------------------------------------
export const TUNING = {
  speed: 110,        // walking speed, pixels per second
  gravity: 700,      // downward pull, pixels per second squared
  jump: 230,         // upward speed at take-off, pixels per second (height ≈ jump² / 2·gravity)
  interactRange: 56, // how close (in pixels) you must be to a building for "Press E"
};

// --- Screen and world --------------------------------------------------------
export const VIEW = {
  height: 270,   // logical screen height: the background art is drawn on a 480x270 grid
  maxWidth: 480, // widest the logical screen gets
  minWidth: 270, // narrowest it gets before the pixels scale down a step instead
};

export const WORLD = {
  width: 1440,  // three 480-pixel screens
  groundY: 238, // y of the surface the player walks on
  startX: 80,   // where a first-time visitor appears
};

// How fast each background layer moves relative to the camera (0 = fixed, 1 = with the ground).
export const PARALLAX = { hills: 0.2, city: 0.5 };

// Props standing on the street between the buildings. Frame names come from PROP_FRAMES.
export const DECOR = [
  { x: 210, prop: "hydrogen" },
  { x: 655, prop: "solar" },
  { x: 700, prop: "turbine" },
  { x: 1180, prop: "wrench" },
  { x: 1330, prop: "hydrogen" },
];

// Order of the items in public/assets/props.png (see assets.md).
export const PROP_FRAMES = {
  hydrogen: 0,
  battery: 1,
  thermometer: 2,
  turbine: 3,
  solar: 4,
  wrench: 5,
};

// --- Assets ------------------------------------------------------------------
// One entry per line of public/assets/assets.md. The background is shipped as
// three layers cut from the one picture so they can scroll at different speeds.
export const ASSETS = {
  images: {
    bg_sky: "bg_sky.png",
    bg_hills: "bg_hills.png",
    bg_city: "bg_city.png",
    building: "building.png",
  },
  sheets: {
    character: { file: "character.png", frameWidth: 32, frameHeight: 32 },
    props: { file: "props.png", frameWidth: 32, frameHeight: 32 },
  },
};

export const STORAGE = {
  position: "portfolio.playerX",
  visited: "portfolio.visited",
};
