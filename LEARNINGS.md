# Engine & Game Development Learnings

This document captures architecture patterns, pitfalls, and design rules learned while building games and engine features in this repository.

---

## 1. Resource Disposal & Shared Three.js Assets

### Problem: Dynamic Mesh Disappearance
When game entities or procedural chunks are dynamically spawned and recycled at runtime (e.g. infinite terrain chunks, particle pools, streaming track segments), cleaning them up via `sim.removeEntity(entity)` traverses the entity's Three.js mesh hierarchy and invokes `.dispose()` on all attached geometries and materials to release GPU memory.

If geometries or materials are declared as **shared module-level singletons** across multiple dynamic entities:
- As soon as the first entity is recycled and removed, its geometries and materials are disposed from WebGL memory.
- All remaining active entities (and newly spawned entities) reusing those same instances become invalid in GPU memory, causing meshes (e.g. tree trunks, rocks, decor) to suddenly disappear or fail to render.

### Best Practice
- **Create per-entity or per-chunk geometries and materials** when entities are designed to be cleaned up via `sim.removeEntity()`.
- If sharing assets for performance, do not dispose them during routine entity removal, or maintain a reference-counted cache where `.dispose()` is only called when the last referencing instance is destroyed.

---

## 2. Floating-Origin Rebasing & Frame Update Ordering

### Problem: Single-Frame Visual Jerk / Pop on Chunk Transitions
When implementing infinite streaming worlds with floating-origin rebasing (shifting all active coordinate frames back when crossing a chunk threshold `L`), updating transforms out of order creates a 1-frame coordinate mismatch.

If entity positions or cameras are computed **before** advancing and rebasing:
1. The train / camera moves in the old coordinate system.
2. The track advances and shifts all active segments to the new origin.
3. The train / camera remains in the previous coordinate frame for the rendered frame, causing the track to visibly jump or jerk sideways for a single frame.

### Best Practice
Always structure the per-frame tick lifecycle in this exact order:
1. **Advance distance:** `s += speed * dt`.
2. **Rebase and recycle:** If `s >= segmentLength`, decrement `s -= segmentLength` and execute `track.advance()` / origin rebasing.
3. **Sample poses in current coordinate frame:** Compute entity transforms and call `mesh.updateMatrixWorld(true)`.
4. **Update camera:** Align camera transforms in lockstep with the newly updated entity matrix.
