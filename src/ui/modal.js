// The project window is ordinary HTML, not drawn by the game, so its text is
// selectable, its links are real links and screen readers can read it.
// A native <dialog> opened with showModal() keeps keyboard focus inside it and
// closes on Esc without extra code.

const $ = (id) => document.getElementById(id);

function fillList(ul, items, render) {
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

  return function open(project) {
    if (dialog.open) return;
    pressedBackdrop = false;
    $("pm-title").textContent = project.title;
    $("pm-summary").textContent = project.summary;
    fillList($("pm-results"), project.results, (text) => text);
    fillList($("pm-tools"), project.tools, (text) => text);
    fillList($("pm-links"), project.links, (link) => {
      const a = document.createElement("a");
      a.href = link.url;
      a.textContent = link.label;
      a.target = "_blank";
      a.rel = "noopener";
      return a;
    });
    dialog.showModal();
    dialog.querySelector(".card").scrollTop = 0;
    onOpen(project);
  };
}
