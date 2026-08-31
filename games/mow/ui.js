// UI housekeeping: the [stats] / [options] toggle buttons, the FPS / GC /
// entity debug readouts, and the sandbox panel toggle.

import {
  createFPSCounter,
  createGCStats,
  createEntityStats,
} from "engine/components.js";

export function buildUI(sim, ctx) {
  const isMobile = ctx.isMobile;

  // Sandbox checkbox: show/hide the sandbox control panel.
  const sandboxCheckbox = document.getElementById("sandbox-checkbox");
  const sandboxPanel = document.getElementById("sandbox-panel");
  sandboxCheckbox.addEventListener("change", () => {
    sandboxPanel.style.display = sandboxCheckbox.checked ? "" : "none";
  });

  const fpsEnt = createFPSCounter(sim);
  const gcEnt = createGCStats(sim, { color: "rgba(20,20,20,0.75)" });
  const entityEnt = createEntityStats(sim, {
    color: "rgba(20,20,20,0.8)",
  });

  // Toggle button tucked directly below the FPS counter; hides/shows the
  // extended stats (GC + entity). FPS always stays visible. GC may be null
  // when the heap API is unavailable.
  const statEls = [gcEnt, entityEnt.element]
    .filter(Boolean)
    .map((e) => (e.element ? e.element : e));
  statEls.forEach((el) => (el.style.display = "none"));
  const statsBtn = document.createElement("button");
  statsBtn.textContent = "[stats]";
  statsBtn.style.position = "absolute";
  statsBtn.style.top = "32px";
  statsBtn.style.right = "14px";
  statsBtn.style.fontFamily = "monospace, sans-serif";
  statsBtn.style.fontSize = "0.7rem";
  statsBtn.style.color = "rgba(255,255,255,0.6)";
  statsBtn.style.background = "transparent";
  statsBtn.style.border = "none";
  statsBtn.style.cursor = "pointer";
  statsBtn.style.padding = "0";
  statsBtn.style.zIndex = "1000";
  let statsVisible = false;
  const statBaseTops = statEls.map((el) => parseInt(el.style.top) || 0);
  const optionsBtn = document.createElement("button"); // hoisted for closure below
  statsBtn.addEventListener("click", () => {
    statsVisible = !statsVisible;
    statEls.forEach((el, i) => {
      el.style.display = statsVisible ? "" : "none";
      el.style.top = statsVisible ? `${statBaseTops[i] + 22}px` : "";
    });
    let bottom = 54;
    if (statsVisible) {
      void statEls[0].offsetHeight;
      for (const el of statEls) {
        bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
      }
    }
    const optionsTop = `${bottom + 6}px`;
    optionsBtn.style.top = optionsTop;
    sidePanel.style.top = `${bottom + 30}px`;
  });
  document.body.appendChild(statsBtn);
  if (isMobile) statsBtn.style.display = "none";

  // [options] button tucked below [stats]; toggles the Creatures/Sandbox
  // controls in the #side panel.
  optionsBtn.textContent = "[options]";
  optionsBtn.style.position = "absolute";
  optionsBtn.style.top = "54px";
  optionsBtn.style.right = "14px";
  optionsBtn.style.fontFamily = "monospace, sans-serif";
  optionsBtn.style.fontSize = "0.7rem";
  optionsBtn.style.color = "rgba(255,255,255,0.6)";
  optionsBtn.style.background = "transparent";
  optionsBtn.style.border = "none";
  optionsBtn.style.cursor = "pointer";
  optionsBtn.style.padding = "0";
  optionsBtn.style.zIndex = "1000";
  const sidePanel = document.getElementById("side");
  optionsBtn.addEventListener("click", () => {
    const shown = sidePanel.style.display !== "none";
    sidePanel.style.display = shown ? "none" : "flex";
  });
  document.body.appendChild(optionsBtn);
  if (isMobile) optionsBtn.style.display = "none";
}