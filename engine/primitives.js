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
