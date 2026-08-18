// Reusable camera controls helper.
//
// Renders a small control panel in the bottom-right of the screen with sliders
// for the camera field-of-view and the X/Y/Z offset (and look target) used to
// position the camera relative to a target object. Call `update()` every frame
// to drive the camera.
//
//   const cam = createCameraControls(sim, {
//     mesh: train.mesh,
//     fov: 60,
//     offset: [-6, 6.5, 4],
//     look: [0, 2, 0],
//   });
//   // each frame:
//   cam.update({ mirror: false }); // mirror=true flips the rig to the far side
//
// Drag the sliders in the bottom-right corner to re-frame the shot live; each
// panel is opaque and draggable so it can be moved out of the way.

import * as THREE from "three";

export function createCameraControls(sim, options = {}) {
  const {
    mesh,
    container = document.body,
    fov = 60,
    offset = [-4, 6.5, 0],
    look = [1.5, 2, 0],
    fovMin = 20,
    fovMax = 130,
    offsetMin = -25,
    offsetMax = 25,
  } = options;

  const state = {
    fov,
    offset: new THREE.Vector3(offset[0], offset[1], offset[2]),
    look: new THREE.Vector3(look[0], look[1], look[2]),
  };

  // --- Build the UI panel -----------------------------------------------
  const panel = document.createElement("div");
  const showPanel = options.visible ?? true;
  Object.assign(panel.style, {
    display: showPanel ? "block" : "none",
    position: "fixed",
    right: "240px",
    bottom: "16px",
    width: "240px",
    padding: "10px 12px",
    background: "rgba(10, 12, 20, 0.75)",
    color: "#e8e8ea",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif',
    fontSize: "11px",
    lineHeight: "1.4",
    borderRadius: "10px",
    userSelect: "none",
    boxShadow: "0 4px 18px rgba(0,0,0,0.5)",
    zIndex: 10,
  });

  const rowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "3px",
  };
  const labelStyle = {
    width: "74px",
    flex: "0 0 auto",
    opacity: "0.85",
  };
  const rangeStyle = {
    flex: "1 1 auto",
    margin: "0",
  };
  const valStyle = {
    width: "46px",
    flex: "0 0 auto",
    textAlign: "right",
    opacity: "0.9",
    fontVariantNumeric: "tabular-nums",
  };

  function addRow(label, min, max, step, get, set) {
    const row = document.createElement("div");
    Object.assign(row.style, rowStyle);

    const lab = document.createElement("span");
    lab.textContent = label;
    Object.assign(lab.style, labelStyle);
    row.appendChild(lab);

    const input = document.createElement("input");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = get();
    input.style.flex = rangeStyle.flex;
    input.style.margin = rangeStyle.margin;
    row.appendChild(input);

    const val = document.createElement("span");
    val.textContent = Number(get()).toFixed(1);
    Object.assign(val.style, valStyle);
    row.appendChild(val);

    input.addEventListener("input", () => {
      const v = Number(input.value);
      set(v);
      val.textContent = Number(v).toFixed(1);
    });
    panel.appendChild(row);
  }

  addRow("FOV°", fovMin, fovMax, 1, () => state.fov, (v) => (state.fov = v));
  addRow("Offset X", offsetMin, offsetMax, 0.1, () => state.offset.x, (v) => (state.offset.x = v));
  addRow("Offset Y", offsetMin, offsetMax, 0.1, () => state.offset.y, (v) => (state.offset.y = v));
  addRow("Offset Z", offsetMin, offsetMax, 0.1, () => state.offset.z, (v) => (state.offset.z = v));
  addRow("Look X", offsetMin, offsetMax, 0.1, () => state.look.x, (v) => (state.look.x = v));
  addRow("Look Y", offsetMin, offsetMax, 0.1, () => state.look.y, (v) => (state.look.y = v));
  addRow("Look Z", offsetMin, offsetMax, 0.1, () => state.look.z, (v) => (state.look.z = v));

  container.appendChild(panel);

  // --- API ---------------------------------------------------------------
  /** Drive the camera from the current slider values relative to `mesh`. */
  function update({ mirror = false } = {}) {
    if (!mesh) return;
    mesh.updateMatrixWorld(true); // ensure the framing origin is current
    const sig = mirror ? -1 : 1;
    sim.camera.fov = state.fov;
    sim.camera.updateProjectionMatrix();
    const o = state.offset;
    const l = state.look;
    const mx = mesh.matrixWorld;
    sim.camera.position.copy(
      new THREE.Vector3(o.x * sig, o.y, o.z).applyMatrix4(mx),
    );
    sim.camera.lookAt(new THREE.Vector3(l.x * sig, l.y, l.z).applyMatrix4(mx));
  }

  function setMesh(m) {
    mesh = m;
  }

  function setVisible(on) {
    panel.style.display = on ? "block" : "none";
  }

  function dispose() {
    window.removeEventListener("pointermove", () => {});
    panel.remove();
  }

  return { state, update, setMesh, setVisible, dispose, panel };
}