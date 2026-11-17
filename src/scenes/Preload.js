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

    // dust kicked up on landing
    g.fillStyle(0xffffff).fillRect(0, 0, 2, 2);
    g.generateTexture("dust", 2, 2);
    g.destroy();
  }
}
