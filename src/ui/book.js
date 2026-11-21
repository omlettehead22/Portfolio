// The publications library opens a book instead of the usual project window.
// Like that window it is plain HTML in a native <dialog>: keyboard focus stays
// inside, Esc closes it, and the text is real text with real links.
//
// Opening: the closed book sits centred, then its cover swings open on the spine
// while the book slides over so the spread is centred. Turning to another paper
// lifts a leaf (a copy of the page being left) over the spine. Both are skipped
// when the visitor asks for reduced motion.

import { play } from "../audio.js";

const $ = (id) => document.getElementById(id);
const known = (s) => Boolean(s) && !/^\s*TODO/i.test(String(s));
const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// One page at a time on a narrow screen: the spread is stacked, not side by side.
const narrow = () => window.matchMedia("(max-width: 640px)").matches;

const OPEN_MS = 900;
const TURN_MS = 650;

// A paper with no title yet is named by where it appeared.
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

export function setupBook(opts) {
  const { onOpen, onClose } = opts;
  const dialog = $("book");
  const book = $("bk");
  const cover = $("bk-cover");
  const page = $("bk-paper");
  const index = $("bk-index");
  const prev = $("bk-prev");
  const next = $("bk-next");
  const count = $("bk-count");
  let papers = [];
  let at = 0;
  let turning = null; // the running page-turn animation, if any

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
    for (const a of book.getAnimations({ subtree: true })) a.finish();
    onClose();
  });
  prev.addEventListener("click", () => show(at - 1));
  next.addEventListener("click", () => show(at + 1));
  dialog.addEventListener("keydown", (e) => {
    // arrow keys turn pages, except while typing or on a link's own business
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

  // Turn to paper i. Forward: the leaf carries the old page over the spine.
  // Back: the new page comes over from the left and settles on the right.
  function show(i, focusPage = false) {
    if (i < 0 || i >= papers.length || i === at) return;
    turning?.finish();
    const forward = i > at;
    if (calm()) {
      fill(i);
    } else {
      if (forward) {
        const leaf = makeLeaf();
        fill(i);
        turning = animateLeaf(leaf, [0, -180]);
      } else {
        fill(i);
        turning = animateLeaf(makeLeaf(), [-180, 0]);
      }
      play("page");
    }
    if (focusPage) page.focus({ preventScroll: true });
  }

  // A leaf is a copy of what the right-hand page shows right now; on its back
  // is a blank sheet of the same paper.
  function makeLeaf() {
    const front = el("div", { className: "bk-face bk-front" }, ...[...page.childNodes].map((n) => n.cloneNode(true)));
    for (const n of front.querySelectorAll("[id]")) n.removeAttribute("id");
    const leaf = el("div", { className: "bk-leaf" }, front, el("div", { className: "bk-face bk-back" }));
    leaf.setAttribute("aria-hidden", "true");
    leaf.inert = true;
    page.parentElement.append(leaf);
    return leaf;
  }

  function animateLeaf(leaf, [from, to]) {
    // on a phone there is no left page to land on: the leaf lifts away instead
    const end = narrow() ? (to === 0 ? 0 : -100) : to;
    const start = narrow() && from === -180 ? -100 : from;
    // (opacity only on a phone: animating it makes the browser flatten the leaf,
    // and the back of the page would show the front's writing mirrored)
    const frame = (deg) => (narrow() ? { transform: `rotateY(${deg}deg)`, opacity: deg === 0 ? 1 : 0 } : { transform: `rotateY(${deg}deg)` });
    const frames = [frame(start), frame(end)];
    const anim = leaf.animate(frames, { duration: TURN_MS, easing: "cubic-bezier(.45,.05,.35,1)" });
    const done = () => {
      leaf.remove();
      if (turning === anim) turning = null;
    };
    anim.onfinish = done;
    anim.oncancel = done;
    return anim;
  }

  function openAnimation() {
    if (calm()) return;
    const wide = !narrow();
    // Closed, only the cover half shows, centred; the left half opens out from
    // the spine as the cover swings over to that side.
    if (wide) {
      const shut = { transform: "translateX(-25%)", clipPath: "inset(-20px -20px -20px 50%)" };
      book.animate(
        [shut, { ...shut, offset: 0.2 }, { transform: "none", clipPath: "inset(-20px -20px -20px 0%)" }],
        { duration: OPEN_MS, easing: "ease-in-out" }
      );
    }
    cover.animate(
      [
        { transform: "rotateY(0deg)", visibility: "visible" },
        { transform: "rotateY(0deg)", offset: 0.2 },
        { transform: `rotateY(${wide ? -180 : -110}deg)`, visibility: "visible" },
      ],
      { duration: OPEN_MS, easing: "cubic-bezier(.5,0,.3,1)" }
    );
    // the pages are there under the cover; the writing fades in as it opens
    for (const p of book.querySelectorAll(".bk-page")) {
      p.animate([{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1 }], { duration: OPEN_MS });
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
    dialog.showModal();
    openAnimation();
    onOpen(entry);
  };
}
