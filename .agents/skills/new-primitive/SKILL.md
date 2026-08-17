---
name: new-primitive
description: Creates a new game primitive.
---

The user will describe a primitive. Implement it in engine/primitives.js.

Before implementation, check and see if any existing primitives are similar or could be extended
to achieve the same use-case.

If the primitive is actually a composite - it could be composed of multiple primitives, then
create it in engine/components.js instead.

For example, a sphere is a primitive. A traffic light composed of a rectangle and three spheres is a component.

Primitives should have intuitive and clearly named arguments - always objects so they can be extended.
Match the existing `createX(sim, opts = {})` pattern in engine/primitives.js: destructure `opts` with defaults,
build a matched THREE.Mesh and CANNON.Body, set `castShadow`/`receiveShadow` on the mesh and `body.material`
plus `body.updateMassProperties()`, then return `sim.addEntity(mesh, body)` (add a third `updateFn` argument
for dynamic behavior).

Keep the physics shape and the three.js geometry dimensionally consistent (e.g. box half-extents `size / 2` vs
sphere `radius`), so the visual mesh and the collision body line up.

Do not try to generalize right off the bat - the user is responsible for this; simply implement what they asked
and no more.
