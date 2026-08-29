// Composite primitives - reusable objects composed of multiple primitives.
// Built by composing the functions in primitives.js (e.g. createBox, createSphere).
// Track any created primitives so they can be removed together via sim.removeEntity(entity).

import * as THREE from "three";
import * as CANNON from "cannon-es";
import { createCylinder, createSphere, createBox } from "./primitives.js";
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
    return sim.addEntity(instancedMesh, null, null, "grass");
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

  const seg = sim.addEntity(group, null, null, "rail");
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

  return sim.addEntity(group, null, null, "cowcatcher");
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

  const entity = sim.addEntity(group, null, null, "dynamite");
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

// A simple sign: a cylindrical post with a rectangular signboard on top.
// Decorative (no physics). Composes createCylinder + createBox primitives.
// The board's front face (local +Z) can render text from a canvas texture.
export function createSign(sim, opts = {}) {
  const {
    postHeight = 2.2,
    postRadius = 0.12,
    postColor = 0x8a6d4b,
    boardWidth = 1.6,
    boardHeight = 0.7,
    boardThickness = 0.1,
    boardColor = 0xffffff,
    text = "",
    textColor = 0x222222,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
  } = opts;

  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  group.rotation.set(rotation[0], rotation[1], rotation[2]);
  const children = [];

  const post = createCylinder(sim, {
    radiusTop: postRadius,
    radiusBottom: postRadius,
    height: postHeight,
    color: postColor,
    mass: 0,
    position: [0, postHeight / 2, 0],
    radialSegments: 12,
  });
  group.add(post.mesh);
  children.push(post);

  const board = createBox(sim, {
    size: [boardWidth, boardHeight, boardThickness],
    color: boardColor,
    mass: 0,
    position: [0, postHeight + boardHeight / 2, 0],
  });
  group.add(board.mesh);
  children.push(board);

  if (text) {
    const canvas = document.createElement("canvas");
    const px = 64;
    canvas.width = Math.round(boardWidth * px);
    canvas.height = Math.round(boardHeight * px);
    const ctx = canvas.getContext("2d");
    const boardHex = Number(boardColor).toString(16).padStart(6, "0");
    const textHex = Number(textColor).toString(16).padStart(6, "0");
    ctx.fillStyle = `#${boardHex}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `#${textHex}`;
    ctx.font = `bold ${Math.round(canvas.height * 0.6)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const textMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(boardWidth, boardHeight),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    textMesh.position.set(
      0,
      postHeight + boardHeight / 2,
      boardThickness / 2 + 0.001,
    );
    group.add(textMesh);
  }

  const entity = sim.addEntity(group, null, null, "sign");
  entity.children = children;
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

  return sim.addEntity(group, null, null, "train");
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

// A heads-up overlay showing JavaScript heap / GC pressure, complementing the
// FPS counter. Uses `performance.memory` (available in Chromium/Chrome), so on
// other browsers it falls back to a placeholder note. Highlighting the growing
// used-heap is the fastest way to spot a per-frame allocation leak (which shows
// up as a sawtooth of GC drops on the FPS counter).
export function createGCStats(sim, opts = {}) {
  const {
    color = "rgba(120, 220, 160, 0.75)",
    fontSize = "0.75rem",
    updateInterval = 0.5,
  } = opts;

  const el = document.createElement("div");
  el.id = "gc-stats";
  el.style.position = "absolute";
  el.style.top = "34px";
  el.style.right = "14px";
  el.style.fontFamily = "monospace, sans-serif";
  el.style.fontSize = fontSize;
  el.style.color = color;
  el.style.letterSpacing = "0.05em";
  el.style.pointerEvents = "none";
  el.style.userSelect = "none";
  el.style.zIndex = "1000";
  el.style.textAlign = "right";

  const mem = performance.memory;
  el.textContent = mem ? "heap -- MB" : "GC: n/a (heap API unavailable)";

  const container = sim?.container || document.body;
  container.appendChild(el);

  let timeAccum = 0;
  const mb = (n) => (n / (1024 * 1024)).toFixed(1);

  const updateFn = (dt) => {
    timeAccum += dt;
    if (timeAccum < updateInterval || !mem) return;
    timeAccum = 0;
    const used = mem.usedJSHeapSize;
    const total = mem.totalJSHeapSize;
    const limit = mem.jsHeapSizeLimit;
    const pct = Math.round((used / limit) * 100);
    // Color shifts toward red as we approach the heap limit (leak warning).
    el.style.color = pct > 80 ? "rgba(255,120,90,0.85)" : color;
    el.textContent = `GC heap ${mb(used)} / ${mb(total)} MB (${pct}%)`;
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

// A heads-up overlay listing the live entity count, grouped by type. Reads the
// simulation's entity set, where each entity is typed via `sim.addEntity(..., type)`
// (or inferred from its shape). Great for spotting leaked/duplicated entities
// (e.g. after a hot reload) and for seeing why a scene is becoming expensive.
export function createEntityStats(sim, opts = {}) {
  const {
    color = "rgba(150, 210, 255, 0.8)",
    fontSize = "0.75rem",
    updateInterval = 0.5,
    showUnlabeled = true,
  } = opts;

  const el = document.createElement("div");
  el.id = "entity-stats";
  el.style.position = "absolute";
  el.style.top = "56px";
  el.style.right = "14px";
  el.style.fontFamily = "monospace, sans-serif";
  el.style.fontSize = fontSize;
  el.style.color = color;
  el.style.letterSpacing = "0.03em";
  el.style.lineHeight = "1.35";
  el.style.whiteSpace = "pre-line"; // render \n as line breaks
  el.style.pointerEvents = "none";
  el.style.userSelect = "none";
  el.style.zIndex = "1000";
  el.style.textAlign = "right";
  el.textContent = "entities --";

  const container = sim?.container || document.body;
  container.appendChild(el);

  // Fallback label for entities created without an explicit type.
  const inferType = (e) => {
    if (e.body) return "physics";
    if (e.mesh) return "visual";
    if (e.updateFn) return "logic";
    return "?";
  };

  let timeAccum = 0;

  const updateFn = (dt) => {
    timeAccum += dt;
    if (timeAccum < updateInterval) return;
    timeAccum = 0;

    const counts = new Map();
    let total = 0;
    for (const entity of sim.entities) {
      const t = entity.type || inferType(entity);
      counts.set(t, (counts.get(t) || 0) + 1);
      total++;
    }

    const parts = [];
    const keys = [...counts.keys()].sort();
    for (const t of keys) {
      if (!showUnlabeled && t === "?") continue;
      parts.push(`${t} ${counts.get(t)}`);
    }
    el.textContent = `entities ${total}\n${parts.join("\n")}`;
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

  // Eyes: black eyeballs on the sides of the head, each with a smaller white
  // pupil dot on its forward-facing surface so the eye reads from the front.
  const eyeBlackR = 0.085;
  const eyeWhiteR = 0.045;
  const eyeY = 1.02;
  const eyeZ = 0.6;
  const sideX = 0.33;
  // Pupil center sits just inside the eyeball's front surface (not poking out).
  const pupilOut = eyeBlackR - eyeWhiteR - 0.01;
  const eyeRot = [0, 0, Math.PI / 2];
  addSphere(eyeBlackR, eyeColor, [-sideX, eyeY, eyeZ], [1, 1, 1], eyeRot);
  addSphere(eyeBlackR, eyeColor, [sideX, eyeY, eyeZ], [1, 1, 1], eyeRot);
  addSphere(eyeWhiteR, 0xffffff, [-sideX * 0.92, eyeY + 0.02, eyeZ + pupilOut], [1, 1, 1], eyeRot);
  addSphere(eyeWhiteR, 0xffffff, [sideX * 0.92, eyeY + 0.02, eyeZ + pupilOut], [1, 1, 1], eyeRot);

  // Tail
  addSphere(0.26, color, [0, 0.5, -0.72]);

  // Paws & feet
  addSphere(0.12, color, [-0.2, 0.06, 0.35], [0.8, 0.5, 1.2]);
  addSphere(0.12, color, [0.2, 0.06, 0.35], [0.8, 0.5, 1.2]);
  addSphere(0.18, color, [-0.35, 0.09, -0.15], [0.7, 0.5, 1.4], [0, -0.15, 0]);
  addSphere(0.18, color, [0.35, 0.09, -0.15], [0.7, 0.5, 1.4], [0, 0.15, 0]);

  const entity = sim.addEntity(group, null, null, "bunny");
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

// A gatling gun: 5 thin barrels bundled in a circle (like dynamite sticks),
// mounted on a vertical post and base plate. start() begins barrel rotation,
// stop() halts it. Decorative (no physics) — built from createCylinder + createBox.
export function createGatlingGun(sim, opts = {}) {
  const {
    barrelCount = 5,
    barrelRadius = 0.06,
    barrelLength = 3.0,
    color = 0x3a3a3e,
    barrelColor = 0x555558,
    baseColor = 0x2a2a2e,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    speed = 12,
  } = opts;

  const group = new THREE.Group();
  // Center geometry so the gallery camera (orbiting y=1) frames it nicely.
  const R = (2 * barrelRadius) / Math.sqrt(3);
  const postHeight = 0.7;
  const halfLen = barrelLength / 2;
  const centerY = (R + barrelRadius - (R + barrelRadius + postHeight)) / 2;
  group.position.set(
    position[0] - halfLen,
    position[1] - centerY,
    position[2],
  );
  group.rotation.set(rotation[0], rotation[1], rotation[2]);
  const children = [];

  // Barrel group — spins around the local X axis
  const barrelGroup = new THREE.Group();
  group.add(barrelGroup);

  // Pack barrels in a circle in the YZ plane (all run along +X, like dynamite)
  for (let i = 0; i < barrelCount; i++) {
    const angle = (i / barrelCount) * Math.PI * 2;
    const y = Math.cos(angle) * R;
    const z = Math.sin(angle) * R;
    const stick = createCylinder(sim, {
      radiusTop: barrelRadius,
      radiusBottom: barrelRadius,
      height: barrelLength,
      color: barrelColor,
      mass: 0,
      position: [barrelLength / 2, y, z],
      rotation: [0, 0, Math.PI / 2],
      radialSegments: 12,
    });
    barrelGroup.add(stick.mesh);
    children.push(stick);
  }

  // Support ring — short cylinder band around the barrel bundle
  const ringRadius = R + barrelRadius + 0.04;
  const ring = createCylinder(sim, {
    radiusTop: ringRadius,
    radiusBottom: ringRadius,
    height: 0.12,
    color,
    mass: 0,
    position: [barrelLength * 0.18, 0, 0],
    rotation: [0, 0, Math.PI / 2],
    radialSegments: 24,
  });
  barrelGroup.add(ring.mesh);
  children.push(ring);

  // Second support ring near the muzzle end
  const ring2 = createCylinder(sim, {
    radiusTop: ringRadius,
    radiusBottom: ringRadius,
    height: 0.10,
    color,
    mass: 0,
    position: [barrelLength * 0.82, 0, 0],
    rotation: [0, 0, Math.PI / 2],
    radialSegments: 24,
  });
  barrelGroup.add(ring2.mesh);
  children.push(ring2);

  // Mounting post — vertical cylinder below the barrel bundle back end
  const post = createCylinder(sim, {
    radiusTop: 0.1,
    radiusBottom: 0.12,
    height: postHeight,
    color: baseColor,
    mass: 0,
    position: [0.15, -(R + barrelRadius) - postHeight / 2, 0],
    radialSegments: 10,
  });
  group.add(post.mesh);
  children.push(post);

  // Rotation state
  let spinning = false;

  const updateFn = (dt) => {
    if (spinning) {
      barrelGroup.rotation.x += speed * dt;
    }
  };

  const entity = sim.addEntity(group, null, updateFn, "gatling");
  entity.children = children;

  entity.start = () => {
    spinning = true;
  };
  entity.stop = () => {
    spinning = false;
  };

  return entity;
}

// A manual push lawnmower: two parallel reel rings connected by a spiral
// (helix) of cutting blades, with a push handle leading up-and-back. Purely
// decorative (no physics). Composes createCylinder primitives plus plain
// box meshes for the helix blades, all under one group.
export function createLawnmower(sim, opts = {}) {
  const {
    wheelRadius = 0.5,
    ringThickness = 0.18,
    bodyColor = 0x2a3d56,
    bladeColor = 0xb8c2cc,
    wheelColor = 0x1a1a1a,
    reelWidth = 1.0,
    bladeThickness = 0.03,
    handleAngle = 0.55,
    handleLength = 1.5,
    reelRatio = 2,
    blades = 4,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
  } = opts;

  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  group.rotation.set(rotation[0], rotation[1], rotation[2]);
  const children = [];

  const halfReel = reelWidth / 2;

  // The reel and each wheel get their own pivot so they can spin about their
  // own hub. Each pivot sits ON the part's centerline (height wheelRadius), so
  // rotation makes it spin in place rather than orbit the ground-level axle.
  const wheelPivots = [];
  const reelPivot = new THREE.Group();
  reelPivot.position.set(0, wheelRadius, 0);
  group.add(reelPivot);

  // Two parallel reel rings (thin discs), lying in the YZ plane with the reel
  // axis along local X. Axle along X, rings at each end. Each sits in its own
  // hub pivot so it spins about its own center (height wheelRadius).
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * halfReel, wheelRadius, 0);
    group.add(pivot);
    const ring = createCylinder(sim, {
      radiusTop: wheelRadius,
      radiusBottom: wheelRadius,
      height: ringThickness,
      color: wheelColor,
      mass: 0,
      position: [0, 0, 0],
      rotation: [0, 0, Math.PI / 2],
      radialSegments: 24,
    });
    pivot.add(ring.mesh);
    children.push(ring);
    wheelPivots.push(pivot);
  }

  // Spiral (helix) of cutting blades running between the two rings, wrapping
  // around the reel axis (local X). Each blade is a thin box tangent to the
  // drum, twisted progressively so together they form a helix.
  const bladeLen = reelWidth;
  const bladeMat = new THREE.MeshStandardMaterial({ color: bladeColor });
  for (let i = 0; i < blades; i++) {
    const twist = (i / blades) * Math.PI * 2;
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(bladeLen, bladeThickness, wheelRadius * 1.4),
      bladeMat,
    );
    // Sit the blade against the drum surface, tangent along its length, with a
    // progressive twist around the X axis so the set forms a helix. The blade
    // is centered on the reelPivot origin (at height wheelRadius).
    blade.position.set(0, 0, 0);
    blade.rotation.set(
      twist,
      0,
      0,
    );
    blade.castShadow = true;
    blade.receiveShadow = true;
    reelPivot.add(blade);
  }

  // Push handle: two handlebar tubes of fixed length rising up-and-back from
  // the reel axle, meeting a horizontal grip across the top. handleAngle
  // (radians from vertical) tilts the handle, keeping handleLength constant.
  const handleSpread = 0.22;
  const gripY = wheelRadius + handleLength * Math.cos(handleAngle);
  const gripZ = handleLength * Math.sin(handleAngle);
  const handleMat = new THREE.MeshStandardMaterial({ color: bodyColor });
  // The tube already has length handleLength (its angle is handleAngle), so it
  // runs exactly from the axle to the grip.
  for (const side of [-1, 1]) {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, handleLength, 8),
      handleMat,
    );
    tube.position.set(side * handleSpread, (gripY + wheelRadius) / 2, gripZ / 2);
    tube.rotation.x = handleAngle;
    tube.castShadow = true;
    tube.receiveShadow = true;
    group.add(tube);
  }
  // Grip bar spans exactly between the two tube tops.
  const grip = createCylinder(sim, {
    radiusTop: 0.025,
    radiusBottom: 0.025,
    height: handleSpread * 2 + 0.05,
    color: bodyColor,
    mass: 0,
    position: [0, gripY, gripZ],
    rotation: [0, 0, Math.PI / 2],
    radialSegments: 8,
  });
  group.add(grip.mesh);
  children.push(grip);

  // Rotation state: the mower is pushed at a forward speed (local +Z). Wheels
  // spin at speed/wheelRadius; the reel spins reelRatio times faster.
  let speed = 0;
  let wheelAngle = 0;
  let reelAngle = 0;

  const updateFn = (dt) => {
    if (speed === 0) return;
    const wheelOmega = speed / wheelRadius;
    wheelAngle = (wheelAngle + wheelOmega * dt) % (Math.PI * 2);
    reelAngle = (reelAngle + reelRatio * wheelOmega * dt) % (Math.PI * 2);
    for (const pivot of wheelPivots) pivot.rotation.x = wheelAngle;
    reelPivot.rotation.x = reelAngle;
  };

  const entity = sim.addEntity(group, null, updateFn, "lawnmower");
  entity.children = children;

  // Forward speed in m/s (local +Z). 0 stops. Negative pushes backward/reverses.
  entity.setSpeed = (v) => {
    speed = v;
  };

  return entity;
}

// A flat triangular butterfly wing (a single 3-vertex plane). Pure decorative
// mesh - no physics. Drawn lying in the XZ plane with its base along Z and the
// apex at the far +X corner, so a pivot at x=0 lets it flare out to the side.
// Geometry is cached per side so many butterflies share the same vertex buffers
// instead of each uploading its own (keeps render GPU cost flat regardless of
// how many butterflies are spawned).
function makeButterflyWing(span, depth, side) {
  const key = `${span}_${depth}_${side}`;
  let geo = butterflyWingGeos.get(key);
  if (!geo) {
    geo = new THREE.BufferGeometry();
    // Single vertex (apex) at the body (x=0); the wide base flares outward to
    // ±X. The geometry is mirrored per side (side = -1 left, +1 right) so BOTH
    // wings rotate identically and flap in sync, instead of opposing.
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [0, 0, 0, side * span, 0, -depth, side * span, 0, depth],
        3,
      ),
    );
    geo.computeVertexNormals();
    butterflyWingGeos.set(key, geo);
  }
  return geo;
}
const butterflyWingGeos = new Map();
let butterflyBodyGeo = null;
let butterflyBodyMat = null;

// A single butterfly model: a tiny cylinder body with one flat triangular wing
// on each side that flaps up and down by rotating about the body's long axis.
// The component ONLY builds the model and animates the wing flap — it does NOT
// move or position the butterfly. The game places it by setting entity.mesh.
//position / .rotation and drives the flap speed via entity.flap(speed).
export function createButterfly(sim, opts = {}) {
  const {
    bodyColor = 0x222222,
    wingColor = 0xffb347,
    wingSpan = 0.3,
    wingDepth = 0.32,
    bodyLength = 0.1,
    bodyRadius = 0.02,
    position = [0, 0, 0],
  } = opts;

  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  const children = [];

  // Body: a tiny cylinder lying along the flight axis (+Z). Built as a plain
  // Three mesh - the butterfly is pure decoration, so it creates NO physics
  // body (a decorative component must not add bodies to the physics world).
  // Geometry and material are shared across butterflies to keep GPU cost flat.
  if (!butterflyBodyGeo) {
    butterflyBodyGeo = new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyLength, 6);
    butterflyBodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6 });
  }
  const body = new THREE.Mesh(butterflyBodyGeo, butterflyBodyMat);
  body.rotation.x = Math.PI / 2; // axis along +Z (flight direction)
  body.castShadow = false; // tiny decorative insect - no shadow cost
  group.add(body);
  children.push(body);

  // Wings: one flat triangle on each side, each on its own pivot so it can
  // flap about the body's long (Z) axis. Both wings are mirrored in geometry
  // and share the same rotation, so they flap together in sync.
  const wingRoot = bodyRadius + 0.01;
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * wingRoot, 0, 0);
    const wing = new THREE.Mesh(
      makeButterflyWing(wingSpan, wingDepth, side),
      new THREE.MeshStandardMaterial({
        color: wingColor,
        roughness: 0.8,
        side: THREE.DoubleSide,
      }),
    );
    wing.castShadow = false;
    pivot.add(wing);
    group.add(pivot);
    wings.push(pivot);
  }

  // Animation state: only the wing-flap phase. Movement is owned by the game.
  const flap = {
    phase: Math.random() * Math.PI * 2,
    speed: 14,
  };

  const updateFn = (dt) => {
    // Wings hinge about the body's long (Z) axis; opposite signs on the
    // mirrored wings lift both outer edges up together and down together.
    flap.phase = (flap.phase + flap.speed * dt) % (Math.PI * 2);
    const angle = Math.sin(flap.phase) * 0.85;
    wings[0].rotation.z = -angle;
    wings[1].rotation.z = angle;
  };

  const entity = sim.addEntity(group, null, updateFn, "butterfly");
  entity.children = children;

  // Set the flap speed (rad/s of wing beat). The game calls this to speed up
  // the flapping (e.g. when the butterfly hurries away).
  entity.setFlapSpeed = (v) => {
    flap.speed = v;
  };

  return entity;
}

// A single dragonfly model: a slender cylinder body with two sets of flat,
// rectangular wings on each side (forewings + hindwings) that flap up and down
// by rotating about the body's long axis (much faster than a butterfly). The
// component ONLY builds the model and animates the wing flap — it does NOT move
// or position the dragonfly. The game places it by setting entity.mesh.position /
// .rotation and drives the flap speed via entity.setFlapSpeed.
const dragonflyWingGeos = new Map();
let dragonflyBodyGeo = null;
let dragonflyBodyMat = null;

// A flat rectangular dragonfly wing lying in the XZ plane, extending span from
// the body (x=0) out to the side. The leading edge runs along +Z (flight
// direction). The sweep is baked INTO the geometry: a rotation about the
// dragonfly's vertical (Y) axis swings the wing's outer edge fore/back, so the
// fore and hind wings splay apart like >< in plan view. The mesh only ever
// applies a clean 180° side flip — no Euler rotation mixing that would shear
// the wing. Geometry is cached per span/depth/sweep so many dragonflies share
// the same vertex buffers.
function makeDragonflyWing(span, depth, sweepDeg, side) {
  const key = `${span}_${depth}_${sweepDeg}_${side}`;
  let geo = dragonflyWingGeos.get(key);
  if (!geo) {
    // A flat rectangle: full span along X (with the body at x=0), chord along Z.
    geo = new THREE.PlaneGeometry(span, depth);
    geo.rotateX(Math.PI / 2); // lay flat in the XZ plane
    geo.translate(span / 2, 0, 0); // root at x=0 so it flares out from the body
    // Sweep about the vertical (Y) axis: anchor at the root (x=0) and rotate the
    // outer edge fore (+Z) for positive sweep, back (-Z) for negative. The sign
    // is multiplied by side so the sweep reads the same on both wings despite
    // the per-side 180° Y-flip of the mesh (which would otherwise invert it on
    // the left). Baked per span/depth/sweep so many dragonflies share buffers.
    if (sweepDeg) geo.rotateY(THREE.MathUtils.degToRad(sweepDeg * side));
    dragonflyWingGeos.set(key, geo);
  }
  return geo;
}

export function createDragonfly(sim, opts = {}) {
  const {
    bodyColor = 0x2a2a2a,
    wingColor = 0xcfe8ff,
    wingSpan = 0.4,
    wingDepth = 0.14,
    bodyLength = 0.18,
    bodyRadius = 0.02,
    position = [0, 0, 0],
    wingTilt = -6, // deg: Y-axis sweep of each wing set from parallel (fore +, hind -)
  } = opts;

  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  const children = [];

  // Body: a slender cylinder lying along the flight axis (+Z). Decorative, so
  // it creates NO physics body. Geometry and material shared across dragonflies.
  if (!dragonflyBodyGeo) {
    dragonflyBodyGeo = new THREE.CylinderGeometry(
      bodyRadius,
      bodyRadius,
      bodyLength,
      6,
    );
    dragonflyBodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.6,
    });
  }
  const body = new THREE.Mesh(dragonflyBodyGeo, dragonflyBodyMat);
  body.rotation.x = Math.PI / 2; // axis along +Z (flight direction)
  body.castShadow = false;
  group.add(body);
  children.push(body);

  // Two sets of wings per side (forewing + hindwing), each on its own pivot so
  // they can flap about the body's long (Z) axis. Both sides share identical
  // rotation so all four wings flap together in sync.
  const wingRoot = bodyRadius + 0.01;
  const wings = [];
  for (const side of [-1, 1]) {
    // Forewing (front, leading edge deeper along +Z), swept +wingTilt forward.
    const forePivot = new THREE.Group();
    forePivot.position.set(side * wingRoot, 0, wingDepth * 0.6);
    const fore = new THREE.Mesh(
      makeDragonflyWing(wingSpan, wingDepth, wingTilt, side),
      new THREE.MeshStandardMaterial({
        color: wingColor,
        roughness: 0.6,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      }),
    );
    // Flip the shared wing geometry on the left side so wings extend outward
    // (toward -X) instead of both sets pointing toward +X.
    fore.rotation.y = side === -1 ? Math.PI : 0;
    fore.castShadow = false;
    forePivot.add(fore);
    group.add(forePivot);
    wings.push(forePivot);

    // Hindwing (rear, slightly shorter, back along -Z), swept -wingTilt back so
    // the fore/hind sets splay apart like >< in plan view (about 20° between them).
    const hindPivot = new THREE.Group();
    hindPivot.position.set(side * wingRoot, 0, -wingDepth * 0.6);
    const hind = new THREE.Mesh(
      makeDragonflyWing(wingSpan * 0.8, wingDepth, -wingTilt, side),
      new THREE.MeshStandardMaterial({
        color: wingColor,
        roughness: 0.6,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      }),
    );
    hind.castShadow = false;
    hind.rotation.y = side === -1 ? Math.PI : 0;
    hindPivot.add(hind);
    group.add(hindPivot);
    wings.push(hindPivot);
  }

  // Animation state: only the wing-flap phase. Movement is owned by the game.
  const flap = {
    phase: Math.random() * Math.PI * 2,
    speed: 64, // much faster than a butterfly's 14 rad/s wing beat
  };

  const updateFn = (dt) => {
    flap.phase = (flap.phase + flap.speed * dt) % (Math.PI * 2);
    const angle = Math.sin(flap.phase) * 0.6;
    // Front set (indices 0, 2) and hind set (1, 3) flap together, opposites on
    // each side lift both outer edges up together and down together.
    wings[0].rotation.z = -angle;
    wings[1].rotation.z = -angle;
    wings[2].rotation.z = angle;
    wings[3].rotation.z = angle;
  };

  const entity = sim.addEntity(group, null, updateFn, "dragonfly");
  entity.children = children;

  entity.setFlapSpeed = (v) => {
    flap.speed = v;
  };

  return entity;
}

// A swarm of small flying midges (flies/gnats) that hover in place and dart
// from spot to spot across the lawn. Rendered as one instanced mesh of tiny
// two-segment bodies (thorax + head) that face their direction of flight; they
// scatter as a group when frightened.
export function createFlies(sim, opts = {}) {
  const {
    count = 20,
    color = 0xffffff,
    size = 0.035,
    spread = 30,
    hoverHeight = [0.5, 1.3],
    dwellTime = [2, 5],
    flightTime = [0.6, 1.4],
    position = [0, 0, 0],
  } = opts;

  const geo = new THREE.SphereGeometry(size, 6, 4);
  const headGeo = new THREE.SphereGeometry(size * 0.75, 6, 4);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const instancedMesh = new THREE.InstancedMesh(geo, mat, count);
  // Head: a second instanced body sphere in front of the thorax along the fly's
  // facing direction, so each fly reads as a tiny two-segment body.
  const headMesh = new THREE.InstancedMesh(headGeo, mat, count);
  const HEAD_OFF = size * 0.8; // center-to-center gap (spheres overlap a touch)
  instancedMesh.add(headMesh);
  instancedMesh.position.set(position[0], position[1], position[2]);
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  headMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instancedMesh.frustumCulled = false;
  headMesh.frustumCulled = false;
  instancedMesh.castShadow = false; // tiny decorative insects - no shadow cost
  headMesh.castShadow = false;

  const dummy = new THREE.Object3D();
  const headDummy = new THREE.Object3D();
  const half = spread / 2;
  const flies = [];
  for (let i = 0; i < count; i++) {
    flies.push({
      x: Math.random() * spread - half,
      z: Math.random() * spread - half,
      h: hoverHeight[0] + Math.random() * (hoverHeight[1] - hoverHeight[0]),
      phase: Math.random() * Math.PI * 2,
      tx: 0, tz: 0, th: 0,
      moving: false,
      panicT: 0,
      timer: (dwellTime[0] + Math.random() * (dwellTime[1] - dwellTime[0])) / 2,
      dur: 0,
    });
  }

  const updateFn = (dt) => {
    // Each fly has its own remaining panic time; the ones near the fright
    // point get a fresh burst, the rest just keep waiting it out.
    for (let i = 0; i < count; i++) {
      const f = flies[i];
      f.phase = (f.phase + dt * (f.panicT > 0 ? 12 : 2)) % (Math.PI * 2);
      if (f.panicT > 0) f.panicT -= dt;
      if (f.panicT > 0) {
        // Scatter: jitter upward and outward, then settle with a timer.
        f.h = Math.min(2.5, f.h + dt * (Math.random() + 0.5));
        f.timer += dt;
      } else if (!f.moving) {
        f.timer += dt;
        if (f.timer > dwellTime[0] + Math.random() * (dwellTime[1] - dwellTime[0])) {
          f.tx = Math.random() * spread - half;
          f.tz = Math.random() * spread - half;
          f.th = hoverHeight[0] + Math.random() * (hoverHeight[1] - hoverHeight[0]);
          f.dur = flightTime[0] + Math.random() * (flightTime[1] - flightTime[0]);
          f.timer = 0;
          f.moving = true;
        }
      } else {
        const t = Math.min(1, f.timer / f.dur);
        const e = t * t * (3 - 2 * t);
        f.x += (f.tx - f.x) * e;
        f.z += (f.tz - f.z) * e;
        f.h += (f.th - f.h) * e;
        f.timer += dt;
        if (t >= 1) {
          f.moving = false;
          f.timer = 0;
        }
      }
      const bob = Math.sin(f.phase) * 0.05;
      // Face the dart direction while flying, otherwise drift with the phase.
      const heading = f.moving && (f.tx !== f.x || f.tz !== f.z)
        ? Math.atan2(f.tx - f.x, f.tz - f.z)
        : f.phase;
      dummy.position.set(f.x, f.h + bob, f.z);
      dummy.rotation.y = heading;
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);

      // Head follows the thorax but leads it along the heading (local +Z after
      // the yaw), so the fly always faces nose-first through the swarm.
      headDummy.position.set(
        f.x + Math.sin(heading) * HEAD_OFF,
        f.h + bob,
        f.z + Math.cos(heading) * HEAD_OFF,
      );
      headDummy.updateMatrix();
      headMesh.setMatrixAt(i, headDummy.matrix);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
  };

  const entity = sim.addEntity(instancedMesh, null, updateFn, "flies");
  entity.flies = flies;

  // Scatter flies near a world position (e.g. an approaching mower).
  entity.frighten = (fx, fz, radius = 4) => {
    const r2 = radius * radius;
    for (const f of flies) {
      const dx = f.x - fx;
      const dz = f.z - fz;
      if (dx * dx + dz * dz < r2) {
        f.panicT = 1.5;
      }
    }
  };

  return entity;
}

// A dandelion: a thin green stem topped by a small receptacle. In its seed
// phase a single white puffball sphere caps the stem; in its flower phase
// (flower = true) a flattened yellow bloom with a darker disc center and green
// bracts instead. By default (bunch = true) it grows a clump of 2-5 plants,
// all rooted at the same origin with their stems angling outward — like a
// tuft of dandelions leaning away from a common base — plus natural size
// variation. Decorative (no physics) — composes createCylinder + createSphere
// primitives, plus plain cone meshes for the bracts, all under one group.
export function createDandelion(sim, opts = {}) {
  const {
    stemHeight = 3,
    stemRadius = 0.035,
    stemColor = 0x3f7d3a,
    headRadius = 0.25,
    puffColor = 0xf4f3ee,
    puffOpacity = 0.6,
    flowerColor = 0xffd730,
    flower = false,
    bunch = true,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
  } = opts;

  const isFlower = flower === true || String(flower).toLowerCase() === "true";
  const isBunch = !(bunch === false || String(bunch).toLowerCase() === "false");

  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  group.rotation.set(rotation[0], rotation[1], rotation[2]);
  const children = [];

  // Grows a single plant from the origin. Each plant lives in its own pivot
  // group anchored at the ground, so tilting the pivot leans the whole stem
  // about the shared base point (v.tiltX / v.tiltZ in radians).
  const grow = (v = {}) => {
    const h = stemHeight * (v.height ?? 1);
    const r = headRadius * (v.head ?? 1);

    const el = new THREE.Group(); // pivot at the shared ground origin
    el.rotation.set(v.tiltX ?? 0, 0, v.tiltZ ?? 0);
    group.add(el);

    // Stem: a slightly tapered cylinder rising from the ground.
    const stem = createCylinder(sim, {
      radiusTop: stemRadius,
      radiusBottom: stemRadius * 1.2,
      height: h,
      color: stemColor,
      mass: 0,
      position: [0, h / 2, 0],
      radialSegments: 8,
    });
    el.add(stem.mesh);
    children.push(stem);

    // Small green receptacle at the top of the stem where the head sits.
    const hub = createSphere(sim, {
      radius: stemRadius * 2,
      color: stemColor,
      mass: 0,
      position: [0, h, 0],
    });
    el.add(hub.mesh);
    children.push(hub);

    if (isFlower) {
      // Flattened yellow bloom perched above the receptacle: a squat cylinder
      // (small height, full radius) rather than a sphere so it reads as a flat
      // flower head.
      const bloom = createCylinder(sim, {
        radiusTop: r,
        radiusBottom: r,
        height: r * 0.3,
        color: flowerColor,
        mass: 0,
        position: [0, h + r * 0.15, 0],
        radialSegments: 16,
      });
      el.add(bloom.mesh);
      children.push(bloom);

      // Darker disc center on top of the bloom.
      const disc = createSphere(sim, {
        radius: r * 0.22,
        color: 0xc88e1a,
        mass: 0,
        position: [0, h + r * 0.42, 0],
      });
      disc.mesh.scale.set(1, 0.5, 1);
      el.add(disc.mesh);
      children.push(disc);
    } else {
      // The white puffball perched just above the receptacle.
      const puff = createSphere(sim, {
        radius: r,
        color: puffColor,
        opacity: puffOpacity,
        transparent: puffOpacity < 1,
        mass: 0,
        position: [0, h + r * 0.15, 0],
      });
      el.add(puff.mesh);
      children.push(puff);
    }
  };

  if (isBunch) {
    const count = 2 + Math.floor(Math.random() * 4); // 2-5
    // Spread the stems' azimuths so adjacent stems stay 30-45 degrees apart,
    // preventing their heads from overlapping while keeping them in a tuft.
    const baseAz = Math.random() * Math.PI * 2;
    const minGap = THREE.MathUtils.degToRad(30);
    const maxGap = THREE.MathUtils.degToRad(45);
    for (let i = 0; i < count; i++) {
      const az = baseAz + i * (minGap + Math.random() * (maxGap - minGap));
      const tilt = 0.06 + Math.random() * 0.22; // lean shared toward that azimuth
      grow({
        height: 0.75 + Math.random() * 0.5,
        head: 0.85 + Math.random() * 0.3,
        tiltX: Math.cos(az) * tilt,
        tiltZ: Math.sin(az) * tilt,
      });
    }
  } else {
    grow({});
  }

  const entity = sim.addEntity(group, null, null, "dandelion");
  entity.children = children;
  return entity;
}

  // A bumblebee: three spheres in a row — black, yellow, black — forming the
  // striped body, like a cartoon bee flying through the air. Two tiny, thin
  // cylinder wings on the sides flap up and down like a butterfly. Purely
  // decorative (no physics). Composes createSphere + createCylinder under one
  // group, with the body centered on the given position.
  export function createBumblebee(sim, opts = {}) {
    const {
      radius = 0.15,
      yellow = 0xffcc33,
      black = 0x1a1a1a,
      wingColor = 0xffffff,
      wings = true,
      position = [0, 0, 0],
      rotation = [0, 0, 0],
    } = opts;

    const group = new THREE.Group();
    group.position.set(position[0], position[1], position[2]);
    group.rotation.set(rotation[0], rotation[1], rotation[2]);
    const children = [];

    // Three segments side by side along x: black head, yellow middle, black tail.
    const specs = [
      { color: black, r: radius, dx: -radius },
      { color: yellow, r: radius * 1.15, dx: 0 },
      { color: black, r: radius * 0.85, dx: radius },
    ];
    for (const s of specs) {
      const seg = createSphere(sim, {
        radius: s.r,
        color: s.color,
        mass: 0,
        position: [s.dx, 0, 0],
      });
      group.add(seg.mesh);
      children.push(seg);
    }

    // Wings: one wide, flat disc (like a dinner plate) on each side of the
    // body, each on its own pivot so it can flap about the body's long (X)
    // axis. Both wings are mirrored and share the same rotation, so they flap
    // together in sync. Optional (`wings: false`) to save geometry/CPU.
    const wingsArr = [];
    if (wings) {
      const wingHingeR = radius + 0.02;
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(0, 0, side * wingHingeR);
        const wing = createCylinder(sim, {
          radiusTop: radius,
          radiusBottom: radius,
          height: 0.02,
          color: wingColor,
          mass: 0,
          position: [0, 0, 0],
        });
        wing.mesh.castShadow = false;
        pivot.add(wing.mesh);
        group.add(pivot);
        wingsArr.push(pivot);
      }
    }

    // Animation state: only the wing-flap phase. Movement is owned by the game.
    const flap = {
      phase: Math.random() * Math.PI * 2,
      speed: 140,
    };

    const updateFn = (dt) => {
      if (!wingsArr.length) return;
      // Wings hinge about the body's long (X) axis; opposite signs on the
      // mirrored wings lift both outer edges up together and down together.
      flap.phase = (flap.phase + flap.speed * dt) % (Math.PI * 2);
      const angle = Math.sin(flap.phase) * 0.85;
      wingsArr[0].rotation.x = angle;
      wingsArr[1].rotation.x = -angle;
    };

    const entity = sim.addEntity(group, null, updateFn, "bumblebee");
    entity.children = children;

    // Set the flap speed (rad/s of wing beat).
    entity.setFlapSpeed = (v) => {
      flap.speed = v;
    };
    return entity;
  }

