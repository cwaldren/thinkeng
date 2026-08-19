---
name: new-component
description: Creates a new game component.
---

The user will describe a component. Implement it in engine/components.js.

## What is a component?

A component is a **composite** entity built by composing primitives from
`engine/primitives.js` (box, sphere, cylinder, etc.), rather than a single
primitive. For example, a sphere is a primitive; a traffic light composed of
a rectangle and three spheres is a component. The existing `createGrass`
(a field of many blades) is the reference implementation.

## Before you start

1. **Read `engine/components.js`** and `engine/primitives.js` to see what
   primitives already exist and how the current component is structured.
2. **Prefer composing existing primitives.** Check whether the required
   parts already exist (box, sphere, cylinder, ground, player) and can be
   composed to achieve the use-case.
3. **Create a new primitive only if a needed part doesn't exist.** If you
   must invent a genuinely new primitive, implement it via the
   `new-primitive` skill (engine/primitives.js) and register it there. A
   component is just an assembly of primitives.

## Component conventions

- Name it `createX(sim, opts = {})` and destructure `opts` with defaults,
  matching the existing `createGrass` pattern.
- Compose primitives from `engine/primitives.js` (e.g. `createCylinder`,
  `createBox`) and parent their `.mesh` under a single `THREE.Group`.
- Track every created primitive so it can be cleaned up together:
  ```js
  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  const children = [];

  const part = createBox(sim, { ... });
  group.add(part.mesh);
  children.push(part);
  // ... more parts, each pushed to `children`

  const entity = sim.addEntity(group, null, null);
  entity.children = children;
  return entity;
  ```
  - Passing `children` on the returned entity means `sim.removeEntity`
    disposes the whole composite (primitives + physics bodies) at once -
    this is how the gallery frees a component on rebuild.
- Keep arguments intuitive and object-based so they're gallery-friendly
  (numbers, colors, vectors). Prefer passing a sensible `position` so the
  whole group is placed together.
- Use `mass: 0` for purely decorative parts unless the component needs
  physics. If it does need physics, decide whether the group root or the
  child bodies own it and keep the visual meshes and bodies aligned.

Do not try to generalize right off the bat - the user is responsible for
this; simply implement what they asked and no more.

## Register the component in the registry

After implementing the component in engine/components.js, register it in the
shared registry at `engine/registry.js`. This is the single source of truth
that drives the gallery (`entities.html`). Do NOT edit `entities.html`
itself - it renders every `ENTRIES` entry generically.

1. **Read `engine/registry.js`** and add the new function's import alongside
   the others, e.g. `import { createMyComp } from "./components.js";`
2. **Add a new entry** with `category: "component"`:
   ```js
   {
     category: "component",
     key: "mycomp",
     label: "My Comp",
     desc: "One-line description",
     fn: createMyComp,
     opts: [
       { key: "color", label: "Color", type: "color", default: "0x88cc55" },
       { key: "position", label: "Position [x,y,z]", type: "vector", default: [0, 0, 0] },
     ],
   }
   ```
3. Supported `opts` field types (the gallery builds controls generically
   from these):
   - `number` - `<input type=number>` with `min`, `max`, `step`.
   - `color` - color picker; value hex string, e.g. `"0xff5533"`.
   - `vector` - comma-separated numbers mapped to an array (for `position`,
     `rotation`, etc.).
   - Omitting a field from `opts` simply means it uses its default and has no
     control.
4. Match each field's `default` to the destructured default in
   `engine/components.js` so the gallery and the code agree.
