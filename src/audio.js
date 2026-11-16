// Tiny synthesised sound effects: no audio files to download.
// Sound is off until the visitor turns it on.

let ctx = null;
let enabled = false;

const SOUNDS = {
  jump: [{ from: 320, to: 560, at: 0, len: 0.12 }],
  open: [
    { from: 440, to: 440, at: 0, len: 0.08 },
    { from: 660, to: 660, at: 0.08, len: 0.12 },
  ],
  close: [
    { from: 660, to: 660, at: 0, len: 0.08 },
    { from: 440, to: 440, at: 0.08, len: 0.12 },
  ],
};

export function setSound(on) {
  enabled = on;
  if (on && !ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (on && ctx?.state === "suspended") ctx.resume();
  if (on) play("open");
}

export const soundOn = () => enabled;

export function play(name) {
  if (!enabled || !ctx) return;
  for (const n of SOUNDS[name] ?? []) {
    const t = ctx.currentTime + n.at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(n.from, t);
    osc.frequency.linearRampToValueAtTime(n.to, t + n.len);
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + n.len);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + n.len);
  }
}
