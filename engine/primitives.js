import * as THREE from "three";
import * as CANNON from "cannon-es";

function sizeVector(size) {
  if (Array.isArray(size)) return new THREE.Vector3(size[0], size[1], size[2]);
  return new THREE.Vector3(size, size, size);
}

export function createGround(sim, opts = {}) {
  const {
    size = 30,
    color = 0x222233,
    height = 1,
    friction = 0.3,
    position = [0, 0, 0],
  } = opts;

  const geometry = new THREE.BoxGeometry(size, height, size);
  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.receiveShadow = true;

  const body = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(size / 2, height / 2, size / 2)),
  });
  body.position.set(position[0], position[1], position[2]);

  const defaultMaterial = new CANNON.Material("ground");
  body.material = defaultMaterial;
  body.updateMassProperties();

  return sim.addEntity(mesh, body);
}

export function createBox(sim, opts = {}) {
  const {
    size = 1,
    color = 0xff5533,
    mass = 1,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    friction = 0.3,
  } = opts;

  const s = sizeVector(size);
  const geometry = new THREE.BoxGeometry(s.x, s.y, s.z);
  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const body = new CANNON.Body({
    mass,
    shape: new CANNON.Box(new CANNON.Vec3(s.x / 2, s.y / 2, s.z / 2)),
  });
  body.position.set(position[0], position[1], position[2]);
  body.quaternion.setFromEuler(rotation[0], rotation[1], rotation[2]);
  body.material = new CANNON.Material("box");
  body.updateMassProperties();

  return sim.addEntity(mesh, body);
}

export function createCylinder(sim, opts = {}) {
  const {
    radiusTop = 1,
    radiusBottom = 1,
    height = 1,
    color = 0x88cc55,
    mass = 1,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    radialSegments = 8,
    friction = 0.3,
  } = opts;

  const geometry = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegments,
  );
  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const body = new CANNON.Body({
    mass,
    shape: new CANNON.Cylinder(radiusBottom, radiusTop, height, radialSegments),
  });
  body.position.set(position[0], position[1], position[2]);
  body.quaternion.setFromEuler(rotation[0], rotation[1], rotation[2]);
  body.material = new CANNON.Material("cylinder");
  body.updateMassProperties();

  return sim.addEntity(mesh, body);
}

export function createSphere(sim, opts = {}) {
  const {
    radius = 0.5,
    color = 0x33aaff,
    mass = 1,
    position = [0, 0, 0],
    friction = 0.3,
  } = opts;

  const geometry = new THREE.SphereGeometry(radius, 32, 16);
  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const body = new CANNON.Body({
    mass,
    shape: new CANNON.Sphere(radius),
  });
  body.position.set(position[0], position[1], position[2]);
  body.material = new CANNON.Material("sphere");
  body.updateMassProperties();

  return sim.addEntity(mesh, body);
}

export function createRock(sim, opts = {}) {
  const {
    radius = 1,
    detail = 0,
    color = 0x6e7278,
    roughness = 0.9,
    mass = 10,
    scale = [1, 0.8, 1],
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    friction = 0.5,
  } = opts;

  const geometry = new THREE.DodecahedronGeometry(radius, detail);
  const material = new THREE.MeshStandardMaterial({ color, roughness });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  mesh.scale.set(s[0], s[1], s[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const avgR = radius * ((s[0] + s[1] + s[2]) / 3);
  const body = new CANNON.Body({
    mass,
    shape: new CANNON.Sphere(avgR * 0.95),
  });
  body.position.set(position[0], position[1], position[2]);
  body.quaternion.setFromEuler(rotation[0], rotation[1], rotation[2]);
  body.material = new CANNON.Material("rock");
  body.updateMassProperties();

  return sim.addEntity(mesh, body);
}

// Triangular wedge (right-triangle prism). Flat on the bottom, vertical face at
// the front (z = -depth/2), and a slanted face rising from the back-bottom edge
// up to the front-top edge. Good for cowcatchers, ramps, and scoops.
export function createTriangle(sim, opts = {}) {
  const {
    width = 1,
    depth = 1,
    height = 1,
    color = 0xcccccc,
    mass = 1,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    friction = 0.5,
  } = opts;

  const w = width / 2;
  const d = depth / 2;

  const v = [
    [-w, 0, d], // 0 back-bottom-left
    [w, 0, d], // 1 back-bottom-right
    [-w, 0, -d], // 2 front-bottom-left
    [w, 0, -d], // 3 front-bottom-right
    [-w, height, -d], // 4 front-top-left
    [w, height, -d], // 5 front-top-right
  ];

  const sl = Math.hypot(depth, height);
  const slant = [0, depth / sl, height / sl]; // slanted face outward (up/back)

  // Each face listed with its own vertices and an outward unit normal.
  const faces = [
    { idx: [1, 3, 5], n: [1, 0, 0] }, // right end (x = +w)
    { idx: [0, 4, 2], n: [-1, 0, 0] }, // left end (x = -w)
    { idx: [0, 3, 1], n: [0, -1, 0] }, // bottom half 1
    { idx: [0, 2, 3], n: [0, -1, 0] }, // bottom half 2
    { idx: [2, 5, 3], n: [0, 0, -1] }, // front vertical (z = -d) half 1
    { idx: [2, 4, 5], n: [0, 0, -1] }, // front vertical (z = -d) half 2
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
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const body = new CANNON.Body({
    mass,
    shape: new CANNON.Box(new CANNON.Vec3(w, height / 2, d)),
  });
  body.position.set(position[0], position[1], position[2]);
  body.quaternion.setFromEuler(rotation[0], rotation[1], rotation[2]);
  body.material = new CANNON.Material("triangle");
  body.updateMassProperties();

  return sim.addEntity(mesh, body);
}

export function createPlayer(sim, opts = {}) {
  const {
    size = 1,
    color = 0x22ff88,
    mass = 5,
    position = [0, 0, 0],
    speed = 10,
    jumpForce = 8,
  } = opts;

  const s = sizeVector(size);
  const geometry = new THREE.BoxGeometry(s.x, s.y, s.z);
  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const body = new CANNON.Body({
    mass,
    shape: new CANNON.Box(new CANNON.Vec3(s.x / 2, s.y / 2, s.z / 2)),
  });
  body.position.set(position[0], position[1], position[2]);
  body.fixedRotation = true;
  body.updateMassProperties();

  const keys = new Set();
  const onKeyDown = (e) => keys.add(e.code);
  const onKeyUp = (e) => keys.delete(e.code);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const updateFn = (dt, entity, sim) => {
    let vx = 0;
    let vz = 0;
    if (keys.has("KeyW")) vz -= 1;
    if (keys.has("KeyS")) vz += 1;
    if (keys.has("KeyA")) vx -= 1;
    if (keys.has("KeyD")) vx += 1;

    const body = entity.body;
    body.velocity.x = vx * speed;
    body.velocity.z = vz * speed;

    if (keys.has("Space")) {
      body.velocity.y = jumpForce;
    }
  };

  return sim.addEntity(mesh, body, updateFn);
}

// A smooth, sculpted 3D heart primitive with soft rounded bevels and plump lobes.
export function createHeart(sim, opts = {}) {
  const {
    scale = 1,
    color = 0xff3344,
    mass = 1,
    roughness = 0.3,
    metalness = 0.1,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    friction = 0.3,
  } = opts;

  const shape = new THREE.Shape();
  // Smooth symmetric heart contour in the XY plane
  shape.moveTo(0, 0.35);
  // Left lobe top curve
  shape.bezierCurveTo(-0.15, 0.72, -0.7, 0.72, -0.7, 0.25);
  // Left flank down to bottom tip
  shape.bezierCurveTo(-0.7, -0.15, -0.35, -0.45, 0, -0.75);
  // Right flank up from bottom tip
  shape.bezierCurveTo(0.35, -0.45, 0.7, -0.15, 0.7, 0.25);
  // Right lobe top curve back to top notch
  shape.bezierCurveTo(0.7, 0.72, 0.15, 0.72, 0, 0.35);

  const extrudeSettings = {
    depth: 0.18,
    bevelEnabled: true,
    bevelSegments: 10,
    steps: 1,
    bevelSize: 0.12,
    bevelThickness: 0.14,
    curveSegments: 48,
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.center();
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  mesh.scale.set(s[0], s[1], s[2]);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);

  const body = new CANNON.Body({
    mass,
    shape: new CANNON.Box(
      new CANNON.Vec3(0.82 * s[0], 0.82 * s[1], 0.23 * s[2]),
    ),
  });
  body.position.set(position[0], position[1], position[2]);
  body.quaternion.setFromEuler(rotation[0], rotation[1], rotation[2]);
  body.material = new CANNON.Material("heart");
  body.updateMassProperties();

  return sim.addEntity(mesh, body);
}

