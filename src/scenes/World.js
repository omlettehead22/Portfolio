import Phaser from "phaser";
import { TUNING as T, VIEW, WORLD, PARALLAX, SCENERY, NPCS, CHARACTER_FRAMES, STORAGE, BUILDING_SCALE, GROUND_SCALE, DOORS } from "../config.js";

// Where the "Press E" marker floats: just above head height, in front of the door.
const MARKER_BOTTOM = WORLD.groundY - 46;
import { controls, isFrozen, store } from "../state.js";
import { currentHour, isCycling, lightAt, mix } from "../daynight.js";
import { play } from "../audio.js";
import Ambient from "./ambient.js";

const DEPTH = { sky: 0, stars: 1, sun: 1.5, hills: 2, city: 3, back: 4, ground: 5, building: 6, prop: 7, glow: 8, npc: 9, player: 10 };

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
    this.lit = [];   // everything that takes the colour of the daylight

    this.physics.world.setBounds(0, 0, WORLD.width, VIEW.height);
    this.physics.world.gravity.y = T.gravity;

    this.addSky();
    this.ambient = new Ambient(this, { calm: this.calm });
    this.ambient.create();
    this.addGround();
    this.addScenery();
    this.addBuildings();
    this.addPeople();
    this.addPlayer();
    this.addInput();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD.width, VIEW.height);
    cam.setRoundPixels(true);
    // The camera is moved by hand once physics has placed the player (see
    // followPlayer), so everything that depends on it sees the same position.
    this.events.on("postupdate", this.followPlayer, this);
    this.events.once("shutdown", () => this.events.off("postupdate", this.followPlayer, this));
    this.followPlayer(0, 0);

    // Light follows the clock. Re-check now and then, and whenever the view is resized.
    this.refreshLight();
    this.time.addEvent({ delay: 20000, loop: true, callback: this.refreshLight, callbackScope: this });
    this.scale.on("resize", this.refreshLight, this);

    // Remember where the visitor got to.
    this.time.addEvent({ delay: 1500, loop: true, callback: this.savePosition, callbackScope: this });
    const onHide = () => this.savePosition();
    window.addEventListener("pagehide", onHide);
    this.events.once("shutdown", () => {
      window.removeEventListener("pagehide", onHide);
      this.scale.off("resize", this.refreshLight, this);
    });

    this.game.events.emit("world-ready", data);
  }

  // --- sky and background ----------------------------------------------------

  addSky() {
    // Everything here is fixed to the screen; the hill layers are scrolled by hand in update().
    this.sky = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.sky);

    this.stars = this.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.stars);
    const rnd = new Phaser.Math.RandomDataGenerator(["stars"]);
    for (let i = 0; i < 30; i++) {
      const star = this.add
        .rectangle(rnd.between(2, VIEW.maxWidth - 2), rnd.between(2, WORLD.skyRows - 6), 1, 1, 0xdfe9e4)
        .setAlpha(rnd.realInRange(0.4, 1));
      this.stars.add(star);
      if (!this.calm) {
        this.tweens.add({
          targets: star,
          alpha: 0.15,
          duration: rnd.between(900, 2600),
          delay: rnd.between(0, 3000),
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }

    this.sun = this.add.image(0, 0, "sun").setScrollFactor(0).setDepth(DEPTH.sun);
    this.moon = this.add.image(0, 0, "moon").setScrollFactor(0).setDepth(DEPTH.sun);

    // Two copies of each layer: the night painting, and its daylight version on top,
    // faded in and out as the day goes by.
    const rows = VIEW.height - WORLD.skyRows;
    const layer = (key, depth) =>
      this.add.tileSprite(0, WORLD.skyRows, VIEW.maxWidth, rows, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
    this.hills = [layer("bg_hills", DEPTH.hills), layer("bg_hills_day", DEPTH.hills + 0.1)];
    this.city = [layer("bg_city", DEPTH.city), layer("bg_city_day", DEPTH.city + 0.1)];
  }

  drawSky(top, bottom) {
    const bands = 11;
    const h = WORLD.skyRows / bands;
    this.sky.clear();
    for (let i = 0; i < bands; i++) {
      this.sky.fillStyle(mix(top, bottom, i / (bands - 1))).fillRect(0, Math.round(i * h), VIEW.maxWidth, Math.ceil(h) + 1);
    }
  }

  // Set every colour in the scene for the current time of day.
  refreshLight() {
    const L = lightAt(currentHour());
    const width = this.scale.width;

    this.drawSky(L.sky, L.horizon);
    this.stars.setAlpha(L.stars);
    for (const day of [this.hills[1], this.city[1]]) day.setAlpha(1 - L.night).setTint(L.light);

    // sun and moon cross the sky on an arc and sink behind the hills
    const place = (body, p) => {
      body.setVisible(p > -0.05 && p < 1.05);
      body.setPosition(Math.round(24 + p * (width - 48)), Math.round(WORLD.skyRows + 8 - Math.sin(Math.PI * p) * 58));
    };
    place(this.sun, L.sun);
    place(this.moon, L.moon);

    for (const obj of this.lit) obj.setTint(L.light);
    this.ambient.setLight(L);
    this.dust?.setParticleTint(L.light);
    this.game.events.emit("light", L);
  }

  // --- street ----------------------------------------------------------------

  addGround() {
    const h = VIEW.height - WORLD.groundY;
    this.lit.push(
      this.add
        .tileSprite(0, WORLD.groundY, WORLD.width, h, "props", "tile_street")
        .setTileScale(GROUND_SCALE)
        .setOrigin(0)
        .setDepth(DEPTH.ground)
    );
    this.ground = this.add.zone(WORLD.width / 2, WORLD.groundY + h / 2, WORLD.width, h);
    this.physics.add.existing(this.ground, true);
  }

  addScenery() {
    this.platforms = [];
    for (const item of SCENERY) {
      const atlas = item.atlas ?? "props";
      const scale = item.scale ?? 1;
      const depth = item.back ? DEPTH.back : atlas === "buildings" ? DEPTH.building : DEPTH.prop;
      if (item.turbine) {
        this.lit.push(this.ambient.addStreetTurbine(item.x, item.turbine, scale, depth));
        continue;
      }
      if (!this.textures.get(atlas).has(item.sprite)) continue;
      const img = this.add.image(item.x, WORLD.groundY, atlas, item.sprite).setOrigin(0.5, 1).setScale(scale).setDepth(depth);
      this.lit.push(img);

      if (item.platform) {
        // Solid only from above: you can land on it, but walk and jump through it.
        // Either the whole sprite, or listed surfaces ([left, top, width] in sprite pixels).
        const left = item.x - img.displayWidth / 2;
        const top = WORLD.groundY - img.displayHeight;
        const surfaces = Array.isArray(item.platform)
          ? item.platform.map(([sx, sy, sw]) => [left + sx * scale, top + sy * scale, sw * scale])
          : [[left + 3, top, img.displayWidth - 6]];
        for (const [zx, zy, zw] of surfaces) {
          // Deep enough that even a slow frame (see fps.min in game.js) cannot
          // carry a falling player straight through it.
          const zone = this.add.zone(zx + zw / 2, zy + 12, zw, 24);
          this.physics.add.existing(zone, true);
          const c = zone.body.checkCollision;
          c.down = c.left = c.right = false;
          this.platforms.push(zone);
        }
      }
      if (item.glow) {
        this.ambient.addLamp(
          this.add
            .image(item.x, WORLD.groundY - img.displayHeight + 7 * scale, "glow")
            .setScale(scale)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setTint(0xffb45c)
            .setDepth(DEPTH.glow)
        );
      }
      if (atlas === "buildings") this.ambient.addFixtures(item.sprite, item.x, scale);
    }
  }

  addBuildings() {
    const visited = new Set(store.get(STORAGE.visited, []));
    const atlas = this.textures.get("buildings");

    this.buildings = this.projects.map((project) => {
      // "sprite" is a name from the buildings atlas, or the key of a single image
      let sprite;
      if (atlas.has(project.sprite)) sprite = this.add.image(project.x, WORLD.groundY, "buildings", project.sprite);
      else if (this.textures.exists(project.sprite)) sprite = this.add.image(project.x, WORLD.groundY, project.sprite);
      else sprite = this.add.image(project.x, WORLD.groundY, "buildings", "battery_lab");
      sprite.setOrigin(0.5, 1).setScale(BUILDING_SCALE).setDepth(DEPTH.building);
      this.ambient.addFixtures(sprite.frame.name, project.x, BUILDING_SCALE);
      this.lit.push(sprite);
      // the door, where the marker floats and "Press E" is measured from
      const door = project.x + (DOORS[sprite.frame.name] ?? 0) * BUILDING_SCALE;

      // Clicking or tapping a building opens it, wherever the player is standing.
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerup", (pointer) => {
        if (this.frozen || pointer.getDistance() > 12) return;
        this.openProject(project);
      });

      // A floating marker shows it can be entered: a lightbulb, then a star once visited.
      // Buildings still waiting for their project have none.
      if (project.draft) return { project, sprite, door, marker: null };
      const marker = this.add
        .image(door, MARKER_BOTTOM, "props", visited.has(project.id) ? "star" : "bulb")
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.glow);
      if (!this.calm) {
        this.tweens.add({ targets: marker, y: marker.y - 4, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
      return { project, sprite, door, marker };
    });
  }

  addPeople() {
    this.npcs = [];
    for (const npc of NPCS) {
      const frame = CHARACTER_FRAMES[npc.frame];
      if (frame === undefined) continue;
      const sprite = this.add
        .sprite(npc.x, WORLD.groundY, "character", frame)
        .setOrigin(0.5, 1)
        .setFlipX(!!npc.faceLeft)
        .setDepth(DEPTH.npc);
      // breathe, each on their own rhythm
      if (!this.calm && this.anims.exists(npc.frame)) {
        sprite.play({ key: npc.frame, startFrame: Phaser.Math.Between(0, 1), delay: Phaser.Math.Between(0, 900) });
      }
      this.lit.push(sprite);
      this.npcs.push({ sprite, faceLeft: !!npc.faceLeft });
    }
  }

  // People turn to look at you as you walk past.
  watchPlayer() {
    for (const npc of this.npcs) {
      const d = this.player.x - npc.sprite.x;
      npc.sprite.setFlipX(Math.abs(d) < 90 ? d < 0 : npc.faceLeft);
    }
  }

  addPlayer() {
    const saved = store.get(STORAGE.position, WORLD.startX);
    const x = Phaser.Math.Clamp(Number(saved) || WORLD.startX, 16, WORLD.width - 16);

    // 48x48 frames with the feet on the bottom row; the body is the figure, not the frame
    const player = this.physics.add.sprite(x, WORLD.groundY - 24, "character", 0).setDepth(DEPTH.player);
    player.body.setSize(12, 36).setOffset(18, 12);
    player.body.setMaxVelocity(T.speed, T.maxFall);
    player.setCollideWorldBounds(true);
    player.play("idle");
    this.player = player;
    this.lit.push(player);

    this.physics.add.collider(player, this.ground);
    // land on a platform only when coming down onto its top
    this.physics.add.collider(player, this.platforms, null, (p, plat) => p.body.prev.y + p.body.height <= plat.body.top + 4);

    this.dust = this.add
      .particles(0, 0, "dust", {
        speed: { min: 15, max: 45 },
        angle: { min: 190, max: 350 },
        lifespan: { min: 200, max: 380 },
        alpha: { start: 0.7, end: 0 },
        gravityY: 120,
        emitting: false,
      })
      .setDepth(DEPTH.npc);

    this.groundedAt = 0;       // last moment the player stood on something
    this.jumpPressedAt = -1e9; // last moment jump was pressed
    this.rising = false;       // still in the upward part of a jump that can be cut short
    this.wasOnGround = true;
    this.fallSpeed = 0;
  }

  addInput() {
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard.addKeys({ left: K.LEFT, right: K.RIGHT, up: K.UP, a: K.A, d: K.D, w: K.W, space: K.SPACE, e: K.E });

    // Jump and E are taken from key-press events rather than polled, so even the
    // quickest tap is never missed between two frames.
    this.touchJumpWasDown = false;
    const pressJump = (e) => {
      if (!e.repeat && !this.frozen) this.jumpPressedAt = this.time.now;
    };
    this.input.keyboard.on("keydown-UP", pressJump);
    this.input.keyboard.on("keydown-W", pressJump);
    this.input.keyboard.on("keydown-SPACE", pressJump);
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
    this.buildings.find((b) => b.project === project)?.marker?.setFrame("star");
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
      this.dust.pause();
      this.ambient.setFrozen(true);
      // let Space and the arrow keys reach the page (scrolling, buttons) while a menu is open
      this.input.keyboard.disableGlobalCapture();
    } else {
      this.jumpPressedAt = -1e9;
      this.input.keyboard.resetKeys();
      this.input.keyboard.enableGlobalCapture();
      this.physics.world.resume();
      this.anims.resumeAll();
      this.tweens.resumeAll();
      this.dust.resume();
      this.ambient.setFrozen(false);
    }
  }

  // --- every frame -----------------------------------------------------------

  update(time) {
    const frozen = isFrozen();
    if (frozen !== this.frozen) this.setFrozen(frozen);
    if (isCycling() && !frozen) this.refreshLight();

    if (!frozen) {
      this.movePlayer(time);
      this.watchPlayer();
    }
  }

  // Runs after physics has moved the player this frame. The camera follows the
  // player's *rounded* position: following the exact position made the player
  // wobble a pixel back and forth on screen while walking, because the camera
  // and the sprite were each rounded to whole pixels separately. Everything
  // that scrolls with the camera is then placed from the same position.
  followPlayer(time, delta) {
    const cam = this.cameras.main;
    const width = this.scale.width;
    cam.scrollX = Phaser.Math.Clamp(Math.round(this.player.x) - Math.floor(width / 2), 0, WORLD.width - width);

    for (const l of this.hills) l.tilePositionX = Math.round(cam.scrollX * PARALLAX.hills);
    for (const l of this.city) l.tilePositionX = Math.round(cam.scrollX * PARALLAX.city);
    this.ambient.update(time, delta);
    this.updateHud(cam);
  }

  movePlayer(time) {
    const { keys, player } = this;
    const body = player.body;
    const onGround = body.blocked.down || body.touching.down;

    // --- running: push towards top speed, slide to a stop --------------------
    const left = keys.left.isDown || keys.a.isDown || controls.left;
    const right = keys.right.isDown || keys.d.isDown || controls.right;
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    const grip = onGround ? 1 : T.airControl;

    if (dir !== 0) {
      const reversing = body.velocity.x * dir < 0;
      body.setAccelerationX(dir * T.acceleration * grip * (reversing ? T.turnBoost : 1));
      body.setDragX(0);
      player.setFlipX(dir < 0);
    } else {
      body.setAccelerationX(0);
      body.setDragX(T.friction * grip);
    }

    // --- jumping --------------------------------------------------------------
    const touchJump = controls.jump && !this.touchJumpWasDown;
    this.touchJumpWasDown = controls.jump;
    if (touchJump) this.jumpPressedAt = time;
    const jumpHeld = keys.up.isDown || keys.w.isDown || keys.space.isDown || controls.jump;

    if (onGround) this.groundedAt = time;
    const buffered = time - this.jumpPressedAt <= T.jumpBufferMs;
    const canJump = time - this.groundedAt <= T.coyoteMs;
    if (buffered && canJump && !this.rising) {
      // Physics moves by each frame's real time, which makes a jump a little
      // lower the longer the frames are. Adding half a frame of gravity to the
      // take-off speed cancels that, so the jump is the same height at 30, 60
      // or 144 frames a second.
      body.setVelocityY(-(T.jump + (T.gravity * this.game.loop.delta) / 2000));
      this.rising = true;
      this.jumpPressedAt = -1e9;
      this.groundedAt = -1e9;
      play("jump");
      this.puff(3);
    } else if (this.rising) {
      if (body.velocity.y >= 0) this.rising = false;
      else if (!jumpHeld) {
        body.setVelocityY(body.velocity.y * T.jumpCut); // let go early: short hop
        this.rising = false;
      }
    }

    // fall faster than you rise
    body.setGravityY(body.velocity.y > 0 ? T.gravity * (T.fallGravity - 1) : 0);

    // --- landing --------------------------------------------------------------
    if (onGround && !this.wasOnGround && this.fallSpeed > 180) this.puff(6);
    if (!onGround) this.fallSpeed = body.velocity.y;
    this.wasOnGround = onGround;

    // --- animation ------------------------------------------------------------
    const moving = Math.abs(body.velocity.x) > 8;
    if (!onGround) player.play(body.velocity.y < 0 ? "rise" : "fall", true);
    else if (moving) {
      player.play("walk", true);
      // legs keep pace with the ground speed
      player.anims.timeScale = Phaser.Math.Clamp(Math.abs(body.velocity.x) / T.speed, 0.4, 1);
    } else player.play("idle", true);
    if (!moving || !onGround) player.anims.timeScale = 1;
  }

  puff(count) {
    if (this.calm) return;
    this.dust.explode(count, this.player.x, this.player.body.bottom);
  }

  updateHud(cam) {
    // nearest building within reach, if any
    let near = null;
    let best = T.interactRange;
    for (const b of this.buildings) {
      const d = Math.abs(b.door - this.player.x);
      if (d <= best) {
        best = d;
        near = b;
      }
    }
    this.near = near;

    const hud = this.hud;
    hud.near = near ? near.project : null;
    if (near) {
      hud.x = near.door - cam.scrollX;
      hud.y = MARKER_BOTTOM - 34; // above the marker
    }
    hud.progress = this.player.x / WORLD.width;
    this.game.events.emit("hud", hud);
  }
}
