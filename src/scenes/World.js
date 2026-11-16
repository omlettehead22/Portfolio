import Phaser from "phaser";
import { TUNING, VIEW, WORLD, PARALLAX, DECOR, PROP_FRAMES, STORAGE } from "../config.js";
import { controls, isFrozen, store } from "../state.js";
import { play } from "../audio.js";

const BUILDING_HEIGHT = 128;

export default class World extends Phaser.Scene {
  constructor() {
    super("World");
  }

  create() {
    const data = this.cache.json.get("projects");
    this.projects = data.projects;
    this.calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.frozen = false;
    this.near = null;
    this.hud = { near: null, x: 0, y: 0, progress: 0 };

    this.physics.world.setBounds(0, 0, WORLD.width, VIEW.height);
    this.physics.world.gravity.y = TUNING.gravity;

    this.addBackground();
    this.addGround();
    this.addDecor();
    this.addBuildings();
    this.addPlayer();
    this.addInput();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD.width, VIEW.height);
    cam.setRoundPixels(true);
    cam.startFollow(this.player, true);

    // Remember where the visitor got to.
    this.time.addEvent({ delay: 1500, loop: true, callback: this.savePosition, callbackScope: this });
    const onHide = () => this.savePosition();
    window.addEventListener("pagehide", onHide);
    this.events.once("shutdown", () => window.removeEventListener("pagehide", onHide));

    this.game.events.emit("world-ready", data);
  }

  // --- scenery ---------------------------------------------------------------

  addBackground() {
    // Layers are fixed to the screen and scrolled by hand in update().
    this.add.image(0, 0, "bg_sky").setOrigin(0).setScrollFactor(0).setDepth(0);

    const rnd = new Phaser.Math.RandomDataGenerator(["stars"]);
    for (let i = 0; i < 26; i++) {
      const star = this.add
        .rectangle(rnd.between(2, VIEW.maxWidth - 2), rnd.between(2, 60), 1, 1, 0xdfe9e4)
        .setScrollFactor(0)
        .setDepth(1)
        .setAlpha(rnd.realInRange(0.3, 0.9));
      if (!this.calm) {
        this.tweens.add({
          targets: star,
          alpha: 0.1,
          duration: rnd.between(900, 2600),
          delay: rnd.between(0, 3000),
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }

    const skyRows = this.textures.get("bg_sky").getSourceImage().height;
    const rows = VIEW.height - skyRows;
    this.hills = this.add
      .tileSprite(0, skyRows, VIEW.maxWidth, rows, "bg_hills")
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(2);
    this.city = this.add
      .tileSprite(0, skyRows, VIEW.maxWidth, rows, "bg_city")
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(3);
  }

  addGround() {
    const h = VIEW.height - WORLD.groundY;
    this.add.tileSprite(0, WORLD.groundY, WORLD.width, h, "ground").setOrigin(0).setDepth(5);
    this.ground = this.add.zone(WORLD.width / 2, WORLD.groundY + h / 2, WORLD.width, h);
    this.physics.add.existing(this.ground, true);
  }

  addDecor() {
    for (const d of DECOR) {
      this.add.image(d.x, WORLD.groundY, "props", PROP_FRAMES[d.prop]).setOrigin(0.5, 1).setDepth(6);
    }
  }

  addBuildings() {
    this.buildings = this.projects.map((project) => {
      const key = this.textures.exists(project.sprite) ? project.sprite : "building";
      const sprite = this.add.image(project.x, WORLD.groundY, key).setOrigin(0.5, 1).setDepth(6);

      // Clicking or tapping a building opens it, wherever the player is standing.
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerup", (pointer) => {
        if (this.frozen || pointer.getDistance() > 12) return;
        this.openProject(project);
      });

      // A floating icon marks each building as something you can enter.
      const frame = PROP_FRAMES[project.icon];
      if (frame !== undefined) {
        const icon = this.add
          .image(project.x, WORLD.groundY - BUILDING_HEIGHT - 6, "props", frame)
          .setOrigin(0.5, 1)
          .setDepth(7);
        if (!this.calm) {
          this.tweens.add({
            targets: icon,
            y: icon.y - 4,
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
      }
      return { project, sprite };
    });
  }

  addPlayer() {
    const saved = store.get(STORAGE.position, WORLD.startX);
    const x = Phaser.Math.Clamp(Number(saved) || WORLD.startX, 16, WORLD.width - 16);

    this.player = this.physics.add.sprite(x, WORLD.groundY - 16, "character", 0).setDepth(10);
    this.player.body.setSize(10, 30).setOffset(11, 2);
    this.player.setCollideWorldBounds(true);
    this.player.play("idle");
    this.physics.add.collider(this.player, this.ground);
  }

  addInput() {
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard.addKeys({
      left: K.LEFT,
      right: K.RIGHT,
      up: K.UP,
      a: K.A,
      d: K.D,
      w: K.W,
      space: K.SPACE,
      e: K.E,
    });
    // Jump and E are taken from key-press events rather than polled, so even the
    // quickest tap is never missed between two frames.
    this.jumpQueued = false;
    this.touchJumpWasDown = false;
    const queueJump = (e) => {
      if (!e.repeat) this.jumpQueued = true;
    };
    this.input.keyboard.on("keydown-UP", queueJump);
    this.input.keyboard.on("keydown-W", queueJump);
    this.input.keyboard.on("keydown-SPACE", queueJump);
    this.input.keyboard.on("keydown-E", (e) => {
      if (!e.repeat) this.interact();
    });
    this.game.events.on("action", this.interact, this);
    this.events.once("shutdown", () => this.game.events.off("action", this.interact, this));
  }

  // --- actions ---------------------------------------------------------------

  interact() {
    if (!this.frozen && this.near) this.openProject(this.near.project);
  }

  openProject(project) {
    this.savePosition();
    this.game.events.emit("open-project", project);
  }

  savePosition() {
    if (this.player) store.set(STORAGE.position, Math.round(this.player.x));
  }

  // Stop or restart everything that moves. Called when a menu opens or closes.
  setFrozen(frozen) {
    this.frozen = frozen;
    if (frozen) {
      this.physics.world.pause();
      this.anims.pauseAll();
      this.tweens.pauseAll();
      // let Space and the arrow keys reach the page (scrolling, buttons) while a menu is open
      this.input.keyboard.disableGlobalCapture();
    } else {
      this.jumpQueued = false;
      this.input.keyboard.resetKeys();
      this.input.keyboard.enableGlobalCapture();
      this.physics.world.resume();
      this.anims.resumeAll();
      this.tweens.resumeAll();
    }
  }

  // --- every frame -----------------------------------------------------------

  update() {
    const frozen = isFrozen();
    if (frozen !== this.frozen) this.setFrozen(frozen);

    const cam = this.cameras.main;
    this.hills.tilePositionX = Math.round(cam.scrollX * PARALLAX.hills);
    this.city.tilePositionX = Math.round(cam.scrollX * PARALLAX.city);

    if (!frozen) this.movePlayer();
    this.updateHud(cam);
  }

  movePlayer() {
    const { keys, player } = this;
    const body = player.body;
    const onGround = body.blocked.down || body.touching.down;

    const left = keys.left.isDown || keys.a.isDown || controls.left;
    const right = keys.right.isDown || keys.d.isDown || controls.right;
    const dir = (right ? 1 : 0) - (left ? 1 : 0);

    player.setVelocityX(dir * TUNING.speed);
    if (dir !== 0) player.setFlipX(dir < 0);

    const touchJump = controls.jump && !this.touchJumpWasDown;
    this.touchJumpWasDown = controls.jump;
    if ((this.jumpQueued || touchJump) && onGround) {
      player.setVelocityY(-TUNING.jump);
      play("jump");
    }
    this.jumpQueued = false;

    if (!onGround) player.play("jump", true);
    else if (dir !== 0) player.play("walk", true);
    else player.play("idle", true);
  }

  updateHud(cam) {
    // nearest building within reach, if any
    let near = null;
    let best = TUNING.interactRange;
    for (const b of this.buildings) {
      const d = Math.abs(b.project.x - this.player.x);
      if (d <= best) {
        best = d;
        near = b;
      }
    }
    this.near = near;

    const hud = this.hud;
    hud.near = near ? near.project : null;
    if (near) {
      hud.x = near.project.x - cam.scrollX;
      hud.y = WORLD.groundY - BUILDING_HEIGHT - 44;
    }
    hud.progress = this.player.x / WORLD.width;
    this.game.events.emit("hud", hud);
  }
}
