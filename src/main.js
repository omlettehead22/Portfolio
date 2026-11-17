import { ui, isFrozen, store } from "./state.js";
import { STORAGE, WORLD } from "./config.js";
import { setSound, soundOn, play } from "./audio.js";
import { setupModal } from "./ui/modal.js";
import { setupTouch } from "./ui/touch.js";
import { fitGame } from "./scale.js";

const $ = (id) => document.getElementById(id);

const stage = $("stage");
const viewport = $("viewport");
const intro = $("intro");
const startBtn = $("start");
const pauseBtn = $("pause-toggle");
const soundBtn = $("sound-toggle");
const introSound = $("intro-sound");
const pausedVeil = $("paused");
const prompt = $("prompt");
const promptTitle = $("prompt-title");
const minimap = $("minimap");
const mmPlayer = $("mm-player");
const mmCount = $("mm-count");

let game = null;
let projects = [];
const visited = new Set(store.get(STORAGE.visited, []));

const focusGame = () => game?.canvas?.focus({ preventScroll: true });

// --- sound (off by default) --------------------------------------------------
function applySound(on) {
  setSound(on);
  soundBtn.textContent = `Sound: ${on ? "on" : "off"}`;
  soundBtn.setAttribute("aria-pressed", String(on));
  introSound.checked = on;
}
soundBtn.addEventListener("click", () => {
  applySound(!soundOn());
  if (!ui.intro) focusGame();
});
introSound.addEventListener("change", () => applySound(introSound.checked));

// --- pause -------------------------------------------------------------------
function setPaused(paused) {
  if (ui.intro || ui.modal) return;
  ui.paused = paused;
  pausedVeil.hidden = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  pauseBtn.setAttribute("aria-pressed", String(paused));
  touch.release();
  if (paused) $("resume").focus();
  else focusGame();
}
pauseBtn.addEventListener("click", () => setPaused(!ui.paused));
$("resume").addEventListener("click", () => setPaused(false));
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game && !isFrozen()) setPaused(true);
});

// --- project window ----------------------------------------------------------
const openModal = setupModal({
  onOpen(project) {
    ui.modal = true;
    touch.release();
    play("open");
    if (!project.draft) {
      visited.add(project.id);
      store.set(STORAGE.visited, [...visited]);
      drawVisited();
    }
  },
  onClose() {
    ui.modal = false;
    play("close");
    focusGame();
  },
});

// --- touch buttons -----------------------------------------------------------
const touch = setupTouch({ onAction: () => game?.events.emit("action") });

// --- keyboard shortcuts that belong to the page rather than the game ----------
window.addEventListener("keydown", (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "p" || e.key === "P") setPaused(!ui.paused);
  else if (e.key === "Escape" && ui.paused) setPaused(false);
});

// --- minimap -----------------------------------------------------------------
function buildMinimap() {
  const track = minimap.querySelector(".mm-track");
  for (const p of projects) {
    const dot = document.createElement("span");
    dot.className = p.draft ? "mm-building draft" : "mm-building";
    dot.dataset.id = p.id;
    dot.style.left = `${(p.x / WORLD.width) * 100}%`;
    track.append(dot);
  }
  minimap.hidden = false;
  drawVisited();
}

function drawVisited() {
  for (const dot of minimap.querySelectorAll(".mm-building")) {
    dot.classList.toggle("visited", visited.has(dot.dataset.id));
  }
  const ready = projects.filter((p) => !p.draft);
  const seen = ready.filter((p) => visited.has(p.id)).length;
  mmCount.textContent = ready.length ? `${seen}/${ready.length} visited` : "";
}

// --- intro -------------------------------------------------------------------
startBtn.addEventListener("click", () => {
  ui.intro = false;
  intro.hidden = true;
  pauseBtn.disabled = false;
  focusGame();
});

function showLoadError(message) {
  $("load-text").textContent = message;
  $("load-bar").hidden = true;
  $("loading").classList.add("error");
}

// --- start the game ----------------------------------------------------------
async function boot() {
  let createGame;
  try {
    ({ createGame } = await import("./game.js"));
  } catch {
    showLoadError("The game could not be loaded. The project list still works.");
    return;
  }

  game = createGame("game");
  if (import.meta.env.DEV) window.__game = game; // handy in the browser console while developing
  game.canvas.tabIndex = 0;
  game.canvas.setAttribute(
    "aria-label",
    "Game: a night-time street with one building for each project. The same content is on the View as list page."
  );
  fitGame(game, stage, viewport);

  game.events.on("load-progress", (p) => ($("load-bar").value = p));
  game.events.on("load-failed", (keys) =>
    showLoadError(`Could not load: ${keys.join(", ")}. The project list still works.`)
  );

  game.events.on("world-ready", (data) => {
    projects = data.projects;
    buildMinimap();
    $("loading").hidden = true;
    startBtn.disabled = false;
    startBtn.textContent = store.get(STORAGE.position, null) === null ? "Start" : "Continue";
    startBtn.focus({ preventScroll: true });
  });

  game.events.on("open-project", openModal);

  // The scene reports where the prompt and the minimap marker belong each frame.
  let lastNear;
  game.events.on("hud", (hud) => {
    const zoom = game.registry.get("zoom") || 1;
    const show = hud.near && !isFrozen();
    prompt.hidden = !show;
    if (show) {
      if (hud.near !== lastNear) promptTitle.textContent = `· ${hud.near.draft ? "Coming soon" : hud.near.title}`;
      const half = prompt.offsetWidth / 2 + 4;
      const max = game.scale.width * zoom;
      const x = Math.min(Math.max(hud.x * zoom, half), max - half);
      prompt.style.transform = `translate(${x}px, ${hud.y * zoom}px) translate(-50%, -100%)`;
    }
    lastNear = hud.near;
    mmPlayer.style.left = `${hud.progress * 100}%`;
  });
}

boot();
