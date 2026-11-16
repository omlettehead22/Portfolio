import { VIEW } from "./config.js";

// Pixel art only stays sharp when every game pixel covers a whole number of
// screen pixels. So instead of stretching to fit, pick the largest whole-number
// zoom that fits the space, then widen or narrow the view to use what is left.
export function fitGame(game, stage, viewport) {
  const apply = () => {
    const dpr = window.devicePixelRatio || 1;
    const availW = stage.clientWidth;
    const availH = stage.clientHeight;
    if (!availW || !availH) return;

    // zoom counted in physical screen pixels, so it is exact on high-density screens too
    const zoomDevice = Math.max(
      1,
      Math.floor(Math.min((availW * dpr) / VIEW.minWidth, (availH * dpr) / VIEW.height))
    );
    const zoom = zoomDevice / dpr; // the same zoom in CSS pixels
    const width = Math.max(160, Math.min(VIEW.maxWidth, Math.floor(availW / zoom)));

    if (game.scale.width !== width || game.scale.zoom !== zoom) {
      game.scale.setZoom(zoom);
      game.scale.resize(width, VIEW.height);
    }
    // Phaser leaves the canvas's CSS size alone at zoom 1, so always set it here.
    const cssW = `${width * zoom}px`;
    const cssH = `${VIEW.height * zoom}px`;
    Object.assign(game.canvas.style, { width: cssW, height: cssH });
    Object.assign(viewport.style, { width: cssW, height: cssH });
    viewport.style.setProperty("--zoom", zoom);
    game.registry.set("zoom", zoom);
  };

  apply();
  new ResizeObserver(apply).observe(stage);
  window.addEventListener("orientationchange", apply);
  return apply;
}
