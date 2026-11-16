# Portfolio

A side-scrolling pixel-art portfolio: the visitor walks along a night-time street and each building opens one project. Built with Vite and Phaser 3, deployed to GitHub Pages.

## Commands

- `npm run dev`: dev server at http://localhost:5173/Portfolio/
- `npm run build`: production build into `dist/`
- `npm run preview`: serve the production build
- `npm run assets`: rebuild `public/assets/*.png` from `art-src/` (needs Python with Pillow, NumPy and SciPy)

## Where things live

- `public/projects.json`: all project content and building positions. The game, the project window and the list page all read this one file.
- `src/config.js`: tuning values (speed, gravity, jump), world size, parallax speeds, street props.
- `src/scenes/`: Phaser scenes. `Boot` → `Preload` (loads assets, reports progress) → `World` (the street).
- `src/main.js`, `src/ui/`: the HTML interface around the canvas (intro, project window, touch buttons, minimap, pause).
- `src/scale.js`: whole-number pixel scaling.
- `vite.config.js`: base path, and the plugin that writes the list page from `projects.json`.
- `public/assets/assets.md`: the art brief for each asset. `art-src/` holds the original renders.

## Rules

- Never invent results or figures. Unknown results are written as `TODO: add result`.
- The project window and the list page are plain HTML, not Phaser objects, and must stay keyboard-accessible.
- Art is drawn on a 480x270 grid. Keep `pixelArt` rendering and whole-number scaling.
- Test in a browser before committing: desktop, 360px and 768px wide.
