import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = import.meta.dirname;
const dataFile = resolve(root, "public/projects.json");
const atlasFile = resolve(root, "public/assets/buildings.json");

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const list = (items, render) => items.map((i) => `<li>${render(i)}</li>`).join("");

// A TODO placeholder is not shown as a link (or a role line) until it is filled in.
const isTodo = (s) => !s || /^\s*TODO/i.test(s);
const linkItems = (links) =>
  list(
    links.filter((l) => !isTodo(l.url)),
    (l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`
  );

// The building a project uses, drawn from the game's own sprite sheet.
function thumbnail(sprite, frames, base) {
  const f = frames[sprite]?.frame;
  if (!f) return "";
  return `<div class="thumb" aria-hidden="true" style="width:${f.w}px;height:${f.h}px;background-image:url(${base}assets/buildings.png);background-position:-${f.x}px -${f.y}px"></div>`;
}

function section(p, frames, base, labels = {}) {
  return `
      <article id="${esc(p.id)}">
        ${thumbnail(p.sprite, frames, base)}
        <div class="body">
          <h2>${esc(p.title)}</h2>
          ${isTodo(p.role) ? "" : `<p class="role">${esc(p.role)}</p>`}
          <p>${esc(p.summary)}</p>
          <h3>${esc(labels.results ?? "Key results")}</h3>
          <ul>${list(p.results, esc)}</ul>
          <h3>${esc(labels.tools ?? "Tools used")}</h3>
          <ul class="chips">${list(p.tools, esc)}</ul>
          <h3>${esc(labels.links ?? "Links")}</h3>
          <ul class="links">${linkItems(p.links)}</ul>
        </div>
      </article>`;
}

// The publications library, as a list of papers. Unknown details (TODO) are left out.
function publications(entry, frames, base, owner) {
  if (!entry) return "";
  const paper = (p) => {
    const name = isTodo(p.title) ? `Article in ${p.venue}` : p.title;
    const title = isTodo(p.url) ? esc(name) : `<a href="${esc(p.url)}">${esc(name)}</a>`;
    const authors = (p.authors ?? [])
      .filter((a) => !isTodo(a))
      .map((a) => (a === owner ? `<strong>${esc(a)}</strong>` : esc(a)))
      .join(", ");
    const venue = [p.venue, p.publisher].filter((v) => !isTodo(v)).map(esc).join(". ");
    const meta = [p.type, isTodo(p.year) ? null : p.year].filter(Boolean).map(esc).join(" · ");
    const findings = (p.findings ?? []).filter((f) => !isTodo(f));
    return `
            <li>
              <p class="pub-meta">${meta}</p>
              <h3 class="pub-title">${title}</h3>
              ${authors ? `<p class="pub-authors">${authors}</p>` : ""}
              ${venue ? `<p class="pub-venue">${venue}</p>` : ""}
              ${isTodo(p.summary) ? "" : `<p>${esc(p.summary)}</p>`}
              ${findings.length ? `<ul>${list(findings, esc)}</ul>` : ""}
              ${isTodo(p.doi) ? "" : `<p class="pub-doi">DOI <a href="https://doi.org/${esc(p.doi)}">${esc(p.doi)}</a></p>`}
            </li>`;
  };
  return `
      <h2 class="section-title">${esc(entry.title)}</h2>
      <article id="${esc(entry.id)}" class="pubs">
        ${thumbnail(entry.sprite, frames, base)}
        <div class="body">
          <p>${esc(entry.summary ?? "")}</p>
          <ol class="pub-list">${entry.papers.map(paper).join("")}
          </ol>
        </div>
      </article>`;
}

// Link-preview tags, so a link pasted into LinkedIn, Slack or a message shows
// a picture of the street, a title and a description.
function previewTags(site, title, path) {
  const url = new URL(path, site.url).href;
  const image = new URL("og.png", site.url).href;
  return `
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(site.owner)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(site.tagline)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="A pixel-art street of lab buildings, each one a project" />
    <meta name="twitter:card" content="summary_large_image" />
  `;
}

// Fills the {{…}} placeholders in the HTML pages from public/projects.json, so
// the list page is plain HTML and the game and the list always show the same
// content. Also adds the link-preview tags to every page.
function projectsHtml() {
  let base = "/";
  return {
    name: "projects-html",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const { site, about, projects } = JSON.parse(readFileSync(dataFile, "utf8"));
        const { frames } = JSON.parse(readFileSync(atlasFile, "utf8"));
        const page = ctx.path.split("/").pop() || "index.html";
        const articles = projects
          .filter((p) => !p.draft && !p.kind) // buildings still waiting for a project are left off the list
          .map((p) => section(p, frames, base))
          .join("\n");
        const title = html.match(/<title>(.*?)<\/title>/)?.[1] ?? site.owner;
        const filled = (s) =>
          s
            .replaceAll("{{owner}}", esc(site.owner))
            .replaceAll("{{tagline}}", esc(site.tagline))
            .replaceAll("{{github}}", esc(site.github))
            .replaceAll("{{base}}", base)
            .replaceAll("{{role}}", isTodo(about?.role) ? "" : esc(about.role));
        return filled(html)
          .replace("{{about}}", about ? section(about, frames, base, about.labels) : "")
          .replace("{{projects}}", articles)
          .replace("{{publications}}", publications(projects.find((p) => p.kind === "publications"), frames, base, site.owner))
          .replace("{{thumb}}", thumbnail("library", frames, base))
          .replace("</head>", `${previewTags(site, filled(title), page === "index.html" ? "" : page)}</head>`);
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
      input: {
        main: resolve(root, "index.html"),
        projects: resolve(root, "projects.html"),
        notFound: resolve(root, "404.html"), // GitHub Pages shows this for any missing page
      },
    },
    chunkSizeWarningLimit: 1200, // Phaser is one large file; it is loaded on demand
  },
});
