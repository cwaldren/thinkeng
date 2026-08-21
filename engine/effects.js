// Reusable Particle and Visual Effects.
import * as THREE from "three";

let cachedSandTexture = null;
function getSandTexture() {
  if (cachedSandTexture) return cachedSandTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255, 240, 160, 1)");
  grad.addColorStop(0.4, "rgba(240, 190, 80, 0.95)");
  grad.addColorStop(0.8, "rgba(215, 150, 45, 0.7)");
  grad.addColorStop(1, "rgba(180, 110, 25, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(16, 16, 16, 0, Math.PI * 2);
  ctx.fill();
  cachedSandTexture = new THREE.CanvasTexture(canvas);
  return cachedSandTexture;
}

export function createSandBlast(sim, opts = {}) {
  const {
    particleCount = 500,
    particleSize = 0.16,
    color = 0xffd97d,
    speed = 32,
    spread = 0.25,
    gravity = 8,
    lifetime = 0.75,
    rate = 350,
    position = [0, 1.5, 0],
    direction = [1, -0.15, 0],
    parent = null,
    enabled = true,
  } = opts;

  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  if (parent) {
    parent.add(group);
  }

  const positions = new Float32Array(particleCount * 3);
  const particles = [];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: 0,
      y: -1000,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: lifetime,
      active: false,
    });
    positions[i * 3 + 0] = 0;
    positions[i * 3 + 1] = -1000;
    positions[i * 3 + 2] = 0;
  }

  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", posAttr);

  const material = new THREE.PointsMaterial({
    map: getSandTexture(),
    color: typeof color === "number" ? color : parseInt(String(color).replace(/^#/, ""), 16),
    size: particleSize,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  group.add(points);

  const dir = new THREE.Vector3(direction[0], direction[1], direction[2]).normalize();
  let spawnAccum = 0;
  let isEnabledState = enabled;

  const updateFn = (dt) => {
    const activeRunning = typeof isEnabledState === "function" ? isEnabledState() : isEnabledState;
    if (activeRunning) {
      spawnAccum += dt * rate;
    } else {
      spawnAccum = 0;
    }
    let toSpawn = Math.floor(spawnAccum);
    spawnAccum -= toSpawn;

    for (let i = 0; i < particleCount; i++) {
      const p = particles[i];
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife || p.y <= -2.0) {
          p.active = false;
          p.y = -1000;
        } else {
          p.vy -= gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
        }
      } else if (toSpawn > 0 && activeRunning) {
        toSpawn--;
        p.active = true;
        p.life = 0;
        p.maxLife = lifetime * (0.8 + Math.random() * 0.4);

        // Support twin stream nozzles if offsets or wide nozzle
        const side = Math.random() < 0.5 ? 1 : -1;
        p.x = (Math.random() - 0.5) * 0.15;
        p.y = (Math.random() - 0.5) * 0.1;
        p.z = side * 0.72 + (Math.random() - 0.5) * 0.15;

        const currentSpeed = speed * (0.85 + Math.random() * 0.3);
        const vx = dir.x + (Math.random() - 0.5) * spread;
        const vy = dir.y + (Math.random() - 0.5) * spread;
        const vz = (Math.random() - 0.5) * (spread * 0.5);
        const vLen = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;

        p.vx = (vx / vLen) * currentSpeed;
        p.vy = (vy / vLen) * currentSpeed;
        p.vz = (vz / vLen) * currentSpeed;
      }

      positions[i * 3 + 0] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }
    posAttr.needsUpdate = true;
  };

  const entity = sim.addEntity(parent ? null : group, null, updateFn);
  entity.mesh = group;
  entity.setEnabled = (val) => {
    isEnabledState = val;
  };
  entity.dispose = () => {
    if (parent) parent.remove(group);
    geometry.dispose();
    material.dispose();
  };
  return entity;
}
