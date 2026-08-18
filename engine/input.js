// Reusable input handling for games.
//
// Provides a single shared keyboard key-state set plus a way to map
// mobile/screen touches onto desktop keys. Games can register the keys they
// watch and toggle their behavior based on touch via mapTouchToKey.

/**
 * Central input manager. Tracks the set of currently-pressed key codes
 * (a shared `keys` Set) and bridges touch interactions to those keys.
 *
 *   const input = new Input();
 *   input.mapTouchToKey("KeyW");     // tap/hold screen == press W
 *   input.mapTouchToKey("KeyD");     // a second finger == press D
 *   if (input.isDown("KeyW")) { ... }
 */
export class Input {
  constructor() {
    // Shared pressed-key registry (maps `e.code` values).
    this.keys = new Set();
    // touch.identifier -> key code, so multi-touch fingers stay tracked
    this._touchMap = new Map();
    this._bindKeyboard();
  }

  /** True while the given key code is held. */
  isDown(code) {
    return this.keys.has(code);
  }

  _bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") e.preventDefault();
      this.keys.delete(e.code);
    });
    window.addEventListener("blur", () => {
      this.keys.clear();
    });
  }

  /**
   * Maps any touch on the screen to the given key code, so holding a finger
   * down reads the same as holding that desktop key. Supports multi-touch:
   * each finger is tracked independently, and a key only releases when no
   * active touch is mapped to it.
   * @param {string} code - The desktop `e.code` to activate on touch
   * @returns {Input} this, for chaining
   */
  mapTouchToKey(code) {
    const isInteractive = (target) => {
      if (!target || target === document.body || target === document.documentElement) return false;
      if (target.tagName === "CANVAS") return false;
      if (target.closest("button, a, input, select, textarea, [role='button'], [data-interactive]")) return true;
      let cur = target;
      while (cur && cur !== document.body) {
        if (cur.style?.cursor === "pointer" || cur.style?.pointerEvents === "auto" || window.getComputedStyle(cur).cursor === "pointer") {
          return true;
        }
        cur = cur.parentElement;
      }
      return false;
    };

    const addTouches = (e) => {
      if (isInteractive(e.target)) return;

      e.preventDefault();
      for (const touch of e.changedTouches) {
        this._touchMap.set(touch.identifier, code);
      }
      this.keys.add(code);
    };

    const releaseTouches = (e) => {
      let releasedAny = false;
      for (const touch of e.changedTouches) {
        if (this._touchMap.has(touch.identifier)) {
          this._touchMap.delete(touch.identifier);
          releasedAny = true;
        }
      }
      if (releasedAny) {
        e.preventDefault();
      }
      // Only release the key once no remaining touch maps to it.
      if (![...this._touchMap.values()].includes(code)) {
        this.keys.delete(code);
      }
    };

    window.addEventListener("touchstart", addTouches, { passive: false });
    window.addEventListener("touchend", releaseTouches, { passive: false });
    window.addEventListener("touchcancel", releaseTouches, { passive: false });
    return this;
  }

  /**
   * Convenience: map a touch to a key, returning a function that reads
   * whether that key (or its touch) is currently pressed.
   * @param {string} code
   * @returns {() => boolean}
   */
  makeToggle(code) {
    this.mapTouchToKey(code);
    return () => this.isDown(code);
  }
}
