// MaterialReveal: lets the boot intro first present grass, flowers, and
// creatures as untextured grey + shiny 3D-viewport "model preview" materials,
// then fade each one to its real material. A single injected uniform
// (uRevealR, 0..1) is driven on any MeshStandard/Physical material; 0 leaves
// it a flat grey plastic, 1 restores the fully-textured original look.

const PREVIEW_GREY = [0.585, 0.595, 0.625];
const PREVIEW_ROUGH = 0.12; // shiny (low roughness) while previewing
const PREVIEW_METAL = 0.82; // chrome-like specular while previewing

// Per-instance stagger (grass). Each blade differs in vRevealPhase over
// [0, SPREAD] across the reveal window, turning on with a fast RISE so the
// whole lawn appears to "resolve" blade-by-blade within ~1s.
const PHASE_SPREAD = 0.92; // last blade starts ~92% through the window
const PHASE_RISE = 9.0; // sharpness of each blade's grey->color turn-on
const FLICK_RATE = 18.0; // animated per-blade flicker speed
const FLICK_SEED = 47.0;

// GLSL injected just before the physical lighting stage bakes material
// params, so we get to override the albedo + roughness/metalness factors and
// suppress any emissive glow while the object is still "untextured".
// uRevealR is the shared 0..1 window progress; with USE_REVEAL_PHASE it is
// offset per-instance (vRevealPhase) so blades resolve at different times.
const INJECT_BODY = `float _rRv = clamp( uRevealR, 0.0, 1.0 );
#ifdef USE_REVEAL_PHASE
    float _rS = clamp( ( _rRv - vRevealPhase * ${PHASE_SPREAD.toFixed(3)} ) * ${PHASE_RISE.toFixed(2)}, 0.0, 1.0 );
    float _rF = sin( uTime * ${FLICK_RATE.toFixed(2)} + vRevealPhase * ${FLICK_SEED.toFixed(2)} );
    _rRv = _rS < 1.0 ? clamp( _rS - 0.22 * max( 0.0, _rF ), 0.0, 1.0 ) : 1.0;
#endif
vec3 _rGrey = vec3( ${PREVIEW_GREY.map((v) => v.toFixed(3)).join(", ")} );
diffuseColor.rgb = mix( _rGrey, diffuseColor.rgb, _rRv );
roughnessFactor = mix( ${PREVIEW_ROUGH.toFixed(3)}, roughnessFactor, _rRv );
metalnessFactor = mix( ${PREVIEW_METAL.toFixed(3)}, metalnessFactor, _rRv );
totalEmissiveRadiance *= _rRv;
`;

// Every registered driver, driven once per frame by the intro (cinematics).
export const drivers = [];

const _driverByMat = new WeakMap();

// Register a single material.
//   opts.mode = 'grey' -> untextured grey+shiny preview that resolves to the
//       real material (grass, flowers, insects).
//   opts.mode = 'fade' -> starts fully transparent and fades/flickers in to
//       the real material (the fence). Opacity is driven along with uRevealR.
//   opts.cpuFlicker = true  -> adds random noise to the reveal progress each
//       frame as it resolves (default true; false for grass, which flickers
//       per-blade in the shader).
function register(material, opts = {}) {
  if (!material || !material.isMeshStandardMaterial) return null;
  const existing = _driverByMat.get(material);
  if (existing) return existing;

  const mode = opts.mode || "grey";
  if (mode === "fade") {
    material.transparent = true;
    material.opacity = 0;
  }

  const driver = {
    uniforms: { uRevealR: { value: 1 } },
    material,
    mode,
    cpuFlicker: opts.cpuFlicker !== false,
    revealT: null, // intro time at which this material starts resolving
    revealDur: 0, // how long the grey -> color transition lasts
    setProgress(k) {
      this.uniforms.uRevealR.value = k;
      if (this.mode === "fade") this.material.opacity = k;
    },
    setReveal(k) {
      this.setProgress(k);
    },
  };

  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    const phaseDecl = "#ifdef USE_REVEAL_PHASE\nvarying float vRevealPhase;\n#endif";
    shader.uniforms.uRevealR = driver.uniforms.uRevealR;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `uniform float uRevealR;\nuniform float uTime;\n${phaseDecl}\n#include <common>`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        `${INJECT_BODY}#include <lights_physical_fragment>`,
      );
  };

  _driverByMat.set(material, driver);
  drivers.push(driver);
  return driver;
}

export function registerMaterial(material, opts) {
  return register(material, opts);
}

// Register every supported material under a root object (a mesh or group).
// Returns the unique drivers found, so a caller can tag each with a shared
// reveal time.
export function registerObject(root, opts) {
  const found = [];
  if (!root || !root.traverse) return found;
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      const d = register(m, opts);
      if (d && !found.includes(d)) found.push(d);
    }
  });
  return found;
}