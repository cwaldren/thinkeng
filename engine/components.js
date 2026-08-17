// Composite primitives - reusable objects composed of multiple primitives.
// Built by composing the functions in primitives.js (e.g. createBox, createSphere).
// Track any created primitives so they can be removed together via sim.removeEntity(entity).

import * as THREE from "three";
import { createBox, createCylinder } from "./primitives.js";

export function createGrass(sim, opts = {}) {
  const {
    width = 10,
    depth = 10,
    count = 200,
    color = 0x44aa55,
    height = 1,
    radiusBottom = 0.06,
    radiusTop = 0.02,
    position = [0, 0, 0],
    radialSegments = 6,
  } = opts;

  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  const children = [];

  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  for (let i = 0; i < count; i++) {
    const bladeHeight = height * (0.5 + Math.random() * 0.7);
    const entity = createCylinder(sim, {
      radiusTop,
      radiusBottom,
      height: bladeHeight,
      color,
      mass: 0,
      radialSegments,
      position: [
        position[0] + (Math.random() * width - halfWidth),
        position[1] + bladeHeight / 2,
        position[2] + (Math.random() * depth - halfDepth),
      ],
    });
    group.add(entity.mesh);
    children.push(entity);
  }

  const grass = sim.addEntity(group, null, null);
  grass.children = children;
  return grass;
}

// A single train-track chunk: a pair of rails + ties laid out along a spine of
// arc-length `length`. `radius` controls the bend (0 => straight, huge => nearly
// straight, sign flips the turn direction). Composed purely from createBox so it
// cleans up as one composite via sim.removeEntity(entity).
export function createRailSegment(sim, opts = {}) {
  const {
    length = 50,
    radius = 0,
    gauge = 1.5,
    tieSpacing = 5,
    tieColor = 0x6b4a32,
    railColor = 0x9aa0a6,
    railHeight = 0.35,
    railWidth = 0.16,
    railThickness = 0.2,
    tieThickness = 0.12,
    position = [0, 0, 0],
    step = 3,
  } = opts;

  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  const children = [];

  const n = Math.max(1, Math.round(length / step));
  const ds = length / n;

  const pts = [];
  let x = 0;
  let z = 0;
  let heading = 0;
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * length;
    heading = radius === 0 ? 0 : s / radius;
    pts.push({ x, z, heading });
    x += Math.cos(heading) * ds;
    z += Math.sin(heading) * ds;
  }

  const railY = railHeight + tieThickness / 2;
  const perp = (h) => ({ x: -Math.sin(h), z: Math.cos(h) });

  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const p1 = perp(a.heading);
      const p2 = perp(b.heading);
      const x1 = a.x + p1.x * (gauge / 2) * side;
      const z1 = a.z + p1.z * (gauge / 2) * side;
      const x2 = b.x + p2.x * (gauge / 2) * side;
      const z2 = b.z + p2.z * (gauge / 2) * side;
      const len = Math.hypot(x2 - x1, z2 - z1);
      const ang = Math.atan2(z2 - z1, x2 - x1);
      const entity = createBox(sim, {
        size: [len, railThickness, railWidth],
        color: railColor,
        mass: 0,
        position: [(x1 + x2) / 2, railY, (z1 + z2) / 2],
        rotation: [0, -ang, 0],
      });
      group.add(entity.mesh);
      children.push(entity);
    }
  }

  const tieCount = Math.max(1, Math.round(length / tieSpacing));
  for (let t = 0; t <= tieCount; t++) {
    const i = Math.min(n, Math.round((t * length / tieSpacing) / ds));
    const p = pts[i];
    const pc = perp(p.heading);
    const tieLen = gauge + 0.8;
    const entity = createBox(sim, {
      size: [tieLen, tieThickness, 0.35],
      color: tieColor,
      mass: 0,
      position: [p.x, tieThickness / 2, p.z],
      rotation: [0, -Math.atan2(pc.z, pc.x), 0],
    });
    group.add(entity.mesh);
    children.push(entity);
  }

  const pe = pts[n];
  const segment = {
    curve: radius,
    length,
    entryPose: { point: [0, 0, 0], heading: 0, bank: 0 },
    exitPose: { point: [pe.x, 0, pe.z], heading: pe.heading, bank: 0 },
  };

  const seg = sim.addEntity(group, null, null);
  seg.children = children;
  seg.segment = segment;
  return seg;
}