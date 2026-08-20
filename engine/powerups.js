// Powerups API.
//
// Holds a list of powerups (empty by default) and renders each as a small
// "[ icon Label ]" pill in a fixed panel placed under the top-left keymapping.
// When the player clicks a pill, the API emits an event carrying the powerup's
// details (id, label, icon, cost, unit) to every subscriber and then
// automatically removes it from the list.
// The API knows nothing about what a powerup does; subscribers react to the
// emitted item however they like. There is no "disengage" once acquired.
//
// Affordability is derived internally from a bank account the game registers via
// `setBank(currentMoney)`. An item is "available" when its cost <= bank; call
// `refresh()` for the API to recompute availability for all items and restyle
// them. Unavailable pills are dimmed and non-interactive.
//
//   const powerups = createPowerups();
//   powerups.setBank(() => money);
//   powerups.on(({ id }) => {
//     if (id === "auto-throttle") enableAutoThrottle();
//   });
//   powerups.add({ id: "auto-throttle", label: "Auto Throttle", icon: "↑", cost: 100 });
//   // on money change: powerups.refresh();

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @media (max-width: 600px), (pointer: coarse) {
      .powerups-panel {
        left: 0 !important;
        margin-left: 0 !important;
        padding-left: 0 !important;
      }
      .powerup-icon {
        display: none !important;
      }
      .powerup-pill {
        padding: 6px 10px 6px 8px !important;
        font-size: 0.82rem !important;
        gap: 6px !important;
        border-radius: 0 !important;
        border-left: none !important;
        margin-left: 0 !important;
      }
      .powerup-cost {
        font-size: 0.75rem !important;
        padding: 1px 6px !important;
        margin-left: 4px !important;
        border-radius: 10px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

export function createPowerups(options = {}) {
  ensureStyles();
  const {
    container = document.body,
    top = "82px",
    left = "16px",
    textColor = "#000",
    costColor = textColor,
    borderColor = "#000",
    background = "none", // "none" (transparent) or a CSS color string
    showIcon = true,
    unavailableColor = "#8a8a8a",
    unavailableOpacity = 0.45,
    width = "230px",
  } = options;

  const items = new Map();
  const listeners = new Set();
  const state = { background, showIcon };
  let bankGet = () => 0;
  function resolveBg(bg) {
    return !bg || bg === "none" ? "transparent" : bg;
  }

  function applyState(item) {
    const unavailable = !item.available;
    item.pill.style.opacity = unavailable ? `${unavailableOpacity}` : "1";
    item.pill.style.pointerEvents = unavailable ? "none" : "auto";
    item.pill.style.cursor = unavailable ? "default" : "pointer";
    item.labelEl.style.color = unavailable ? unavailableColor : textColor;
    if (item.costEl)
      item.costEl.style.color = unavailable ? unavailableColor : costColor;
  }

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    position: "fixed",
    top,
    left,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: textColor,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif',
    fontSize: "0.85rem",
    fontWeight: "700",
    pointerEvents: "auto",
    userSelect: "none",
    zIndex: "100",
  });
  container.appendChild(panel);

  function emit(item) {
    for (const cb of listeners) cb(item);
  }

  return {
    panel,
    on(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    add({ id, label, icon = "", cost = 0, unit = "$" } = {}) {
      const item = {
        id,
        label,
        icon,
        cost,
        unit,
        available: bankGet() >= cost,
        bg: resolveBg(state.background),
        showIcon: state.showIcon,
      };
      const pill = document.createElement("div");
      pill.className = "powerup-pill";
      Object.assign(pill.style, {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 20px",
        background: item.bg,
        border: `1px solid ${borderColor}`,
        borderRadius: "0",
        cursor: "pointer",
        transition: "background 0.15s, transform 0.05s",
        fontSize: "1.05rem",
        width,
        minWidth: width,
        boxSizing: "border-box",
        touchAction: "manipulation",
        webkitTapHighlightColor: "transparent",
      });
      pill.addEventListener("mouseenter", () => {
        if (item.bg === "transparent")
          pill.style.background = "rgba(255, 255, 255, 0.1)";
      });
      pill.addEventListener("mouseleave", () => {
        pill.style.background = item.bg;
      });
      pill.addEventListener(
        "mousedown",
        () => (pill.style.transform = "scale(0.96)"),
      );
      pill.addEventListener(
        "mouseup",
        () => (pill.style.transform = "scale(1)"),
      );
      pill.addEventListener(
        "touchstart",
        (e) => {
          pill.style.transform = "scale(0.96)";
          buyPowerup();
          if (e.cancelable) {
            e.preventDefault();
          }
        },
        { passive: false },
      );
      pill.addEventListener(
        "touchend",
        () => (pill.style.transform = "scale(1)"),
        { passive: true },
      );
      pill.addEventListener(
        "touchcancel",
        () => (pill.style.transform = "scale(1)"),
        { passive: true },
      );

      const iconEl = document.createElement("span");
      iconEl.className = "powerup-icon";
      iconEl.textContent = icon;
      iconEl.style.fontSize = "1.3rem";
      iconEl.style.lineHeight = "1";
      iconEl.style.width = "1.2em";
      iconEl.style.textAlign = "center";
      iconEl.style.display = item.showIcon ? "inline-block" : "none";
      pill.appendChild(iconEl);
      item.iconEl = iconEl;

      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      pill.appendChild(labelEl);
      item.labelEl = labelEl;

      if (cost > 0) {
        const costEl = document.createElement("span");
        costEl.className = "powerup-cost";
        costEl.textContent = `${unit}${cost}`;
        costEl.style.marginLeft = "auto";
        costEl.style.padding = "2px 10px";
        costEl.style.background = "transparent";
        costEl.style.border = "none";
        costEl.style.borderRadius = "0";
        costEl.style.color = costColor;
        costEl.style.fontSize = "0.95rem";
        pill.appendChild(costEl);
        item.costEl = costEl;
      }

      const buyPowerup = () => {
        if (!items.has(id)) return;
        if (!item.available) return; // not enough in the bank
        items.delete(id);
        pill.remove();
        emit({ id, label, icon, cost, unit });
      };
      pill.addEventListener("click", buyPowerup);

      item.pill = pill;
      items.set(id, item);
      panel.appendChild(pill);
      applyState(item);
    },
    remove(id) {
      const item = items.get(id);
      if (item) {
        item.pill.remove();
        items.delete(id);
      }
    },
    clear() {
      for (const [, item] of items) item.pill.remove();
      items.clear();
    },
    has(id) {
      return items.has(id);
    },
    setBank(bank) {
      bankGet = typeof bank === "function" ? bank : () => bank;
    },
    refresh() {
      for (const item of items.values()) {
        item.available = bankGet() >= item.cost;
        applyState(item);
      }
    },
    setBackground(bg) {
      state.background = bg;
      for (const item of items.values()) {
        item.bg = resolveBg(bg);
        item.pill.style.background = item.bg;
      }
    },
    setShowIcon(on) {
      state.showIcon = on;
      for (const item of items.values()) {
        if (item.iconEl)
          item.iconEl.style.display = on ? "inline-block" : "none";
      }
    },
    dispose() {
      panel.remove();
    },
  };
}

// Gallery preview (entities.html): renders a few canned powerup pills with no
// interactions. `sim` is ignored; the returned handle carries the powerups API
// plus a `dispose()` so entities.html can tear the overlay down on switch.
export function createPowerupsPreview(sim, values = {}) {
  const powerups = createPowerups({
    container: document.body,
    textColor: "#fff",
  });
  Object.assign(powerups.panel.style, {
    top: "82px",
    left: "50%",
    transform: "translateX(-50%)",
  });
  powerups.setBank(200);
  const canned = [
    {
      id: "auto-throttle",
      label: "Auto Throttle",
      icon: "↑",
      cost: 100,
      unit: "$",
    },
    { id: "cowcatcher", label: "Cowcatcher", icon: "▴", cost: 50, unit: "$" },
    { id: "governor", label: "Governor", icon: "◆", cost: 1000, unit: "$" },
  ];
  for (const item of canned) powerups.add(item);
  return {
    ...powerups,
    dispose() {
      powerups.dispose();
    },
  };
}
