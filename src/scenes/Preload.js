import Phaser from "phaser";
import { ASSETS } from "../config.js";

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
    this.load.setPath(base);
    this.load.json("projects", "projects.json");
  }

  create() {
    const failed = this.registry.get("loadErrors");
    if (failed.length) {
      this.game.events.emit("load-failed", failed);
      return;
    }

    this.makeGroundTexture();

    this.anims.create({
      key: "idle",
      frames: this.anims.generateFrameNumbers("character", { frames: [0, 1] }),
      frameRate: 2,
      repeat: -1,
    });
    this.anims.create({
      key: "walk",
      frames: this.anims.generateFrameNumbers("character", { frames: [2, 3, 4, 5] }),
      frameRate: 9,
      repeat: -1,
    });
    this.anims.create({
      key: "jump",
      frames: this.anims.generateFrameNumbers("character", { frames: [6] }),
      frameRate: 1,
    });

    this.scene.start("World");
  }

  // The street surface is drawn in code: a lit kerb line over dark paving.
  makeGroundTexture() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x0b1633).fillRect(0, 0, 32, 32);
    g.fillStyle(0x5a8f9a).fillRect(0, 0, 32, 1);
    g.fillStyle(0x2b4f66).fillRect(0, 1, 32, 2);
    g.fillStyle(0x16294a);
    g.fillRect(0, 9, 32, 1).fillRect(0, 19, 32, 1);
    g.fillRect(7, 3, 1, 6).fillRect(23, 3, 1, 6).fillRect(15, 10, 1, 9).fillRect(31, 10, 1, 9);
    g.generateTexture("ground", 32, 32);
    g.destroy();
  }
}
