// Action-based input manager for the engine.
//
// Rather than polling raw key codes (`keys.has("KeyW")`) and touch coordinates
// directly inside a game's update loop, games register named abstract actions
// (digital) and axes (analog) with an InputManager once, then query them by
// name. This decouples gameplay logic from the concrete keys / gestures and
// makes the same control scheme reusable across games.
//
//   const input = new InputManager();
//   // Digital action: true while any bound key is held.
//   input.defineAction("orbit", ["Space"]);
//   // Analog axis: -1..1 (negative keys subtract, positive keys add).
//   input.defineAxis("move", { negative: ["KeyW", "ArrowUp"], positive: ["KeyS", "ArrowDown"] });
//   // Virtual touch stick (available on touch devices; idle otherwise).
//   input.defineStick("drive");
//
//   // Call once per simulation tick, before querying:
//   input.update();
//   const forward = input.axis("move");        // -1 / 0 / 1 (or stick Y on touch)
//   const steer   = input.axis("drive").x;     // -1..1 virtual stick X
//   if (input.isDown("shift"))   slowTurn();
//   if (input.pressed("orbit"))  toggleCamera();   // edge: true for one tick
//
// The virtual stick layers onto a configured axis: on touch, that axis reads
// the stick's normalized deflection for its facing dimension (horizontal ->
// x, vertical -> y), while keyboard still drives it directly.

const isInteractive = (target) => {
  if (
    !target ||
    target === document.body ||
    target === document.documentElement
  )
    return false;
  if (target.tagName === "CANVAS") return false;
  if (target.tagName === "BODY") return false;
  if (
    target.closest(
      "button, a, input, select, textarea, [role='button'], [data-interactive]",
    )
  )
    return true;
  let cur = target;
  while (cur && cur !== document.body) {
    if (
      cur.style?.cursor === "pointer" ||
      cur.style?.pointerEvents === "auto" ||
      window.getComputedStyle(cur).cursor === "pointer"
    ) {
      return true;
    }
    cur = cur.parentElement;
  }
  return false;
};

export class InputManager {
  /**
   * @param {object} [options]
   * @param {number} [options.stickRadius] Normalizing throw radius (px) for a
   *   virtual-stick finger; deflection scales from 0 at the grab point to
   *   ±1 at this many pixels. Defaults to 35% of the shorter screen edge.
   */
  constructor({ stickRadius } = {}) {
    this.stickRadius =
      stickRadius ??
      Math.min(window.innerWidth, window.innerHeight) * 0.35;

    // name -> Set of key codes bound to that digital action.
    this._actions = new Map();
    // name -> { negative:Set, positive:Set, axis } of codes bound to an axis.
    this._axes = new Map();
    // stickName -> { horizontal: axisName, vertical: axisName }
    this._sticks = new Map();

    // Currently-held key codes, plus edge-detection snapshots.
    this._codes = new Set();
    this._pressedCodes = new Set();
    this._releasedCodes = new Set();

    // Virtual stick state for the active finger.
    this._stick = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0, px: 0, py: 0 };
    this._stickWasActive = false;
    this.touchStarted = false; // true for one update() after a fresh touch

    this._bindKeyboard();
    this._bindTouch();
  }

  // ---- Registration ----

  /** Bind a digital action to one or more key codes. */
  defineAction(name, codes) {
    const list = Array.isArray(codes) ? codes : [codes];
    this._actions.set(name, new Set(list));
    return this;
  }

  /** Bind an analog axis (-1..1) to a negative/positive set of key codes. */
  defineAxis(name, { negative = [], positive = [] } = {}) {
    this._axes.set(name, {
      negative: new Set(Array.isArray(negative) ? negative : [negative]),
      positive: new Set(Array.isArray(positive) ? positive : [positive]),
    });
    return this;
  }

  /**
   * Register a virtual touch stick by naming the (already-defined) axes it
   * drives. On touch, the stick's horizontal deflection feeds the `vertical`
   * axis and its vertical deflection feeds `horizontal` (see defineAxis usage
   * notes); keyboard input to those axes still works untouched.
   */
  defineStick(name, { horizontal, vertical }) {
    this._sticks.set(name, { horizontal, vertical });
    return this;
  }

  // ---- Per-tick state ----

  // Snapshot of held codes from the PREVIOUS update() call, used to compute
  // pressed/released edges. Events (keydown/keyup) mutate `_codes` asynchronously
  // between update() calls, so we must compare against the state as of the last
  // frame rather than a fresh copy of the current frame.
  _lastSnapshot = new Set();

  /** Call once per frame, before querying, to refresh edges + stick state. */
  update() {
    this._pressedCodes.clear();
    this._releasedCodes.clear();
    for (const code of this._codes) {
      if (!this._lastSnapshot.has(code)) this._pressedCodes.add(code);
    }
    for (const code of this._lastSnapshot) {
      if (!this._codes.has(code)) this._releasedCodes.add(code);
    }
    this._lastSnapshot = new Set(this._codes);
    const stickJustDown = this._stick.active && !this._stickWasActive;
    this._stickWasActive = this._stick.active;
    this.touchStarted = stickJustDown;
  }

  // ---- Queries ----

  /** All key codes bound to an action (returns a fresh array). */
  _codesOf(name) {
    const s = this._actions.get(name);
    return s ? [...s] : [];
  }

  _axisCodes(name) {
    const a = this._axes.get(name);
    if (!a) return { negative: [], positive: [] };
    return { negative: [...a.negative], positive: [...a.positive] };
  }

  /** Any key bound to `name` currently held. */
  hasAction(name) {
    return this._codesOf(name).some((c) => this._codes.has(c));
  }

  /** `name` pressed this tick (edge). Requires update(). */
  pressed(name) {
    return this._codesOf(name).some((c) => this._pressedCodes.has(c));
  }

  /** `name` released this tick (edge). Requires update(). */
  released(name) {
    return this._codesOf(name).some((c) => this._releasedCodes.has(c));
  }

  /**
   * Value of `name` in -1..1: +1 if any positive key held, -1 if any negative
   * key held, else 0. If `name` is driven by a registered stick and a touch is
   * active, that dimension instead returns the stick's normalized deflection.
   */
  axis(name) {
    const { negative, positive } = this._axisCodes(name);
    let v = (positive.some((c) => this._codes.has(c)) ? 1 : 0) -
      (negative.some((c) => this._codes.has(c)) ? 1 : 0);
    // Overlay a virtual stick if one drives this axis and a touch is active.
    for (const s of this._sticks.values()) {
      if (!this._stick.active) break;
      if (s.horizontal === name) v = v !== 0 ? v : this._stick.x;
      if (s.vertical === name) v = v !== 0 ? v : this._stick.y;
    }
    return v;
  }

  /** Virtual-stick state: normalized deflection (x/y) plus raw pointer coords. */
  get stick() {
    return {
      x: this._stick.active ? this._stick.x : 0,
      y: this._stick.active ? this._stick.y : 0,
      active: this._stick.active,
      px: this._stick.active ? this._stick.px : 0,
      py: this._stick.active ? this._stick.py : 0,
      ox: this._stick.active ? this._stick.ox : 0,
      oy: this._stick.active ? this._stick.oy : 0,
    };
  }

  // ---- Event binding ----

  _bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") e.preventDefault();
      this._codes.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") e.preventDefault();
      this._codes.delete(e.code);
    });
    window.addEventListener("blur", () => {
      this._codes.clear();
    });
  }

  _bindTouch() {
    window.addEventListener(
      "touchstart",
      (e) => {
        if (isInteractive(e.target)) return;
        // Only one stick finger at a time.
        if (this._stick.active) return;
        const t = e.changedTouches[0];
        this._stick.active = true;
        this._stick.id = t.identifier;
        this._stick.ox = t.clientX;
        this._stick.oy = t.clientY;
        this._stick.px = t.clientX;
        this._stick.py = t.clientY;
        this._stick.x = 0;
        this._stick.y = 0;
      },
      { passive: true },
    );
    window.addEventListener(
      "touchmove",
      (e) => {
        if (!this._stick.active) return;
        let f = null;
        for (const t of e.changedTouches) {
          if (t.identifier === this._stick.id) {
            f = t;
            break;
          }
        }
        if (!f) return;
        e.preventDefault();
        const dx = f.clientX - this._stick.ox;
        const dy = f.clientY - this._stick.oy;
        const r = this.stickRadius;
        this._stick.px = f.clientX;
        this._stick.py = f.clientY;
        this._stick.x = Math.max(-1, Math.min(1, dx / r));
        this._stick.y = Math.max(-1, Math.min(1, dy / r));
      },
      { passive: false },
    );
    const endStick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._stick.id) {
          this._stick.active = false;
          this._stick.id = -1;
          this._stick.x = 0;
          this._stick.y = 0;
          this._stick.px = 0;
          this._stick.py = 0;
        }
      }
    };
    window.addEventListener("touchend", endStick, { passive: true });
    window.addEventListener("touchcancel", endStick, { passive: true });
  }
}