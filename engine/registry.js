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
  createPlayer,
} from "./primitives.js";

import { createGrass } from "./components.js";

export const ENTRIES = [
  {
    category: "primitive",
    key: "ground",
    label: "Ground",
    desc: "Static planar platform",
    fn: createGround,
    opts: [
      { key: "size", label: "Size", type: "number", default: 6, min: 1, max: 30, step: 1 },
      { key: "height", label: "Height", type: "number", default: 1, min: 0.2, max: 5, step: 0.1 },
      { key: "color", label: "Color", type: "color", default: "0x222233" },
      { key: "friction", label: "Friction", type: "number", default: 0.3, min: 0, max: 1, step: 0.05 },
      { key: "position", label: "Position [x,y,z]", type: "vector", default: [0, 0, 0] },
    ],
  },
  {
    category: "primitive",
    key: "box",
    label: "Box",
    desc: "Interactable cube",
    fn: createBox,
    opts: [
      { key: "size", label: "Size", type: "number", default: 1, min: 0.1, max: 5, step: 0.1 },
      { key: "color", label: "Color", type: "color", default: "0xff5533" },
      { key: "mass", label: "Mass", type: "number", default: 1, min: 0, max: 50, step: 1 },
      { key: "friction", label: "Friction", type: "number", default: 0.3, min: 0, max: 1, step: 0.05 },
      { key: "position", label: "Position [x,y,z]", type: "vector", default: [0, 0, 0] },
      { key: "rotation", label: "Rotation [x,y,z]", type: "vector", default: [0, 0, 0] },
    ],
  },
  {
    category: "primitive",
    key: "sphere",
    label: "Sphere",
    desc: "Rollable ball",
    fn: createSphere,
    opts: [
      { key: "radius", label: "Radius", type: "number", default: 0.5, min: 0.1, max: 5, step: 0.1 },
      { key: "color", label: "Color", type: "color", default: "0x33aaff" },
      { key: "mass", label: "Mass", type: "number", default: 1, min: 0, max: 50, step: 1 },
      { key: "friction", label: "Friction", type: "number", default: 0.3, min: 0, max: 1, step: 0.05 },
      { key: "position", label: "Position [x,y,z]", type: "vector", default: [0, 0, 0] },
    ],
  },
  {
    category: "primitive",
    key: "cylinder",
    label: "Cylinder",
    desc: "Tapered column",
    fn: createCylinder,
    opts: [
      { key: "radiusTop", label: "Radius Top", type: "number", default: 1, min: 0, max: 5, step: 0.1 },
      { key: "radiusBottom", label: "Radius Bottom", type: "number", default: 1, min: 0, max: 5, step: 0.1 },
      { key: "height", label: "Height", type: "number", default: 1, min: 0.1, max: 5, step: 0.1 },
      { key: "radialSegments", label: "Radial Segments", type: "number", default: 8, min: 3, max: 32, step: 1 },
      { key: "color", label: "Color", type: "color", default: "0x88cc55" },
      { key: "mass", label: "Mass", type: "number", default: 1, min: 0, max: 50, step: 1 },
      { key: "friction", label: "Friction", type: "number", default: 0.3, min: 0, max: 1, step: 0.05 },
      { key: "position", label: "Position [x,y,z]", type: "vector", default: [0, 0, 0] },
      { key: "rotation", label: "Rotation [x,y,z]", type: "vector", default: [0, 0, 0] },
    ],
  },
  {
    category: "primitive",
    key: "player",
    label: "Player",
    desc: "Keyboard-controlled (WASD/Space)",
    fn: createPlayer,
    opts: [
      { key: "size", label: "Size", type: "number", default: 1, min: 0.1, max: 5, step: 0.1 },
      { key: "color", label: "Color", type: "color", default: "0x22ff88" },
      { key: "mass", label: "Mass", type: "number", default: 5, min: 0, max: 50, step: 1 },
      { key: "speed", label: "Speed", type: "number", default: 10, min: 1, max: 40, step: 1 },
      { key: "jumpForce", label: "Jump Force", type: "number", default: 8, min: 1, max: 30, step: 1 },
      { key: "position", label: "Position [x,y,z]", type: "vector", default: [0, 0, 0] },
    ],
  },
  {
    category: "component",
    key: "grass",
    label: "Grass",
    desc: "A field of grass blades (component)",
    fn: createGrass,
    opts: [
      { key: "width", label: "Width", type: "number", default: 10, min: 1, max: 30, step: 1 },
      { key: "depth", label: "Depth", type: "number", default: 10, min: 1, max: 30, step: 1 },
      { key: "count", label: "Blade Count", type: "number", default: 200, min: 1, max: 500, step: 10 },
      { key: "color", label: "Color", type: "color", default: "0x44aa55" },
      { key: "height", label: "Height", type: "number", default: 1, min: 0.2, max: 4, step: 0.1 },
      { key: "position", label: "Position [x,y,z]", type: "vector", default: [0, 0, 0] },
    ],
  },
];