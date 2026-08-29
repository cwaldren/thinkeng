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

  const s = sizeVector(size);
  const geometry = new THREE.BoxGeometry(s.x, height, s.z);
  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.receiveShadow = true;

  const body = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(s.x / 2, height / 2, s.z / 2)),
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

// Smooth symmetric heart contour in the XY plane
const _heartShape = new THREE.Shape();
_heartShape.moveTo(0, 0.35);
// Left lobe top curve
_heartShape.bezierCurveTo(-0.15, 0.72, -0.7, 0.72, -0.7, 0.25);
// Left flank down to bottom tip
_heartShape.bezierCurveTo(-0.7, -0.15, -0.35, -0.45, 0, -0.75);
// Right flank up from bottom tip
_heartShape.bezierCurveTo(0.35, -0.45, 0.7, -0.15, 0.7, 0.25);
// Right lobe top curve back to top notch
_heartShape.bezierCurveTo(0.7, 0.72, 0.15, 0.72, 0, 0.35);

const _heartExtrudeSettings = {
  depth: 0.18,
  bevelEnabled: true,
  bevelSegments: 10,
  steps: 1,
  bevelSize: 0.12,
  bevelThickness: 0.14,
  curveSegments: 48,
};

// Reusable heart geometry, centered with computed normals. Shared by createHeart
// (and any transient heart visuals) so geometry isn't rebuilt on every call.
export const heartGeometry = (() => {
  const g = new THREE.ExtrudeGeometry(_heartShape, _heartExtrudeSettings);
  g.center();
  g.computeVertexNormals();
  return g;
})();

export function createHeartMaterial(opts = {}) {
  const { color = 0xff3344, roughness = 0.3, metalness = 0.1 } = opts;
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

// Builds a heart mesh (no physics body) from the shared geometry. Useful for
// transient decoration hearts that only need to render, e.g. floating effects.
export function createHeartMesh(opts = {}) {
  const {
    scale = 1,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    material = createHeartMaterial(opts),
  } = opts;

  const mesh = new THREE.Mesh(heartGeometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  mesh.scale.set(s[0], s[1], s[2]);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  return mesh;
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

  const mesh = createHeartMesh({
    scale,
    color,
    roughness,
    metalness,
    position,
    rotation,
  });

  const s = Array.isArray(scale) ? scale : [scale, scale, scale];

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

// A swarm of flies zooming around inside a bounded sphere. Rendered as one
// instanced mesh of tiny dark spheres; each fly steers with a small random
// velocity and bounces off the sphere boundary, so the whole group keeps
// darting around within a fixed radius. Purely decorative (no physics body) —
// the updateFn drives the instanced matrices each frame.
export function createFlySwarm(sim, opts = {}) {
  const {
    count = 10,
    color = 0xffffff,
    size = 0.035,
    radius = 1.5,
    speed = 3,
    position = [0, 1.2, 0],
  } = opts;

  const geo = new THREE.SphereGeometry(size, 6, 4);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const instancedMesh = new THREE.InstancedMesh(geo, mat, count);
  instancedMesh.position.set(position[0], position[1], position[2]);
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instancedMesh.frustumCulled = false;
  instancedMesh.castShadow = false; // tiny decorative insects - no shadow cost

  const dummy = new THREE.Object3D();
  const flies = [];
  for (let i = 0; i < count; i++) {
    // Random starting point inside the sphere, with a random velocity.
    const x = (Math.random() * 2 - 1) * radius;
    const y = (Math.random() * 2 - 1) * radius;
    const z = (Math.random() * 2 - 1) * radius;
    const len = Math.hypot(x, y, z);
    const s = len > radius ? radius / len : 1;
    flies.push({
      x: x * s,
      y: y * s,
      z: z * s,
      // Velocity is kept roughly at a target "cruise" speed but the direction is
      // constantly smashed around so the flight reads as chaotic buzzing.
      vx: (Math.random() * 2 - 1) * speed,
      vy: (Math.random() * 2 - 1) * speed,
      vz: (Math.random() * 2 - 1) * speed,
      flingT: Math.random() * 0.3, // time until the next big direction fling
    });
  }

  const updateFn = (dt) => {
    for (let i = 0; i < count; i++) {
      const f = flies[i];
      // Chaotic steering: a random angular swerve every frame (noise drives the
      // direction so the motion swirls and flips).
      f.vx += (Math.random() - 0.5) * speed * 18 * dt;
      f.vy += (Math.random() - 0.5) * speed * 18 * dt;
      f.vz += (Math.random() - 0.5) * speed * 18 * dt;

      // Big random "fling": every so often, sharply re-aim the velocity to make
      // the fly zoom off in a fresh random direction.
      f.flingT -= dt;
      if (f.flingT <= 0) {
        const ang = Math.random() * Math.PI * 2;
        const elev = (Math.random() - 0.5) * Math.PI * 0.7;
        const sp = speed * (0.8 + Math.random() * 1.6);
        f.vx = Math.cos(ang) * Math.cos(elev) * sp;
        f.vy = Math.sin(elev) * sp;
        f.vz = Math.sin(ang) * Math.cos(elev) * sp;
        f.flingT = 0.15 + Math.random() * 0.4;
      }

      // Clamp speed so flies zoom rather than crawling.
      let spd = Math.hypot(f.vx, f.vy, f.vz);
      const maxS = speed * 2.2;
      if (spd > maxS) {
        f.vx *= maxS / spd;
        f.vy *= maxS / spd;
        f.vz *= maxS / spd;
        spd = maxS;
      }
      if (spd < speed * 0.4 && spd > 0) {
        f.vx *= (speed * 0.4) / spd;
        f.vy *= (speed * 0.4) / spd;
        f.vz *= (speed * 0.4) / spd;
      }

      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;

      // Keep inside the sphere: if a fly strays out, softly steer it back rather
      // than a harsh bounce, so it can swirl along the wall.
      const d = Math.hypot(f.x, f.y, f.z);
      if (d > radius) {
        const inv = radius / d;
        f.x *= inv;
        f.y *= inv;
        f.z *= inv;
        // Steer the outward velocity back inward so it hugs the boundary.
        const nx = f.x / radius, ny = f.y / radius, nz = f.z / radius;
        const vn = f.vx * nx + f.vy * ny + f.vz * nz;
        if (vn > 0) {
          f.vx -= 1.6 * vn * nx;
          f.vy -= 1.6 * vn * ny;
          f.vz -= 1.6 * vn * nz;
        }
      }

      dummy.position.set(f.x, f.y, f.z);
      dummy.rotation.y = Math.atan2(f.vx, f.vz);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
  };

  return sim.addEntity(instancedMesh, null, updateFn, "flyswarm");
}

