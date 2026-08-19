// Entity registry - the curated list of every primitive and component.
// Single source of truth for the gallery (entities.html). New primitives go
// in primitives.js, new components in components.js; register each here with
// a GENERIC schema. The gallery builds its controls from `opts` (no custom UI).
//
// Control field types:
//   number: <input type=number> with min/max/step
//   color:  <input type=color>  (value hex, converts to int 0xRRGGBB)
//   vector: <input type=text>   (comma-separated numbers -> array)

import {
  createGround,
  createBox,
  createSphere,
  createCylinder,
  createRock,
  createTriangle,
  createPlayer,
} from "./primitives.js";

import {
  createGrass,
  createRailSegment,
  createTrain,
  createDynamite,
  createCowcatcher,
  createBunny,
} from "./components.js";

import { createPowerupsPreview } from "./powerups.js";

export const ENTRIES = [
  {
    category: "primitive",
    key: "ground",
    label: "Ground",
    desc: "Static planar platform",
    fn: createGround,
    opts: [
      {
        key: "size",
        label: "Size",
        type: "number",
        default: 6,
        min: 1,
        max: 30,
        step: 1,
      },
      {
        key: "height",
        label: "Height",
        type: "number",
        default: 1,
        min: 0.2,
        max: 5,
        step: 0.1,
      },
      { key: "color", label: "Color", type: "color", default: "0x222233" },
      {
        key: "friction",
        label: "Friction",
        type: "number",
        default: 0.3,
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        key: "position",
        label: "Position [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
    ],
  },
  {
    category: "primitive",
    key: "box",
    label: "Box",
    desc: "Interactable cube",
    fn: createBox,
    opts: [
      {
        key: "size",
        label: "Size",
        type: "number",
        default: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
      },
      { key: "color", label: "Color", type: "color", default: "0xff5533" },
      {
        key: "mass",
        label: "Mass",
        type: "number",
        default: 1,
        min: 0,
        max: 50,
        step: 1,
      },
      {
        key: "friction",
        label: "Friction",
        type: "number",
        default: 0.3,
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        key: "position",
        label: "Position [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
      {
        key: "rotation",
        label: "Rotation [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
    ],
  },
  {
    category: "primitive",
    key: "sphere",
    label: "Sphere",
    desc: "Rollable ball",
    fn: createSphere,
    opts: [
      {
        key: "radius",
        label: "Radius",
        type: "number",
        default: 0.5,
        min: 0.1,
        max: 5,
        step: 0.1,
      },
      { key: "color", label: "Color", type: "color", default: "0x33aaff" },
      {
        key: "mass",
        label: "Mass",
        type: "number",
        default: 1,
        min: 0,
        max: 50,
        step: 1,
      },
      {
        key: "friction",
        label: "Friction",
        type: "number",
        default: 0.3,
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        key: "position",
        label: "Position [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
    ],
  },
  {
    category: "primitive",
    key: "cylinder",
    label: "Cylinder",
    desc: "Tapered column",
    fn: createCylinder,
    opts: [
      {
        key: "radiusTop",
        label: "Radius Top",
        type: "number",
        default: 1,
        min: 0,
        max: 5,
        step: 0.1,
      },
      {
        key: "radiusBottom",
        label: "Radius Bottom",
        type: "number",
        default: 1,
        min: 0,
        max: 5,
        step: 0.1,
      },
      {
        key: "height",
        label: "Height",
        type: "number",
        default: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
      },
      {
        key: "radialSegments",
        label: "Radial Segments",
        type: "number",
        default: 8,
        min: 3,
        max: 32,
        step: 1,
      },
      { key: "color", label: "Color", type: "color", default: "0x88cc55" },
      {
        key: "mass",
        label: "Mass",
        type: "number",
        default: 1,
        min: 0,
        max: 50,
        step: 1,
      },
      {
        key: "friction",
        label: "Friction",
        type: "number",
        default: 0.3,
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        key: "position",
        label: "Position [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
      {
        key: "rotation",
        label: "Rotation [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
    ],
  },
  {
    category: "primitive",
    key: "rock",
    label: "Rock",
    desc: "Faceted jagged rock / boulder",
    fn: createRock,
    opts: [
      {
        key: "radius",
        label: "Radius",
        type: "number",
        default: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
      },
      { key: "color", label: "Color", type: "color", default: "0x6e7278" },
      {
        key: "mass",
        label: "Mass",
        type: "number",
        default: 10,
        min: 0,
        max: 100,
        step: 1,
      },
      {
        key: "scale",
        label: "Scale [x,y,z]",
        type: "vector",
        default: [1, 0.8, 1],
      },
      {
        key: "position",
        label: "Position [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
      {
        key: "rotation",
        label: "Rotation [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
    ],
  },
  {
    category: "primitive",
    key: "triangle",
    label: "Triangle",
    desc: "Triangular wedge / ramp (cowcatcher)",
    fn: createTriangle,
    opts: [
      {
        key: "width",
        label: "Width",
        type: "number",
        default: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
      },
      {
        key: "depth",
        label: "Depth",
        type: "number",
        default: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
      },
      {
        key: "height",
        label: "Height",
        type: "number",
        default: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
      },
      { key: "color", label: "Color", type: "color", default: "0xcccccc" },
      {
        key: "mass",
        label: "Mass",
        type: "number",
        default: 1,
        min: 0,
        max: 50,
        step: 1,
      },
      {
        key: "position",
        label: "Position [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
      {
        key: "rotation",
        label: "Rotation [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
    ],
  },
  {
    category: "primitive",
    key: "player",
    label: "Player",
    desc: "Keyboard-controlled (WASD/Space)",
    fn: createPlayer,
    opts: [
      {
        key: "size",
        label: "Size",
        type: "number",
        default: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
      },
      { key: "color", label: "Color", type: "color", default: "0x22ff88" },
      {
        key: "mass",
        label: "Mass",
        type: "number",
        default: 5,
        min: 0,
        max: 50,
        step: 1,
      },
      {
        key: "speed",
        label: "Speed",
        type: "number",
        default: 10,
        min: 1,
        max: 40,
        step: 1,
      },
      {
        key: "jumpForce",
        label: "Jump Force",
        type: "number",
        default: 8,
        min: 1,
        max: 30,
        step: 1,
      },
      {
        key: "position",
        label: "Position [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
    ],
  },
  {
    category: "component",
    key: "grass",
    label: "Grass",
    desc: "A field of grass blades (component)",
    fn: createGrass,
    opts: [
      {
        key: "width",
        label: "Width",
        type: "number",
        default: 10,
        min: 1,
        max: 30,
        step: 1,
      },
      {
        key: "depth",
        label: "Depth",
        type: "number",
        default: 10,
        min: 1,
        max: 30,
        step: 1,
      },
      {
        key: "count",
        label: "Blade Count",
        type: "number",
        default: 200,
        min: 1,
        max: 500,
        step: 10,
      },
      { key: "color", label: "Color", type: "color", default: "0x44aa55" },
      {
        key: "height",
        label: "Height",
        type: "number",
        default: 1,
        min: 0.2,
        max: 4,
        step: 0.1,
      },
      {
        key: "position",
        label: "Position [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
    ],
  },
  {
    category: "component",
    key: "railsegment",
    label: "Rail Segment",
    desc: "A train-track chunk (rails + ties)",
    fn: createRailSegment,
    opts: [
      {
        key: "length",
        label: "Length",
        type: "number",
        default: 50,
        min: 10,
        max: 200,
        step: 5,
      },
      {
        key: "radius",
        label: "Radius (0=straight)",
        type: "number",
        default: 0,
        min: -50,
        max: 50,
        step: 1,
      },
      {
        key: "gauge",
        label: "Gauge",
        type: "number",
        default: 1.5,
        min: 0.5,
        max: 5,
        step: 0.1,
      },
      {
        key: "tieSpacing",
        label: "Tie Spacing",
        type: "number",
        default: 5,
        min: 1,
        max: 20,
        step: 1,
      },
      {
        key: "railColor",
        label: "Rail Color",
        type: "color",
        default: "0x9aa0a6",
      },
      {
        key: "tieColor",
        label: "Tie Color",
        type: "color",
        default: "0x6b4a32",
      },
      {
        key: "position",
        label: "Position [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
    ],
  },
  {
    category: "component",
    key: "train",
    label: "Train",
    desc: "A steam locomotive composite (no physics)",
    fn: createTrain,
    opts: [
      {
        key: "bodyColor",
        label: "Body Color",
        type: "color",
        default: "0xc23b2e",
      },
      {
        key: "cabColor",
        label: "Cab Color",
        type: "color",
        default: "0x8a2b22",
      },
      {
        key: "accentColor",
        label: "Accent Color",
        type: "color",
        default: "0x334455",
      },
      {
        key: "position",
        label: "Position [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
    ],
  },
  {
    category: "component",
    key: "cowcatcher",
    label: "Cowcatcher",
    desc: "A fan of skinny triangular wedges (component)",
    fn: createCowcatcher,
    opts: [
      {
        key: "count",
        label: "Count",
        type: "number",
        default: 6,
        min: 2,
        max: 20,
        step: 1,
      },
      {
        key: "width",
        label: "Tooth Width",
        type: "number",
        default: 0.32,
        min: 0.005,
        max: 0.5,
        step: 0.01,
      },
      {
        key: "gap",
        label: "Gap",
        type: "number",
        default: 0.16,
        min: 0,
        max: 0.5,
        step: 0.01,
      },
      {
        key: "depth",
        label: "Depth",
        type: "number",
        default: 2.2,
        min: 0.1,
        max: 5,
        step: 0.1,
      },
      {
        key: "height",
        label: "Height",
        type: "number",
        default: 1.3,
        min: 0.1,
        max: 5,
        step: 0.1,
      },
      { key: "color", label: "Color", type: "color", default: "0x222b33" },
      {
        key: "position",
        label: "Position [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
      {
        key: "rotation",
        label: "Rotation [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
    ],
  },
  {
    category: "component",
    key: "dynamite",
    label: "Dynamite",
    desc: "A bundle of three long red dynamite sticks (component)",
    fn: createDynamite,
    opts: [
      {
        key: "length",
        label: "Length",
        type: "number",
        default: 2.4,
        min: 0.5,
        max: 6,
        step: 0.1,
      },
      {
        key: "radius",
        label: "Radius",
        type: "number",
        default: 0.18,
        min: 0.05,
        max: 1,
        step: 0.05,
      },
      { key: "color", label: "Color", type: "color", default: "0xd93a2b" },
      {
        key: "position",
        label: "Position [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
    ],
  },
  {
    category: "component",
    key: "bunny",
    label: "Bunny",
    desc: "A cute bunny composed of spheres and ellipsoids (component)",
    fn: createBunny,
    opts: [
      { key: "color", label: "Color", type: "color", default: "0xffffff" },
      {
        key: "position",
        label: "Position [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
      {
        key: "rotation",
        label: "Rotation [x,y,z]",
        type: "vector",
        default: [0, 0, 0],
      },
    ],
  },
  {
    category: "ux",
    key: "powerups",
    label: "Powerups",
    desc: "3 canned powerup pills preview",
    fn: createPowerupsPreview,
    opts: [],
    controls(form, getHandle) {
      const field = (label) => {
        const div = document.createElement("div");
        div.className = "field";
        const lab = document.createElement("label");
        lab.textContent = label;
        div.appendChild(lab);
        form.appendChild(div);
        return div;
      };

      // Background: transparent (none) or a solid color.
      const bgField = field("Background");
      const noneWrap = document.createElement("label");
      noneWrap.style.fontSize = "0.78rem";
      noneWrap.style.opacity = "0.8";
      noneWrap.style.display = "flex";
      noneWrap.style.alignItems = "center";
      noneWrap.style.gap = "6px";
      const noneBox = document.createElement("input");
      noneBox.type = "checkbox";
      noneBox.checked = true;
      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = "#334466";
      colorInput.disabled = true;
      const applyBg = () =>
        getHandle()?.setBackground?.(
          noneBox.checked ? "none" : colorInput.value,
        );
      noneBox.addEventListener("change", () => {
        colorInput.disabled = noneBox.checked;
        applyBg();
      });
      colorInput.addEventListener("input", applyBg);
      noneWrap.appendChild(noneBox);
      noneWrap.appendChild(document.createTextNode("Transparent"));
      bgField.appendChild(noneWrap);
      bgField.appendChild(colorInput);

      // Show icons/glyphs.
      const iconField = field("Show icons");
      const iconBox = document.createElement("input");
      iconBox.type = "checkbox";
      iconBox.checked = true;
      iconBox.addEventListener("change", () =>
        getHandle()?.setShowIcon?.(iconBox.checked),
      );
      iconField.appendChild(iconBox);
    },
  },
];
