// MowerController: the player's push lawnmower — entity construction, the
// spatial-grid cut/grow loop, grass-clipping particles, dandelion mowing,
// the first-person/orbit camera, keyboard + touch input, and the grass tweak
// sliders.

import * as THREE from "three";
import { createLawnmower } from "engine/components.js";
import { CONFIG } from "./config.js";

export function buildMower(sim, ctx, env) {
  const isMobile = ctx.env.isMobile;
  const grass = ctx.grass;
  const C = CONFIG;

  // --- Push lawnmower ---
  const MOWER = {
    wheelRadius: C.mower.wheelRadius,
    handleAngle: C.mower.handleAngle,
    handleLength: C.mower.handleLength,
  };
  const mower = createLawnmower(sim, {
    wheelRadius: MOWER.wheelRadius,
    reelWidth: C.mower.reelWidth,
    bladeThickness: C.mower.bladeThickness,
    blades: C.mower.blades,
    handleAngle: MOWER.handleAngle,
    handleLength: MOWER.handleLength,
    bodyColor: C.mower.bodyColor,
    bladeColor: C.mower.bladeColor,
    wheelColor: C.mower.wheelColor,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  });
  ctx.mower = mower;

  // Fade the whole mower in/out by tuning every MeshStandardMaterial's opacity
  // across its object tree.
  const setMowerOpacity = (o) => {
    mower.mesh.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        for (const m of Array.isArray(obj.material)
          ? obj.material
          : [obj.material]) {
          if (m.isMeshStandardMaterial) {
            m.transparent = true;
            m.opacity = o;
          }
        }
      }
    });
  };
  ctx.mower.setOpacity = setMowerOpacity;
  setMowerOpacity(0.0001); // boot: starts transparent, fades in at init end

  // --- Cut footprint + grow bookkeeping ---
  const CUT_HALF_W = C.mower.cutWidth / 2;
  const CUT_HALF_D = C.mower.cutDepth * C.mower.footprintFrac;
  let CUT_HEIGHT = C.mower.cutHeight;
  const bladeMinGrowth = new Float32Array(grass.total);
  const recomputeMinGrowth = () => {
    for (let i = 0; i < grass.total; i++) {
      bladeMinGrowth[i] = Math.min(
        1,
        CUT_HEIGHT / (grass.half * grass.bladeScale[i]),
      );
    }
  };
  recomputeMinGrowth();

  const localPos = new THREE.Vector3();
  const invMower = new THREE.Matrix4();

  // Active-growth set: only blades below full height are touched each frame.
  const growList = [];
  const growIndex = new Int32Array(grass.total).fill(-1);
  const addToGrow = (i) => {
    if (growIndex[i] !== -1) return;
    growIndex[i] = growList.length;
    growList.push(i);
  };

  const hasCuttableGrass = () => {
    invMower.copy(mower.mesh.matrixWorld).invert();
    return ctx.env.visitCutArea(CUT_HALF_W, CUT_HALF_D, 0, (i) => {
      if (grass.bladeGrowth[i] <= bladeMinGrowth[i]) return false;
      localPos.copy(grass.bladePos[i]).applyMatrix4(invMower);
      if (
        Math.abs(localPos.x) < CUT_HALF_W &&
        Math.abs(localPos.z) < CUT_HALF_D
      ) {
        return true;
      }
      return false;
    });
  };

  // Particle-size sampler: a thin rectangular box just ahead of the reel.
  const SAMPLE_HALF_W = CUT_HALF_W;
  const SAMPLE_HALF_D = C.mower.sampleHalfD;
  const SAMPLE_OFF_Z = -(CUT_HALF_D + SAMPLE_HALF_D);
  const sampleCutAmount = () => {
    invMower.copy(mower.mesh.matrixWorld).invert();
    let sum = 0,
      count = 0;
    ctx.env.visitCutArea(SAMPLE_HALF_W, SAMPLE_HALF_D, SAMPLE_OFF_Z, (i) => {
      if (grass.bladeGrowth[i] <= bladeMinGrowth[i]) return false;
      localPos.copy(grass.bladePos[i]).applyMatrix4(invMower);
      if (
        Math.abs(localPos.x) < SAMPLE_HALF_W &&
        Math.abs(localPos.z - SAMPLE_OFF_Z) < SAMPLE_HALF_D
      ) {
        sum += grass.bladeGrowth[i] - bladeMinGrowth[i];
        count++;
      }
      return false;
    });
    return count ? sum / count : 0;
  };

  // --- Grass-clipping particle effect (emitted when the mower moves) ---
  const CLIP_COUNT = C.mower.clipCount;
  const CLIP_SCALE = (C.grass.height / 0.5) * 0.5;
  const clipGeo = new THREE.BufferGeometry();
  clipGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [-0.025, 0, 0, 0.025, 0, 0, 0, 0.5, 0],
      3,
    ),
  );
  clipGeo.computeVertexNormals();
  const clipMat = new THREE.MeshStandardMaterial({
    color: C.mower.clipColor,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const clipMesh = new THREE.InstancedMesh(clipGeo, clipMat, CLIP_COUNT);
  clipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  clipMesh.frustumCulled = false;
  sim.scene.add(clipMesh);
  const clipMat4 = new THREE.Matrix4();
  const _clipArray = clipMesh.instanceMatrix.array;
  const _cp = new THREE.Vector3();
  const _cs = new THREE.Vector3();
  const clipQuat = new THREE.Quaternion();
  const clipEuler = new THREE.Euler();
  const clips = [];
  for (let i = 0; i < CLIP_COUNT; i++) {
    clips.push({
      x: 0,
      y: -1000,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      wrx: 0,
      wry: 0,
      wrz: 0,
      life: 0,
      scale: 1,
      alive: false,
      hidden: true,
    });
    clipMat4.makeTranslation(-1000, -1000, -1000);
    _clipArray.set(clipMat4.elements, i * 16);
  }
  clipMesh.instanceMatrix.needsUpdate = true;
  let clipCursor = 0;
  let clipAccum = 0;

  // ---- Drive the mower from input ----
  const input = ctx.input;
  // Register this game's abstract actions/axes with the shared manager once.
  // Forward: W/Up = -1 (drive forward along -Z), S/Down = +1 (reverse).
  input.defineAxis("forward", {
    negative: ["KeyW", "ArrowUp"],
    positive: ["KeyS", "ArrowDown"],
  });
  // Turn: A/Left = +1, D/Right = -1 (reversed later for reversing).
  input.defineAxis("turn", {
    negative: ["KeyD", "ArrowRight"],
    positive: ["KeyA", "ArrowLeft"],
  });
  input.defineAction("orbit", "Space");
  input.defineAction("shift", ["ShiftLeft", "ShiftRight"]);

  let hintMoveHidden = false;
  let hintOrbitHidden = false;
  let hintStart = 0;
  const freezeHint = () => {
    const hint = document.getElementById("hint");
    if (!hint || hint.style.display === "none") return;
    if (hintStart === 0) hintStart = hint.offsetHeight;
    hint.style.height = `${hintStart}px`;
    hint.style.overflow = "hidden";
  };
  const collapseHint = () => {
    const hint = document.getElementById("hint");
    if (!hint || hint.style.display === "none") return;
    const from = hintStart || hint.offsetHeight;
    const start = performance.now();
    const dur = 400;
    hint.style.overflow = "hidden";
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      hint.style.height = `${from * (1 - ease(p))}px`;
      if (p < 1) requestAnimationFrame(tick);
      else {
        hint.style.display = "none";
        hint.style.height = "";
      }
    };
    requestAnimationFrame(tick);
  };
  const dismissOrbit = () => {
    if (hintOrbitHidden) return;
    hintOrbitHidden = true;
    freezeHint();
    const orbitHint = document.getElementById("hint-orbit");
    if (orbitHint) {
      orbitHint.style.transition = "opacity 0.4s ease";
      requestAnimationFrame(() => {
        orbitHint.style.opacity = "0";
      });
      setTimeout(() => {
        orbitHint.style.display = "none";
        if (hintMoveHidden) collapseHint();
      }, 400);
    }
  };
  // Toggle the orbit camera + dismiss the hint on the Space action (edge).
  const maybeOrbit = () => {
    ctx.camera.camBlendTarget = ctx.camera.camBlendTarget > 0.5 ? 0 : 1;
    dismissOrbit();
  };

  const forward = new THREE.Vector3(0, 0, 1);
  const _dir = new THREE.Vector3();
  const _reelWorld = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const turnDir = new THREE.Vector3(0, 1, 0);
  let mowerMoving = false;
  let mowerForward = false;

  // Touch control (mobile): a virtual stick owned by the shared InputManager.
  // Steering rides the grab-relative X deflection; the throttle is anchored to
  // a fixed on-screen line so most of the display drives forward (same tuned
  // feel as before), reading the stick's raw pointer position.
  const STICK_R = input.stickRadius;
  const FWD_STROKE = STICK_R * C.touch.fwdStrokeFraction;
  const backLine = () => window.innerHeight * C.touch.backLineFraction;
  const touchTurn = () => {
    if (!input.stick.active) return 0;
    const x = input.stick.x;
    const sa = Math.abs(x);
    return sa < C.touch.turnDeadzone
      ? 0
      : -Math.sign(x) * Math.pow(Math.min(1, sa), 3);
  };
  const touchF = () => {
    if (!input.stick.active) return 0;
    const ndy = (input.stick.py - backLine()) / FWD_STROKE;
    return Math.abs(ndy) < C.touch.fwdDeadzone
      ? 0
      : Math.max(-1, Math.min(1, ndy));
  };
  let mobileHintHidden = false;
  // Re-arm the dismiss so the first tap AFTER the countdown hides the hint.
  ctx.mower.rearmMobileHint = () => {
    mobileHintHidden = false;
    if (isMobile) {
      const hint = document.getElementById("hint");
      hint.style.display = "block";
      hint.style.opacity = "0.5";
      hint.style.fontSize = "0.85rem";
      hint.style.transition = "";
    }
  };
  const dismissMobileHint = () => {
    if (mobileHintHidden) return;
    mobileHintHidden = true;
    const hint = document.getElementById("hint");
    if (!hint) return;
    hint.style.transition = "opacity 0.4s ease";
    requestAnimationFrame(() => {
      hint.style.opacity = "0";
    });
    setTimeout(() => {
      hint.style.display = "none";
    }, 400);
  };
  // --- Orbit camera ---
  const canvas = sim.renderer.domElement;
  canvas.style.touchAction = "none"; // let the input manager drive touch
  let dragging = false,
    lastX = 0,
    lastY = 0;
  const target = new THREE.Vector3(0, 0, 0);
  const CAM_BLEND_K = C.camera.blendK;
  const MAX_ZOOM =
    Math.min(ctx.env.lawnHalfW, ctx.env.lawnHalfD) +
    C.camera.orbitWallMargin -
    C.camera.orbitMaxMargin;

  canvas.addEventListener("mousedown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    ctx.camera.theta -= (e.clientX - lastX) * 0.005;
    const MAX_PHI = Math.PI / 2 - THREE.MathUtils.degToRad(5);
    ctx.camera.phi = Math.max(
      0.05,
      Math.min(MAX_PHI, ctx.camera.phi - (e.clientY - lastY) * 0.005),
    );
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      ctx.camera.radius = Math.max(3, Math.min(MAX_ZOOM, ctx.camera.radius + e.deltaY * 0.03));
    },
    { passive: false },
  );

  // The big per-frame system: drive the mower + cut/grow grass + clip
  // particles + mow dandelions + place the camera.
  sim.addEntity(null, null, (dt) => {
    const input = ctx.input;
    input.update(); // refresh edge detection (pressed/released) + stick state

    // Orbit toggle (Space) fires once per press; first press dismisses the hint.
    if (input.pressed("orbit")) maybeOrbit();
    // Mobile: dismiss the "tap to mow" hint on the first fresh touch.
    if (input.touchStarted && isMobile) dismissMobileHint();

    // ---- Mower local +Z (handle push direction) mapped to world ----
    const dir = _dir.copy(forward).applyQuaternion(mower.mesh.quaternion);
    const rawTurn = input.axis("turn") || touchTurn();
    const v = input.axis("forward") || touchF();
    const reverseMultiplier = v > 0 ? -1 : 1;
    const turn = rawTurn * reverseMultiplier;
    const speed = C.mower.moveSpeed;
    const shifting = input.hasAction("shift");
    const ease = shifting ? C.mower.shiftEase : 1;
    const move = v * speed * ease;
    const touchSpinBoost =
      v === 0 && touchTurn() !== 0 ? C.mower.touchSpinBoost : 1;
    const turnSpeed =
      (v === 0
        ? C.mower.pivotTurnSpeed
        : shifting
          ? C.mower.shiftTurnSpeed
          : C.mower.turnSpeed) * touchSpinBoost;
    const moveLocked = ctx.flow.introActive ? 0 : move;
    const effectiveMove = moveLocked;

    mowerMoving = v !== 0;
    mowerForward = effectiveMove < 0;

    // Drop the "keys to move" hint once the player moves.
    if (v !== 0 && !hintMoveHidden) {
      hintMoveHidden = true;
      freezeHint();
      const moveHint = document.getElementById("hint-move");
      const orbitHint = document.getElementById("hint-orbit");
      if (moveHint && orbitHint) {
        const gap =
          parseFloat(getComputedStyle(moveHint.parentElement).gap) || 0;
        const shift = moveHint.offsetWidth + gap;
        moveHint.style.transition = "opacity 0.4s ease";
        orbitHint.style.transition = "transform 0.4s ease";
        orbitHint.style.transform = `translateX(${-shift}px)`;
        requestAnimationFrame(() => {
          moveHint.style.opacity = "0";
        });
        setTimeout(() => {
          moveHint.style.display = "none";
          moveHint.style.opacity = "1";
          orbitHint.style.transition = "none";
          orbitHint.style.transform = "";
          if (hintOrbitHidden) collapseHint();
        }, 400);
      }
    }

    mower.mesh.rotateOnWorldAxis(turnDir, turn * turnSpeed * dt);
    mower.setSpeed(effectiveMove);
    mower.mesh.position.addScaledVector(dir, effectiveMove * dt);
    mower.mesh.position.x = Math.max(
      -ctx.env.lawnHalfW + ctx.env.margin,
      Math.min(ctx.env.lawnHalfW - ctx.env.margin, mower.mesh.position.x),
    );
    mower.mesh.position.z = Math.max(
      -ctx.env.lawnHalfD + ctx.env.margin,
      Math.min(ctx.env.lawnHalfD - ctx.env.margin, mower.mesh.position.z),
    );
    mower.mesh.updateWorldMatrix(true, false);

    // ---- Emit clippings from the reel when moving AND cutting grass ----
    const reelWorld = mower.mesh.localToWorld(_reelWorld.set(0, 0.1, 0));
    const right = _right
      .set(1, 0, 0)
      .applyQuaternion(mower.mesh.quaternion);
    if (mowerForward && hasCuttableGrass()) {
      clipAccum += dt * C.mower.clipEmitRate;
      const amt = sampleCutAmount();
      while (clipAccum >= 1) {
        clipAccum -= 1;
        const p = clips[clipCursor];
        clipCursor = (clipCursor + 1) % CLIP_COUNT;
        const off = (Math.random() - 0.5) * 0.8;
        p.x = reelWorld.x + off * right.x;
        p.z = reelWorld.z + off * right.z;
        p.y = reelWorld.y + Math.random() * 0.1;
        const spread = 1.6;
        p.vx = (Math.random() - 0.5) * spread;
        p.vz = (Math.random() - 0.5) * spread;
        p.vy = 1.2 + Math.random() * 1.6;
        p.scale = Math.max(0.08, amt * CLIP_SCALE);
        p.rx = Math.random() * Math.PI * 2;
        p.ry = Math.random() * Math.PI * 2;
        p.rz = Math.random() * Math.PI * 2;
        p.wrx = (Math.random() - 0.5) * 14;
        p.wry = (Math.random() - 0.5) * 14;
        p.wrz = (Math.random() - 0.5) * 14;
        p.life = 0;
        p.alive = true;
        p.hidden = false;
      }
    } else {
      clipAccum = 0;
    }

    // ---- Age clippings: tumble and arc with gravity, then despawn ----
    const clipArr = clipMesh.instanceMatrix.array;
    for (let i = 0; i < CLIP_COUNT; i++) {
      const p = clips[i];
      if (!p.alive) {
        if (p.hidden) continue;
        p.hidden = true;
        clipMat4.makeTranslation(-1000, -1000, -1000);
        _clipArray.set(clipMat4.elements, i * 16);
        continue;
      }
      p.life += dt;
      if (ctx.flow.gravityOn) {
        p.vy -= C.mower.clipGravity * dt;
      } else {
        p.vy *= Math.max(0, 1 - 6 * dt);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rx += p.wrx * dt;
      p.ry += p.wry * dt;
      p.rz += p.wrz * dt;
      if (p.life > (ctx.flow.gravityOn ? 0.9 : 20) || p.y < 0.01) {
        p.alive = false;
        p.y = -1000;
      }
      clipEuler.set(p.rx, p.ry, p.rz);
      clipQuat.setFromEuler(clipEuler);
      clipMat4.compose(
        _cp.set(p.x, p.y, p.z),
        clipQuat,
        _cs.set(p.scale, p.scale, p.scale),
      );
      _clipArray.set(clipMat4.elements, i * 16);
    }
    clipMesh.instanceMatrix.needsUpdate = true;

    // ---- Grass: sway, then cut + grow ----
    if (ctx.flow.swaying) {
      // Slow-motion ramp: uTime advances scaled by motionScale (0 frozen during
      // the countdown, easing to realtime by "MOW!").
      ctx.grass.swayUniforms.uTime.value =
        (ctx.grass.swayUniforms.uTime.value + dt * ctx.flow.motionScale) % 1000;
    }
    // Wind-blown sway only when the simulation is live (not at the reveal).
    ctx.grass.swayUniforms.uSway.value = ctx.flow.swaying ? 1 : 0;
    ctx.grass.grassDirty = false;
    invMower.copy(mower.mesh.matrixWorld).invert();
    if (mowerForward) {
      ctx.env.visitCutArea(CUT_HALF_W, CUT_HALF_D, 0, (i) => {
        if (grass.bladeGrowth[i] > bladeMinGrowth[i]) {
          localPos.copy(grass.bladePos[i]).applyMatrix4(invMower);
          if (
            Math.abs(localPos.x) < CUT_HALF_W &&
            Math.abs(localPos.z) < CUT_HALF_D
          ) {
            grass.bladeGrowth[i] = bladeMinGrowth[i];
            grass.arr[i] = bladeMinGrowth[i];
            grass.attr.needsUpdate = true;
            addToGrow(i);
          }
        }
        return false;
      });
    }
    const grassArr = grass.mesh.instanceMatrix.array;
    let growthNeedsUpdate = false;
    for (let k = 0; k < growList.length; ) {
      const i = growList[k];
      grass.bladeGrowth[i] = Math.min(
        grass.bladeGrowth[i] + dt * ctx.grass.growRate,
        1,
      );
      grassArr[i * 16 + 13] =
        grass.half * grass.bladeScale[i] * (grass.bladeGrowth[i] - 1);
      grass.arr[i] = grass.bladeGrowth[i];
      ctx.grass.grassDirty = true;
      growthNeedsUpdate = true;
      if (grass.bladeGrowth[i] >= 1) {
        const last = growList.pop();
        if (last !== i) {
          growList[k] = last;
          growIndex[last] = k;
        }
        growIndex[i] = -1;
      } else {
        k++;
      }
    }
    if (ctx.grass.grassDirty) {
      grass.mesh.instanceMatrix.needsUpdate = true;
      if (growthNeedsUpdate) {
        grass.attr.needsUpdate = true;
        growthNeedsUpdate = false;
      }
    }

    // ---- Mow dandelions under the reel + regrow after a delay ----
    const _foldBaseQ = new THREE.Quaternion();
    const _foldQ = new THREE.Quaternion();
    const _foldFwd = new THREE.Vector3();
    const _foldAxis = new THREE.Vector3();
    const _tmpCross = new THREE.Vector3();
    invMower.copy(mower.mesh.matrixWorld).invert();
    if (mowerForward) {
      for (const d of ctx.creatures.dandelions) {
        if (d.grown && !d.folding) {
          localPos.set(d.x, 0, d.z).applyMatrix4(invMower);
          if (
            Math.abs(localPos.x) < CUT_HALF_W &&
            Math.abs(localPos.z) < CUT_HALF_D
          ) {
            if (!d.flower) d.shouldPuff = true;
            ctx.creatures.bumpMowed();
            d.folding = true;
            d.foldT = 0;
            _foldFwd.set(0, 0, -1).applyQuaternion(mower.mesh.quaternion);
            _foldFwd.y = 0;
            if (_foldFwd.lengthSq() < 1e-6) _foldFwd.set(0, 0, -1);
            _foldFwd.normalize();
            _foldAxis.set(0, 1, 0).cross(_foldFwd).normalize();
            d.foldAxis.copy(_foldAxis);
          }
        }
      }
    }
    for (const d of ctx.creatures.dandelions) {
      if (d.grown) continue;
      d.regrowT -= dt;
      if (d.regrowT <= 0) {
        // Respawn in a fresh random spot on the lawn (kept clear of the
        // center where the mower starts).
        const bx = ctx.creatures.bx;
        const bz = ctx.creatures.bz;
        const clearR = Math.min(bx, bz) * C.dandelions.minClearFraction;
        let nx, nz;
        do {
          nx = (Math.random() * 2 - 1) * bx;
          nz = (Math.random() * 2 - 1) * bz;
        } while (Math.hypot(nx, nz) < clearR);
        d.x = nx;
        d.z = nz;
        d.ent.mesh.position.x = nx;
        d.ent.mesh.position.z = nz;
        d.ent.mesh.quaternion.setFromEuler(d.baseEuler);
        d.ent.mesh.visible = true;
        d.pop = 0;
        d.ent.mesh.position.y = -0.8;
        d.grown = true;
        d.puffed = false;
        d.shouldPuff = false;
        d.ent.restore?.();
      }
    }

    // Dandelions wave in the wind like the grass. uTime advances scaled by
// motionScale, so they stay still until the countdown's slow-motion ramp.
    if (ctx.flow.swaying) {
      const t = ctx.grass.swayUniforms.uTime.value;
      for (const d of ctx.creatures.dandelions) {
        if (!d.grown || d.folding) continue;
        for (let i = 0; i < d.waves.length; i++) {
          const w = d.waves[i];
          const stalk = d.ent.mesh.children[i];
          const wave = 0.1745 * Math.sin(t * 1.3 + w.ph);
          stalk.rotation.x = w.baseX + w.ax * wave;
          stalk.rotation.z = w.baseZ + w.az * wave;
        }
      }
    }

    // Fold-over: a mowed dandelion rotates flat then despawns.
    for (const d of ctx.creatures.dandelions) {
      if (!d.folding) continue;
      d.foldT = Math.min(1, d.foldT + dt / ctx.creatures.FOLD_S);
      const e = 1 - (1 - d.foldT) * (1 - d.foldT);
      const ang = ctx.creatures.FOLD_ANGLE * e;
      if (d.shouldPuff && !d.puffed && e >= 0.6) {
        d.puffed = true;
        d.ent.puff();
      }
      _foldBaseQ.setFromEuler(d.baseEuler);
      _foldQ.setFromAxisAngle(
        _tmpCross.copy(d.foldAxis).normalize(),
        ang,
      );
      d.ent.mesh.quaternion.copy(_foldQ).multiply(_foldBaseQ);
      if (d.foldT >= 1) {
        d.ent.mesh.visible = false;
        d.folding = false;
        d.foldT = 0;
        d.grown = false;
        d.regrowT = 3 + Math.random() * 7;
      }
    }
    // Rise any dandelion currently popping out of the ground.
    for (const d of ctx.creatures.dandelions) {
      if (d.pop !== undefined && d.pop < 1) {
        d.pop = Math.min(1, d.pop + dt / 0.25);
        d.ent.mesh.position.y = -0.8 * (1 - d.pop);
      }
    }

    // ---- Camera: blend first-person (on the mower handle) and orbit ----
    ctx.camera.camBlend += (ctx.camera.camBlendTarget - ctx.camera.camBlend) * Math.min(1, dt * CAM_BLEND_K);
    const blend = ctx.camera.camBlend;

    const gripY =
      MOWER.wheelRadius + MOWER.handleLength * Math.cos(MOWER.handleAngle);
    const gripZ = MOWER.handleLength * Math.sin(MOWER.handleAngle);
    const _fpMount = new THREE.Vector3(
      0,
      MOWER.wheelRadius + (gripY - MOWER.wheelRadius) * 1.5,
      gripZ * 1.5 + ctx.camera.fwdOffset,
    );
    const _fpWorld = new THREE.Vector3();
    const _fpQuat = new THREE.Quaternion();
    const _fpPitch = new THREE.Quaternion();
    const _fpAxis = new THREE.Vector3(1, 0, 0);
    const _orbQuat = new THREE.Quaternion();
    const _tmpOrb = new THREE.Vector3();
    const _lookAtM = new THREE.Matrix4();
    mower.mesh.updateWorldMatrix(true, false);
    _fpWorld.copy(mower.mesh.localToWorld(_fpMount));
    _fpQuat.copy(mower.mesh.quaternion);
    const kickNow = ctx.camera.kickEnv(ctx.camera.kick.elapsed);
    _fpQuat.multiply(
      _fpPitch.setFromAxisAngle(
        _fpAxis.set(1, 0, 0),
        ctx.camera.gazePitch + kickNow * ctx.camera.KICK_PITCH,
      ),
    );

    ctx.camera.radius = Math.max(3, Math.min(MAX_ZOOM, ctx.camera.radius));
    const sp = Math.sin(ctx.camera.phi);
    _tmpOrb.set(
      target.x + ctx.camera.radius * sp * Math.sin(ctx.camera.theta),
      target.y + ctx.camera.radius * Math.cos(ctx.camera.phi),
      target.z + ctx.camera.radius * sp * Math.cos(ctx.camera.theta),
    );
    _orbQuat.setFromRotationMatrix(
      _lookAtM.lookAt(_tmpOrb, target, _fpAxis.set(0, 1, 0)),
    );

    if (blend <= 0.001) {
      sim.camera.position.copy(_fpWorld);
      sim.camera.quaternion.copy(_fpQuat);
    } else if (blend >= 0.999) {
      sim.camera.position.copy(_tmpOrb);
      sim.camera.quaternion.copy(_orbQuat);
    } else {
      sim.camera.position.lerpVectors(_fpWorld, _tmpOrb, blend);
      sim.camera.quaternion.slerpQuaternions(_fpQuat, _orbQuat, blend);
    }

    // Advance (and apply) the blast camera kick.
    ctx.camera.kick.elapsed += dt * 1000;
    const baseFov = parseFloat(ctx.camera.fovSlider.value);
    const kickFovNow = ctx.camera.kickEnv(ctx.camera.kick.elapsed);
    if (kickFovNow > 0) {
      sim.camera.fov = baseFov + (ctx.camera.KICK_TARGET_FOV - baseFov) * kickFovNow;
      sim.camera.updateProjectionMatrix();
    }
  });

  // ---- Grass tweak sliders ----
  {
    const cutSlider = document.getElementById("cut-height-slider");
    const cutValueEl = document.getElementById("cut-height-value");
    const growSlider = document.getElementById("grow-rate-slider");
    const growValueEl = document.getElementById("grow-rate-value");
    const applyCutHeight = () => {
      CUT_HEIGHT = parseFloat(cutSlider.value);
      recomputeMinGrowth();
      cutValueEl.textContent = CUT_HEIGHT.toFixed(2) + "m";
    };
    const applyGrowRate = () => {
      ctx.grass.growRate = parseFloat(growSlider.value);
      growValueEl.textContent = ctx.grass.growRate.toFixed(3);
    };
    cutSlider.addEventListener("input", applyCutHeight);
    growSlider.addEventListener("input", applyGrowRate);
    applyCutHeight();
    applyGrowRate();
  }
  // ---- Grass density config (Apply persists then reloads) ----
  {
    const el = (id) => document.getElementById(id);
    const colsEl = el("density-cols");
    const rowsEl = el("density-rows");
    const nEl = el("density-n");
    const totalEl = el("density-total");
    colsEl.value = ctx.density.COLS;
    rowsEl.value = ctx.density.ROWS;
    nEl.value = ctx.density.N;
    const upd = () => {
      const c = ctx.clampInt(Number(colsEl.value), 1, 20);
      const r = ctx.clampInt(Number(rowsEl.value), 1, 20);
      const n = ctx.clampInt(Number(nEl.value), 1, 10000);
      totalEl.textContent = `${(c * r * n).toLocaleString()} blades`;
    };
    [colsEl, rowsEl, nEl].forEach((i) =>
      i.addEventListener("input", upd),
    );
    upd();
    el("density-apply").addEventListener("click", () => {
      localStorage.setItem(
        "mow-cols",
        String(ctx.clampInt(Number(colsEl.value), 1, 20)),
      );
      localStorage.setItem(
        "mow-rows",
        String(ctx.clampInt(Number(rowsEl.value), 1, 20)),
      );
      localStorage.setItem(
        "mow-n",
        String(ctx.clampInt(Number(nEl.value), 1, 10000)),
      );
      location.reload();
    });
  }

  return { mower, setMowerOpacity };
}