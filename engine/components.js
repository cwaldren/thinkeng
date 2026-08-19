// Composite primitives - reusable objects composed of multiple primitives.
// Built by composing the functions in primitives.js (e.g. createBox, createSphere).
// Track any created primitives so they can be removed together via sim.removeEntity(entity).

import * as THREE from "three";
import * as CANNON from "cannon-es";
import { createCylinder, createSphere } from "./primitives.js";
import {
  TrackSegment,
  Track,
  InfiniteTrack,
  TrackFollower,
  getLocalSpinePose,
} from "./track.js";

export { TrackSegment, Track, InfiniteTrack, TrackFollower, getLocalSpinePose };

export function createGrass(sim, opts = {}) {
  const {
    width = 10,
    depth = 10,
    count = 200,
    color = 0x44aa55,
    height = 1,
    radiusBottom = 0.08,
    position = [0, 0, 0],
    radialSegments = 4,
  } = opts;

  const geo = new THREE.ConeGeometry(radiusBottom, height, radialSegments);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const instancedMesh = new THREE.InstancedMesh(geo, mat, count);
  instancedMesh.position.set(position[0], position[1], position[2]);
  instancedMesh.castShadow = true;
  instancedMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  for (let i = 0; i < count; i++) {
    const bladeScale = 0.6 + Math.random() * 0.8;
    const h = height * bladeScale;
    dummy.position.set(
      Math.random() * width - halfWidth,
      h / 2,
      Math.random() * depth - halfDepth,
    );
    dummy.rotation.set(
      (Math.random() - 0.5) * 0.35,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.35,
    );
    dummy.scale.set(bladeScale, bladeScale, bladeScale);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);
  }
  instancedMesh.instanceMatrix.needsUpdate = true;

  if (sim) {
    return sim.addEntity(instancedMesh, null, null);
  }
  return instancedMesh;
}

// A single train-track chunk: a pair of rails + ties laid out along a spine of
// arc-length `length`. `radius` controls the bend (0 => straight, huge => nearly
// straight, sign flips the turn direction). Built from plain Three meshes (no
// physics bodies) so it cleans up as one composite via sim.removeEntity(entity).
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
    entryHeading = 0,
    step = 3,
  } = opts;

  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  group.rotation.y = -entryHeading;

  const railMat = new THREE.MeshStandardMaterial({ color: railColor });
  const tieMat = new THREE.MeshStandardMaterial({ color: tieColor });

  // Plain mesh helper: an oriented box lying along the X-Y plane.
  const addBar = (w, h, d, x, y, z, ry, mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  const trackSegment = new TrackSegment({
    length,
    radius,
    position,
    entryHeading,
    mesh: group,
  });

  const n = Math.max(1, Math.round(length / step));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * length;
    const local = getLocalSpinePose(radius, length, s);
    pts.push({
      x: local.position.x,
      z: local.position.z,
      heading: local.heading,
    });
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
      addBar(
        len,
        railThickness,
        railWidth,
        (x1 + x2) / 2,
        railY,
        (z1 + z2) / 2,
        -ang,
        railMat,
      );
    }
  }

  const tieCount = Math.max(1, Math.round(length / tieSpacing));
  for (let t = 0; t <= tieCount; t++) {
    const s = Math.min(length, t * tieSpacing);
    const local = getLocalSpinePose(radius, length, s);
    const pc = perp(local.heading);
    const tieLen = gauge + 0.8;
    addBar(
      tieLen,
      tieThickness,
      0.35,
      local.position.x,
      tieThickness / 2,
      local.position.z,
      -Math.atan2(pc.z, pc.x),
      tieMat,
    );
  }

  const seg = sim.addEntity(group, null, null);
  seg.length = length;
  seg.radius = radius;
  seg.trackSegment = trackSegment;
  seg.getPoseAt = (s) => trackSegment.getPoseAt(s);
  seg.entryPose = trackSegment.entryPose;
  seg.exitPose = trackSegment.exitPose;
  seg.segment = {
    curve: radius,
    length,
    spine: pts,
    entryPose: {
      point: [
        trackSegment.entryPose.position.x,
        trackSegment.entryPose.position.y,
        trackSegment.entryPose.position.z,
      ],
      heading: trackSegment.entryPose.heading,
      position: trackSegment.entryPose.position,
    },
    exitPose: {
      point: [
        trackSegment.exitPose.position.x,
        trackSegment.exitPose.position.y,
        trackSegment.exitPose.position.z,
      ],
      heading: trackSegment.exitPose.heading,
      position: trackSegment.exitPose.position,
    },
  };
  return seg;
}

// A cowcatcher: a fan of skinny triangular wedges arranged side by side with
// small gaps between them, so they act as the teeth of a cowcatcher / plow.
// Decorative (no physics) — a purely visual attachment meant to be parented
// under another entity (e.g. a train), so it shares one group and cleans up as
// a single composite via sim.removeEntity.
export function createCowcatcher(sim, opts = {}) {
  const {
    count = 6,
    width = 0.32,
    gap = 0.16,
    depth = 2.2,
    height = 1.3,
    color = 0x222b33,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
  } = opts;

  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  group.rotation.set(rotation[0], rotation[1], rotation[2]);

  const w = width / 2;
  const d = depth / 2;

  const sl = Math.hypot(depth, height);
  const slant = [0, depth / sl, height / sl];

  const v = [
    [-w, 0, d], // 0 back-bottom-left
    [w, 0, d], // 1 back-bottom-right
    [-w, 0, -d], // 2 front-bottom-left
    [w, 0, -d], // 3 front-bottom-right
    [-w, height, -d], // 4 front-top-left
    [w, height, -d], // 5 front-top-right
  ];

  const faces = [
    { idx: [1, 3, 5], n: [1, 0, 0] }, // right end
    { idx: [0, 4, 2], n: [-1, 0, 0] }, // left end
    { idx: [0, 3, 1], n: [0, -1, 0] }, // bottom half 1
    { idx: [0, 2, 3], n: [0, -1, 0] }, // bottom half 2
    { idx: [2, 5, 3], n: [0, 0, -1] }, // front vertical half 1
    { idx: [2, 4, 5], n: [0, 0, -1] }, // front vertical half 2
    { idx: [0, 1, 5], n: slant }, // slanted half 1
    { idx: [0, 5, 4], n: slant }, // slanted half 2
  ];

  const positions = [];
  const normals = [];
  for (const f of faces) {
    for (const i of f.idx) {
      positions.push(v[i][0], v[i][1], v[i][2]);
      normals.push(f.n[0], f.n[1], f.n[2]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    "normal",
    new THREE.BufferAttribute(new Float32Array(normals), 3),
  );
  const material = new THREE.MeshStandardMaterial({ color });

  const step = width + gap;
  const startX = -((count - 1) * step) / 2;

  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(startX + i * step, 0, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return sim.addEntity(group, null, null);
}

// A bundle of three long, red dynamite sticks. Decorative (no physics).
// The sticks run parallel along the local +X axis and are arranged in the YZ
// plane as a triangular (equilateral) packing, so viewed edge-on they form a
// triangle. Composes createCylinder primitives under one group.
export function createDynamite(sim, opts = {}) {
  const {
    length = 2.4,
    radius = 0.18,
    color = 0xd93a2b,
    radialSegments = 16,
    position = [0, 0, 0],
    mass = 0, // > 0 attaches a single dynamic physics body to the bundle
  } = opts;

  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  const children = [];

  // Equilateral triangle (side 2r, centroid at origin) in the YZ plane so the
  // three equal cylinders touch and pack into a triangle when viewed edge-on.
  const R = (2 * radius) / Math.sqrt(3);
  const offsets = [
    [R, 0],
    [-R / 2, -radius],
    [-R / 2, radius],
  ];

  for (const [y, z] of offsets) {
    const stick = createCylinder(sim, {
      radiusTop: radius,
      radiusBottom: radius,
      height: length,
      color,
      mass: 0,
      position: [0, y, z],
      rotation: [0, 0, Math.PI / 2],
      radialSegments,
    });
    group.add(stick.mesh);
    children.push(stick);
  }

  const entity = sim.addEntity(group, null, null);
  entity.children = children;

  if (mass > 0) {
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Box(
        new CANNON.Vec3(length / 2, radius * 1.4, radius * 1.4),
      ),
      linearDamping: 0.1,
      angularDamping: 0.2,
    });
    body.position.set(position[0], position[1], position[2]);
    body.updateMassProperties();
    sim.world.addBody(body);
    entity.body = body;
  }

  return entity;
}

// A simple steam locomotive composite. Travels along its local +X axis (matching
// the spine direction used by createRailSegment, so local +X is "forward").
// Built from plain Three meshes with no physics body — it is driven analytically
// by the game (set entity.mesh.position / rotation each frame).
export function createTrain(sim, opts = {}) {
  const {
    position = [0, 0, 0],
    bodyColor = 0xc23b2e,
    cabColor = 0x8a2b22,
    accentColor = 0x334455,
    trimColor = 0x222b33,
    wheelColor = 0x1a1a1a,
  } = opts;

  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);

  const addMesh = (geometry, color, x, y, z, rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const railY = 0.5;
  const wheelR = 0.42;
  const axleY = railY + wheelR;
  const halfGauge = 0.75;

  // Horizontal spans (local +X = forward): cab [-3.8,-1.4] (len 2.4),
  // hood [-1.4,0.0] (len 1.4), boiler [0.0,3.6] (len 3.6) — each starts
  // exactly where the previous ends, so the body is seamless.
  // Chassis box running the length of the locomotive.
  addMesh(
    new THREE.BoxGeometry(7.2, 0.5, 1.8),
    trimColor,
    0.6,
    railY + 0.45,
    0,
  );

  // Boiler: horizontal cylinder along +X (cylinder axis is Y by default).
  const boiler = addMesh(
    new THREE.CylinderGeometry(0.68, 0.68, 3.6, 20),
    bodyColor,
    1.8,
    railY + 0.45 + 0.68,
    0,
    [0, 0, Math.PI / 2],
  );

  // Firebox / hood in front of the cab.
  addMesh(
    new THREE.BoxGeometry(1.4, 1.2, 1.6),
    bodyColor,
    -0.7,
    railY + 0.45 + 1.0,
    0,
  );

  // Cab at the rear.
  addMesh(
    new THREE.BoxGeometry(2.4, 2.1, 1.9),
    cabColor,
    -2.6,
    railY + 0.45 + 1.9,
    0,
  );

  // Cab roof.
  addMesh(
    new THREE.BoxGeometry(2.6, 0.16, 2.1),
    trimColor,
    -2.6,
    railY + 0.45 + 3.05,
    0,
  );

  // Smokestack on the front of the boiler.
  addMesh(
    new THREE.CylinderGeometry(0.24, 0.3, 1.0, 14),
    trimColor,
    3.55,
    railY + 0.45 + 0.68 + 1.1,
    0,
  );

  // Steam dome / sand dome on top of the boiler.
  addMesh(
    new THREE.CylinderGeometry(0.22, 0.24, 0.7, 14),
    accentColor,
    1.6,
    railY + 0.45 + 0.68 + 0.85,
    0,
  );

  // Wheels: three axles, two sides.
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.18, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: wheelColor });
  for (const x of [-2.6, -0.7, 1.5]) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, axleY, side * (halfGauge + 0.05));
      wheel.rotation.x = Math.PI / 2;
      wheel.castShadow = true;
      wheel.receiveShadow = true;
      group.add(wheel);
    }
  }

  return sim.addEntity(group, null, null);
}

// Lightweight reusable FPS counter overlay. Displays in upper right corner.
export function createFPSCounter(sim, opts = {}) {
  const {
    color = "rgba(255, 255, 255, 0.6)",
    fontSize = "0.75rem",
    updateInterval = 0.25,
  } = opts;

  const el = document.createElement("div");
  el.id = "fps-counter";
  el.style.position = "absolute";
  el.style.top = "12px";
  el.style.right = "14px";
  el.style.fontFamily = "monospace, sans-serif";
  el.style.fontSize = fontSize;
  el.style.color = color;
  el.style.letterSpacing = "0.05em";
  el.style.pointerEvents = "none";
  el.style.userSelect = "none";
  el.style.zIndex = "1000";
  el.textContent = "FPS 60";

  const container = sim?.container || document.body;
  container.appendChild(el);

  let frameCount = 0;
  let timeAccum = 0;

  const updateFn = (dt) => {
    frameCount++;
    timeAccum += dt;
    if (timeAccum >= updateInterval) {
      const fps = Math.round(frameCount / timeAccum);
      el.textContent = `FPS ${fps}`;
      frameCount = 0;
      timeAccum = 0;
    }
  };

  const entity = {
    mesh: null,
    body: null,
    updateFn,
    element: el,
    dispose: () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    },
  };

  if (sim) {
    sim.entities.add(entity);
  }
  return entity;
}

// A simple bunny composite made of spheres and ellipsoids.
// Decorative by default (mass = 0), or can have a physics body if mass > 0.
export function createBunny(sim, opts = {}) {
  const {
    color = 0xffffff,
    eyeColor = 0x222222,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    mass = 0,
  } = opts;

  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  group.rotation.set(rotation[0], rotation[1], rotation[2]);
  const children = [];

  const addSphere = (radius, col, pos, scale = [1, 1, 1], rot = [0, 0, 0]) => {
    const part = createSphere(sim, {
      radius,
      color: col,
      mass: 0,
      position: pos,
    });
    part.mesh.scale.set(scale[0], scale[1], scale[2]);
    part.mesh.rotation.set(rot[0], rot[1], rot[2]);
    group.add(part.mesh);
    children.push(part);
    return part;
  };

  // Body (ellipsoid)
  addSphere(0.55, color, [0, 0.5, 0], [1.0, 0.9, 1.15]);

  // Head
  addSphere(0.38, color, [0, 0.95, 0.42], [1.0, 0.95, 1.0]);

  // Ears (single ellipsoid each)
  addSphere(0.3, color, [-0.18, 1.55, 0.35], [0.3, 1.3, 0.2], [0.1, 0, -0.15]);
  addSphere(0.3, color, [0.18, 1.55, 0.35], [0.3, 1.3, 0.2], [0.1, 0, 0.15]);

  // Eyes
  addSphere(0.05, eyeColor, [-0.18, 1.02, 0.68]);
  addSphere(0.05, eyeColor, [0.18, 1.02, 0.68]);

  // Tail
  addSphere(0.26, color, [0, 0.5, -0.72]);

  // Paws & feet
  addSphere(0.12, color, [-0.2, 0.06, 0.35], [0.8, 0.5, 1.2]);
  addSphere(0.12, color, [0.2, 0.06, 0.35], [0.8, 0.5, 1.2]);
  addSphere(0.18, color, [-0.35, 0.09, -0.15], [0.7, 0.5, 1.4], [0, -0.15, 0]);
  addSphere(0.18, color, [0.35, 0.09, -0.15], [0.7, 0.5, 1.4], [0, 0.15, 0]);

  const entity = sim.addEntity(group, null, null);
  entity.children = children;

  if (mass > 0) {
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Sphere(0.65),
      linearDamping: 0.1,
      angularDamping: 0.2,
    });
    body.position.set(position[0], position[1], position[2]);
    body.quaternion.setFromEuler(rotation[0], rotation[1], rotation[2]);
    body.updateMassProperties();
    sim.world.addBody(body);
    entity.body = body;
  }

  return entity;
}

export const createBunnie = createBunny;

