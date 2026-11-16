import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = import.meta.dirname;
const dataFile = resolve(root, "public/projects.json");

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const list = (items, render) => items.map((i) => `<li>${render(i)}</li>`).join("");

// Fills {{owner}}, {{tagline}}, {{github}} and {{projects}} in the HTML pages from
// public/projects.json, so the list page is plain HTML and the game and the list
// always show the same content.
function projectsHtml() {
  return {
    name: "projects-html",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const { site, projects } = JSON.parse(readFileSync(dataFile, "utf8"));
        const articles = projects
          .map(
            (p) => `
      <article id="${esc(p.id)}">
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.summary)}</p>
        <h3>Key results</h3>
        <ul>${list(p.results, esc)}</ul>
        <h3>Tools used</h3>
        <ul class="chips">${list(p.tools, esc)}</ul>
        <h3>Links</h3>
        <ul class="links">${list(p.links, (l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`)}</ul>
      </article>`
          )
          .join("\n");
        return html
          .replaceAll("{{owner}}", esc(site.owner))
          .replaceAll("{{tagline}}", esc(site.tagline))
          .replaceAll("{{github}}", esc(site.github))
          .replace("{{projects}}", articles);
      },
    },
    configureServer(server) {
      // reload the pages when the data changes during development
      server.watcher.add(dataFile);
      server.watcher.on("change", (file) => {
        if (file === dataFile) server.ws.send({ type: "full-reload" });
      });
    },
  };
}

export default defineConfig({
  // GitHub Pages serves this repo at https://<user>.github.io/Portfolio/.
  // The deploy workflow passes the real repo name in BASE_PATH, so a rename needs no edit here.
  base: process.env.BASE_PATH ?? "/Portfolio/",
  plugins: [projectsHtml()],
  resolve: {
    alias: {
      // Phaser's build without the Matter physics engine, which this game does not use (about 110 kB smaller).
      phaser: resolve(root, "node_modules/phaser/dist/phaser-arcade-physics.min.js"),
    },
  },
  build: {
    rollupOptions: {
      input: { main: resolve(root, "index.html"), projects: resolve(root, "projects.html") },
    },
    chunkSizeWarningLimit: 1200, // Phaser is one large file; it is loaded on demand
  },
});
