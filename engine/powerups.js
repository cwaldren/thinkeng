// Powerups API.
//
// Holds a list of powerups (empty by default) and renders each as a small
// "[ icon Label ]" pill in a fixed panel placed under the top-left keymapping.
// When the player clicks a pill, the API emits an event carrying the powerup's
// details (id, label, icon, cost, unit) to every subscriber and then
// automatically removes it from the list.
// The API knows nothing about what a powerup does; subscribers react to the
// emitted name however they like. There is no "disengage" once acquired.
//
//   const powerups = createPowerups();
//   powerups.on((name) => {
//     if (name === "Auto Throttle") enableAutoThrottle();
//   });
//   powerups.add({ id: "auto-throttle", label: "Auto Throttle", icon: "↑" });

export function createPowerups(options = {}) {
  const {
    container = document.body,
    top = "82px",
    left = "16px",
  } = options;

  const items = new Map();
  const listeners = new Set();

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    position: "fixed",
    top,
    left,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "#fff",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif',
    fontSize: "0.85rem",
    fontWeight: "700",
    pointerEvents: "auto",
    userSelect: "none",
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
    add({ id, label, icon = "", cost = 0, unit = "$", isAffordable = null } = {}) {
      const item = { id, label, icon, cost, unit, isAffordable };
      const pill = document.createElement("div");
      Object.assign(pill.style, {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 20px",
        background: "rgba(20, 22, 28, 0.78)",
        border: "1px solid rgba(255, 255, 255, 0.18)",
        borderRadius: "24px",
        cursor: "pointer",
        backdropFilter: "blur(4px)",
        transition: "background 0.15s, transform 0.05s",
        fontSize: "1.05rem",
      });
      pill.addEventListener("mouseenter", () => (pill.style.background = "rgba(40, 44, 54, 0.85)"));
      pill.addEventListener("mouseleave", () => (pill.style.background = "rgba(20, 22, 28, 0.78)"));
      pill.addEventListener("mousedown", () => (pill.style.transform = "scale(0.96)"));
      pill.addEventListener("mouseup", () => (pill.style.transform = "scale(1)"));

      const iconEl = document.createElement("span");
      iconEl.textContent = icon;
      iconEl.style.fontSize = "1.3rem";
      iconEl.style.lineHeight = "1";
      iconEl.style.width = "1.2em";
      iconEl.style.textAlign = "center";
      pill.appendChild(iconEl);

      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      pill.appendChild(labelEl);

      if (cost > 0) {
        const costEl = document.createElement("span");
        costEl.textContent = `${unit}${cost}`;
        costEl.style.marginLeft = "6px";
        costEl.style.padding = "2px 10px";
        costEl.style.background = "rgba(231, 217, 132, 0.16)";
        costEl.style.border = "1px solid rgba(231, 217, 132, 0.4)";
        costEl.style.borderRadius = "14px";
        costEl.style.color = "#e7d984";
        costEl.style.fontSize = "0.95rem";
        pill.appendChild(costEl);
      }

      pill.addEventListener("click", () => {
        if (!items.has(id)) return;
        if (item.isAffordable && !item.isAffordable()) return; // can't afford yet
        items.delete(id);
        pill.remove();
        emit({ id, label, icon, cost, unit });
      });

      items.set(id, { ...item, pill });
      panel.appendChild(pill);
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
    dispose() {
      panel.remove();
    },
  };
}