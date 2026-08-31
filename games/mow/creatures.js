// CreatureManager: every living thing on the lawn — midges, butterflies,
// dragonflies, gnat swarms, bumblebees, fireflies — plus the mowable
// dandelions and the daily sleep/wake (dayCycle) registrations.

import * as THREE from "three";
import { createGnats } from "engine/primitives.js";
import { CONFIG } from "./config.js";
import {
  createFlies,
  createButterfly,
  createDragonfly,
  createBumblebee,
  createFirefly,
  createDandelion,
} from "engine/components.js";

export function buildCreatures(sim, ctx, env) {
  const isMobile = ctx.env.isMobile;
  const { COLS, ROWS } = ctx.density;
  const W = ctx.density.W;
  const D = ctx.density.D;
  const C = CONFIG.creatures;
  const dandelionCfg = CONFIG.dandelions;

  // Lawn bounds used by all creatures.
  const bx = (COLS * W) / 2 - 1,
    bz = (ROWS * D) / 2 - 1;
  ctx.creatures.bx = bx;
  ctx.creatures.bz = bz;
  const mowerPos = ctx.creatures.mowerPos;

  // --- Running total of dandelions mowed down, shown under the title ---
  let mowedCount = 0;
  const mowedCountEl = document.getElementById("mowed-count");
  const mowedLabelEl = document.getElementById("mowed-label");
  const updateMowedLabel = () => {
    mowedLabelEl.textContent = mowedCount === 1 ? "dandelion" : "dandelions";
  };
  // Fade in + slide a counter element in from the left, once, on its first
  // trigger. Subsequent updates just refresh the number.
  const revealCounter = (el) => {
    if (el.dataset.revealed) return;
    el.dataset.revealed = "1";
    el.style.opacity = "1";
    el.style.transform = "translateX(0)";
  };
  ctx.creatures.mowedCount = () => mowedCount;
  ctx.creatures.mowedCountEl = mowedCountEl;
  ctx.creatures.mowedLabelEl = mowedLabelEl;
  ctx.creatures.updateMowedLabel = updateMowedLabel;
  ctx.creatures.revealCounter = revealCounter;
  // Mower module needs to increment the live count; expose a small setter.
  const bumpMowed = () => {
    mowedCount += 1;
    mowedCountEl.textContent = String(mowedCount);
    updateMowedLabel();
    revealCounter(mowedCountEl.parentElement);
  };
  ctx.creatures.bumpMowed = bumpMowed;

  // --- Flying bugs: midges that hover and flit around the lawn ---
  const BUG_COUNT = isMobile ? C.flies.mobile : C.flies.desktop;
  const SCARE_R = C.flies.scareRadius;
  const flies = createFlies(sim, {
    count: BUG_COUNT,
    color: C.flies.color,
    size: C.flies.size,
    spread: bx * 2,
  });
  const fliesSleeping = { value: false };
  const fliesLife = {
    sleep() {
      fliesSleeping.value = true;
      flies.mesh.visible = false;
    },
    wake() {
      fliesSleeping.value = false;
      flies.mesh.visible = ctx.flow.creaturesEnabled;
    },
  };

  sim.addEntity(null, null, () => {
    flies.mesh.visible = ctx.flow.creaturesEnabled && !fliesSleeping.value;
  });

  // Diurnal: midges sleep through the night (20h-6h).
  ctx.creatures.dayCycle.push({
    items: [fliesLife],
    wakeHour: C.day.wake,
    sleepHour: C.day.sleep,
  });

  // --- Butterflies: graceful, colorful flappers ---
  const BFLY_COUNT = isMobile ? C.butterflies.mobile : C.butterflies.desktop;
  const pastel = new THREE.Color();
  const butterflies = [];
  for (let i = 0; i < BFLY_COUNT; i++) {
    pastel.setHSL(
      Math.random(),
      C.butterflies.wingSat,
      C.butterflies.wingLight,
    );
    const ent = createButterfly(sim, {
      wingColor: "#" + pastel.getHexString(),
      position: [
        (Math.random() * 2 - 1) * bx,
        0.8 + Math.random() * 0.8,
        (Math.random() * 2 - 1) * bz,
      ],
    });
    butterflies.push({
      group: ent.mesh,
      ent,
      x: (Math.random() * 2 - 1) * bx,
      z: (Math.random() * 2 - 1) * bz,
      h: 0.8 + Math.random() * 0.8,
      yaw: Math.random() * Math.PI * 2,
      flapSpeed: 14 + Math.random() * 8,
      burstT: 1 + Math.random() * 3,
      flapBoost: 0,
      cx: (Math.random() * 2 - 1) * bx,
      cz: (Math.random() * 2 - 1) * bz,
      orbit: Math.random() * Math.PI * 2,
      orbitR: 0.8 + Math.random() * 1.2,
      scatterT: 0,
      scareCooldown: 0,
      rejoinT: 0,
      antiAxis: null,
      antiAngle: 0,
      antiRate: 0,
      antiDir: null,
    });
  }

  sim.addEntity(null, null, (dt) => {
    for (const b of butterflies) b.group.visible = ctx.flow.creaturesEnabled;
    if (!ctx.flow.creaturesEnabled) return;
    mowerPos.copy(ctx.mower.mesh.position);
    for (const b of butterflies) {
      b.ent.setFlapSpeed(b.scatterT > 0 ? 42 : b.flapSpeed + b.flapBoost);

      if (ctx.flow.revealFired) {
        b.ent.setFlapSpeed(0);
        if (!b.antiAxis) {
          b.antiAxis = new THREE.Vector3(
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
          ).normalize();
          b.antiAngle = 0;
          b.antiRate =
            (Math.random() < 0.5 ? 1 : -1) * 3 * (0.4 + Math.random() * 0.6);
          b.antiDir = new THREE.Vector3(
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
          ).normalize();
        }
        b.antiAngle += b.antiRate * dt;
        b.x += b.antiDir.x * dt * 0.6;
        b.h += b.antiDir.y * dt * 0.6;
        b.z += b.antiDir.z * dt * 0.6;
        b.group.position.set(b.x, b.h, b.z);
        b.group.quaternion.setFromAxisAngle(b.antiAxis, b.antiAngle);
        continue;
      } else {
        b.antiAxis = null;
      }

      if (b.scatterT > 0) {
        b.scatterT -= dt;
        b.scareCooldown = Math.max(0, b.scareCooldown - dt);
        const dx = b.x - mowerPos.x;
        const dz = b.z - mowerPos.z;
        const d = Math.hypot(dx, dz) || 1;
        b.x += (dx / d) * dt * 3;
        b.z += (dz / d) * dt * 3;
        b.h += dt * 2;
        b.yaw = Math.atan2(dx, dz);
        if (b.scatterT <= 0) {
          b.rejoinT = 0.6;
          b.scareCooldown = 1.2;
        }
      } else {
        const dx = b.x - mowerPos.x;
        const dz = b.z - mowerPos.z;
        if (
          b.scareCooldown <= 0 &&
          dx * dx + dz * dz < SCARE_R * SCARE_R
        ) {
          b.scatterT = 1.4;
          continue;
        }
        b.orbit = (b.orbit + dt * (0.8 + Math.random() * 0.4)) % (Math.PI * 2);
        b.cx += (Math.random() - 0.5) * dt * 0.5;
        b.cz += (Math.random() - 0.5) * dt * 0.5;
        let ox = b.cx + Math.cos(b.orbit) * b.orbitR;
        let oz = b.cz + Math.sin(b.orbit) * b.orbitR;
        b.h += Math.sin(b.orbit * 1.7 + 1) * dt * 0.3;
        if (b.flapBoost > 0) {
          b.h += dt * 0.5;
          b.flapBoost = Math.max(0, b.flapBoost - dt * 5);
        } else {
          const sink = b.h > 0.8 ? 0.25 : 0;
          b.h -= dt * sink;
          b.burstT -= dt;
          if (b.burstT <= 0) {
            b.flapBoost = 5 + Math.random() * 9;
            b.burstT = 2 + Math.random() * 4;
          }
        }
        if (b.rejoinT > 0) {
          b.rejoinT -= dt;
          const tt = Math.max(0, b.rejoinT / 0.6);
          const e = 1 - tt * tt * (3 - 2 * tt);
          const fromX = b.x,
            fromZ = b.z;
          b.cx = fromX;
          b.cz = fromZ;
          ox = b.cx + Math.cos(b.orbit) * b.orbitR;
          oz = b.cz + Math.sin(b.orbit) * b.orbitR;
          ox = fromX + (ox - fromX) * e;
          oz = fromZ + (oz - fromZ) * e;
        }
        b.x = ox;
        b.z = oz;
        b.yaw = -b.orbit - Math.PI / 2;
        b.cx = Math.max(-bx, Math.min(bx, b.cx));
        b.cz = Math.max(-bz, Math.min(bz, b.cz));
        b.h = Math.max(0.6, Math.min(2.2, b.h));
      }
      b.group.position.set(b.x, b.h, b.z);
      b.group.rotation.set(0, b.yaw, 0);
    }
  });

  // --- Dragonflies: hover, then zoom to a new spot, hover, repeat ---
  const DRGN_COUNT = C.dragonflies;
  const dragonflies = [];
  for (let i = 0; i < DRGN_COUNT; i++) {
    const x = (Math.random() * 2 - 1) * bx;
    const z = (Math.random() * 2 - 1) * bz;
    const h = 0.8 + Math.random() * 0.8;
    const ent = createDragonfly(sim, {
      bodyColor: "#2a2a2a",
      wingColor: "#78dfff",
      wingSpan: 0.4,
      wingTilt: -6,
      position: [x, h, z],
    });
    dragonflies.push({
      group: ent.mesh,
      ent,
      sleeping: false,
      sleep() {
        this.sleeping = true;
        this.group.visible = false;
      },
      wake() {
        this.sleeping = false;
        this.group.visible = ctx.flow.creaturesEnabled;
      },
      x,
      z,
      h,
      yaw: Math.random() * Math.PI * 2,
      state: "hover",
      hoverT: 0.8 + Math.random() * 1.4,
      hoverDur: 0,
      fx: 0,
      fz: 0,
      fh: 0,
      flyT: 0,
      flyDur: 0,
      tx: 0,
      tz: 0,
      th: 0,
    });
  }
  ctx.creatures.dayCycle.push({ items: dragonflies, wakeHour: C.day.wake, sleepHour: C.day.sleep });

  sim.addEntity(null, null, (dt) => {
    for (const d of dragonflies)
      d.group.visible = ctx.flow.creaturesEnabled && !d.sleeping;
    if (!ctx.flow.creaturesEnabled) return;
    for (const d of dragonflies) {
      if (d.sleeping) continue;
      if (d.state === "hover") {
        d.hoverT -= dt;
        d.yaw += dt * 0.5;
        d.h += Math.sin(performance.now() * 0.003 + d.tx) * dt * 0.05;
        d.ent.setFlapSpeed(64);
        if (d.hoverT <= 0) {
          d.fx = d.x;
          d.fz = d.z;
          d.fh = d.h;
          d.tx = (Math.random() * 2 - 1) * bx;
          d.tz = (Math.random() * 2 - 1) * bz;
          d.th = 0.8 + Math.random() * 0.8;
          const dist = Math.max(
            0.01,
            Math.hypot(d.tx - d.fx, d.tz - d.fz),
          );
          d.flyDur = 0.1 + dist * 0.05;
          d.flyT = 0;
          d.state = "fly";
        }
      } else {
        d.flyT += dt;
        const t = Math.min(1, d.flyT / d.flyDur);
        const e = 1 - (1 - t) * (1 - t);
        d.x = d.fx + (d.tx - d.fx) * e;
        d.z = d.fz + (d.tz - d.fz) * e;
        d.h = d.fh + (d.th - d.fh) * e;
        const ddx = d.tx - d.fx;
        const ddz = d.tz - d.fz;
        if (t < 1 && (ddx || ddz)) d.yaw = Math.atan2(ddx, ddz);
        d.ent.setFlapSpeed(64);
        if (t >= 1) {
          d.state = "hover";
          d.hoverT = 1.2 + Math.random() * 2.0;
        }
      }
      d.group.position.set(d.x, d.h, d.z);
      d.group.rotation.y = d.yaw;
    }
  });

  // --- Gnats: two clouds of tiny flies that drift slowly around ---
  const SWARM_COUNT = C.swarms;
  const flySwarms = [];
  for (let i = 0; i < SWARM_COUNT; i++) {
    const ent = createGnats(sim, {
      count: 20 + Math.floor(Math.random() * 21),
      size: 0.01,
      radius: 1.2,
      speed: 1.3 + Math.random() * 0.3,
      position: [
        (Math.random() * 2 - 1) * bx * 0.8,
        0.8 + Math.random() * 1.2,
        (Math.random() * 2 - 1) * bz * 0.8,
      ],
    });
    flySwarms.push({
      mesh: ent.mesh,
      ent,
      sleeping: false,
      sleep() {
        this.sleeping = true;
        this.mesh.visible = false;
      },
      wake() {
        this.sleeping = false;
        this.mesh.visible = ctx.flow.creaturesEnabled;
      },
      x: ent.mesh.position.x,
      z: ent.mesh.position.z,
      h: ent.mesh.position.y,
      tx: 0,
      tz: 0,
      th: 0,
      wanderT: 1 + Math.random() * 2,
      wanderDur: 1,
    });
  }
  ctx.creatures.dayCycle.push({ items: flySwarms, wakeHour: C.day.wake, sleepHour: C.day.sleep });

  sim.addEntity(null, null, (dt) => {
    for (const s of flySwarms)
      s.mesh.visible = ctx.flow.creaturesEnabled && !s.sleeping;
    if (!ctx.flow.creaturesEnabled) return;
    for (const s of flySwarms) {
      if (s.sleeping) continue;
      s.wanderT -= dt;
      if (s.wanderT <= 0) {
        s.tx = (Math.random() * 2 - 1) * bx * 0.8;
        s.tz = (Math.random() * 2 - 1) * bz * 0.8;
        s.th = 0.6 + Math.random() * 1.4;
        s.wanderDur = 30 + Math.random() * 30;
        s.wanderT = s.wanderDur;
      }
      const e = 1 - Math.exp(-dt * 0.08);
      s.x += (s.tx - s.x) * e;
      s.z += (s.tz - s.z) * e;
      s.h += (s.th - s.h) * e;
      s.mesh.position.set(s.x, s.h, s.z);
    }
  });

  // --- Bumblebees: feed on the flowers, then fly along arcs ---
  const FEED_H = C.bees.feedHeight;
  const BEE_SPEED = C.bees.speed;
  const BEE_COUNT = isMobile ? C.bees.mobile : C.bees.desktop;
  const bees = [];
  for (let i = 0; i < BEE_COUNT; i++) {
    const x = (Math.random() * 2 - 1) * bx * 0.8;
    const z = (Math.random() * 2 - 1) * bz * 0.8;
    const ent = createBumblebee(sim, {
      radius: 0.05,
      wings: false,
      position: [x, FEED_H, z],
    });
    bees.push({
      group: ent.mesh,
      ent,
      sleeping: false,
      sleep() {
        this.sleeping = true;
        this.group.visible = false;
      },
      wake() {
        this.sleeping = false;
        this.group.visible = ctx.flow.creaturesEnabled;
      },
      x,
      z,
      h: FEED_H,
      yaw: Math.random() * Math.PI * 2,
      pitch: 0,
      roll: 0,
      state: "feed",
      feedT: (() => {
        const r = Math.random();
        return r < 0.33 ? 0.5 : r < 0.66 ? 1 : 3;
      })(),
      feedPhase: Math.random() * Math.PI * 2,
      sx: x,
      sz: z,
      sh: FEED_H,
      tx: 0,
      tz: 0,
      th: FEED_H,
      apex: 3,
      upT: 0.5,
      downT: 0.5,
      flyT: 0,
      flyDur: 1,
    });
  }
  ctx.creatures.dayCycle.push({ items: bees, wakeHour: C.day.wake, sleepHour: C.day.sleep });

  // --- Fireflies: nocturnal — emerge at dusk, blink through the night ---
  const FIREFLY_COUNT = isMobile ? C.fireflies.mobile : C.fireflies.desktop;
  const fireflies = [];
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    const x = (Math.random() * 2 - 1) * bx;
    const z = (Math.random() * 2 - 1) * bz;
    const h = 0.4 + Math.random() * 0.6;
    const ent = createFirefly(sim, {
      position: [x, h, z],
      size: 0.035,
    });
    fireflies.push({
      group: ent.mesh,
      ent,
      sleeping: false,
      sleep() {
        this.sleeping = true;
        this.group.visible = false;
      },
      wake() {
        this.sleeping = false;
        this.group.visible = ctx.flow.creaturesEnabled;
      },
      x,
      z,
      h,
      tx: 0,
      tz: 0,
      th: 0,
      wanderT: 1 + Math.random() * 2,
    });
  }
  ctx.creatures.dayCycle.push({ items: fireflies, wakeHour: C.night.wake, sleepHour: C.night.sleep });
  ctx.creatures.firefliesReady = true;
  ctx.creatures.fireflies = fireflies;

  sim.addEntity(null, null, (dt) => {
    for (const f of fireflies)
      f.group.visible = ctx.flow.creaturesEnabled && !f.sleeping && !ctx.flow.revealFired;
    if (!ctx.flow.creaturesEnabled) return;
    for (const f of fireflies) {
      if (f.sleeping) continue;
      f.wanderT -= dt;
      if (f.wanderT <= 0) {
        f.tx = (Math.random() * 2 - 1) * bx * 0.9;
        f.tz = (Math.random() * 2 - 1) * bz * 0.9;
        f.th = 0.3 + Math.random() * 0.7;
        f.wanderT = 6 + Math.random() * 8;
      }
      const e = 1 - Math.exp(-dt * 0.5);
      f.x += (f.tx - f.x) * e;
      f.z += (f.tz - f.z) * e;
      f.h += (f.th - f.h) * e;
      f.group.position.set(f.x, f.h, f.z);
    }
  });

  // --- Dandelions: ~20 decorative plants scattered across the lawn. ---
  const DANDELION_COUNT = isMobile ? dandelionCfg.countMobile : dandelionCfg.countDesktop;
  const dandelions = [];
  for (let i = 0; i < DANDELION_COUNT; i++) {
    let x, z;
    do {
      x = (Math.random() * 2 - 1) * bx;
      z = (Math.random() * 2 - 1) * bz;
    } while (
      Math.hypot(x, z) < Math.min(bx, bz) * dandelionCfg.minClearFraction
    );
    const flower = Math.random() < 0.5;
    const ent = createDandelion(sim, {
      flower,
      bunch: Math.random() < 0.75,
      stemHeight: 1.1,
      stemRadius: 0.02,
      headRadius: 0.14,
      position: [x, 0, z],
      rotation: [0, Math.random() * Math.PI * 2, 0],
    });
    ent.mesh.visible = false; // hidden until the intro pops them up one by one
    ent.mesh.position.y = -0.8; // poised below ground for the pop
    const waves = [];
    for (const stalk of ent.mesh.children) {
      const az = Math.random() * Math.PI * 2;
      waves.push({
        ax: Math.cos(az),
        az: Math.sin(az),
        ph: Math.random() * Math.PI * 2,
        baseX: stalk.rotation.x,
        baseZ: stalk.rotation.z,
      });
    }
    dandelions.push({
      ent,
      x,
      z,
      flower,
      grown: true,
      regrowT: 0,
      waves,
      folding: false,
      foldT: 0,
      foldAngle: 0,
      foldAxis: new THREE.Vector3(),
      puffed: false,
      shouldPuff: false,
      pop: 1,
      baseEuler: ent.mesh.rotation.clone(),
    });
  }
  ctx.creatures.dandelions = dandelions;
  ctx.creatures.dandelionsReady = true; // now applySky can drive petal nastic closure
  ctx.creatures.flowerStarted = new Uint8Array(DANDELION_COUNT);
  ctx.creatures.popProgress = new Float32Array(DANDELION_COUNT);

  // Sync initial sleep/wake state to the current hour so a page loaded at
  // night starts the diurnal families already asleep. dispatch lets prevHour
  // == hour on init, so no boundary "crosses" fire; set state directly.
  for (const fam of ctx.creatures.dayCycle) {
    const w = fam.wakeHour,
      s = fam.sleepHour;
    const awake =
      w < s
        ? ctx.time.hour >= w && ctx.time.hour < s
        : ctx.time.hour >= w || ctx.time.hour < s;
    for (const item of fam.items) awake ? item.wake() : item.sleep();
  }

  // Creatures checkbox: toggle all bugs.
  const creaturesCheckbox = document.getElementById("creatures-checkbox");
  const applyCreatures = () => {
    ctx.flow.creaturesEnabled = creaturesCheckbox.checked;
    flies.mesh.visible = ctx.flow.creaturesEnabled && !fliesSleeping.value;
    for (const b of butterflies) b.group.visible = ctx.flow.creaturesEnabled;
    for (const d of dragonflies)
      d.group.visible = ctx.flow.creaturesEnabled && !d.sleeping;
    for (const s of flySwarms)
      s.mesh.visible = ctx.flow.creaturesEnabled && !s.sleeping;
    for (const b of bees)
      b.group.visible = ctx.flow.creaturesEnabled && !b.sleeping;
    for (const f of fireflies)
      f.group.visible = ctx.flow.creaturesEnabled && !f.sleeping && !ctx.flow.revealFired;
  };
  creaturesCheckbox.addEventListener("change", applyCreatures);

  return { butterflies, dragonflies, flySwarms, bees, fireflies, flies, fliesSleeping };
}