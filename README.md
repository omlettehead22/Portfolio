# Portfolio

My portfolio as a small pixel-art game. Walk along the street and step into a building to read about a project. If you would rather skip the game, there is a plain [list of projects](https://omlettehead22.github.io/Portfolio/projects.html).

**Play it: [omlettehead22.github.io/Portfolio](https://omlettehead22.github.io/Portfolio/)**

## Controls

| | |
|---|---|
| Walk | `←` `→` or `A` `D` |
| Run | hold `Shift` |
| Drop down from crates, the van or the cart | `↓` or `S` |
| Jump | `Space`, `↑` or `W` |
| Open a project | `E` beside a building, or click or tap the building |
| Close a project | `Esc` or the close button |
| Pause | `P` |

On a phone or tablet, on-screen buttons appear: hold ◀ or ▶ to walk (keep holding to run), ▲ to jump, ▼ to drop down, E to open. Held upright, a card under the game shows the building you are at.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173/Portfolio/
npm run build    # production build in dist/
```

## Change the content

**About me** is the `about` entry at the top of [`public/projects.json`](public/projects.json). The welcome hall where you start opens it, as does the About me button and the top of the list page. Fill in the `TODO` fields; a link whose `url` still starts with `TODO` is hidden until it has a real address.

Everything shown about a project is in [`public/projects.json`](public/projects.json): title, summary, results, tools, links, where its building stands (`x`, in pixels along a 3240-pixel street; buildings sit 320 apart) and which building it uses (`sprite`). Add an entry and a building appears; the list page updates too.

Buildings available: `battery_lab`, `pcm_lab`, `hydrogen_plant`, `cold_station`, `sim_centre`, `control_room`, `wind_solar_hub`, `workshop`, `library`, and `home_base` (the welcome hall at the start).

A building waiting for its project is an entry with only `id`, `x`, `sprite` and `"draft": true`. It stands on the street and opens a "Coming soon" window, but is left off the list page and the visited count. To give it a project, add the other fields and delete `"draft": true`.

**Publications** live in the library at the end of the street: the entry with `"kind": "publications"`. Each item in its `papers` list has `title`, `authors` (your own name is shown in bold), `type`, `venue`, `publisher`, `year`, `doi`, `url`, `summary` and `findings`. The library opens as a pixel-art book (from `art-src/books.png`): its cover swings open and the pages turn through drawn frames; ← → or the Previous/Next buttons turn them. A closed book floats over the library door, and an open one once it has been visited. A field still starting with `TODO` is simply left out, so a paper can go up with just its link.

Movement (speed, acceleration, friction, jump), the day/night timetable and the street scenery are in [`src/config.js`](src/config.js).

## Day and night

The street follows your own clock: sun by day, moon, stars and lit lamp posts by night, with dawn and dusk in between. To see another time, add `?time=night` (or `dawn`, `day`, `dusk`, an hour such as `21.5`, or `cycle` for a whole day in a minute) to the address.

## A living street

The wind turbines on the hills turn, and so do the two on the street. Clouds drift and birds cross the sky by day. At night the city windows switch on and off one at a time (fewer of them lit in the small hours), the wind turbines' red aviation lights blink together, shooting stars and a plane's lights cross now and then, street lamps flicker, and the hydrogen plant's flare burns with smoke rising from it. The people on the street breathe and turn to look at you as you pass. All of it holds still for visitors who have "reduce motion" turned on, and stops while the game is paused. The settings are under "Ambient life" in [`src/config.js`](src/config.js).

## Art

The art briefs are in [`public/assets/assets.md`](public/assets/assets.md) and the original renders in `art-src/`. `npm run assets` turns them into the sprites the game loads. Each source picture is pixel art on a regular grid, so the script finds that grid and reads back one colour per art pixel, with no resizing. It then removes the magenta background, merges the shades left by JPEG compression, packs buildings and props into sprite atlases, cuts the background into parallax layers and makes a daylight version of each. It also paints the blades out of the turbines drawn in the hills (the game turns rotors from `art-src/turbines.png` on their hubs instead), makes the rotor frames by rotating the rotor art without blurring it, rebuilds the crate stack so every crate rests flat, and draws the street paving as a seamless running bond in the stone tile's colours.

## Sharing

`public/og.png` is the picture shown when the site's link is pasted into LinkedIn, Slack or a message. To refresh it after the street changes, screenshot the game canvas at 2x zoom (960x540) and run `python3 tools/make_preview_image.py screenshot.png`. Missing pages show `404.html`.

## Built with

[Phaser 3](https://phaser.io) and [Vite](https://vite.dev). Deployed to GitHub Pages by the workflow in `.github/workflows/deploy.yml`.
