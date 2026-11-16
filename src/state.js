// Shared between the Phaser scenes and the HTML interface around them.

// Held state of the on-screen touch buttons. Keyboard input is read inside the scene.
export const controls = { left: false, right: false, jump: false };

// The world stands still while any of these is true.
export const ui = { intro: true, paused: false, modal: false };

export const isFrozen = () => ui.intro || ui.paused || ui.modal;

// localStorage can be unavailable (private mode, blocked cookies), so never let it throw.
export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* nothing to do: the game works without saving */
    }
  },
};
