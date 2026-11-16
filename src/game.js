// Loaded on demand by main.js so the page shell appears before Phaser has downloaded.
import Phaser from "phaser";
import { VIEW, TUNING } from "./config.js";
import Boot from "./scenes/Boot.js";
import Preload from "./scenes/Preload.js";
import World from "./scenes/World.js";

export function createGame(parent) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW.maxWidth,
    height: VIEW.height,
    backgroundColor: "#0b1633",
    pixelArt: true, // no smoothing when sprites are scaled
    roundPixels: true,
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER }, // sized by scale.js
    physics: { default: "arcade", arcade: { gravity: { y: TUNING.gravity } } },
    audio: { noAudio: true }, // sound effects are synthesised in audio.js
    input: { activePointers: 3 },
    banner: false,
    scene: [Boot, Preload, World],
  });
}
