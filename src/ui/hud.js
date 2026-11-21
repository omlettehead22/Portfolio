import { isFrozen } from "../state.js";
import { START_HINT } from "../config.js";

// Everything drawn over or under the game that follows it frame by frame: the
// "Press E" prompt, an NPC's speech bubble, the how-to-walk hint, the minimap
// marker, and on phones the card for the building you are at.
//
// The game reports positions every frame. Only touch the page when something
// has actually changed: writing styles every frame makes the browser redo its
// layout work each time.

const $ = (id) => document.getElementById(id);
const isTouch = () => document.body.classList.contains("touch");

// Show an element over the game at (x, y) in game pixels, centred above the point.
function placer(el) {
  let shown = false;
  let transform = "";
  let half = 0;
  return {
    show(on) {
      if (on !== shown) el.hidden = !(shown = on);
    },
    text(t) {
      if (el.textContent !== t) {
        el.textContent = t;
        half = el.offsetWidth / 2 + 4; // measure when the text changes, not every frame
      }
    },
    measure() {
      half = el.offsetWidth / 2 + 4;
    },
    move(x, y, zoom, width) {
      const cx = Math.round(Math.min(Math.max(x * zoom, half), width * zoom - half));
      const t = `translate(${cx}px, ${Math.round(y * zoom)}px) translate(-50%, -100%)`;
      if (t !== transform) el.style.transform = transform = t;
    },
  };
}

export function setupHud(game, { onOpen }) {
  const prompt = placer($("prompt"));
  const speech = placer($("speech"));
  const hint = placer($("hint"));
  const promptTitle = $("prompt-title");
  const mmPlayer = $("mm-player");
  const nearby = $("nearby");
  const nb = { kicker: $("nb-kicker"), title: $("nb-title"), summary: $("nb-summary"), open: $("nb-open") };

  let lastNear;
  let lastLeft = "";
  let lastCard = "";
  let cardTarget = null;
  nb.open.addEventListener("click", () => cardTarget && onOpen());

  game.events.on("hud", (hud) => {
    const zoom = game.registry.get("zoom") || 1;
    const width = game.scale.width;
    const frozen = isFrozen();
    const touch = isTouch();

    // "Press E" at a door
    const showPrompt = Boolean(hud.near) && !frozen;
    prompt.show(showPrompt);
    if (showPrompt) {
      if (hud.near !== lastNear) {
        promptTitle.textContent = `· ${hud.near.draft ? "Coming soon" : hud.near.title}`;
        prompt.measure();
      }
      prompt.move(hud.x, hud.y, zoom, width);
    }
    lastNear = showPrompt ? hud.near : null;

    // an NPC's line
    const talk = !frozen && hud.talk;
    speech.show(Boolean(talk));
    if (talk) {
      speech.text(touch ? talk.say.touch : talk.say.keys);
      speech.move(talk.x, talk.y, zoom, width);
    }

    // how to walk
    const showHint = !frozen && hud.hint && !talk;
    hint.show(Boolean(showHint));
    if (showHint) {
      hint.text(touch ? START_HINT.touch : START_HINT.keys);
      hint.move(hud.hint.x, hud.hint.y, zoom, width);
    }

    // minimap marker
    const left = `${(hud.progress * 100).toFixed(1)}%`;
    if (left !== lastLeft) mmPlayer.style.left = lastLeft = left;

    // phone card: the building you are at, or which way the nearest project is
    if (!touch) return;
    const at = hud.near;
    let card;
    if (at) {
      card = at.draft
        ? ["You are at", "Coming soon", "This building is waiting for its project.", true]
        : [at.kind === "about" ? "Welcome" : "You are at", at.title, at.summary, true];
    } else if (hud.next) {
      const arrow = hud.next.dir < 0 ? "←" : "→";
      card = [`Next project ${arrow}`, hud.next.project.title, hud.next.project.summary, false];
    } else card = ["", "", "", false];
    const key = card.join("|");
    if (key !== lastCard) {
      lastCard = key;
      [nb.kicker.textContent, nb.title.textContent, nb.summary.textContent] = card;
      nb.open.hidden = !card[3];
      cardTarget = card[3] ? at : null;
      nearby.hidden = !card[1];
    }
  });
}
