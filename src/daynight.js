import { DAY, SUN, HORIZON, CYCLE_SECONDS } from "./config.js";

const NAMED = { dawn: 6.5, day: 12, dusk: 18.5, night: 23 };

// ?time=21.5, ?time=dusk or ?time=cycle in the address overrides the clock.
const param = new URLSearchParams(window.location.search).get("time");
const fixedHour = param in NAMED ? NAMED[param] : param !== null && param !== "cycle" && !Number.isNaN(Number(param)) ? Number(param) % 24 : null;
const cycling = param === "cycle";
const startedAt = performance.now();

// The hour of day as a decimal, e.g. 18.5 for half past six in the evening.
export function currentHour() {
  if (fixedHour !== null) return fixedHour;
  if (cycling) return (((performance.now() - startedAt) / 1000 / CYCLE_SECONDS) * 24 + 5) % 24;
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

export const isCycling = () => cycling;

const channels = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const pack = (r, g, b) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);

export function mix(a, b, t) {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return pack(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export function multiply(a, b) {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return pack((ar * br) / 255, (ag * bg) / 255, (ab * bb) / 255);
}

// Everything the scene needs to know about the light at a given hour.
export function lightAt(hour) {
  let i = DAY.findIndex((k) => k.hour > hour);
  if (i <= 0) i = DAY.length - 1;
  const a = DAY[i - 1];
  const b = DAY[i];
  const t = (hour - a.hour) / (b.hour - a.hour);
  const lerp = (key) => a[key] + (b[key] - a[key]) * t;

  const light = mix(a.light, b.light, t);
  const night = lerp("night");
  const dayLength = SUN.set - SUN.rise;
  return {
    sky: mix(a.sky, b.sky, t),
    // where the sky meets the hills: whatever colour the hills layer shows there
    horizon: mix(multiply(HORIZON.day, light), HORIZON.night, night),
    light,
    night,
    stars: lerp("stars"),
    glow: lerp("glow"),
    // 0 at rising, 1 at setting; outside 0-1 the body is below the horizon
    sun: (hour - SUN.rise) / dayLength,
    moon: ((hour - SUN.set + 24) % 24) / (24 - dayLength),
  };
}
