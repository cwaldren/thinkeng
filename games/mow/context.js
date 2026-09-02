// Shared game context for the Moasis game.
//
// The original monolithic setup(sim) relied on one giant closure scope to
// share mutable state across every system. Splitting it into domain modules
// means cross-module state is hoisted onto this single shared `ctx` object,
// grouped by owner so it's easy to see where each value lives and who writes
// it. A module reads another system's data via `ctx.<group>.<field>` at call
// time (never captured at module load into a local).

import * as THREE from "three";
import { CONFIG } from "./config.js";

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

export function createContext(sim) {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const cfg = CONFIG.density;

  // Density config (already namespaced by name; defaults from CONFIG.density).
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
    // Engine + config basics (rarely edited).
    sim,
    density,
    clampInt,

    // ---- ctx.env: the physical world — lights, moon/Earth, sun, lawn bounds.
    // Owned by environment.js (bootstraps), mutated by cinematics.js for the
    // live sun/earth tuning. ----
    env: {
      isMobile,
      sunLight: null,
      domeSun: null,
      domeAmbient: null,
      earth: null,
      lawnHalfW: 0,
      lawnHalfD: 0,
      margin: 0, // mower-stop inset from the lawn bounds
      CELL: 0, // spatial-grid cell size
      visitCutArea: null, // cut-area footprint iterator
      declinationDeg: () => 0,
      // Live sun/earth tuning (cinematics mutates these at runtime).
      SUN_INTENSITY: CONFIG.sun.intensity,
      SUN_FLAT: CONFIG.sun.distance,
      SUN_AZ: CONFIG.sun.azimuth,
      SUN_EL: CONFIG.sun.elevation,
      sunAzimuth: CONFIG.sun.azimuth,
      sunElevation: CONFIG.sun.elevation,
      updateSunDir: null,
      earthAngleDeg: CONFIG.earth.defaultAngleAboveHorizon,
      earthDistance: CONFIG.earth.defaultDistance,
      // Reusable temps for sun/earth math.
      _sunDir0Base: new THREE.Vector3(),
      _sunDir0: new THREE.Vector3(),
      _sunDir: new THREE.Vector3(),
      _camFwd: new THREE.Vector3(),
      _fwdXZ: new THREE.Vector3(),
    },

    // ---- ctx.grass: the grass lawn + its runtime growth state. Owned by
    // environment.js (blades/sway shader), grown/cut by mower.js. ----
    grass: {
      mesh: null,
      attr: null,
      arr: null,
      bladePos: [],
      bladeScale: null,
      bladeGrowth: null,
      half: 0,
      total: 0,
      swayUniforms: {
        uTime: { value: 0 },
        uSway: { value: 1 },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uFacetStrength: { value: CONFIG.grass.facetStrength },
        uGradBase: { value: CONFIG.grass.gradBase },
        uGradTip: { value: CONFIG.grass.gradTip },
      },
      growRate: CONFIG.grass.growRate,
      grassDirty: false,
    },

    // ---- ctx.mower: the player's push lawnmower entity plus helper methods
    // mower.js attaches. Stays a single object so `ctx.mower.mesh` is stable
    // everywhere. ----
    mower: null,

    // ---- ctx.creatures: bugs + dandelions + daily sleep/wake. Owned by
    // creatures.js. ----
    creatures: {
      dandelions: [],
      fireflies: [],
      dandelionsReady: false,
      firefliesReady: false,
      dayCycle: [],
      mowerPos: new THREE.Vector3(),
      bx: 0,
      bz: 0,
      mowedCount: 0,
      mowedCountEl: null,
      mowedLabelEl: null,
      updateMowedLabel: null,
      revealCounter: null,
      bumpMowed: null,
      flowerStarted: null,
      popProgress: null,
      FOLD_S: CONFIG.dandelions.foldS,
      FOLD_BACK_S: CONFIG.dandelions.foldBackS,
      FOLD_ANGLE: CONFIG.dandelions.foldAngle,
    },

    // ---- ctx.flow: the state-machine flags that toggled across systems. All
    // runtime flow, owned centrally so mutators are obvious. ----
    flow: {
      introActive: true,
      swaying: true, // grass wind-blows by day, freezes at the reveal
      gravityOn: true, // clipping gravity: off after the reveal, back on at dawn
      curtainStarted: false, // reveal act fired once per night
      revealFired: false,
      creaturesEnabled: false,
      creaturesRevealed: false,
      // Movement of grass/insects/plants ramps from 0 (frozen) up to 1
      // (realtime) during the intro countdown, hitting realtime at "MOW!".
      // Driven by cinematics.js; read by mower/creatures.
      motionScale: 0,
      controlsUnlocked: false,
    },

    // ---- ctx.camera: first-person + orbit camera state and the blast kick.
    // Owned by mower.js (per-frame), reset by cinematics.js on restart. ----
    camera: {
      theta: 0,
      phi: Math.PI / 6,
      radius: 25,
      camBlend: 0,
      camBlendTarget: 0,
      fwdOffset: -0.45,
      gazePitch: -30 * (Math.PI / 180),
      fovSlider: null,
      // Camera kick (defined/mutated by cinematics, read by mower).
      kick: { elapsed: Infinity },
      kickEnv: null,
      KICK_PITCH: 0,
      KICK_TARGET_FOV: 70,
    },

    // ---- ctx.time: the shared day/night simulation clock. Owned by
    // cinematics.js. ----
    time: {
      hour: null,
      prevHour: null,
      dispatchDayNight: null,
    },

    // Shared action-based input manager (created in mow.html).
    input: null,
  };

  return ctx;
}