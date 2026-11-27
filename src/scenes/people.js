// The people on the street (NPCS in src/config.js): some at work in one place
// (writing on a clipboard, turning a valve, typing, reading, up a ladder), some
// pacing up and down, and a cyclist who rides the length of the street.
//
// Frames come from the "npcs" atlas (tools/process_assets.py, "npcs"); each
// animation's frames share one size and are lined up on what holds still, so a
// sprite only ever changes frame. With "reduce motion" on, everyone holds their
// first pose and nobody moves; while the game is frozen (a window open, paused)
// the walkers stop where they are, along with the animations.

import Phaser from "phaser";
import { WORLD, CHARACTER_FRAMES, TALK_RANGE } from "../config.js";

const LOOK_RANGE = 90; // people who turn, turn to face you inside this distance
const NEAR = 60; // walkers stop for you inside this distance
const RIDE_MARGIN = 60; // the cyclist rides this far past each end before coming round

export default class People {
  constructor(scene, list, { calm, depth, addShadow, lit }) {
    this.scene = scene;
    this.calm = calm;
    this.meta = scene.cache.json.get("npcs_meta") ?? {};
    this.all = [];
    list.forEach((cfg, i) => {
      const person = this.make(cfg, i, depth);
      if (!person) return;
      person.shadow = addShadow(person.sprite.x, person.shadowWidth);
      lit.push(person.sprite);
      this.all.push(person);
    });
  }

  make(cfg, i, depth) {
    const scene = this.scene;
    const x = cfg.x ?? cfg.walk?.from ?? cfg.ride?.x ?? 0;
    let sprite;
    let anim = null;
    if (cfg.sheet) {
      const m = this.meta[cfg.sheet];
      if (!m) return null;
      const frame = (n) => `${cfg.sheet}${n}`;
      const order = cfg.play ?? [0];
      sprite = scene.add.sprite(x, WORLD.groundY, "npcs", frame(order[0]));
      // stand on the anchor (the head or the base), not the frame's middle
      sprite.setOrigin(m.anchor / m.w, 1);
      if (order.length > 1) {
        anim = `npc-${i}`;
        scene.anims.create({
          key: anim,
          frames: order.map((n) => ({ key: "npcs", frame: frame(n) })),
          frameRate: cfg.fps ?? 4,
          repeat: -1,
          repeatDelay: cfg.rest ?? 0,
        });
      }
      sprite.frameOf = frame;
    } else {
      // a still pose from the older character sheet, breathing
      const f = CHARACTER_FRAMES[cfg.frame];
      if (f === undefined) return null;
      sprite = scene.add.sprite(x, WORLD.groundY, "character", f).setOrigin(0.5, 1);
      if (scene.anims.exists(cfg.frame)) anim = cfg.frame;
    }
    sprite.setDepth(depth).setFlipX(!!cfg.faceLeft);
    if (anim && !this.calm) {
      sprite.play({ key: anim, startFrame: Phaser.Math.Between(0, 1), delay: Phaser.Math.Between(0, 900) });
    }
    const person = {
      x, // exact position; the sprite is drawn on the whole pixel
      cfg,
      sprite,
      anim,
      say: cfg.say,
      faceLeft: !!cfg.faceLeft,
      dir: 1, // which way a walker is going
      waiting: false,
      shadowWidth: cfg.ride ? 30 : cfg.sheet === "trolley" || cfg.sheet === "bench" || cfg.sheet === "laptop" ? 26 : 16,
    };
    return person;
  }

  // Called each frame the game is running. dt in seconds.
  update(px, dt) {
    for (const p of this.all) {
      const { cfg, sprite } = p;
      const d = px - sprite.x;
      if (cfg.walk) this.walk(p, d, dt);
      else if (cfg.ride) this.ride(p, dt);
      else {
        if (cfg.turns) sprite.setFlipX(Math.abs(d) < LOOK_RANGE ? d < 0 : p.faceLeft);
        // look up from work to talk while you stand by them
        if (cfg.talkFrame !== undefined && cfg.say) this.hold(p, Math.abs(d) <= TALK_RANGE ? cfg.talkFrame : null);
      }
      p.shadow?.setX(Math.round(sprite.x));
    }
  }

  // Show one frame instead of the loop (n), or go back to the loop (null).
  hold(p, n) {
    const holding = n !== null;
    if (holding === p.held) return;
    p.held = holding;
    if (holding) {
      p.sprite.stop();
      p.sprite.setFrame(p.sprite.frameOf(n));
    } else if (p.anim && !this.calm) p.sprite.play(p.anim);
  }

  walk(p, d, dt) {
    const { walk } = p.cfg;
    const near = Math.abs(d) < NEAR;
    if (this.calm || near) {
      // stand, face you, and wave if they have a wave
      if (near) p.sprite.setFlipX(d < 0);
      this.hold(p, near && walk.near !== undefined ? walk.near : (walk.still ?? 0));
      return;
    }
    this.hold(p, null);
    p.x += p.dir * walk.speed * dt;
    if (p.x >= walk.to) (p.x = walk.to), (p.dir = -1);
    else if (p.x <= walk.from) (p.x = walk.from), (p.dir = 1);
    p.sprite.setX(Math.round(p.x)).setFlipX(p.dir < 0);
  }

  ride(p, dt) {
    if (this.calm) return;
    p.x += p.cfg.ride.speed * dt;
    if (p.x > WORLD.width + RIDE_MARGIN) p.x = -RIDE_MARGIN;
    p.sprite.setX(Math.round(p.x));
  }
}
