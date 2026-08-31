// Shared game context for the Moasis game.
//
// The original monolithic setup(sim) relied on one giant closure scope to
// share mutable state (reveal flags, grass arrays, mower, creatures, ...)
// across every system. Splitting it into domain modules means each module gets
// its own scope, so anything that crosses a module boundary is hoisted onto
// this single shared `ctx` object. Values are assigned by whichever module
// builds them, then read/mutated by others at call time (the same timing the
// monolithic closures had).

import * as THREE from "three";
import { CONFIG } from "./config.js";

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

export function createContext(sim) {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const cfg = CONFIG.density;

  // Density config is editable in the UI; applied values persist and are
  // consumed on the next load (Apply triggers a reload). Defaults come from
  // CONFIG.density.
  const density = {
    COLS: Number(localStorage.getItem("mow-cols")) || cfg.cols,
    ROWS: Number(localStorage.getItem("mow-rows")) || cfg.rows,
    N:
      Number(localStorage.getItem("mow-n")) ||
      (isMobile ? cfg.mobileN : cfg.desktopN),
  };
  density.COLS = clampInt(density.COLS, cfg.min, cfg.maxCols);
  density.ROWS = clampInt(density.ROWS, cfg.min, cfg.maxRows);
  density.N = clampInt(density.N, cfg.min, cfg.maxN);
  density.W = cfg.patchWidth;
  density.D = cfg.patchDepth;
  density.total = density.COLS * density.ROWS * density.N;

  const ctx = {
    sim,
    isMobile,
    density,
    clampInt,

    // Lawn / fence geometry derived from density (set by the environment).
    lawnHalfW: 0,
    lawnHalfD: 0,
    bx: 0,
    bz: 0,

    // ---- Sun / lighting shared by environment + cinematics ----
    sunLight: null,
    domeSun: null,
    domeAmbient: null,
    SUN_INTENSITY: CONFIG.sun.intensity,
    SUN_FLAT: CONFIG.sun.distance, // "infinitely far" stand-in
    SUN_AZ: CONFIG.sun.azimuth,
    SUN_EL: CONFIG.sun.elevation,
    sunAzimuth: CONFIG.sun.azimuth,
    sunElevation: CONFIG.sun.elevation,
    declinationDeg: () => 0,
    updateSunDir: null,
    earthAngleDeg: CONFIG.earth.defaultAngleAboveHorizon,
    earthDistance: CONFIG.earth.defaultDistance,
    _sunDir0Base: new THREE.Vector3(),
    _sunDir0: new THREE.Vector3(),
    _sunDir: new THREE.Vector3(),
    _camFwd: new THREE.Vector3(),
    _fwdXZ: new THREE.Vector3(),

    // ---- Earth + reveal ----
    earth: null,
    revealFired: false,

    // ---- Grass + sway (built by environment, grown/cut by mower, read by
    // cinematics intro/completeInit) ----
    grass: {
      mesh: null,
      attr: null,
      arr: null,
      bladePos: [],
      bladeScale: null,
      bladeGrowth: null,
      half: 0,
      total: 0,
    },
    swayUniforms: { uTime: { value: 0 } },
    swaying: true, // grass wind-blows by day, freezes at the reveal
    gravityOn: true, // clipping gravity: off after the reveal, back on at dawn
    grassDirty: false,
    growRate: CONFIG.grass.growRate,

    // Spatial grid API over the lawn (built by environment, used by mower).
    visitCutArea: null,

    // Mower (built by mower module; cinematics restart touches it).
    mower: null,
    setMowerOpacity: null,

    // ---- Creatures + dandelions (built by creatures module) ----
    creaturesEnabled: false,
    creaturesRevealed: false,
    mowerPos: new THREE.Vector3(),
    dayCycle: [],
    time: {
      hour: null,
      prevHour: null,
    },
    firefliesReady: false,
    dandelionsReady: false,
    fireflies: [],
    dandelions: [],

    // Dandelion bookkeeping shared by mower (mow triggers) + creatures (fold/
    // regrow) + cinematics intro (pop-up).
    mowedCount: 0,
    mowedCountEl: null,
    mowedLabelEl: null,
    flowerStarted: null,
    popProgress: null,
    FOLD_S: CONFIG.dandelions.foldS,
    FOLD_ANGLE: CONFIG.dandelions.foldAngle,
    updateMowedLabel: null,
    revealCounter: null,

    // Day/night helpers shared by cinematics (dispatch) + creatures (register).
    dispatchDayNight: null,

    // Orbit-camera state (mower owns per-frame, cinematics restart resets).
    theta: 0,
    phi: Math.PI / 6,
    radius: 25,
    camBlend: 0,
    camBlendTarget: 0,

    // Camera kick (defined/mutated by cinematics, read by mower camera).
    kick: { elapsed: Infinity },
    kickEnv: null,
    KICK_PITCH: 0,
    KICK_TARGET_FOV: 70,

    // First-person FOV slider (owned by mow.html; read by mower + cinematics).
    fovSlider: null,

    // Shared action-based input manager (created in mow.html).
    input: null,

    // Intro flag (cinematics owns, mower reads to lock movement).
    introActive: true,
  };

  // First-person camera slider state (used by mower camera + cinematics kick).
  ctx.fwdOffset = -0.45;
  ctx.gazePitch = -30 * (Math.PI / 180);

  return ctx;
}