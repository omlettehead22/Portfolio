import Phaser from "phaser";
import { VIEW, WORLD, PARALLAX, AMBIENT as A, WINDOW_LIGHTS, FIXTURES } from "../config.js";

const TILE = 852; // width of one repeat of the hill layers (bg_hills.png)
// The rotors in turbines.png have pale blades; the painted night towers are muted
// teal. This tint brings the night rotors to the towers' colour.
const NIGHT_ROTOR_TINT = 0x6ba1a8;
import { currentHour, mix } from "../daynight.js";

// Everything that moves on its own: clouds, birds, shooting stars, a plane,
// turning wind turbines, city windows switching on and off, blinking turbine
// lights, breathing street lamps, and the hydrogen flare with its smoke.
//
// None of it uses new art: the lights are lifted out of the background picture
// by tools/process_assets.py, and the clouds and birds are drawn in code.
// With "reduce motion" switched on in the system settings, the scene is lit
// the same way but holds still.

const DEPTH = { meteor: 1.2, clouds: 1.7, birds: 1.8, hillsLights: 2.2, rotors: 2.25, cityLights: 3.2, fixture: 8 };
const between = ([lo, hi]) => Phaser.Math.Between(lo * 1000, hi * 1000);

export default class Ambient {
  constructor(scene, { calm }) {
    this.scene = scene;
    this.calm = calm;
    this.frozen = false;
    this.clock = 0; // milliseconds of unpaused time, so a pause stops the clouds too
    this.light = null;
    this.lamps = []; // { glow, phase, dip }
    this.fixtures = []; // building lights: { glow }
    this.flares = []; // { glow, smoke }
    this.rotors = []; // { night, day, size, phase, lit }
    this.streetBeacons = [];
    this.rig = scene.cache.json.get("turbine_rig");
  }

  create() {
    this.addClouds();
    this.addLights();
    this.addHillRotors();
    this.meteor = this.scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.meteor);
    this.plane = this.scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.meteor);
    this.birds = [];
    this.flock = null;
    this.shooting = null;
    this.flight = null;

    if (this.calm) return;
    const t = this.scene.time;
    t.addEvent({ delay: A.windowFlickerMs, loop: true, callback: this.flickerWindow, callbackScope: this });
    this.schedule("launchFlock", A.birdsEverySec, 4000);
    this.schedule("launchMeteor", A.shootingStarEverySec, 3000);
    this.schedule("launchPlane", A.planeEverySec, 9000);
    this.schedule("lampFlicker", A.lampFlickerEverySec);
  }

  // Call `method` again and again at random intervals; the first one can come sooner.
  schedule(method, range, first) {
    const run = () => {
      if (!this.frozen) this[method]();
      this.scene.time.delayedCall(between(range), run);
    };
    this.scene.time.delayedCall(first ?? between(range), run);
  }

  setFrozen(frozen) {
    this.frozen = frozen;
    for (const f of this.flares) frozen ? f.smoke.pause() : f.smoke.resume();
  }

  // --- clouds ------------------------------------------------------------------

  addClouds() {
    const rnd = new Phaser.Math.RandomDataGenerator(["clouds"]);
    this.wrap = VIEW.maxWidth + 120;
    this.clouds = [];
    for (let i = 0; i < A.clouds; i++) {
      const sprite = this.scene.add
        .image(0, 0, `cloud${i % 3}`)
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setDepth(DEPTH.clouds);
      this.clouds.push({
        sprite,
        x: (i + rnd.frac() * 0.6) * (this.wrap / A.clouds),
        y: rnd.between(16, WORLD.skyRows + 4),
        speed: A.wind * rnd.realInRange(0.5, 1.3),
      });
    }
  }

  moveClouds(time) {
    const scroll = this.scene.cameras.main.scrollX * 0.06;
    for (const c of this.clouds) {
      const drift = this.calm ? 0 : (time / 1000) * c.speed;
      const x = Phaser.Math.Wrap(c.x + drift - scroll, 0, this.wrap) - 60;
      c.sprite.setPosition(Math.round(x), c.y);
    }
  }

  // --- lights in the background ------------------------------------------------

  addLights() {
    // Window layers become canvases, so single windows can be switched.
    this.windows = [];
    const rows = VIEW.height - WORLD.skyRows;
    const layer = (key, depth, factor) => {
      const sprite = this.scene.add
        .tileSprite(0, WORLD.skyRows, VIEW.maxWidth, rows, key)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(depth);
      sprite.parallax = factor;
      return sprite;
    };
    for (const [key, depth, factor] of [
      ["bg_hills_lights", DEPTH.hillsLights, PARALLAX.hills],
      ["bg_city_lights", DEPTH.cityLights, PARALLAX.city],
    ]) {
      const live = this.makeLiveWindows(key);
      this.windows.push({ ...live, sprite: layer(live.key, depth, factor) });
    }
    this.beacons = layer("bg_beacons", DEPTH.hillsLights, PARALLAX.hills).setTint(0xff6a55);
  }

  makeLiveWindows(key) {
    const src = this.scene.textures.get(key).getSourceImage();
    const tex = this.scene.textures.createCanvas(`${key}_live`, src.width, src.height);
    const ctx = tex.getContext();
    ctx.drawImage(src, 0, 0);
    const image = ctx.getImageData(0, 0, src.width, src.height);
    const { data, width, height } = image;

    // group touching lit pixels into windows
    const seen = new Uint8Array(width * height);
    const groups = [];
    for (let start = 0; start < width * height; start++) {
      if (seen[start] || data[start * 4 + 3] === 0) continue;
      const pixels = [];
      const stack = [start];
      seen[start] = 1;
      while (stack.length) {
        const p = stack.pop();
        pixels.push(p);
        const x = p % width;
        const y = (p - x) / width;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const q = ny * width + nx;
            if (!seen[q] && data[q * 4 + 3] > 0) {
              seen[q] = 1;
              stack.push(q);
            }
          }
        }
      }
      groups.push({ pixels, on: true });
    }

    const share = windowShare(currentHour());
    for (const g of groups) this.setWindow(data, g, Math.random() < share);
    ctx.putImageData(image, 0, 0);
    tex.refresh();
    return { key: `${key}_live`, tex, ctx, image, groups };
  }

  setWindow(data, group, on) {
    group.on = on;
    for (const p of group.pixels) data[p * 4 + 3] = on ? 255 : 0;
  }

  flickerWindow() {
    if (this.frozen || !this.light || this.light.night < 0.05) return;
    const share = windowShare(currentHour());
    const w = Phaser.Utils.Array.GetRandom(this.windows);
    const group = Phaser.Utils.Array.GetRandom(w.groups);
    const on = Math.random() < share;
    if (on === group.on) return;
    this.setWindow(w.image.data, group, on);
    w.ctx.putImageData(w.image, 0, 0);
    w.tex.refresh();
  }

  // --- wind turbines ------------------------------------------------------------

  // A rotor turns on every turbine painted in the hills. The painted blades were
  // taken out of the picture by tools/process_assets.py; towers and nacelles stay.
  // The layer repeats every TILE pixels, its second half mirrored, so each rotor
  // appears at x, its mirror image, and both again one repeat further on.
  addHillRotors() {
    for (const { x, y, size } of this.rig.painted) {
      for (const lx of [x, TILE - 1 - x, x + TILE, 2 * TILE - 1 - x]) {
        this.addRotor(lx, WORLD.skyRows + y, size, { scale: 1, depth: DEPTH.rotors, parallax: PARALLAX.hills });
      }
    }
  }

  // One rotor. Hill rotors swap to white daytime frames as the light comes up;
  // street ones are tinted with the daylight like everything else on the street.
  addRotor(x, y, size, { scale, depth, parallax, lit = false }) {
    const make = (day) =>
      this.scene.add
        .image(x, y, "turbines", `rotor_${size}${day ? "_day" : ""}_0`)
        .setScale(scale)
        .setScrollFactor(parallax ?? 1, parallax === undefined ? 1 : 0)
        .setDepth(depth + (day ? 0.01 : 0));
    const rotor = {
      night: make(false),
      day: lit ? null : make(true),
      x,
      parallax: parallax ?? 1,
      reach: (this.scene.textures.getFrame("turbines", `rotor_${size}_0`).width * scale) / 2,
      frame: -1,
      size,
      lit,
      phase: Math.random() * this.rig.frames,
      fps: A.rotorFps[size] * Phaser.Math.FloatBetween(0.85, 1.15),
    };
    this.rotors.push(rotor);
    return rotor;
  }

  // A turbine standing on the street: tower from turbines.png, turning rotor,
  // red lights on the nacelle at night.
  addStreetTurbine(x, size, scale, depth) {
    const tower = this.scene.add
      .image(x, WORLD.groundY, "turbines", `tower_${size}`)
      .setOrigin(0.5, 1)
      .setScale(scale)
      .setDepth(depth);
    const r = this.rig[size];
    this.addRotor(x + r.hub[0] * scale, WORLD.groundY + r.hub[1] * scale, size, { scale, depth: depth + 0.05, lit: true });
    for (const [bx, by] of r.beacons) {
      this.streetBeacons.push(
        this.scene.add
          .rectangle(x + bx * scale, WORLD.groundY + by * scale, scale, scale, 0xff4a3a)
          .setOrigin(0)
          .setDepth(depth + 0.1)
      );
    }
    return tower;
  }

  turnRotors() {
    const frames = this.rig.frames;
    const cam = this.scene.cameras.main;
    const width = this.scene.scale.width;
    for (const r of this.rotors) {
      // skip the ones off screen: Phaser would otherwise draw them anyway
      const sx = r.x - cam.scrollX * r.parallax;
      const onScreen = sx > -r.reach && sx < width + r.reach;
      r.night.setVisible(onScreen);
      r.day?.setVisible(onScreen);
      if (!onScreen) continue;
      const i = this.calm ? 0 : Math.floor(r.phase + (this.clock / 1000) * r.fps) % frames;
      if (i === r.frame) continue;
      r.frame = i;
      r.night.setFrame(`rotor_${r.size}_${i}`);
      r.day?.setFrame(`rotor_${r.size}_day_${i}`);
    }
  }

  // --- lights on the street ----------------------------------------------------

  addLamp(glow) {
    this.lamps.push({ glow, phase: Math.random() * Math.PI * 2, dip: 0 });
  }

  // Lights drawn into a building or scenery sprite (see FIXTURES in config.js).
  addFixtures(name, x, scale) {
    const fx = FIXTURES[name];
    if (!fx) return;
    const at = ([dx, dy]) => [x + dx * scale, WORLD.groundY + dy * scale];
    for (const p of fx.lights ?? []) {
      const [gx, gy] = at(p);
      const glow = this.scene.add
        .image(gx, gy, "glow_small")
        .setScale(scale)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffb45c)
        .setDepth(DEPTH.fixture);
      this.fixtures.push({ glow });
    }
    if (fx.flare) {
      const [fx0, fy0] = at(fx.flare);
      const fire = new Fire(this.scene, `flare${this.flares.length}`);
      if (this.calm) fire.burn(40); // a settled shape, held still
      const flame = this.scene.add
        .image(fx0, fy0, fire.key)
        .setOrigin(0.5, 1)
        .setScale(scale)
        .setDepth(DEPTH.fixture);
      const glow = this.scene.add
        .image(fx0, fy0 - 8 * scale, "glow")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xff8a3c)
        .setDepth(DEPTH.fixture);
      const smoke = this.scene.add
        .particles(fx0, fy0 - 16 * scale, "dust", {
          speedX: { min: A.wind * 1.5, max: A.wind * 3 },
          speedY: { min: -16, max: -9 },
          lifespan: { min: 2600, max: 3800 },
          scale: { start: 1.5, end: 3.5 },
          alpha: { start: 0.6, end: 0 },
          frequency: 200,
          tint: 0xaab4bc,
          emitting: !this.calm,
        })
        .setDepth(DEPTH.fixture - 0.5);
      this.flares.push({ glow, smoke, fire, flame, steps: 0 });
    }
  }

  lampFlicker() {
    if (!this.light || this.light.glow < 0.3 || !this.lamps.length) return;
    // one lamp stutters: dims and recovers in a few quick steps
    Phaser.Utils.Array.GetRandom(this.lamps).dip = 1;
  }

  // --- things that cross the sky -------------------------------------------------

  launchFlock() {
    if (!this.light || this.light.night > 0.5 || this.flock) return;
    const count = Phaser.Math.Between(3, 5);
    const y = Phaser.Math.Between(14, 48);
    const fromLeft = Math.random() < 0.5;
    const width = this.scene.scale.width;
    this.flock = {
      vx: (fromLeft ? 1 : -1) * Phaser.Math.Between(20, 30),
      birds: Array.from({ length: count }, (_, i) => {
        const back = Math.ceil(i / 2) * 7; // a loose V
        const side = i === 0 ? 0 : i % 2 ? -1 : 1;
        const sprite = this.scene.add.image(0, 0, "bird0").setScrollFactor(0).setDepth(DEPTH.birds);
        return {
          sprite,
          x: fromLeft ? -10 - back : width + 10 + back,
          y: y + side * Math.ceil(i / 2) * 4,
          flap: Math.random() * 300,
          bob: Math.random() * Math.PI * 2,
        };
      }),
    };
  }

  launchMeteor() {
    if (!this.light || this.light.stars < 0.6 || this.shooting) return;
    const width = this.scene.scale.width;
    this.shooting = {
      x: Phaser.Math.Between(Math.round(width * 0.3), width),
      y: Phaser.Math.Between(4, 26),
      age: 0,
    };
  }

  launchPlane() {
    if (!this.light || this.light.stars < 0.5 || this.flight) return;
    const width = this.scene.scale.width;
    const fromRight = Math.random() < 0.5;
    this.flight = { x: fromRight ? width + 4 : -4, y: Phaser.Math.Between(8, 22), vx: fromRight ? -9 : 9, age: 0 };
  }

  // --- each frame ------------------------------------------------------------------

  setLight(L) {
    this.light = L;
    const cloudTint = mix(L.light, 0x2c3858, L.night);
    for (const c of this.clouds) c.sprite.setTint(cloudTint).setAlpha(1 - L.night * 0.55);
    for (const w of this.windows) w.sprite.setAlpha(L.night);
    for (const f of this.fixtures) f.glow.setAlpha(L.glow * 0.9);
    for (const r of this.rotors) {
      if (r.lit) r.night.setTint(L.light);
      else {
        r.night.setTint(NIGHT_ROTOR_TINT);
        r.day.setAlpha(1 - L.night).setTint(L.light);
      }
    }
  }

  update(time, delta) {
    const cam = this.scene.cameras.main;
    if (!this.frozen) this.clock += delta;
    this.moveClouds(this.clock);
    for (const w of this.windows) w.sprite.tilePositionX = Math.round(cam.scrollX * w.sprite.parallax);
    this.beacons.tilePositionX = Math.round(cam.scrollX * PARALLAX.hills);
    if (!this.light) return;

    // turbine lights blink together, as real wind farms do
    const blink = this.calm || time % A.beaconPeriodMs < A.beaconPeriodMs * 0.35;
    this.beacons.setAlpha(this.light.night * (blink ? 1 : 0.12));
    for (const b of this.streetBeacons) b.setAlpha(this.light.night * (blink ? 1 : 0));
    this.turnRotors();

    // street lamps breathe a little, and one now and then stutters
    for (const lamp of this.lamps) {
      let level = this.calm ? 1 : 0.9 + 0.1 * Math.sin(time / 700 + lamp.phase);
      if (lamp.dip > 0 && !this.frozen) {
        lamp.dip = Math.max(0, lamp.dip - delta / 450);
        level *= [1, 0.35, 0.8, 0.25, 0.6][Math.floor(lamp.dip * 5) % 5];
      }
      lamp.glow.setAlpha(this.light.glow * level);
    }

    // the flare never goes out: the fire burns on, its glow bright at night, faint by day
    for (const f of this.flares) {
      if (!this.calm) {
        const due = Math.floor((this.clock / 1000) * A.flameFps);
        if (due > f.steps) {
          f.fire.burn(Math.min(due - f.steps, 3));
          f.steps = due;
        }
      }
      const flicker = this.calm ? 1 : 0.8 + 0.2 * Math.random();
      f.glow.setAlpha((0.25 + 0.5 * this.light.night) * (this.frozen ? 1 : flicker));
      f.smoke.setParticleTint(mix(0x8d979f, 0x3a4458, this.light.night));
    }

    if (this.frozen) return;
    const dt = delta / 1000;
    this.updateFlock(time, dt);
    this.updateMeteor(dt);
    this.updatePlane(dt);
  }

  updateFlock(time, dt) {
    if (!this.flock) return;
    const width = this.scene.scale.width;
    const tint = mix(0x2a3440, 0x10141c, this.light.night);
    let gone = 0;
    for (const b of this.flock.birds) {
      b.x += this.flock.vx * dt;
      const frame = Math.floor((time + b.flap) / 160) % 2;
      b.sprite
        .setTexture(`bird${frame}`)
        .setTint(tint)
        .setPosition(Math.round(b.x), Math.round(b.y + Math.sin(time / 500 + b.bob)));
      if (b.x < -30 || b.x > width + 30) gone++;
    }
    if (gone === this.flock.birds.length) {
      for (const b of this.flock.birds) b.sprite.destroy();
      this.flock = null;
    }
  }

  updateMeteor(dt) {
    const g = this.meteor;
    g.clear();
    const m = this.shooting;
    if (!m) return;
    m.age += dt;
    const life = 0.5;
    if (m.age > life) {
      this.shooting = null;
      return;
    }
    // head plus a fading tail, on whole pixels
    const speed = 240;
    const hx = m.x - m.age * speed;
    const hy = m.y + m.age * speed * 0.45;
    const fade = 1 - m.age / life;
    const tail = 14;
    for (let i = 0; i < tail; i++) {
      g.fillStyle(0xffffff, fade * (1 - i / tail));
      g.fillRect(Math.round(hx + i), Math.round(hy - i * 0.45), 1, 1);
    }
  }

  updatePlane(dt) {
    const g = this.plane;
    g.clear();
    const p = this.flight;
    if (!p) return;
    p.age += dt;
    p.x += p.vx * dt;
    const width = this.scene.scale.width;
    if (p.x < -10 || p.x > width + 10) {
      this.flight = null;
      return;
    }
    // red navigation light on a slow blink, white strobe in between
    const t = p.age % 1.2;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    g.fillStyle(0x6b7288, 0.6).fillRect(x, y, 1, 1);
    if (t < 0.2) g.fillStyle(0xff5a4a).fillRect(x, y, 1, 1);
    else if (t > 0.6 && t < 0.68) g.fillStyle(0xffffff).fillRect(x + (p.vx > 0 ? -1 : 1), y, 1, 1);
  }
}

// Share of windows lit at this hour, from WINDOW_LIGHTS.
function windowShare(hour) {
  const i = WINDOW_LIGHTS.findIndex(([h]) => h > hour);
  const [h0, a] = WINDOW_LIGHTS[Math.max(i - 1, 0)];
  const [h1, b] = WINDOW_LIGHTS[Math.max(i, 1)];
  return a + (b - a) * Phaser.Math.Clamp((hour - h0) / (h1 - h0), 0, 1);
}

// A small pixel fire, the way the classic demo-scene fire works: heat is fed in
// along the bottom row and each step every cell rises one row, cooling a little
// and drifting with the wind. Heat is drawn in the four flame colours of the
// building art.
class Fire {
  static W = 12;
  static H = 20;
  static MAX = 12;
  static COLOURS = [null, 0xc55e3e, 0xd1844b, 0xe5ba74, 0xf6faf1]; // red, orange, yellow, white-hot

  constructor(scene, key) {
    const { W, H } = Fire;
    this.key = key;
    this.tex = scene.textures.createCanvas(key, W, H);
    this.ctx = this.tex.getContext();
    this.image = this.ctx.createImageData(W, H);
    this.heat = new Uint8Array(W * H);
    // hottest over the middle of the 6-pixel stack, cooler towards its lip,
    // so only a small white-hot core shows, as in the painted flame
    this.source = [0, 0, 5, 8, 10, 12, 12, 10, 8, 5, 0, 0];
    this.burn(25); // start already alight
  }

  burn(steps) {
    const { W, H, MAX } = Fire;
    const heat = this.heat;
    for (let s = 0; s < steps; s++) {
      for (let x = 0; x < W; x++) {
        // the gas feed flickers a little too
        heat[(H - 1) * W + x] = Math.max(0, this.source[x] - (Math.random() < 0.35 ? 3 : 0));
      }
      for (let y = 0; y < H - 1; y++) {
        for (let x = 0; x < W; x++) {
          const r = Math.random();
          const cool = r < 0.45 ? 0 : r < 0.95 ? 1 : 2;
          const d = Math.random();
          const dx = d < 0.1 ? -1 : d < 0.8 ? 0 : 1; // mostly straight up, leaning a little with the wind
          const to = Math.min(W - 1, Math.max(0, x + dx));
          heat[y * W + to] = Math.max(0, heat[(y + 1) * W + x] - cool);
        }
      }
    }
    this.draw(MAX);
  }

  draw(max) {
    const px = this.image.data;
    for (let i = 0; i < this.heat.length; i++) {
      const h = this.heat[i];
      const band = h === 0 ? 0 : Math.min(4, Math.ceil((h / max) * 4));
      const c = Fire.COLOURS[band];
      px[i * 4 + 3] = c === null ? 0 : 255;
      if (c !== null) {
        px[i * 4] = (c >> 16) & 255;
        px[i * 4 + 1] = (c >> 8) & 255;
        px[i * 4 + 2] = c & 255;
      }
    }
    this.ctx.putImageData(this.image, 0, 0);
    this.tex.refresh();
  }
}
