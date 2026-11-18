import Phaser from "phaser";
import { ASSETS, CHARACTER_FRAMES as F } from "../config.js";

// Loads every asset and projects.json, reporting progress to the loading bar.
export default class Preload extends Phaser.Scene {
  constructor() {
    super("Preload");
  }

  preload() {
    const base = import.meta.env.BASE_URL;
    const failed = [];

    this.load.on("progress", (p) => this.game.events.emit("load-progress", p));
    this.load.on("loaderror", (file) => failed.push(file.key));
    this.load.once("complete", () => {
      this.registry.set("loadErrors", failed);
    });

    this.load.setPath(`${base}assets/`);
    for (const [key, file] of Object.entries(ASSETS.images)) this.load.image(key, file);
    for (const [key, s] of Object.entries(ASSETS.sheets)) {
      this.load.spritesheet(key, s.file, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    }
    for (const [key, a] of Object.entries(ASSETS.atlases)) this.load.atlas(key, a.image, a.data);
    this.load.setPath(base);
    this.load.json("projects", "projects.json");
  }

  create() {
    const failed = this.registry.get("loadErrors");
    if (failed.length) {
      this.game.events.emit("load-failed", failed);
      return;
    }

    this.makeTextures();

    const frames = (list) => this.anims.generateFrameNumbers("character", { frames: list });
    this.anims.create({ key: "idle", frames: frames([F.idle0, F.idle1]), frameRate: 2, repeat: -1 });
    this.anims.create({
      key: "walk",
      frames: frames([F.walk0, F.walk1, F.walk2, F.walk3]),
      frameRate: 9,
      repeat: -1,
    });
    this.anims.create({ key: "rise", frames: frames([F.jump_up]), frameRate: 1 });
    for (const npc of ["npc_scientist", "npc_technician", "npc_delivery"]) {
      this.anims.create({ key: npc, frames: frames([F[npc], F[`${npc}_b`]]), frameRate: 2, repeat: -1 });
    }
    this.anims.create({ key: "fall", frames: frames([F.jump_down]), frameRate: 1 });

    this.scene.start("World");
  }

  // Small textures drawn in code rather than loaded.
  makeTextures() {
    const g = this.make.graphics({ add: false });

    // the sun: a pale disc with a brighter centre
    g.fillStyle(0xffe9a8).fillCircle(9, 9, 9);
    g.fillStyle(0xfff6d8).fillCircle(9, 9, 6);
    g.generateTexture("sun", 18, 18);
    g.clear();

    // lamp glow: stepped rings, so it stays pixel art (drawn white, tinted in the scene)
    for (const [radius, alpha] of [[20, 0.12], [14, 0.16], [9, 0.22], [5, 0.3]]) {
      g.fillStyle(0xffffff, alpha).fillCircle(20, 20, radius);
    }
    g.generateTexture("glow", 40, 40);
    g.clear();

    // a small warm glow for lights drawn into buildings (tinted in the scene)
    for (const [radius, alpha] of [[8, 0.14], [5, 0.2], [3, 0.3]]) {
      g.fillStyle(0xffffff, alpha).fillCircle(8, 8, radius);
    }
    g.generateTexture("glow_small", 16, 16);
    g.clear();

    // dust kicked up on landing, and smoke from the hydrogen flare
    g.fillStyle(0xffffff).fillRect(0, 0, 2, 2);
    g.generateTexture("dust", 2, 2);
    g.destroy();

    this.makeClouds();
    this.makeBirds();
  }

  // Clouds are built pixel by pixel from a few overlapping circles, so their
  // edges are as crisp as the rest of the art: white on top, shaded underneath.
  makeClouds() {
    const shapes = [
      [[10, 9, 6], [18, 6, 7], [27, 9, 6], [34, 11, 4]],
      [[7, 7, 5], [14, 5, 5], [21, 7, 5]],
      [[9, 10, 7], [19, 6, 8], [30, 8, 7], [40, 10, 6], [47, 12, 3]],
    ];
    shapes.forEach((circles, i) => {
      const w = Math.max(...circles.map(([x, , r]) => x + r)) + 1;
      const base = Math.max(...circles.map(([, y]) => y)) + 2; // flat bottom
      const tex = this.textures.createCanvas(`cloud${i}`, w, base + 1);
      const ctx = tex.getContext();
      for (let y = 0; y <= base; y++) {
        for (let x = 0; x < w; x++) {
          const inside = circles.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
          if (!inside) continue;
          ctx.fillStyle = y >= base - 2 ? "#c9d7e4" : y >= base - 4 ? "#e4edf4" : "#ffffff";
          ctx.fillRect(x, y, 1, 1);
        }
      }
      tex.refresh();
    });
  }

  // Two frames of a 5x3 bird: wings up, wings down.
  makeBirds() {
    const frames = [
      ["X...X", ".X.X.", "..X.."],
      [".....", "XXXXX", "..X.."],
    ];
    frames.forEach((rows, i) => {
      const tex = this.textures.createCanvas(`bird${i}`, 5, 3);
      const ctx = tex.getContext();
      ctx.fillStyle = "#ffffff";
      rows.forEach((row, y) => [...row].forEach((c, x) => c === "X" && ctx.fillRect(x, y, 1, 1)));
      tex.refresh();
    });
  }
}
