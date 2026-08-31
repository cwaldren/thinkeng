// EnvironmentBuilder: the physical world — the sun + dome lights, the moon
// surface (craters, albedo, heightfield), the Earth globe, the star field,
// the grass lawn (+ sway shader + spatial cut grid), and the fence.

import * as THREE from "three";
import { createFence, createEarth } from "engine/components.js";
import { CONFIG } from "./config.js";

export function buildEnvironment(sim, ctx) {
  const { COLS, ROWS, N, W, D, total } = ctx.density;
  const C = CONFIG;

  // --- Global sun: a directional source beaming straight down from directly
  // overhead, lighting BOTH the moon surface and the Earth. Parallel rays,
  // so the moon's floor (all facing up) is fully lit while the Earth's lower
  // hemisphere falls to a crisp, real day/night terminator.
  const SUN_INTENSITY = ctx.env.SUN_INTENSITY;
  const sunLight = new THREE.DirectionalLight(C.sun.color, SUN_INTENSITY);
  // Offset toward the horizon so the day/night terminator cuts across the
  // globe at an angle. Parked far away along that direction so rays are
  // effectively parallel.
  const SUN_FLAT = ctx.env.SUN_FLAT;
  const SUN_AZ = ctx.env.SUN_AZ;
  const SUN_EL = ctx.env.SUN_EL;
  let sunAzimuth = SUN_AZ;
  let sunElevation = SUN_EL;
  // Solar declination for the current real-world day, tilting the Earth's
  // day/night terminator. δ = 23.45° · sin(360/365 · (N − 81)).
  const declinationDeg = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / 86400000);
    return (
      23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * (Math.PI / 180))
    );
  };
  const _sunDir0Base = new THREE.Vector3();
  const updateSunDir = () => {
    const ce = Math.cos(sunElevation);
    _sunDir0Base
      .set(
        ce * Math.sin(sunAzimuth),
        Math.sin(sunElevation),
        ce * Math.cos(sunAzimuth),
      )
      .normalize();
  };
  updateSunDir();
  const _sunDir0 = _sunDir0Base.clone();
  sunLight.position.copy(_sunDir0).multiplyScalar(SUN_FLAT);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(C.sun.shadowSize, C.sun.shadowSize);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = SUN_FLAT;
  const shadowHalf = C.sun.shadowHalfExtent;
  sunLight.shadow.camera.left = -shadowHalf;
  sunLight.shadow.camera.right = shadowHalf;
  sunLight.shadow.camera.top = shadowHalf;
  sunLight.shadow.camera.bottom = -shadowHalf;
  sunLight.shadow.bias = -0.0005;
  sim.scene.add(sunLight);
  sim.scene.add(sunLight.target);

  // Drop the engine's default directional light so it isn't fighting the sun.
  const engineSun = sim.scene.children.find((c) => c.isDirectionalLight);
  if (engineSun) sim.scene.remove(engineSun);

  // Low ambient so surfaces facing away from the sun genuinely fall to shadow.
  const ambient = sim.scene.children.find((c) => c.isAmbientLight);
  ambient.intensity = 0;

  // Fake "sun" light inside the Earth dome: a warm light tracking fake-sky
  // time so the grass reads as lit by day sky. It's inside the cube so it
  // lights only the lawn + mower. (Intensity driven later by cinematics.)
  const domeSun = new THREE.DirectionalLight(0xfff6e8, 2.0);
  domeSun.castShadow = false;
  sim.scene.add(domeSun);
  // Bright fill so the sealed dome reads as a beautiful day.
  const domeAmbient = new THREE.HemisphereLight(0xbfe3ff, 0x7fb04a, 1.2);
  sim.scene.add(domeAmbient);

  ctx.env.sunLight = sunLight;
  ctx.env.sunAzimuth = sunAzimuth;
  ctx.env.sunElevation = sunElevation;
  ctx.env.updateSunDir = updateSunDir;
  ctx.env.declinationDeg = declinationDeg;
  ctx.env._sunDir0Base = _sunDir0Base;
  ctx.env._sunDir0 = _sunDir0;
  ctx.env.domeSun = domeSun;
  ctx.env.domeAmbient = domeAmbient;
  ctx.env.SUN_INTENSITY = SUN_INTENSITY;

  // Dirt patch beneath the lawn (inside the fence): a dirt-brown rectangular
  // plane sitting just above the meadow ground, so the mowable patch reads as
  // fresh turned soil against the surrounding field.
  const dirtGeo = new THREE.PlaneGeometry(COLS * W + 0.4, ROWS * D + 0.4);
  const dirtMat = new THREE.MeshStandardMaterial({ color: C.moon.dirtColor });
  const dirt = new THREE.Mesh(dirtGeo, dirtMat);
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.y = -0.005;
  dirt.receiveShadow = true;
  dirt.castShadow = true;
  sim.scene.add(dirt);

  // RADIAL BAND of crater centers outside the glass territory.
  const cubeR =
    Math.hypot((COLS * W) / 2 + 0.6, (ROWS * D) / 2 + 0.6) + 4;
  const GROUND_R = C.moon.groundRadius;
  const craterCenters = [];
  for (let i = 0; i < C.moon.smallCraters; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rr = cubeR + Math.random() * (GROUND_R - cubeR);
    const r = 7 * Math.pow(Math.random(), 2.6) + 0.5;
    craterCenters.push({
      x: Math.cos(ang) * rr,
      z: Math.sin(ang) * rr,
      r,
      depth: r * 0.18,
      rim: r * 0.02 + 0.03,
    });
  }
  for (let i = 0; i < C.moon.bigCraters; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rr = cubeR + 10 + Math.random() * (GROUND_R - cubeR - 10);
    const r = 12 + Math.random() * 16;
    craterCenters.push({
      x: Math.cos(ang) * rr,
      z: Math.sin(ang) * rr,
      r,
      depth: r * 0.18,
      rim: r * 0.02 + 0.03,
    });
  }

  // MOON's surface: a displaceable heightfield so sinks read as real
  // craters. A canvas albedo map paints the darker basin floors.
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
  });
  const ALB = C.moon.albedoResolution;
  const albedo = (() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = ALB;
    const g = cv.getContext("2d");
    g.fillStyle = C.moon.gray;
    g.fillRect(0, 0, ALB, ALB);
    const toU = (x) => ((x + GROUND_R) / (GROUND_R * 2)) * ALB;
    const toV = (z) => ((z + GROUND_R) / (GROUND_R * 2)) * ALB;
    for (const c of craterCenters) {
      const U = toU(c.x),
        V = toV(c.z);
      const px = c.r * (ALB / (GROUND_R * 2));
      const grad = g.createRadialGradient(U, V, 0, U, V, px * 0.62);
      grad.addColorStop(0.0, C.moon.basinColor);
      grad.addColorStop(1.0, "rgba(148,144,141,0)");
      g.fillStyle = grad;
      g.fillRect(U - px, V - px, px * 2, px * 2);
    }
    return new THREE.CanvasTexture(cv);
  })();
  groundMat.map = albedo;

  const craterHeight = (x, z) => {
    let y = 0;
    for (const c of craterCenters) {
      const dx = x - c.x,
        dz = z - c.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const t = d / c.r;
      const RIM_EDGE = 1.22;
      if (t >= RIM_EDGE) continue;
      const FLOOR_FRAC = 0.4;
      if (t < FLOOR_FRAC) {
        y += -c.depth;
      } else if (t < 1) {
        const u = (t - FLOOR_FRAC) / (1 - FLOOR_FRAC);
        y += -c.depth * (1 - u * u * (3 - 2 * u));
      }
      const rimPhase = (t - 1) / (RIM_EDGE - 1);
      y += c.rim * Math.sin(rimPhase * Math.PI);
    }
    return y;
  };

  const groundGeo = new THREE.CircleGeometry(GROUND_R, 240, 200);
  groundGeo.rotateX(-Math.PI / 2);
  {
    const pos = groundGeo.attributes.position;
    const uv = groundGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      pos.setY(i, craterHeight(x, z));
      uv.setXY(
        i,
        (x + GROUND_R) / (GROUND_R * 2),
        (z + GROUND_R) / (GROUND_R * 2),
      );
    }
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.castShadow = true;
  ground.position.y = -2;
  sim.scene.add(ground);

  // Earth floating high in the moon's sky, off beyond the grass dome.
  const earth = createEarth(sim, {
    radius: C.earth.radius,
    position: C.earth.position,
  });
  ctx.env.earth = earth;

  // Star field: tiny points on a huge fixed-radius dome beyond the Earth.
  const SKY_R = C.stars.skyRadius;
  const STAR_COUNT = C.stars.count;
  const starSprite = (() => {
    const cv = document.createElement("canvas");
    const size = C.stars.spriteSize;
    cv.width = cv.height = size;
    const g = cv.getContext("2d");
    const grad = g.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.7)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  const starColorAt = (kelvin) => {
    const t = kelvin / 100;
    let r, g, b;
    if (t <= 66) {
      r = 255;
      g = 99.47 * Math.log(t) - 161.12;
      b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
    } else {
      r = 329.7 * Math.pow(t - 60, -0.1332);
      g = 288.12 * Math.pow(t - 60, -0.0755);
      b = 255;
    }
    return new THREE.Color(
      Math.max(0, Math.min(1, (r / 255) * 0.5 + 0.5)),
      Math.max(0, Math.min(1, (g / 255) * 0.5 + 0.5)),
      Math.max(0, Math.min(1, (b / 255) * 0.5 + 0.5)),
    );
  };

  const buckets = [[], [], [], []];
  for (let i = 0; i < STAR_COUNT; i++) {
    let dx, dy, dz;
    do {
      dx = Math.random() * 2 - 1;
      dy = Math.random() * 2 - 1;
      dz = Math.random() * 2 - 1;
    } while (dx * dx + dy * dy + dz * dz > 1 || dy < 0.02);
    const len = Math.hypot(dx, dy, dz);
    const elev = Math.pow(Math.abs(dy / len), 1.3);
    const c = starColorAt(2500 + Math.pow(Math.random(), 2) * 7800);
    const size = (Math.random() < 0.15) | 0;
    const star = {
      x: (dx / len) * SKY_R,
      y: elev * SKY_R * 0.9,
      z: (dz / len) * SKY_R,
      r: Math.round(c.r * 255),
      g: Math.round(c.g * 255),
      b: Math.round(c.b * 255),
    };
    buckets[size].push(star);
  }

  const starPeel = new THREE.Group();
  const starBucketSizes = [0.9, 1.6, 2.4, 3.4];
  buckets.forEach((stars, bi) => {
    if (stars.length === 0) return;
    const pos = new Float32Array(stars.length * 3);
    const col = new Float32Array(stars.length * 3);
    stars.forEach((s, i) => {
      pos[i * 3] = s.x;
      pos[i * 3 + 1] = s.y;
      pos[i * 3 + 2] = s.z;
      col[i * 3] = s.r / 255;
      col[i * 3 + 1] = s.g / 255;
      col[i * 3 + 2] = s.b / 255;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: starBucketSizes[bi],
      map: starSprite,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    starPeel.add(pts);
  });
  sim.scene.add(starPeel);

  // Grass: single instanced mesh, 3x3 patches tiled across 100x100 (really
  // COLS x ROWS patches across COLS*W x ROWS*D).
  const bladeGeo = new THREE.ConeGeometry(
    C.grass.radius,
    C.grass.height,
    4,
  );
  const bladeMat = new THREE.MeshStandardMaterial({
    color: C.grass.color,
    roughness: C.grass.roughness,
  });
  // Gentle breeze: sway lives in the vertex shader so it costs nothing on the
  // CPU. Bends in local space, anchored at the base, bound to each blade's
  // height so freshly-cut blades stand still.
  const swayUniforms = ctx.grass.swayUniforms;
  bladeMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = swayUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;\nattribute float aGrowth;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
#ifdef USE_INSTANCING
            float h = clamp((transformed.y + 0.85) / 1.7, 0.0, 1.0);
            vec3 _base = instanceMatrix[3].xyz;
            float _ph = fract(sin(dot(_base.xz * 0.13, vec2(12.9898, 78.233))) * 43758.5453);
            float _wave = sin(_base.x * 1.2 + uTime * 1.6 + _ph * 6.2831)
                        + cos(_base.z * 1.4 + uTime * 1.2 + _ph * 6.2831);
            float _g = clamp(aGrowth, 0.0, 1.0);
            _g = pow(_g, 6.0);
            transformed.x += _wave * h * h * ${C.grass.swayAmplitude} * _g;
#endif
`,
      );
  };
  const grassMesh = new THREE.InstancedMesh(bladeGeo, bladeMat, total);
  const growthAttr = new THREE.InstancedBufferAttribute(
    new Float32Array(total),
    1,
  );
  bladeGeo.setAttribute("aGrowth", growthAttr);
  const growthArr = growthAttr.array;
  grassMesh.castShadow = false;
  grassMesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const bladePos = [];
  const bladeRot = [];
  const bladeScale = new Float32Array(total);
  const bladeGrowth = new Float32Array(total);
  const BLADE_HALF = bladeGeo.parameters.height / 2;
  let idx = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ox = (c - COLS / 2 + 0.5) * W;
      const oz = (r - ROWS / 2 + 0.5) * D;
      const hw = W / 2,
        hd = D / 2;
      for (let i = 0; i < N; i++) {
        const s =
          C.grass.scaleMin + Math.random() * (C.grass.scaleMax - C.grass.scaleMin);
        bladeScale[idx] = s;
        bladeGrowth[idx] = 0; // boot cinematic: grass starts underground
        growthArr[idx] = 0;
        bladePos[idx] = new THREE.Vector3(
          ox + Math.random() * W - hw,
          0,
          oz + Math.random() * D - hd,
        );
        bladeRot[idx] = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            (Math.random() - 0.5) * 0.35,
            Math.random() * Math.PI * 2,
            (Math.random() - 0.5) * 0.35,
          ),
        );
        dummy.position.set(
          bladePos[idx].x,
          BLADE_HALF * bladeScale[idx] * (bladeGrowth[idx] - 1),
          bladePos[idx].z,
        );
        dummy.quaternion.copy(bladeRot[idx]);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        grassMesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
  }
  grassMesh.instanceMatrix.needsUpdate = true;
  growthAttr.needsUpdate = true;
  sim.scene.add(grassMesh);

  // Spatial grid over the lawn so cut checks only test blades near the mower
  // instead of all of them every frame. Blade positions never move, so buckets
  // are built once.
  const CELL = C.grass.gridCell;
  const GRID_COLS = Math.ceil((COLS * W) / CELL);
  const GRID_ROWS = Math.ceil((ROWS * D) / CELL);
  const lawnMinX = -(COLS * W) / 2,
    lawnMinZ = -(ROWS * D) / 2;
  const gridCells = new Array(GRID_COLS * GRID_ROWS);
  const counts = new Uint32Array(GRID_COLS * GRID_ROWS);
  const cellIndex = (x, z) => {
    const cx = Math.min(
      GRID_COLS - 1,
      Math.max(0, Math.floor((x - lawnMinX) / CELL)),
    );
    const cz = Math.min(
      GRID_ROWS - 1,
      Math.max(0, Math.floor((z - lawnMinZ) / CELL)),
    );
    return cz * GRID_COLS + cx;
  };
  for (let i = 0; i < total; i++)
    counts[cellIndex(bladePos[i].x, bladePos[i].z)]++;
  const cellStart = new Int32Array(gridCells.length + 1);
  for (let i = 0; i < gridCells.length; i++)
    cellStart[i + 1] = cellStart[i] + counts[i];
  const cellIndices = new Uint32Array(total);
  {
    const cursor = new Int32Array(gridCells.length);
    for (let i = 0; i < total; i++) {
      const ci = cellIndex(bladePos[i].x, bladePos[i].z);
      cellIndices[cellStart[ci] + cursor[ci]++] = i;
    }
  }
  // Iterate blades inside a footprint defined as a box in mower-local space.
  const _boxCenter = new THREE.Vector3();
  const _fx = new THREE.Vector3();
  const _fz = new THREE.Vector3();
  const visitCutArea = (hw, hd, offZ, cb) => {
    const o = ctx.mower.mesh.position;
    const q = ctx.mower.mesh.quaternion;
    const center = _boxCenter.set(0, 0, offZ).applyQuaternion(q).add(o);
    const fx = _fx.set(hw, 0, 0).applyQuaternion(q);
    const fz = _fz.set(0, 0, hd).applyQuaternion(q);
    const minX = center.x - Math.abs(fx.x) - Math.abs(fz.x);
    const maxX = center.x + Math.abs(fx.x) + Math.abs(fz.x);
    const minZ = center.z - Math.abs(fx.z) - Math.abs(fz.z);
    const maxZ = center.z + Math.abs(fx.z) + Math.abs(fz.z);
    const c0x = Math.max(0, Math.floor((minX - lawnMinX) / CELL));
    const c1x = Math.min(
      GRID_COLS - 1,
      Math.floor((maxX - lawnMinX) / CELL),
    );
    const c0z = Math.max(0, Math.floor((minZ - lawnMinZ) / CELL));
    const c1z = Math.min(
      GRID_ROWS - 1,
      Math.floor((maxZ - lawnMinZ) / CELL),
    );
    for (let cz = c0z; cz <= c1z; cz++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const ci = cz * GRID_COLS + cx;
        for (let k = cellStart[ci]; k < cellStart[ci + 1]; k++) {
          if (cb(cellIndices[k])) return true;
        }
      }
    }
    return false;
  };

  // Surround the grass lawn with a wooden fence. Each side gets its own fence
  // segment sized (repeat) to span that edge, meeting at corners.
  const FENCE = {
    postHeight: C.fence.postHeight,
    sectionWidth: C.fence.sectionWidth,
    postColor: C.fence.postColor,
    boardColor: C.fence.boardColor,
  };
  const lawnHalfW = (COLS * W) / 2;
  const lawnHalfD = (ROWS * D) / 2;
  const gap = C.fence.gap;
  const margin = C.fence.mowerMargin; // mower kept in by half-width (mower-stop inset)
  const sideFence = ({ length, position, rotation }) =>
    createFence(sim, {
      ...FENCE,
      repeat: Math.round(length / FENCE.sectionWidth),
      position,
      rotation,
    });
  sideFence({
    length: COLS * W,
    position: [0, 0, lawnHalfD + gap],
    rotation: [0, 0, 0],
  });
  sideFence({
    length: COLS * W,
    position: [0, 0, -lawnHalfD - gap],
    rotation: [0, Math.PI, 0],
  });
  sideFence({
    length: ROWS * D,
    position: [lawnHalfW + gap, 0, 0],
    rotation: [0, Math.PI / 2, 0],
  });
  sideFence({
    length: ROWS * D,
    position: [-lawnHalfW - gap, 0, 0],
    rotation: [0, -Math.PI / 2, 0],
  });

  // Publish lawn geometry + grass + grid to the shared context.
  ctx.env.lawnHalfW = lawnHalfW;
  ctx.env.lawnHalfD = lawnHalfD;
  ctx.env.margin = margin;
  ctx.env.CELL = CELL;
  ctx.grass.mesh = grassMesh;
  ctx.grass.attr = growthAttr;
  ctx.grass.arr = growthArr;
  ctx.grass.bladePos = bladePos;
  ctx.grass.bladeScale = bladeScale;
  ctx.grass.bladeGrowth = bladeGrowth;
  ctx.grass.half = BLADE_HALF;
  ctx.grass.total = total;
  ctx.env.visitCutArea = visitCutArea;

  return {
    sunLight,
    domeSun,
    domeAmbient,
    ground,
    earth,
  };
}