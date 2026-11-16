import Phaser from "phaser";

// First scene: nothing to load, just hand over to Preload once the game exists.
export default class Boot extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    this.scene.start("Preload");
  }
}
