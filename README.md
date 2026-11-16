# Portfolio

My portfolio as a small pixel-art game. Walk along the street and step into a building to read about a project. If you would rather skip the game, there is a plain [list of projects](https://omlettehead22.github.io/Portfolio/projects.html).

**Play it: [omlettehead22.github.io/Portfolio](https://omlettehead22.github.io/Portfolio/)**

## Controls

| | |
|---|---|
| Walk | `←` `→` or `A` `D` |
| Jump | `Space`, `↑` or `W` |
| Open a project | `E` beside a building, or click or tap the building |
| Close a project | `Esc` or the close button |
| Pause | `P` |

On a phone or tablet, on-screen buttons appear.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173/Portfolio/
npm run build    # production build in dist/
```

## Change the content

Everything shown about a project is in [`public/projects.json`](public/projects.json): title, summary, results, tools, links, and where its building stands (`x`, in pixels along a 1440-pixel street). Add an entry and a building appears; the list page updates too.

Player speed, gravity and jump height are at the top of [`src/config.js`](src/config.js).

## Art

The art briefs are in [`public/assets/assets.md`](public/assets/assets.md) and the original renders in `art-src/`. `npm run assets` turns them into the sprites the game loads: it removes the magenta background, shrinks each picture to its pixel grid, cuts the background into three parallax layers, and builds the walk frames from the single standing pose.

## Built with

[Phaser 3](https://phaser.io) and [Vite](https://vite.dev). Deployed to GitHub Pages by the workflow in `.github/workflows/deploy.yml`.
