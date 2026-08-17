// Composite primitives - reusable objects composed of multiple primitives.
// Built by composing the functions in primitives.js (e.g. createBox, createSphere).
// Track any created primitives so they can be removed together via sim.removeEntity(entity).

import * as THREE from "three";
import { createCylinder } from "./primitives.js";

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