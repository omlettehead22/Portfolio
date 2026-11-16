import { controls } from "../state.js";

// On-screen buttons, shown only where the main way of pointing is a finger.
// A laptop with a touchscreen keeps the keyboard layout until it is actually touched.
export function setupTouch({ onAction }) {
  const root = document.getElementById("touch");

  const show = () => {
    root.hidden = false;
    document.body.classList.add("touch");
  };
  if (window.matchMedia("(pointer: coarse)").matches) show();
  else window.addEventListener("touchstart", show, { once: true, passive: true });

  for (const btn of root.querySelectorAll("[data-hold]")) {
    const name = btn.dataset.hold;
    const set = (down) => (e) => {
      e.preventDefault();
      controls[name] = down;
      btn.classList.toggle("down", down);
      if (down) btn.setPointerCapture?.(e.pointerId);
    };
    btn.addEventListener("pointerdown", set(true));
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      btn.addEventListener(type, set(false));
    }
  }

  for (const btn of root.querySelectorAll("[data-tap]")) {
    btn.addEventListener("click", onAction);
  }

  // stop long-presses opening the context menu or selecting the button labels
  root.addEventListener("contextmenu", (e) => e.preventDefault());

  return {
    release() {
      controls.left = controls.right = controls.jump = false;
      for (const b of root.querySelectorAll(".down")) b.classList.remove("down");
    },
  };
}
