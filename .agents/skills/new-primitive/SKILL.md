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

## Register the primitive in the gallery

After implementing the primitive in engine/primitives.js, register it in the gallery at `primitives.html`:

1. **Read `primitives.html`** and locate the `PRIMITIVES` array in the module script.
2. **Add a new entry** matching the existing structure:
   ```js
   {
     key: "myprim",
     label: "My Prim",
     desc: "One-line description",
     fn: createMyPrim,
     opts: [
       { key: "size", label: "Size", type: "number", default: 1, min: 0.1, max: 5, step: 0.1 },
       { key: "color", label: "Color", type: "color", default: "0x88cc55" },
       { key: "position", label: "Position [x,y,z]", type: "vector", default: [0, 0, 0] },
     ],
   }
   ```
   - Currently import the new function from engine/primitives.js in the page's import block too.
3. Supported `opts` field types (the gallery builds controls generically from these):
   - `number` - `<input type=number>` with `min`, `max`, `step`.
   - `color` - color picker; value hex string, e.g. `"0xff5533"`.
   - `vector` - comma-separated numbers mapped to an array (for `position`, `rotation`, etc.).
   - Omitting a field from `opts` simply means it uses its default and has no control.
4. Insert the entry alongside the others. Match each field's `default` to the destructured default in
   `engine/primitives.js` so the gallery and the code agree.
