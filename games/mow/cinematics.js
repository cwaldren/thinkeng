// CinematicManager: the story/dome layer — the translucent glass sky dome and
// its painting, the shattering reveal, the doom red/black overlay, the
// "GOOD MORNING" greeting, the camera kick, the day/night clock + reveal
// driver (applySky), the boot intro, and all the sun/earth tuning sliders.

import * as THREE from "three";
import { CONFIG } from "./config.js";

export function buildCinematics(sim, ctx, env) {
  const isMobile = ctx.env.isMobile;
  const { COLS, ROWS } = ctx.density;
  const W = ctx.density.W;
  const D = ctx.density.D;
  const lawnHalfW = ctx.env.lawnHalfW;
  const lawnHalfD = ctx.env.lawnHalfD;
  const C = CONFIG;
  const dome = C.skyDome;
  const rev = C.reveal;
  const introCfg = C.intro;

  // Wire mutable cross-module state into the shared context.
  ctx.time = { hour: null, prevHour: null };

  // --- Glass cube around the patch: four walls + a lid rising 20m ---
  const WALL_INSET = dome.wallInset;
  const CUBE_H = dome.cubeHeight;
  // Fake "Earth day" sky painted on the cube's surfaces. The inside reads as
  // blue sky at noon, deepening to a red/purple sunset as the sun drops, then
  // turns fully transparent AT sunset so the player suddenly sees out.
  const skyCanvas = document.createElement("canvas");
  const skyCvS = dome.skyResolution;
  skyCanvas.width = skyCvS;
  skyCanvas.height = skyCvS;
  const skyCtx = skyCanvas.getContext("2d");
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const _colorA = new THREE.Color();
  const _colorB = new THREE.Color();
  const lerpC = (a, b, t) => {
    _colorA.set(a);
    _colorB.set(b);
    return _colorA.lerp(_colorB, t).getStyle();
  };
  const DAY_TOP = dome.dayTop,
    DAY_HOR = dome.dayHorizon;
  const SET_TOP = dome.setTop,
    SET_HOR = dome.setHorizon;
  const DUSK_TOP = dome.duskTop,
    DUSK_HOR = dome.duskHorizon;
  const NIGHT_P = dome.nightP;
  let p = 0;
  const ceilCanvas = document.createElement("canvas");
  ceilCanvas.width = ceilCanvas.height = skyCvS;
  const ceilCtx = ceilCanvas.getContext("2d");
  const ceilTex = new THREE.CanvasTexture(ceilCanvas);
  ceilTex.colorSpace = THREE.SRGBColorSpace;
  // Boot cinematic sequence state.
  let introT = 0;
  let wallsDawn = 0;
  const COUNT_START = introCfg.countStart;
  const COUNT_SEC = 1;
  const INTRO_END = introCfg.introEnd;
  // "CONTAINMENT BREACH" / "LOW PRESSURE" warning before the reveal.
  let breachActive = false;
  let breachT = 0;
  let lastPaintedP = -1;
  let lastBreachTick = -1;
  const INTRO_GREY_TOP = dome.introGreyTop,
    INTRO_GREY_HOR = dome.introGreyHorizon;

  // Reveal state machine flags (read by other modules via ctx).
  let curtainStarted = false; // reveal act fired once per night
  let revealFired = ctx.flow.revealFired;

  ctx.flow.swaying = true;
  ctx.flow.gravityOn = true;

  // Paint the shared gradient palette into a given context.
  const paintGradient = (ctx2d) => {
    let top, hor;
    if (p <= 1) {
      top = lerpC(DAY_TOP, SET_TOP, p);
      hor = lerpC(DAY_HOR, SET_HOR, p);
    } else {
      const d = (p - 1) / (NIGHT_P - 1);
      top = lerpC(SET_TOP, DUSK_TOP, d);
      hor = lerpC(SET_HOR, DUSK_HOR, d);
    }
    if (ctx.flow.introActive || wallsDawn < 1) {
      top = lerpC(INTRO_GREY_TOP, top, wallsDawn);
      hor = lerpC(INTRO_GREY_HOR, hor, wallsDawn);
    }
    ctx2d.fillStyle = top;
    ctx2d.fillRect(0, 0, skyCvS, skyCvS);
    const startRow = skyCvS * 0.75;
    const g = ctx2d.createLinearGradient(0, startRow, 0, skyCvS);
    g.addColorStop(0, top);
    g.addColorStop(1, hor);
    ctx2d.fillStyle = g;
    ctx2d.fillRect(0, startRow, skyCvS, skyCvS);
  };
  // Draw the day-start / boot / breach message on the WALL fabric.
  const paintWallText = () => {
    let msg,
      big = false;
    if (ctx.flow.introActive) {
      if (introT >= COUNT_START) {
        const i = Math.floor(introT - COUNT_START);
        const labels = ["3", "2", "1", "MOW!"];
        msg = labels[Math.min(i, labels.length - 1)];
        big = true;
      } else {
        const starting = Math.floor(introT / 2) % 2 === 0;
        msg = starting
          ? isMobile
            ? ["STARTING", "SIMULATION.."]
            : "STARTING SIMULATION.."
          : "PLEASE WAIT..";
        if (starting && isMobile) {
          skyCtx.save();
          skyCtx.translate(skyCvS / 2, 0);
          skyCtx.scale(-1, 1);
          skyCtx.translate(-skyCvS / 2, 0);
          skyCtx.fillStyle = "#ffffff";
          skyCtx.font = "bold 26px sans-serif";
          skyCtx.textAlign = "center";
          skyCtx.textBaseline = "middle";
          skyCtx.fillText(msg[0], skyCvS / 2, skyCvS * 0.75);
          skyCtx.fillText(msg[1], skyCvS / 2, skyCvS * 0.81);
          skyCtx.restore();
          return;
        }
      }
    } else if (breachActive) {
      msg =
        Math.floor(breachT) % 2 === 0
          ? "CONTAINMENT BREACH"
          : "LOW PRESSURE";
    } else {
      return;
    }
    skyCtx.save();
    skyCtx.translate(skyCvS / 2, 0);
    skyCtx.scale(-1, 1);
    skyCtx.translate(-skyCvS / 2, 0);
    skyCtx.fillStyle = "#ffffff";
    skyCtx.font = big ? "bold 78px sans-serif" : "bold 26px sans-serif";
    skyCtx.textAlign = "center";
    skyCtx.textBaseline = "middle";
    skyCtx.fillText(msg, skyCvS / 2, big ? skyCvS * 0.82 : skyCvS * 0.78);
    skyCtx.restore();
  };
  const paintSky = (pv) => {
    p = pv;
    paintGradient(skyCtx);
    paintWallText();
    skyTex.needsUpdate = true;
    paintGradient(ceilCtx);
    ceilTex.needsUpdate = true;
  };
  const glassMat = new THREE.MeshPhysicalMaterial({
    map: skyTex,
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveMap: skyTex,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: dome.opacity,
    roughness: 0.1,
    metalness: 0,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const domeW = lawnHalfW * 2 + WALL_INSET;
  const domeD = lawnHalfD * 2 + WALL_INSET;
  const ceilMat = new THREE.MeshPhysicalMaterial({
    map: ceilTex,
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveMap: ceilTex,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: dome.opacity,
    roughness: 0.1,
    metalness: 0,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const glassCube = new THREE.Group();
  const skyFaces = [];
  const SHARD_CELL = dome.shardCell;
  const addFace = (
    width,
    height,
    ry,
    x,
    y,
    z,
    mat = glassMat,
    segX = 1,
    segY = 1,
  ) => {
    const pl = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height, segX, segY),
      mat,
    );
    pl.rotation.set(0, ry, 0);
    pl.position.set(x, y, z);
    glassCube.add(pl);
    skyFaces.push(pl);
  };
  const wallSegX = (w) => Math.max(1, Math.round(w / SHARD_CELL));
  const wallSegY = Math.max(1, Math.round(CUBE_H / SHARD_CELL));
  addFace(domeW, CUBE_H, 0, 0, CUBE_H / 2, domeD / 2, glassMat, wallSegX(domeW), wallSegY); // north
  addFace(domeW, CUBE_H, Math.PI, 0, CUBE_H / 2, -domeD / 2, glassMat, wallSegX(domeW), wallSegY); // south
  addFace(domeD, CUBE_H, Math.PI / 2, domeW / 2, CUBE_H / 2, 0, glassMat, wallSegX(domeD), wallSegY); // east
  addFace(domeD, CUBE_H, -Math.PI / 2, -domeW / 2, CUBE_H / 2, 0, glassMat, wallSegX(domeD), wallSegY); // west
  {
    const ceilSeg = Math.max(1, Math.round(domeW / SHARD_CELL));
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(domeW, domeD, ceilSeg, ceilSeg),
      ceilMat,
    );
    ceil.rotation.set(-Math.PI / 2, 0, 0);
    ceil.position.set(0, CUBE_H, 0);
    glassCube.add(ceil);
    skyFaces.push(ceil);
  }
  sim.scene.add(glassCube);

  // --- Shattering reveal ---
  const EXPLODE_SPEED = rev.explodeSpeed;
  const EXPLODE_SPREAD = rev.explodeSpread;
  const EXPLODE_TUMBLE = rev.explodeTumble;
  let debris = [];
  const splitShards = (face) => {
    const flat = face.geometry.toNonIndexed();
    const pos = flat.attributes.position;
    const uv = flat.attributes.uv;
    const nrm = flat.attributes.normal;
    const nTri = pos.count / 3;
    const geos = [];
    for (let t = 0; t < nTri; t++) {
      const g = new THREE.BufferGeometry();
      const pp = new THREE.BufferAttribute(new Float32Array(9), 3);
      const u = new THREE.BufferAttribute(new Float32Array(6), 2);
      const n = new THREE.BufferAttribute(new Float32Array(9), 3);
      for (let k = 0; k < 3; k++) {
        pp.setXYZ(k, pos.getX(3 * t + k), pos.getY(3 * t + k), pos.getZ(3 * t + k));
        u.setXY(k, uv.getX(3 * t + k), uv.getY(3 * t + k));
        n.setXYZ(k, nrm.getX(3 * t + k), nrm.getY(3 * t + k), nrm.getZ(3 * t + k));
      }
      g.setAttribute("position", pp);
      g.setAttribute("uv", u);
      g.setAttribute("normal", n);
      geos.push(g);
    }
    flat.dispose();
    return geos;
  };
  const explodeSky = () => {
    const tmp = new THREE.Vector3();
    for (const face of skyFaces) {
      const px = face.position.x,
        pz = face.position.z;
      const horiz = Math.hypot(px, pz);
      const dir = new THREE.Vector3();
      if (horiz < 1e-3) {
        dir.set(0, 1, 0);
      } else {
        dir.set(px / horiz, 0, pz / horiz);
      }
      const upKick = horiz < 1e-3 ? 8 : 2;
      const shardGeos = splitShards(face);
      for (const g of shardGeos) {
        const m = new THREE.Mesh(g, face.material);
        m.position.copy(face.position);
        m.rotation.copy(face.rotation);
        m.frustumCulled = false;
        glassCube.add(m);
        const vel = tmp.copy(dir).multiplyScalar(EXPLODE_SPEED);
        vel.x += (Math.random() - 0.5) * EXPLODE_SPREAD;
        vel.y += (Math.random() - 0.5) * EXPLODE_SPREAD + upKick;
        vel.z += (Math.random() - 0.5) * EXPLODE_SPREAD;
        m.userData.vel = vel.clone();
        m.userData.rvel = new THREE.Vector3(
          (Math.random() - 0.5) * 2 * EXPLODE_TUMBLE,
          (Math.random() - 0.5) * 2 * EXPLODE_TUMBLE,
          (Math.random() - 0.5) * 2 * EXPLODE_TUMBLE,
        );
        debris.push(m);
      }
      face.visible = false;
    }
  };
  const resealSky = () => {
    for (const m of debris) {
      glassCube.remove(m);
      m.geometry.dispose();
    }
    debris = [];
    for (const face of skyFaces) face.visible = true;
  };
  // Flight driver: integrate each shard (friction-free constant velocity +
  // steady tumble) so the glass coasts into space.
  sim.addEntity(null, null, (dt) => {
    for (const m of debris) {
      m.position.addScaledVector(m.userData.vel, dt);
      m.rotation.x += m.userData.rvel.x * dt;
      m.rotation.y += m.userData.rvel.y * dt;
      m.rotation.z += m.userData.rvel.z * dt;
    }
    overlayUpdate(dt);
    greetingUpdate(dt);
  });

  // --- Doom fade: a fullscreen red wash fades IN, then to complete black ---
  const doomBlack = document.createElement("div");
  Object.assign(doomBlack.style, {
    position: "fixed",
    inset: "0",
    background: "#000",
    opacity: 0,
    pointerEvents: "none",
    zIndex: "9998",
  });
  document.body.appendChild(doomBlack);
  const doomRed = document.createElement("div");
  Object.assign(doomRed.style, {
    position: "fixed",
    inset: "0",
    background: "#f00",
    opacity: 0,
    pointerEvents: "none",
    zIndex: "9999",
  });
  document.body.appendChild(doomRed);
  const DOOM_DELAY_MS = rev.doomDelayMs;
  const DOOM_RISE_MS = rev.doomRiseMs;
  const DOOM_PULSE_FULL_MS = rev.doomPulseFullMs;
  const DOOM_BLACK_MS = rev.doomBlackMs;
  let doomT = -1;
  let doomRestarted = false;
  const overlayUpdate = (dt) => {
    if (doomT < 0) return;
    doomT += dt;
    const ms = doomT * 1000;
    if (ms < DOOM_RISE_MS) {
      const ramp = Math.min(1, ms / DOOM_PULSE_FULL_MS);
      const wave = 0.55 + 0.45 * Math.sin(doomT * Math.PI * 2);
      const pulse = 0.72 + 0.28 * wave;
      const red = Math.min(1, ramp * pulse);
      doomRed.style.opacity = red.toFixed(3);
    } else {
      const k = Math.min(1, (ms - DOOM_RISE_MS) / DOOM_BLACK_MS);
      doomRed.style.opacity = ((1 - k) * 1).toFixed(3);
      doomBlack.style.opacity = k.toFixed(3);
      if (k >= 1 && !doomRestarted) {
        doomRestarted = true;
        if (typeof simRestart === "function") simRestart();
      }
    }
  };
  const doomStart = () => {
    doomRestarted = false;
    setTimeout(() => {
      doomT = 0;
    }, DOOM_DELAY_MS);
  };

  // --- Day-start greeting: "GOOD MORNING." plays during the first 10s ---
  let simT = rev.greetingEndSimT;
  const newDay = () => {
    simT = 0;
    doomT = -1;
    doomRed.style.opacity = "0";
    doomBlack.style.opacity = "0";
  };
  const greetingUpdate = (dt) => {
    if (simT >= rev.greetingEndSimT) return;
    simT += dt;
    paintSky(p);
  };

  // --- Camera kick at the blast ---
  const KICK_RISE_MS = rev.kickRiseMs;
  const KICK_HOLD_MS = rev.kickHoldMs;
  const KICK_FALL_MS = rev.kickFallMs;
  const KICK_PITCH = rev.kickPitch;
  const KICK_TARGET_FOV = rev.kickTargetFov;
  const kickEnv = (el) => {
    if (el >= KICK_RISE_MS + KICK_HOLD_MS + KICK_FALL_MS) return 0;
    if (el < KICK_RISE_MS) return el / KICK_RISE_MS;
    if (el < KICK_RISE_MS + KICK_HOLD_MS) return 1;
    return 1 - (el - KICK_RISE_MS - KICK_HOLD_MS) / KICK_FALL_MS;
  };
  const kickStart = () => {
    ctx.camera.kick.elapsed = 0;
  };
  // Export kick to the shared context so the mower camera can read it.
  ctx.camera.kickEnv = kickEnv;
  ctx.camera.KICK_PITCH = KICK_PITCH;
  ctx.camera.KICK_TARGET_FOV = KICK_TARGET_FOV;

  // --- Fake dome sun + fill already created by environment; applySky drives
  // their intensity/color as the fake-sky time advances ---

  // Sun slider drives the fake-sky palette and the cube's opacity.
  const sunSlider = document.getElementById("sun-slider");
  const time = ctx.time;
  time.hour = parseFloat(sunSlider.value);
  time.prevHour = parseFloat(sunSlider.value);
  const parityLabels = ["dawn", "morning", "afternoon", "dusk", "night"];
  const applySky = (hour) => {
    const phase = Math.abs(hour - 12) / 6;
    const breachTickNow = breachActive ? Math.floor(breachT) : -1;
    if (
      Math.abs(phase - lastPaintedP) >= 0.001 ||
      breachTickNow !== lastBreachTick
    ) {
      paintSky(phase);
      lastPaintedP = phase;
      lastBreachTick = breachTickNow;
    }
    const isNight = phase >= NIGHT_P;
    if (isNight) {
      if (!curtainStarted) {
        curtainStarted = true;
        ctx.flow.curtainStarted = true;
        if (ctx.env.sunLight) ctx.env.sunLight.intensity = ctx.env.SUN_INTENSITY;
        ctx.flow.swaying = false;
        ctx.flow.gravityOn = false;
        if (!revealFired) {
          revealFired = true;
          ctx.flow.revealFired = true;
          positionEarth();
          ctx.env.earth.globe.rotation.y = 0;
          if (ctx.env.earth.children) {
            for (const c of ctx.env.earth.children) {
              if (c !== ctx.env.earth.globe) c.rotation.y = 0;
            }
          }
          const cinematicSunDir = ctx.env._sunDir0
            .clone()
            .applyQuaternion(sim.camera.quaternion);
          cinematicSunDir.applyAxisAngle(
            _camFwd,
            ctx.env.declinationDeg() * (Math.PI / 180),
          );
          ctx.env.sunLight.position
            .copy(cinematicSunDir)
            .multiplyScalar(ctx.env.SUN_FLAT);
          ctx.env.sunLight.target.position.copy(sim.camera.position);
          ctx.env.sunLight.target.updateMatrixWorld(true);
        }
        glassMat.transparent = false;
        glassMat.opacity = 1;
        glassMat.depthWrite = true;
        for (const f of skyFaces) f.visible = true;
        explodeSky();
        kickStart();
        doomStart();
      }
    } else {
      glassMat.transparent = false;
      glassMat.opacity = 1;
      glassMat.depthWrite = true;
      ctx.flow.swaying = true;
      ctx.flow.gravityOn = true;
      revealFired = false;
      ctx.flow.revealFired = false;
      if (ctx.creatures.firefliesReady) {
        for (const f of ctx.creatures.fireflies)
          f.group.visible =
            ctx.flow.creaturesEnabled && !f.sleeping && !ctx.flow.revealFired;
      }
      if (ctx.env.sunLight) ctx.env.sunLight.intensity = 0;
      if (curtainStarted) {
        curtainStarted = false;
        ctx.flow.curtainStarted = false;
        newDay();
        resealSky();
        glassMat.transparent = false;
        glassMat.opacity = 1;
        glassMat.depthWrite = true;
        for (const f of skyFaces) f.visible = true;
      }
    }
    const dayFactor = Math.max(0, 1 - phase / NIGHT_P);
    ctx.env.domeSun.intensity = 2.0 * dayFactor;
    const heat = Math.min(1, phase);
    ctx.env.domeSun.color.setRGB(
      1,
      0.82 + 0.18 * (1 - heat),
      0.7 + 0.3 * (1 - heat),
    );
    if (isNight) ctx.env.domeSun.intensity = 0;
    ctx.env.domeAmbient.intensity = 1.2 * dayFactor;
    if (isNight) ctx.env.domeAmbient.intensity = 0;
    if (ctx.creatures.dandelionsReady) {
      const nastic = Math.max(0, Math.min(1, Math.min(phase, 1)));
      for (const d of ctx.creatures.dandelions) d.ent.setNastic?.(nastic);
    }
  };
  ctx.time.dispatchDayNight = (hour) => {
    const prev = time.prevHour;
    time.prevHour = hour;
    for (const fam of ctx.creatures.dayCycle) {
      const awake = (h) => {
        if (fam.wakeHour < fam.sleepHour)
          return h >= fam.wakeHour && h < fam.sleepHour;
        return h >= fam.wakeHour || h < fam.sleepHour;
      };
      const wasAwake = awake(prev);
      const nowAwake = awake(hour);
      if (wasAwake === nowAwake) continue;
      for (const item of fam.items) nowAwake ? item.wake() : item.sleep();
    }
  };
  const clockEl = document.getElementById("sun-clock");
  const phaseEl = document.getElementById("sun-phase");
  const setHour = (hour) => {
    time.hour = hour;
    applySky(hour);
    ctx.time.dispatchDayNight(hour);
    const hh = Math.floor(hour);
    const mm = Math.round((hour - hh) * 60);
    clockEl.textContent = `${String(hh % 24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    phaseEl.textContent = parityLabels[Math.min(4, Math.floor(hour / 6))];
  };
  const sunAngleSlider = document.getElementById("sun-az-slider");
  const sunAngleValueEl = document.getElementById("sun-az-value");
  const sunElSlider = document.getElementById("sun-el-slider");
  const sunElValueEl = document.getElementById("sun-el-value");
  ctx.env.updateSunDir = () => {
    const ce = Math.cos(ctx.env.sunElevation);
    ctx.env._sunDir0Base
      .set(
        ce * Math.sin(ctx.env.sunAzimuth),
        Math.sin(ctx.env.sunElevation),
        ce * Math.cos(ctx.env.sunAzimuth),
      )
      .normalize();
  };
  ctx.env.updateSunDir();
  const applySunAngle = () => {
    ctx.env.sunAzimuth = parseFloat(sunAngleSlider.value) * (Math.PI / 180);
    ctx.env.sunElevation = parseFloat(sunElSlider.value) * (Math.PI / 180);
    ctx.env.updateSunDir();
    ctx.env._sunDir0.copy(ctx.env._sunDir0Base);
    ctx.env.sunLight.position.copy(ctx.env._sunDir0).multiplyScalar(ctx.env.SUN_FLAT);
    ctx.env.sunLight.target.position.set(0, 0, 0);
    ctx.env.sunLight.target.updateMatrixWorld(true);
    sunAngleValueEl.textContent = `${Math.round(sunAngleSlider.value)}°`;
    sunElValueEl.textContent = `${Math.round(sunElSlider.value)}°`;
  };
  sunAngleSlider.addEventListener("input", applySunAngle);
  sunElSlider.addEventListener("input", applySunAngle);
  applySunAngle();

  // Earth angle above horizon + distance sliders, copy-config button.
  const _camFwd = new THREE.Vector3();
  const _fwdXZ = new THREE.Vector3();
  const positionEarth = () => {
    _camFwd.set(0, 0, -1).applyQuaternion(sim.camera.quaternion);
    ctx.env.earth.mesh.position
      .copy(sim.camera.position)
      .addScaledVector(
        _fwdXZ.copy(_camFwd).setY(0).normalize(),
        ctx.env.earthDistance,
      );
    ctx.env.earth.mesh.position.y =
      ctx.env.earthDistance * Math.tan(THREE.MathUtils.degToRad(ctx.env.earthAngleDeg));
  };
  const earthAngleSlider = document.getElementById("earth-angle-slider");
  const earthAngleValueEl = document.getElementById("earth-angle-value");
  const earthDistSlider = document.getElementById("earth-dist-slider");
  const earthDistValueEl = document.getElementById("earth-dist-value");
  const applyEarthPlacement = () => {
    ctx.env.earthAngleDeg = parseFloat(earthAngleSlider.value);
    ctx.env.earthDistance = parseFloat(earthDistSlider.value);
    earthAngleValueEl.textContent = `${Math.round(ctx.env.earthAngleDeg)}°`;
    earthDistValueEl.textContent = String(Math.round(ctx.env.earthDistance));
    if (ctx.flow.revealFired) positionEarth();
  };
  earthAngleSlider.addEventListener("input", applyEarthPlacement);
  earthDistSlider.addEventListener("input", applyEarthPlacement);
  applyEarthPlacement();

  // Copy current sun + earth config to the clipboard as TOML-ish text.
  const copyBtn = document.getElementById("copy-config");
  copyBtn.addEventListener("click", async () => {
    const d = ctx.env._sunDir0;
    const sunPos = d.clone().multiplyScalar(ctx.env.SUN_FLAT);
    const text = [
      `[sun]`,
      `azimuth = ${ctx.env.sunAzimuth * (180 / Math.PI)}`,
      `elevation = ${ctx.env.sunElevation * (180 / Math.PI)}`,
      `position = ${sunPos.x.toFixed(0)}, ${sunPos.y.toFixed(0)}, ${sunPos.z.toFixed(0)}`,
      `direction = ${d.x.toFixed(2)}, ${d.y.toFixed(2)}, ${d.z.toFixed(2)}`,
      ``,
      `[earth]`,
      `angle_above_horizon = ${ctx.env.earthAngleDeg}`,
      `distance = ${ctx.env.earthDistance}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      const old = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = old;
      }, 1200);
    } catch {
      copyBtn.textContent = "Copy failed";
    }
  });

  // Manual time toggle. Not persisted by default, so force it off on load
  // (browsers otherwise restore the prior checked state across a reload).
  const manualTimeCheckbox = document.getElementById("manual-time-checkbox");
  let manualTime = false;
  manualTimeCheckbox.checked = false;
  sunSlider.disabled = !manualTime;
  manualTimeCheckbox.addEventListener("change", () => {
    manualTime = manualTimeCheckbox.checked;
    sunSlider.disabled = !manualTime;
    if (manualTime) {
      sunSlider.value = String(time.hour);
    }
  });
  sunSlider.addEventListener("input", () => {
    setHour(parseFloat(sunSlider.value));
  });

  // Automatic time advancement.
  const NIGHT_START = 12 + NIGHT_P * 6;
  const NIGHT_END = 12 - NIGHT_P * 6;
  const atNight = (h) => h >= NIGHT_START || h < NIGHT_END;
  sim.addEntity(null, null, (dt) => {
    if (manualTime) return;
    const dayRate = dt / 30;
    const rate = atNight(time.hour) ? dayRate * 2 : dayRate;
    let next = time.hour + rate;
    if (next >= 24) next -= 24;
    if (!ctx.flow.introActive) {
      if (!atNight(time.hour)) {
        const sTo = 30 * (NIGHT_START - time.hour);
        if (sTo <= 5 && sTo > 0) {
          breachActive = true;
          breachT += dt;
          ctx.camera.camBlendTarget = 0;
        } else if (sTo <= 0) {
          breachActive = false;
        }
      } else {
        breachActive = false;
      }
    }
    setHour(next);
  });

  // Debug readout of the global sun's world position/direction.
  const sunPosEl = document.getElementById("sun-pos");
  const sunDirEl = document.getElementById("sun-dir");
  const _sunDir = new THREE.Vector3();
  sim.addEntity(null, null, () => {
    if (sunPosEl && sunDirEl) {
      const pp = ctx.env.sunLight.position;
      sunPosEl.textContent = `${pp.x.toFixed(0)}, ${pp.y.toFixed(0)}, ${pp.z.toFixed(0)}`;
      const d = _sunDir.copy(ctx.env.sunLight.target.position).sub(pp).normalize();
      sunDirEl.textContent = `${d.x.toFixed(2)}, ${d.y.toFixed(2)}, ${d.z.toFixed(2)}`;
    }
  });

  // Force a fresh day: reseal the dome, lift the doom, snap the clock to a
  // daytime hour, reset position, replay the boot.
  const simRestart = () => {
    if (curtainStarted) {
      curtainStarted = false;
      ctx.flow.curtainStarted = false;
      resealSky();
      glassMat.transparent = false;
      glassMat.opacity = 1;
      glassMat.depthWrite = true;
      for (const f of skyFaces) f.visible = true;
    }
    doomT = -1;
    doomRed.style.opacity = "0";
    doomBlack.style.opacity = "0";
    ctx.mower.mesh.position.set(0, 0, 0);
    ctx.mower.mesh.quaternion.set(0, 0, 0, 1);
    ctx.mower.mesh.updateMatrixWorld(true);
    sim.camera.position.copy(ctx.mower.mesh.position);
    sim.camera.quaternion.set(0, 0, 0, 1);
    sim.camera.lookAt(0, 0, -1);
    sim.camera.updateProjectionMatrix();
    ctx.camera.theta = C.camera.defaultTheta;
    ctx.camera.phi = C.camera.defaultPhi;
    ctx.camera.radius = C.camera.defaultRadius;
    ctx.camera.camBlend = 0;
    ctx.camera.camBlendTarget = 0;
    setHour(8);
    startIntro();
  };

  // Dev trigger: jump to ~1 real minute before the reveal/ending.
  window.triggerEnd = () => {
    setHour(NIGHT_START - 60 * (1 / 30));
  };

  // --- Boot cinematic driver ---
  const CREATURE_T = introCfg.creatureT,
    MOWER_FADE = introCfg.mowerFade;
  const FLOWER_START = introCfg.flowerStart,
    FLOWER_DUR = introCfg.flowerDur;
  const DAWN_START = introCfg.dawnStart,
    DAWN_FADE = introCfg.dawnFade;
  const flowerStarted = () => ctx.creatures.flowerStarted;
  const popProgress = () => ctx.creatures.popProgress;
  let creaturesRevealed = false;
  const grass = ctx.grass;
  const startIntro = () => {
    const arr = grass.mesh.instanceMatrix.array;
    for (let i = 0; i < grass.total; i++) {
      grass.bladeGrowth[i] = 0;
      grass.arr[i] = 0;
      arr[i * 16 + 13] = grass.half * grass.bladeScale[i] * -1;
    }
    grass.mesh.instanceMatrix.needsUpdate = true;
    grass.attr.needsUpdate = true;
    flowerStarted().fill(0);
    popProgress().fill(0);
    for (const d of ctx.creatures.dandelions) {
      d.ent.mesh.visible = false;
      d.ent.mesh.position.y = -0.8;
      d.pop = 0;
    }
    ctx.flow.creaturesEnabled = false;
    creaturesRevealed = false;
    ctx.mower.setOpacity(0.0001);
    breachActive = false;
    breachT = 0;
    introT = 0;
    wallsDawn = 0;
    ctx.flow.introActive = true;
    paintSky(p);
  };
  const completeInit = () => {
    const arr = grass.mesh.instanceMatrix.array;
    for (let i = 0; i < grass.total; i++) {
      grass.bladeGrowth[i] = 1;
      grass.arr[i] = 1;
      arr[i * 16 + 13] = 0;
    }
    grass.mesh.instanceMatrix.needsUpdate = true;
    grass.attr.needsUpdate = true;
    for (const d of ctx.creatures.dandelions) {
      d.ent.mesh.visible = true;
      d.ent.mesh.position.y = 0;
      d.pop = 1;
    }
    ctx.flow.creaturesEnabled = true;
    creaturesRevealed = true;
    ctx.mower.setOpacity(1);
    breachActive = false;
    breachT = 0;
    introT = INTRO_END;
    wallsDawn = 1;
    ctx.flow.introActive = false;
    paintSky(p);
  };
  sim.addEntity(null, null, (dt) => {
    if (!ctx.flow.introActive) return;
    const fs = ctx.creatures.flowerStarted;
    const pp = ctx.creatures.popProgress;
    introT += dt;
    if (introT < FLOWER_START) {
      const g = Math.min(1, introT / FLOWER_START);
      const arr = grass.mesh.instanceMatrix.array;
      for (let i = 0; i < grass.total; i++) {
        grass.bladeGrowth[i] = g;
        grass.arr[i] = g;
        arr[i * 16 + 13] = grass.half * grass.bladeScale[i] * (g - 1);
      }
      grass.mesh.instanceMatrix.needsUpdate = true;
      grass.attr.needsUpdate = true;
    }
    if (introT >= FLOWER_START) {
      const t = introT - FLOWER_START;
      const target = Math.min(
        fs.length,
        Math.floor((t / FLOWER_DUR) * fs.length) + 1,
      );
      for (let i = 0; i < target; i++) {
        const d = ctx.creatures.dandelions[i];
        if (!fs[i]) {
          fs[i] = 1;
          d.ent.mesh.visible = true;
          pp[i] = 0;
        }
        if (pp[i] < 1) {
          pp[i] = Math.min(1, pp[i] + dt / 0.25);
          d.ent.mesh.position.y = -0.8 * (1 - pp[i]);
        }
      }
      if (t >= FLOWER_DUR) {
        for (let i = 0; i < fs.length; i++) {
          if (!fs[i]) {
            fs[i] = 1;
            ctx.creatures.dandelions[i].ent.mesh.visible = true;
            ctx.creatures.dandelions[i].ent.mesh.position.y = 0;
          }
        }
      }
    }
    if (introT >= DAWN_START) {
      wallsDawn = Math.min(1, (introT - DAWN_START) / DAWN_FADE);
    }
    if (introT >= CREATURE_T && !creaturesRevealed) {
      creaturesRevealed = true;
      ctx.flow.creaturesEnabled = true;
    }
    if (introT >= CREATURE_T && introT < COUNT_START) {
      const k = (introT - CREATURE_T) / MOWER_FADE;
      ctx.mower.setOpacity(0.0001 + k * 0.9999);
    }
    paintSky(p);
    if (introT >= INTRO_END) {
      ctx.flow.introActive = false;
      wallsDawn = 1;
      paintSky(p);
      if (ctx.mower.rearmMobileHint) ctx.mower.rearmMobileHint();
    }
  });

  // Bootstrap: apply the current sun/sky once, then snap the clock.
  applySky(parseFloat(sunSlider.value));
  time.prevHour = time.hour;
  setHour(time.hour);

  return { setHour, startIntro, completeInit, applySky, paintSky };
}