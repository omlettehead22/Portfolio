// The publications library opens a book instead of the usual project window.
// Like that window it is plain HTML in a native <dialog>: keyboard focus stays
// inside, Esc closes it, and the text is real text with real links.
//
// The book is the pixel art in public/assets/book/ (cut by tools/process_assets.py
// from art-src/books.png), drawn at a whole-number scale so its pixels stay square.
// Wide screens: the open spread is the book, the cover swings open over it, and a
// page turns through the three drawn turn frames. Phones: the two pages stack,
// each framed in parchment, and the cover swings away over the whole book.
// With reduced motion the book opens and turns without animating.

import { play } from "../audio.js";

const $ = (id) => document.getElementById(id);
const known = (s) => Boolean(s) && !/^\s*TODO/i.test(String(s));
const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const narrow = () => window.matchMedia("(max-width: 640px)").matches;

// Sizes of the art, in art pixels (also in public/assets/book/book.json).
const SPREAD = { w: 57, h: 37 };
const COVER = { w: 55, h: 71 };
const TURN_H = 42; // turn frames are taller: the lifted page rises above the book
const NAV_H = 52; // the Previous / Next bar under the book, in screen pixels

const OPEN_MS = 1000;
const FRAME_MS = 85; // each drawn turn frame
const TURN_FRAMES = ["turn1", "turn2", "turn3"];

const paperName = (p) => (known(p.title) ? p.title : `Article in ${p.venue}`);

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
}

// Authors as one line, with the site owner's own name in bold.
function authorLine(authors, owner) {
  const line = el("p", { className: "bk-authors" });
  authors.filter(known).forEach((name, i) => {
    if (i) line.append(", ");
    line.append(name === owner ? el("strong", {}, name) : name);
  });
  return line.childNodes.length ? line : null;
}

function renderPaper(paper, owner) {
  const meta = [paper.type, known(paper.year) ? paper.year : null].filter(Boolean).join(" · ");
  const venue = [paper.venue, paper.publisher].filter(known).join(". ");
  const findings = (paper.findings ?? []).filter(known);
  const links = el("p", { className: "bk-links" });
  if (known(paper.url)) {
    links.append(el("a", { href: paper.url, target: "_blank", rel: "noopener", textContent: "Read the paper" }));
  }
  if (known(paper.doi)) {
    links.append(
      el("span", { className: "bk-doi" }, "DOI ", el("a", { href: `https://doi.org/${paper.doi}`, target: "_blank", rel: "noopener", textContent: paper.doi }))
    );
  }
  return [
    el("p", { className: "bk-kind", textContent: meta }),
    el("h3", { id: "bk-title", textContent: paperName(paper) }),
    authorLine(paper.authors ?? [], owner),
    venue ? el("p", { className: "bk-venue", textContent: venue }) : null,
    known(paper.summary) ? el("p", { className: "bk-summary", textContent: paper.summary }) : null,
    findings.length ? el("ul", { className: "bk-findings" }, ...findings.map((f) => el("li", { textContent: f }))) : null,
    links.childNodes.length ? links : null,
    known(paper.summary) ? null : el("p", { className: "bk-soon", textContent: "A summary is on its way." }),
  ].filter(Boolean);
}

// The biggest whole-number scale at which the art fits the window.
function fitScale() {
  const w = window.innerWidth - 32;
  const h = window.innerHeight - 24;
  if (narrow()) return Math.max(2, Math.min(5, Math.floor(Math.min(w / COVER.w, (h * 0.8) / COVER.h))));
  return Math.max(4, Math.min(20, Math.floor(Math.min(w / SPREAD.w, (h - NAV_H) / TURN_H))));
}

export function setupBook(opts) {
  const { onOpen, onClose } = opts;
  const dialog = $("book");
  const book = $("bk");
  const cover = $("bk-cover");
  const flip = $("bk-flip");
  const page = $("bk-paper");
  const left = book.querySelector(".bk-left");
  const index = $("bk-index");
  const prev = $("bk-prev");
  const next = $("bk-next");
  const count = $("bk-count");
  let papers = [];
  let at = 0;
  let turning = null; // the page turn in progress: { finish() }

  // Sprite paths come from the page's base, made absolute: a relative url() in a
  // custom property is read against the stylesheet's folder, not the page's.
  const art = (name) => new URL(`${import.meta.env.BASE_URL}assets/book/${name}.png`, document.baseURI).href;
  book.style.setProperty("--spread", `url(${art("spread")})`);
  book.style.setProperty("--paper", `url(${art("paper")})`);
  cover.style.backgroundImage = `url(${art("cover")})`;
  // fetch the turn frames ahead, so the first turn does not flash
  for (const f of TURN_FRAMES) new Image().src = art(f);

  function rescale() {
    const px = fitScale();
    book.style.setProperty("--px", `${px}px`);
    // the cover has its own whole-number scale: the one that makes it about as
    // tall as the open book (on a phone it sets the scale itself)
    book.style.setProperty("--cpx", `${narrow() ? px : Math.max(1, Math.round((px * SPREAD.h) / COVER.h))}px`);
  }
  window.addEventListener("resize", () => dialog.open && rescale());

  $("bk-close").addEventListener("click", () => dialog.close());
  let pressedBackdrop = false;
  dialog.addEventListener("pointerdown", (e) => {
    pressedBackdrop = e.target === dialog;
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog && pressedBackdrop) dialog.close();
    pressedBackdrop = false;
  });
  dialog.addEventListener("close", () => {
    turning?.finish();
    for (const a of book.getAnimations({ subtree: true })) a.finish();
    onClose();
  });
  prev.addEventListener("click", () => show(at - 1));
  next.addEventListener("click", () => show(at + 1));
  dialog.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") show(at + 1);
    else if (e.key === "ArrowLeft" || e.key === "PageUp") show(at - 1);
    else return;
    e.preventDefault();
  });

  function fill(i) {
    at = i;
    page.replaceChildren(...renderPaper(papers[i], opts.owner ?? ""));
    count.textContent = `Page ${i + 1} of ${papers.length}`;
    prev.disabled = i === 0;
    next.disabled = i === papers.length - 1;
    index.querySelectorAll("button").forEach((b, j) => {
      if (j === i) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    page.scrollTop = 0;
  }

  function show(i, focusPage = false) {
    if (i < 0 || i >= papers.length || i === at) return;
    turning?.finish();
    const forward = i > at;
    if (calm()) fill(i);
    else {
      turning = narrow() ? slidePage(i, forward) : turnPage(i, forward);
      play("page");
    }
    if (focusPage) page.focus({ preventScroll: true });
  }

  // Wide: play the drawn turn frames over the spread. Going back, the same
  // frames are mirrored, so the left page lifts and comes over to the right.
  // The paper's text fades out as the page lifts and back in once it lands.
  function turnPage(i, forward) {
    flip.classList.toggle("back", !forward);
    let timer = 0;
    let step = 0;
    const fade = page.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FRAME_MS, fill: "forwards" });
    const frame = () => {
      if (step < TURN_FRAMES.length) {
        flip.style.backgroundImage = `url(${art(TURN_FRAMES[step++])})`;
        flip.hidden = false;
        if (step === 2) fill(i); // the new page is underneath while the leaf is up
        timer = setTimeout(frame, FRAME_MS);
      } else end();
    };
    const end = () => {
      clearTimeout(timer);
      if (at !== i) fill(i);
      flip.hidden = true;
      fade.cancel();
      if (!calm()) page.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
      if (turning === handle) turning = null;
    };
    const handle = { finish: end };
    frame();
    return handle;
  }

  // Phone: the page slides off to one side and the next slides in from the other.
  function slidePage(i, forward) {
    const d = forward ? -1 : 1;
    const out = page.animate([{ transform: "none", opacity: 1 }, { transform: `translateX(${d * 30}%)`, opacity: 0 }], {
      duration: 160,
      easing: "ease-in",
    });
    let back = null;
    const end = () => {
      out.cancel();
      back?.finish();
      if (at !== i) fill(i);
      if (turning === handle) turning = null;
    };
    const handle = { finish: end };
    out.onfinish = () => {
      fill(i);
      back = page.animate([{ transform: `translateX(${-d * 30}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], {
        duration: 200,
        easing: "ease-out",
      });
      back.onfinish = () => turning === handle && (turning = null);
    };
    return handle;
  }

  // The closed book, then its cover swings open on the spine. On a wide screen
  // only the right half of the spread shows at first, under the cover, centred;
  // the left half opens out as the cover swings over to that side.
  function openAnimation() {
    if (calm()) return;
    const wide = !narrow();
    if (wide) {
      const shut = { transform: "translateX(-25%)", clipPath: "inset(-60px -60px -60px 50%)" };
      book.animate([shut, { ...shut, offset: 0.25 }, { transform: "none", clipPath: "inset(-60px -60px -60px 0%)" }], {
        duration: OPEN_MS,
        easing: "ease-in-out",
      });
    }
    cover.animate(
      [
        { transform: "rotateY(0deg)", visibility: "visible" },
        { transform: "rotateY(0deg)", visibility: "visible", offset: 0.25 },
        { transform: `rotateY(${wide ? -180 : -120}deg)`, visibility: "visible" },
      ],
      { duration: OPEN_MS, easing: "cubic-bezier(.5,0,.3,1)" }
    );
    for (const p of [left, page]) {
      p.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: OPEN_MS });
    }
  }

  return function open(entry) {
    if (dialog.open) return;
    pressedBackdrop = false;
    papers = entry.papers ?? [];
    $("bk-heading").textContent = entry.title;
    $("bk-sub").textContent = entry.summary ?? "";
    index.replaceChildren(
      ...papers.map((p, i) => {
        const b = el("button", { type: "button" }, el("span", { className: "bk-n", textContent: `${i + 1}.` }), " ", paperName(p));
        b.addEventListener("click", () => show(i, true));
        return el("li", {}, b);
      })
    );
    at = -1;
    fill(0);
    rescale();
    dialog.showModal();
    // start on the paper itself, not the first contents entry
    page.focus({ preventScroll: true });
    openAnimation();
    onOpen(entry);
  };
}
