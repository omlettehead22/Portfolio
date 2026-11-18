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

Everything shown about a project is in [`public/projects.json`](public/projects.json): title, summary, results, tools, links, where its building stands (`x`, in pixels along a 3240-pixel street; buildings sit 320 apart) and which building it uses (`sprite`). Add an entry and a building appears; the list page updates too.

Buildings available: `battery_lab`, `pcm_lab`, `hydrogen_plant`, `cold_station`, `sim_centre`, `control_room`, `wind_solar_hub`, `workshop`, `library`, and `home_base` (the welcome hall at the start).

A building waiting for its project is an entry with only `id`, `x`, `sprite` and `"draft": true`. It stands on the street and opens a "Coming soon" window, but is left off the list page and the visited count. To give it a project, add the other fields and delete `"draft": true`.

Movement (speed, acceleration, friction, jump), the day/night timetable and the street scenery are in [`src/config.js`](src/config.js).

## Day and night

The street follows your own clock: sun by day, moon, stars and lit lamp posts by night, with dawn and dusk in between. To see another time, add `?time=night` (or `dawn`, `day`, `dusk`, an hour such as `21.5`, or `cycle` for a whole day in a minute) to the address.

## Art

The art briefs are in [`public/assets/assets.md`](public/assets/assets.md) and the original renders in `art-src/`. `npm run assets` turns them into the sprites the game loads. Each source picture is pixel art on a regular grid, so the script finds that grid and reads back one colour per art pixel, with no resizing. It then removes the magenta background, merges the shades left by JPEG compression, packs buildings and props into sprite atlases, cuts the background into parallax layers and makes a daylight version of each.

## Built with

[Phaser 3](https://phaser.io) and [Vite](https://vite.dev). Deployed to GitHub Pages by the workflow in `.github/workflows/deploy.yml`.
