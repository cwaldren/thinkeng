// Reusable 2D UI helpers.
//
// # createGauge
//
// Renders a circular speedometer-style gauge (SVG) anchored to the screen.
// It is a semicircle split grey/black, with a needle that sweeps from
// horizontal-left (at `min`) to straight up (at `max`). Call `setValue()`
// every frame to drive the readout and needle.
//
//   const gauge = createGauge({
//     min: 0,
//     max: 70,
//     unit: "MPH",
//     container: document.body,
//   });
//   // each frame:
//   gauge.setValue(speedMph);
//
// `max` is the full-scale reading at the top of the gauge.

const SVG_NS = "http://www.w3.org/2000/svg";

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

export function createGauge(options = {}) {
  const {
    min = 0,
    max = 70,
    unit = "",
    container = document.body,
    size = 180,
    label = "MAX",
    showLabel = true,
  } = options;

  // SVG coordinate space (center + radius define the circle geometry).
  const cx = 100;
  const cy = 100;
  const r = 88;
  const topPad = 14;

  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    position: "fixed",
    bottom: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    color: "#fff",
    pointerEvents: "none",
    userSelect: "none",
    filter: "drop-shadow(0 2px 10px rgba(0, 0, 0, 0.5))",
  });

  const svg = el("svg", {
    viewBox: `0 ${-topPad} 200 ${200 + topPad * 2}`,
  });
  svg.style.display = "block";
  svg.style.width = `${size}px`;
  svg.style.height = `${size}px`;
  wrapper.appendChild(svg);

  // Clip to the top half so only the upper semicircle shows.
  const defs = el("defs", {}, svg);
  const clipPath = el("clipPath", { id: "gauge-semi" }, defs);
  el("rect", { x: 0, y: 0, width: 200, height: cy }, clipPath);

  const body = el("g", { "clip-path": "url(#gauge-semi)" }, svg);

  // Left half (grey) / right half (black) wedges joined at the vertical diameter.
  el("path", {
    d: `M ${cx},${cy} L ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx},${cy - r} L ${cx},${cy} Z`,
    fill: "#555",
  }, body);
  el("path", {
    d: `M ${cx},${cy} L ${cx},${cy - r} A ${r},${r} 0 0 1 ${cx + r},${cy} L ${cx},${cy} Z`,
    fill: "rgba(0,0,0,0.55)",
  }, body);
  el("path", {
    d: `M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`,
    fill: "none",
    stroke: "rgba(255,255,255,0.25)",
    "stroke-width": "2",
  }, body);

  // Needle: points left at min, rotates clockwise to straight up at max.
  const needle = el("g", { id: "gauge-needle" }, body);
  needle.style.transformOrigin = `${cx}px ${cy}px`;
  el("line", {
    x1: cx, y1: cy, x2: cx - r + 12, y2: cy,
    stroke: "#ffd24a", "stroke-width": "5", "stroke-linecap": "round",
  }, needle);

  el("circle", { cx, cy, r: 7, fill: "#fff" }, body);

  // Readout text below the gauge.
  const valueText = el("text", {
    id: "gauge-value", x: cx, y: cy + 30,
    "text-anchor": "middle", fill: "#fff", "font-size": "34",
    "font-weight": "900", "font-family": "monospace",
  }, svg);
  valueText.textContent = "0";

  if (unit) {
    const unitText = el("text", {
      x: cx, y: cy + 50, "text-anchor": "middle", fill: "#fff",
      opacity: "0.8", "font-size": "12", "font-weight": "700",
      "font-family": "monospace",
    }, svg);
    unitText.textContent = unit;
  }

  if (showLabel && label) {
    const maxText = el("text", {
      x: cx, y: 2, "text-anchor": "middle", fill: "#fff",
      opacity: "0.55", "font-size": "15", "font-weight": "700",
      "font-family": "monospace",
    }, svg);
    maxText.textContent = label;
  }

  container.appendChild(wrapper);

  // --- API ---------------------------------------------------------------
  function setValue(v) {
    const clamped = Math.max(min, Math.min(max, v));
    valueText.textContent = clamped.toFixed(0);
    const rotation = ((clamped - min) / (max - min)) * 90;
    needle.style.transform = `rotate(${rotation}deg)`;
  }

  function setVisible(on) {
    wrapper.style.display = on ? "block" : "none";
  }

  function dispose() {
    wrapper.remove();
  }

  return { wrapper, setValue, setVisible, dispose };
}
