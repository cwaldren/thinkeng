# Moasis (games/mow/) — notes for coding agents

Each module builds one system and they share mutable
state through a central `ctx` object. This file documents the module
boundaries, the `ctx` contract, and the load-bearing build order so you can
work here without reconstructing the whole graph.

## Modules

| File             | Builder                          | Responsibility                                                                                                                                     |
| ---------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.js`      | `CONFIG` (plain object)          | **All tuning/feel constants**, grouped by domain. Tweak the game's feel here first — every builder reads from it.                                  |
| `context.js`     | `createContext(sim)`             | Shared mutable `ctx` bag + `isMobile` + density (read from `localStorage`, defaulted from `CONFIG`).                                               |
| `environment.js` | `buildEnvironment(sim, ctx)`     | Sun + dome lights, moon craters/albedo/heightfield, Earth, star field, grass instanced mesh + sway shader + spatial cut grid, fence.               |
| `cinematics.js`  | `buildCinematics(sim, ctx, env)` | Glass sky dome + painting, shattering reveal, doom overlay, greeting, camera kick, day/night clock + reveal driver, boot intro, sun/earth sliders. |
| `mower.js`       | `buildMower(sim, ctx, env)`      | Mower entity, cut/grow loop, grass-clipping particles, dandelion mowing, first-person/orbit camera, action registration.                           |
| `creatures.js`   | `buildCreatures(sim, ctx, env)`  | All bugs (flies, butterflies, dragonflies, swarms, bees, fireflies) + dandelions + day/night registration.                                         |
| `ui.js`          | `buildUI(sim, ctx)`              | `[stats]`/`[options]` buttons, FPS/GC/entity readouts, sandbox panel toggle.                                                                       |

## The `ctx` object — the cross-module contract

Everything that crosses a module boundary lives on the shared `ctx`
object. It is **grouped by owner** — each system's state lives in one
namespaced sub-object, so it's easy to see where data lives and who writes it:

- `ctx.env` — physical world: sun/dome lights, Earth, lawn bounds
  (`lawnHalfW/D`, `margin`, `CELL`, `visitCutArea`), and the live sun/earth
  tuning (`sunAzimuth/Elevation`, `earthAngleDeg/Distance`, temps).
  Bootstrapped by `environment.js`, mutated by `cinematics.js`.
- `ctx.grass` — blades + sway + runtime growth (`growRate`, `grassDirty`).
  Built by `environment.js`, grown/cut by `mower.js`.
- `ctx.mower` — the mower **entity** plus helper methods (`setOpacity`,
  `rearmMobileHint`) that `mower.js` attaches. `ctx.mower.mesh` is stable.
- `ctx.creatures` — bugs + dandelions + `dayCycle`, `bx/bz`, mowed-count
  bookkeeping, `flowerStarted`/`popProgress`, dandelion fold params.
  Owned by `creatures.js`.
- `ctx.flow` — runtime state-machine flags: `introActive`, `swaying`,
  `gravityOn`, `curtainStarted`, `revealFired`, `creaturesEnabled`,
  `creaturesRevealed`.
- `ctx.camera` — orbit/first-person state (`theta/phi/radius/camBlend*`),
  `fwdOffset`, `gazePitch`, `fovSlider`, and the blast `kick`.
- `ctx.time` — day/night clock (`hour`, `prevHour`, `dispatchDayNight`).
- `ctx.input` — the engine `InputManager`.
- `ctx.density`, `ctx.sim`, `ctx.clampInt` — config/config basics (not
  namespaced).

**Values are assigned by whichever module builds them, then read/mutated at
call time** (the same timing the monolithic closures had).

Watch out for ordering traps when referencing other systems' state:

- **Capture lazily, not at module top.** Don't copy `ctx.creatures.flowerStarted`
  / `ctx.creatures.dandelions` into a local at module scope — those are built
  by `buildCreatures`, which may run after your module. Read
  `ctx.<group>.<field>` at call time, or use a small accessor function, so you
  get the post-build reference.
- Every field you touch is assumed to exist, under its group, in `createContext`
  (`games/mow/context.js`). If you add cross-module state, declare a default
  for it there.
- Most fields start as `null`/`[]` defaults, then a builder sets them. There is
  no type system — a typo on `ctx.env.foo` or a read-before-build fails
  silently. `buildEnvironment` runs first; `buildCreatures` builds the creature
  arrays. Don't depend on a group before its owner has run.
- To add a new grouping later, prefer adding a new namespaced group in
  `createContext` rather than adding bare top-level fields.

## Build & registration order

Order is load-bearing (matches the original closure timing). From `mow.html`:

```
new Simulation({...})
ctx = createContext(sim)
ctx.input = new InputManager()        // engine/inputManager.js
// fov/gaze/offset sliders + mobile UI bootstrap
const env = buildEnvironment(sim, ctx)   // must run first (mower/grid depend)
const cin = buildCinematics(sim, ctx, env)
buildMower(sim, ctx, env)
buildCreatures(sim, ctx, env)
buildUI(sim, ctx)
cin.completeInit()                       // first load: no boot cinematic
sim.start()
```

- `buildEnvironment` must run first (grass/grid outputs feed the mower).
- `buildCreatures` must run before anything _reads_ the creature arrays.
- Per-frame `sim.addEntity(null, null, updateFn)` callbacks run in
  registration order each frame. Don't rely on subtle cross-entity ordering.

## Input

`ctx.input` is the engine's action-based `InputManager`
(`engine/inputManager.js`). The mower registers named actions/axes once in
`mower.js` (`forward`, `turn`, `orbit`, `shift`) and queries by name (`axis`,
`hasAction`, `pressed`, `released`). **Do not poll raw keys/touch in game code**
— route new controls through the manager. Mouse-drag orbit + wheel zoom are
the exception (intentionally kept as canvas UI interactions).

## Testing

- No headless browser: ask the human to reload `games/mow.html` and test.
- `node --check <file>.js` is a valid quick syntax check.
- ESM imports: `three` / `engine/*` resolve via the import map in `mow.html`;
  sibling modules are `./config.js`, `./context.js`, etc.
- Forward axis for the mower/player is **-Z** (see `games/AGENTS.md`).
