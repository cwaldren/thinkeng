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
    container = document.body,
    size = 540,
  } = options;

  // SVG coordinate space (center + radius define the circle geometry).
  const cx = 100;
  const cy = 100;
  const r = 86;

  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    position: "fixed",
    bottom: options.bottom ?? "0px",
    left: options.left ?? "50%",
    transform: "translateX(-50%)",
    color: "#fff",
    pointerEvents: "none",
    userSelect: "none",
    filter: "drop-shadow(0 -4px 16px rgba(0, 0, 0, 0.6))",
    zIndex: "90",
  });

  const svg = el("svg", {
    viewBox: "0 0 200 100",
  });
  svg.style.display = "block";
  svg.style.width = `${size}px`;
  svg.style.height = `${size / 2}px`;
  wrapper.appendChild(svg);

  // Clip to the top half so only the upper semicircle shows.
  const defs = el("defs", {}, svg);
  const clipPath = el("clipPath", { id: "gauge-semi" }, defs);
  el("rect", { x: 0, y: 0, width: 200, height: cy }, clipPath);

  const body = el("g", { "clip-path": "url(#gauge-semi)" }, svg);

  // Semicircular background dial
  el(
    "path",
    {
      d: `M ${cx},${cy} L ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy} L ${cx},${cy} Z`,
      fill: "rgba(0,0,0,0.65)",
    },
    body,
  );

  // Outer border arc
  const arc = el(
    "path",
    {
      d: `M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`,
      fill: "none",
      stroke: "rgba(255,255,255,0.3)",
      "stroke-width": "2.5",
    },
    body,
  );
  arc.style.transition = "stroke 0.2s, stroke-width 0.2s";

  // Inner track arc
  el(
    "path",
    {
      d: `M ${cx - r + 14},${cy} A ${r - 14},${r - 14} 0 0 1 ${cx + r - 14},${cy}`,
      fill: "none",
      stroke: "rgba(255,255,255,0.1)",
      "stroke-width": "1",
    },
    body,
  );

  // Speed labels & tick marks along the arc
  const step = 20;
  const startVal = 10;
  const majorTickVals = new Set();
  for (let v = startVal; v <= max; v += step) {
    majorTickVals.add(v);
  }
  const lastMajor = Math.max(...majorTickVals, min);
  if (max - lastMajor >= 10) {
    majorTickVals.add(max);
  }

  // Minor ticks every 10
  for (let v = min; v <= max; v += 10) {
    const frac = (v - min) / (max - min);
    const theta = Math.PI - frac * Math.PI;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const isMajor = majorTickVals.has(v);

    const rOuter = r - 1;
    const rInner = isMajor ? r - 8 : r - 4.5;
    el(
      "line",
      {
        x1: cx + rOuter * cosT,
        y1: cy - rOuter * sinT,
        x2: cx + rInner * cosT,
        y2: cy - rInner * sinT,
        stroke: isMajor ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
        "stroke-width": isMajor ? "1.8" : "1",
        "stroke-linecap": "round",
      },
      body,
    );
  }

  // Speed text labels (10, 30, 50, 70, ...)
  for (const v of majorTickVals) {
    const frac = (v - min) / (max - min);
    const theta = Math.PI - frac * Math.PI;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const rLabel = r - 16;
    const lx = cx + rLabel * cosT;
    const ly = cy - rLabel * sinT;

    const txt = el(
      "text",
      {
        x: lx,
        y: ly,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        fill: "rgba(255,255,255,0.9)",
        "font-size": "7.5",
        "font-weight": "900",
        "font-family": 'monospace, -apple-system, sans-serif',
      },
      body,
    );
    txt.textContent = `${v}`;
  }

  // Red notch marking a danger/threshold value on the gauge arc (hidden by default).
  const threshold = el(
    "line",
    {
      x1: cx - r - 2,
      y1: cy,
      x2: cx - r + 9,
      y2: cy,
      stroke: "#e23b3b",
      "stroke-width": "3",
      "stroke-linecap": "round",
      visibility: "hidden",
    },
    body,
  );
  threshold.style.transformOrigin = `${cx}px ${cy}px`;
  threshold.style.transition = "transform 0.15s";

  // Needle: points left at min, rotates clockwise to straight right at max.
  const needle = el("g", { id: "gauge-needle" }, body);
  needle.style.transformOrigin = `${cx}px ${cy}px`;
  el(
    "line",
    {
      x1: cx,
      y1: cy,
      x2: cx - r + 10,
      y2: cy,
      stroke: "#ffd24a",
      "stroke-width": "3.5",
      "stroke-linecap": "round",
    },
    needle,
  );

  // Center pivot hub
  el("circle", { cx, cy, r: 8, fill: "#ffffff" }, body);
  el("circle", { cx, cy, r: 4.5, fill: "#222222" }, body);

  container.appendChild(wrapper);

  // --- API ---------------------------------------------------------------
  function setValue(v) {
    const clamped = Math.max(min, Math.min(max, v));
    const rotation = ((clamped - min) / (max - min)) * 180;
    needle.style.transform = `rotate(${rotation}deg)`;
  }

  function setMax(on) {
    arc.setAttribute("stroke", on ? "#ffd24a" : "rgba(255,255,255,0.3)");
    arc.setAttribute("stroke-width", on ? "4" : "2.5");
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
    background = "radial-gradient(ellipse at center, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.75) 50%, rgba(0, 0, 0, 0) 100%)",
    padding = "12px 32px",
    borderRadius = "12px",
    border = "none",
  } = options;

  const wrapper = document.createElement("div");
  const hasBottom = options.bottom != null;
  Object.assign(wrapper.style, {
    position: "fixed",
    top: anchor ? null : hasBottom ? null : (options.top ?? "64px"),
    left: anchor ? null : (options.left ?? "16px"),
    bottom: anchor ? null : (options.bottom ?? null),
    transform: options.transform ?? (options.left === "50%" ? "translateX(-50%)" : null),
    background,
    padding,
    borderRadius,
    border,
    color: options.color ?? "#e7d984",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif',
    fontSize: size,
    fontWeight: "900",
    lineHeight: "1",
    letterSpacing: "-0.02em",
    pointerEvents: "none",
    userSelect: "none",
    textShadow: "0 2px 10px rgba(0, 0, 0, 0.7)",
    zIndex: "95",
    textAlign: "center",
    whiteSpace: "nowrap",
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
