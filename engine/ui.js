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
let gaugeStylesInjected = false;

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
    d: `M ${cx},${cy} L ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy} L ${cx},${cy} Z`,
    fill: "rgba(0,0,0,0.55)",
  }, body);
  const arc = el("path", {
    d: `M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`,
    fill: "none",
    stroke: "rgba(255,255,255,0.25)",
    "stroke-width": "2",
  }, body);
  arc.style.transition = "stroke 0.2s";

  // Needle: points left at min, rotates clockwise to straight up at max.
  const needle = el("g", { id: "gauge-needle" }, body);
  needle.style.transformOrigin = `${cx}px ${cy}px`;
  el("line", {
    x1: cx, y1: cy, x2: cx - r + 12, y2: cy,
    stroke: "#ffd24a", "stroke-width": "5", "stroke-linecap": "round",
  }, needle);

  el("circle", { cx, cy, r: 7, fill: "#fff" }, body);

  // Red notch marking a danger/threshold value on the gauge arc (hidden by default).
  const threshold = el("line", {
    x1: cx - r - 5, y1: cy, x2: cx - r + 5, y2: cy,
    stroke: "#e23b3b", "stroke-width": "4", "stroke-linecap": "round",
    visibility: "hidden",
  }, body);
  threshold.style.transformOrigin = `${cx}px ${cy}px`;
  threshold.style.transition = "transform 0.15s";

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

  // "2x" earnings badge, always shown in the blank area of the semicircle to the
  // right of the full-throttle line. Turns gold and sways when at top speed.
  const rate2x = el("text", {
    x: cx, y: cy + 72, "text-anchor": "middle", fill: "#777",
    opacity: "1", "font-size": "17", "font-weight": "900",
    "font-family": "monospace", "class": "gauge-2x",
  }, svg);
  rate2x.textContent = "2x";

  // Inject the sway keyframes/style once for the 2x badge.
  if (!gaugeStylesInjected) {
    gaugeStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = `
      .gauge-2x {
        transform-origin: ${cx}px ${cy + 72}px;
      }
      .gauge-2x.swaying {
        animation: gauge-2x-sway 0.6s ease-in-out infinite;
      }
      @keyframes gauge-2x-sway {
        0%, 100% { transform: rotate(-30deg); }
        50% { transform: rotate(30deg); }
      }
    `;
    document.head.appendChild(style);
  }

  container.appendChild(wrapper);

  // --- API ---------------------------------------------------------------
  function setValue(v) {
    const clamped = Math.max(min, Math.min(max, v));
    valueText.textContent = clamped.toFixed(0);
    const rotation = ((clamped - min) / (max - min)) * 180;
    needle.style.transform = `rotate(${rotation}deg)`;
  }

  function setMax(on) {
    arc.setAttribute("stroke", on ? "#ffd24a" : "rgba(255,255,255,0.25)");
    arc.setAttribute("stroke-width", on ? "5" : "2");
    rate2x.setAttribute("fill", on ? "#ffd24a" : "#777");
    rate2x.classList.toggle("swaying", !!on);
  }

  // Place the red threshold line at `v` on the gauge scale. Pass `null` to hide.
  function setThreshold(v) {
    if (v == null) {
      threshold.style.visibility = "hidden";
      return;
    }
    const clamped = Math.max(min, Math.min(max, v));
    threshold.style.visibility = "visible";
    threshold.style.transform = `rotate(${((clamped - min) / (max - min)) * 180}deg)`;
  }

  function setVisible(on) {
    wrapper.style.display = on ? "block" : "none";
  }

  function dispose() {
    wrapper.remove();
  }

  return { wrapper, setValue, setMax, setThreshold, setVisible, dispose };
}

// # createMoneyCounter
//
// A large "money" display (e.g. "$0") anchored below the top-left controls UI.
// Call `setValue()` to update the displayed amount, or use the returned
// `wrapper` to reposition it under other UI elements.
export function createMoneyCounter(options = {}) {
  const {
    container = document.body,
    symbol = "$",
    size = "2.2rem",
    anchor = null, // optional HTMLElement to place directly beneath
    marginTop = 0,
  } = options;

  const wrapper = document.createElement("div");
  const hasBottom = options.bottom != null;
  Object.assign(wrapper.style, {
    position: "fixed",
    top: anchor ? null : (hasBottom ? null : (options.top ?? "64px")),
    left: anchor ? null : (options.left ?? "16px"),
    bottom: anchor ? null : (options.bottom ?? null),
    color: "#e7d984",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif',
    fontSize: size,
    fontWeight: "900",
    lineHeight: "1",
    letterSpacing: "-0.02em",
    pointerEvents: "none",
    userSelect: "none",
    textShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
  });

  if (anchor) {
    wrapper.style.top = null;
    wrapper.style.left = null;
    wrapper.style.position = "static";
    wrapper.style.marginTop = `${marginTop}px`;
    anchor.appendChild(wrapper);
  } else {
    container.appendChild(wrapper);
  }

  const valueEl = document.createElement("span");
  wrapper.appendChild(valueEl);

  function setValue(v) {
    const n = Math.floor(v);
    if (n < 0) {
      valueEl.textContent = `-${symbol}${Math.abs(n).toLocaleString()}`;
      valueEl.style.color = "#ff4444";
    } else {
      valueEl.textContent = `${symbol}${n.toLocaleString()}`;
      valueEl.style.color = "";
    }
  }

  function setVisible(on) {
    wrapper.style.display = on ? "block" : "none";
  }

  function dispose() {
    wrapper.remove();
  }

  setValue(0);

  return { wrapper, setValue, setVisible, dispose };
}
