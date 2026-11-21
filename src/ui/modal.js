// The project window is ordinary HTML, not drawn by the game, so its text is
// selectable, its links are real links and screen readers can read it.
// A native <dialog> opened with showModal() keeps keyboard focus inside it and
// closes on Esc without extra code.

const $ = (id) => document.getElementById(id);

const LABELS = { results: "Key results", tools: "Tools used", links: "Links" };

// A link whose address is still a TODO placeholder is left out rather than
// shown broken: it appears once the address is filled in.
export const isReal = (link) => Boolean(link.url) && !/^\s*TODO/i.test(link.url);

// Shown for a building that does not have its project yet.
const DRAFT = {
  title: "Coming soon",
  summary: "This building is waiting for its project. Check back later.",
  results: [],
  tools: [],
  links: [],
};

function fillList(ul, items, render) {
  // hide the list and its heading when there is nothing to show
  ul.hidden = ul.previousElementSibling.hidden = items.length === 0;
  ul.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      li.append(render(item));
      return li;
    })
  );
}

export function setupModal({ onOpen, onClose }) {
  const dialog = $("project-modal");

  $("pm-close").addEventListener("click", () => dialog.close());
  // A click on the dimmed area around the card lands on the dialog element itself.
  // Only count it if the press started there too: the tap that opened the window
  // ends after the window has appeared, and must not close it again.
  let pressedBackdrop = false;
  dialog.addEventListener("pointerdown", (e) => {
    pressedBackdrop = e.target === dialog;
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog && pressedBackdrop) dialog.close();
    pressedBackdrop = false;
  });
  dialog.addEventListener("close", onClose);

  return function open(entry) {
    if (dialog.open) return;
    pressedBackdrop = false;
    const project = entry.draft ? { ...DRAFT, id: entry.id } : entry;
    $("pm-title").textContent = project.title;
    $("pm-summary").textContent = project.summary;
    $("pm-role").textContent = project.role ?? "";
    $("pm-role").hidden = !project.role;
    for (const key of Object.keys(LABELS)) $(`pm-h-${key}`).textContent = project.labels?.[key] ?? LABELS[key];
    fillList($("pm-results"), project.results, (text) => text);
    fillList($("pm-tools"), project.tools, (text) => text);
    fillList($("pm-links"), project.links.filter(isReal), (link) => {
      const a = document.createElement("a");
      a.href = link.url;
      a.textContent = link.label;
      if (!link.url.startsWith("mailto:")) {
        a.target = "_blank";
        a.rel = "noopener";
      }
      return a;
    });
    dialog.showModal();
    dialog.querySelector(".card").scrollTop = 0;
    onOpen(entry);
  };
}
