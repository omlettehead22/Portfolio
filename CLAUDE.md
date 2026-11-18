# Portfolio

A side-scrolling pixel-art portfolio: the visitor walks along a night-time street and each building opens one project. Built with Vite and Phaser 3, deployed to GitHub Pages.

## Commands

- `npm run dev`: dev server at http://localhost:5173/Portfolio/
- `npm run build`: production build into `dist/`
- `npm run preview`: serve the production build
- `npm run assets`: rebuild `public/assets/*.png` from `art-src/` (needs Python with Pillow, NumPy and SciPy)

## Where things live

- `public/projects.json`: all project content and building positions. The game, the project window and the list page all read this one file. A project's `sprite` is a building name from `public/assets/buildings.json`. Entries with `"draft": true` are buildings still waiting for a project: shown as "Coming soon", left off the list page.
- `src/config.js`: movement tuning, world size, parallax speeds, the day/night timetable, street scenery and NPCs.
- `src/scenes/`: Phaser scenes. `Boot` → `Preload` (loads assets, reports progress) → `World` (the street). `ambient.js` holds everything that moves on its own (clouds, birds, shooting stars, plane, city windows, turbine lights, lamps, the hydrogen flare); its settings are `AMBIENT`, `WINDOW_LIGHTS` and `FIXTURES` in `src/config.js`.
- `src/daynight.js`: works out the light for the visitor's local time. `?time=day|dusk|night|dawn|cycle|<hour>` overrides it.
- `src/main.js`, `src/ui/`: the HTML interface around the canvas (intro, project window, touch buttons, minimap, pause).
- `src/scale.js`: whole-number pixel scaling.
- `vite.config.js`: base path, and the plugin that writes the list page from `projects.json`.
- `public/assets/assets.md`: the art brief for each asset. `art-src/` holds the original renders, and `tools/process_assets.py` cuts them into `buildings`, `props` and `character` sprites. New sheets need their sprite boxes added to that script.

## Branches

- `main` deploys to GitHub Pages on every push. Work happens on `dev`; merge to `main` only when the site is ready to publish.

## Rules

- Never invent results or figures. Unknown results are written as `TODO: add result`.
- The project window and the list page are plain HTML, not Phaser objects, and must stay keyboard-accessible.
- Art is drawn on a 480x270 grid. Keep `pixelArt` rendering and whole-number scaling.
- Sprites are read from the source art at one pixel per art pixel (`tools/process_assets.py`, `GRIDS`). Never resize them to a chosen size: that is what makes pixel art look jagged. On screen, only whole-number scales (`scale: 2`).
- One street scale, set by the 38-pixel character (about 22 pixels to the metre). The character sheet's art pixels are twice the size of the other sheets', so buildings and the paving draw at 2x (`BUILDING_SCALE`, `GROUND_SCALE`) and each prop at 1x or 2x, whichever is closer to its real size. Leave out props that fit neither.
- Ambient motion must hold still with "reduce motion" on, and stop while paused.
- Test in a browser before committing: desktop, 360px and 768px wide, by day and by night (`?time=day`, `?time=night`).
