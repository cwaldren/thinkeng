// Central tuning configuration for the Moasis game.
//
// All gameplay "feel" and rendering constants that were previously scattered
// across the mow modules as inline `const X = ...` are gathered here so a
// designer can tweak the game without hunting through thousands of lines of
// logic. Each builder module reads the group it needs. Runtime-editable values
// (the sandbox/menu sliders for sun, earth, cut height, grow rate, density)
// are stored live on `ctx` but their DEFAULTS come from this object.

export const CONFIG = {
  // ---- Grass lawn / density layout ----
  density: {
    cols: 7,
    rows: 7,
    desktopN: 5000, // blades per patch on desktop
    mobileN: 500, // blades per patch on mobile
    min: 1,
    maxCols: 20,
    maxRows: 20,
    maxN: 10000,
    patchWidth: 3, // W
    patchDepth: 3, // D
  },

  // ---- Grass blades + sway ----
  grass: {
    radius: 0.08, // cone base radius
    height: 1.7, // cone height
    color: 0x44aa55,
    roughness: 0.8,
    scaleMin: 0.6,
    scaleMax: 1.4,
    growRate: 0.005, // default growth/sec (sandbox slider overrides)
    swayAmplitude: 0.025, // vertex-shader sway strength on the X axis
    gridCell: 1.5, // spatial-grid cell size for cut checks (world units)
  },

  // ---- Moon surface / craters / dirt ----
  moon: {
    dirtColor: 0x2b180c,
    groundRadius: 48,
    albedoResolution: 1024,
    gray: "rgb(148,144,141)",
    basinColor: "rgba(58,55,52,0.9)",
    smallCraters: 26,
    bigCraters: 4,
  },

  // ---- Wooden fence around the lawn ----
  fence: {
    postHeight: 1.35,
    sectionWidth: 1.5,
    postColor: 0x922b2c,
    boardColor: 0xba9a59,
    gap: 0.05, // fence sits this far outside the lawn edge
    mowerMargin: 0.7, // mower-stop inset from the lawn bounds
  },

  // ---- Global sun ----
  sun: {
    intensity: 3.0,
    distance: 20000, // effectively-infinite stand-in
    color: 0xfff2d9,
    azimuth: 90 * (Math.PI / 180), // sandbox slider drives live; this is the default
    elevation: 30 * (Math.PI / 180),
    shadowSize: 2048,
    shadowHalfExtent: 260,
  },

  // ---- Earth (the reveal globe) ----
  earth: {
    radius: 7,
    position: [0, 16, -140],
    defaultAngleAboveHorizon: 6, // sandbox slider drives live
    defaultDistance: 157,
  },

  // ---- Star dome ----
  stars: {
    skyRadius: 260,
    count: 900,
    spriteSize: 64,
  },

  // ---- Push lawnmower ----
  mower: {
    // Geometry / visuals
    wheelRadius: 0.4,
    handleAngle: 0.75,
    handleLength: 1.7,
    reelWidth: 1.25,
    bladeThickness: 0.01,
    blades: 4,
    bodyColor: 0x2a3d56,
    bladeColor: 0x014101,
    wheelColor: 0x1a1a1a,
    // Motion feel
    moveSpeed: 2, // forward speed (world units/sec)
    shiftEase: 0.75, // speed multiplier while Shift held
    turnSpeed: 1.0, // turning when moving
    shiftTurnSpeed: 1.5, // turning while Shift held (tighter radius)
    pivotTurnSpeed: 2.0, // turning when stationary
    touchSpinBoost: 1.25, // mobile pivot speed-up
    // Cutting footprint
    cutWidth: 1.25, // across the reel (local X)
    cutDepth: 0.4, // cutting depth (local Z)
    footprintFrac: 0.7, // effective cutting depth fraction
    cutHeight: 0.2, // default grass height left after a cut (m)
    sampleHalfD: 0.12, // particle-size sampler strip half-depth
    // Grass clippings
    clipCount: 120,
    clipEmitRate: 250, // clippings/sec while cutting
    clipGravity: 5,
    clipColor: 0x3f8f3f,
  },

  // ---- Mobile touch stick ----
  touch: {
    stickFraction: 0.35, // stick max throw as a fraction of the short screen edge
    fwdStrokeFraction: 0.5, // forward throttle reaches max over this fraction
    backLineFraction: 0.75, // on-screen line anchoring the forward/back split
    turnDeadzone: 0.1,
    fwdDeadzone: 0.22,
  },

  // ---- Cameras (first-person + orbit) ----
  camera: {
    blendK: 5.3, // blend ease rate
    orbitMinRadius: 3,
    orbitMaxMargin: 1.0, // orbit radius stays this far inside the dome
    orbitWallMargin: 0.3, // extra clearance off the lawn half-extent
    defaultTheta: 0,
    defaultPhi: Math.PI / 6,
    defaultRadius: 25,
  },

  // ---- Dandelions (mowable plants) ----
  dandelions: {
    countMobile: 12,
    countDesktop: 40,
    foldS: 0.35, // seconds to fold flat then despawn
    foldAngle: Math.PI / 2,
    regrowMin: 3, // seconds before regrow
    regrowMax: 7,
    popS: 0.25, // pop-out-of-ground duration
    minClearFraction: 0.35, // keep clear of the mower's start spot
    waveAmplitude: 0.1745, // ±10° sway
  },

  // ---- Creatures ----
  creatures: {
    flies: { desktop: 20, mobile: 8, color: 0x1a1a1a, size: 0.035, scareRadius: 4 },
    butterflies: { desktop: 6, mobile: 3, wingSat: 0.75, wingLight: 0.65 },
    dragonflies: 2,
    swarms: 1,
    bees: { desktop: 6, mobile: 3, feedHeight: 0.7, speed: 3 },
    fireflies: { desktop: 16, mobile: 8 },
    day: { wake: 6, sleep: 20 }, // diurnal families
    night: { wake: 20, sleep: 6 }, // fireflies
  },

  // ---- Glass sky dome + fake-sky painting ----
  skyDome: {
    wallInset: 0.6, // walls sit just beyond the fence
    cubeHeight: 20,
    opacity: 0.85,
    skyResolution: 512,
    shardCell: 2.83, // shatter tessellation cell size
    nightP: 1.75, // sky phase where it goes fully transparent (the reveal)
    dayTop: "#3399ff",
    dayHorizon: "#cfe8ff",
    setTop: "#5b3a6e",
    setHorizon: "#ff7a3d",
    duskTop: "#07070f",
    duskHorizon: "#140a1e",
    introGreyTop: "#7c7c86",
    introGreyHorizon: "#b6b6be",
    // Technical sim-rig grid on the wall faces during the setup intro (vector
// lines, world units).
    // Technical sim-rig grid drawn on the wall fabric during the setup intro.
    gridCell: 0.08, // grid spacing as a fraction of the texture canvas
    gridColor: "rgba(15,17,23,0.6)",
    gridWidth: 0.0025, // line thickness as a fraction of the canvas
  },

  // ---- The reveal + doom + camera kick ----
  reveal: {
    explodeSpeed: 12, // m/s outward from the cube center
    explodeSpread: 6, // extra random outward fan
    explodeTumble: 2.0, // angular velocity (rad/s) per spin axis
    doomDelayMs: 5000,
    doomRiseMs: 5000,
    doomPulseFullMs: 4000,
    doomBlackMs: 4000,
    kickRiseMs: 500,
    kickHoldMs: 5000,
    kickFallMs: 5000,
    kickPitch: 12 * (Math.PI / 180),
    kickTargetFov: 70,
    greetingEndSimT: 20, // "GOOD MORNING" plays for sim T in [0, greetingEndSimT)
  },

  // ---- Boot cinematic (intro) timing ----
  intro: {
    countStart: 6, // "3","2","1" countdown begins here
    introEnd: 9.5, // "MOW!" shows at 9, holds briefly, then controls unlock
    flowerStart: 3,
    flowerDur: 2, // all flowers pop out of the ground within this window
    dawnStart: 5, // walls dusk in as the flowers/fence finish
    dawnFade: 1,
    creatureT: 5, // insects surface right as the flowers finish
    mowerFade: 1, // mower opacity fade duration (5s -> 6s)
    // Untextured grey->color reveal: objects spawn as grey+shiny "model
    // preview" materials and flicker to their real material as they appear.
    reveal: {
      grassT: 3, // lawn flickers green once fully grown
      grassDur: 1, // all blades resolve within this 1s window (staggered)
      fenceT: 3, // fence sweeps in concurrent with the flowers (same start)
      fenceStagger: 2, // same span as flowerSpan so both finish together
      fenceDur: 0.12, // each section's own flicker-in duration
      flowerT: 3, // first dandelion resolves
      flowerSpan: 2, // stagger across the pop sequence (matches fence stagger)
      flowerDur: 0.25,
      creatureT: 5, // insects resolve as they wake
      creatureDur: 0.8,
    },
  },
};