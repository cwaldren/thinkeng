# Infinite Train — Design Plan

An infinite, procedurally-generated train ride: the train chugs along a
track forever, through straight sections, curves, and trees that are all
generated deterministically on the fly.

**Status:** Proposed (plan only, no code yet).

## Design decisions

- **Player control:** speed control — accelerate/brake with keys; the
  train is always on the track.
- **Camera:** first-person cab, looking down the track.
- **Architecture:** track-streaming (chunk along arc-length) with a
  floating origin — not 3D grid chunking.

## Core ideas

### 1. Chunk along the track, not the world

A train on a track only travels in one dimension, so we don't chunk 3D
space. We chunk along the track's **arc-length `s`** — a one-dimensional
stream of segments:

- The world is a small **sliding pool of ~16–24 active track segments**,
  each a fixed arc-length chunk (straight, left-curve, or right-curve).
- Segments are generated ahead and recycled behind, so memory and GPU work
  stay constant regardless of how far the train travels.
- Coordinates stay tiny forever → no float-precision stutter at large
  distances.

### 2. Keep the train near origin; move the world around it (floating origin)

The train's cumulative distance `s` grows unboundedly. To keep all
coordinates small, we **rebase**:

- When `s` crosses a full segment's length `L`, subtract `L` from `s` and
  from every active segment's internal station positions.
- The train mesh stays pinned near the local origin (`~ (0, 1.2, 0)`); the
  visible world just slides back by `L`.
- Reuses `removeEntity` (which disposes GPU geometry) for recycling.
- **Frame update order rule:** Always advance distance `s += speed * dt` and
  perform `track.advance()` (rebasing) _before_ sampling `follower.getPose()` and
  updating train/camera matrices. Sampling before rebasing leaves transforms
  in the prior coordinate space for a single frame, causing a noticeable 1-frame
  track jerk.

### 3. Stitch segments with pose continuity

Each segment stores an **entry pose** `{point, heading, bank}` and an
**exit pose**. On spawn, the next segment receives the prior segment's exit
pose as its entry pose and lays out its spine to continue smoothly:

- Straight: constant heading.
- Curve: constant curvature, banked rails.
- Reusing the interpolated spine gives C1 continuity — curves merge with no
  seams.

### 4. Deterministic segments (seeded PRNG)

Seed a PRNG with the segment's index so a given segment always generates the
same content (tree/rock placement off the sides). The world is infinite but
regenerable and consistent.

### 5. Robustness: drive the train analytically, not by physics

Rails + general physics invite jitter and derails. Instead:

- `speed += input · accel · dt`, then `s += speed · dt`.
- Sample the current segment's spine at `s` for position, forward, and up →
  set the train's transform directly.
- Canvas camera lerps onto the cab seat + forward.
- Physics (CANNON) is used only for decoration, if at all.

## Proposed implementation shape

### Engine helpers — `engine/components.js`

- `createRailSegment(sim, opts)` — one track chunk (arc length ~50), built
  by composing `primitives.js`:
  - Rails: two long thin `createBox` strips following the sampled spine.
  - Ties: short `createBox` bars across the spine at each station.
  - Decorators: trees/rocks/telegraph poles off the sides, placed with the
    segment's seeded PRNG.
  - Returns an entity whose `.children` are the rail boxes plus a
    `.segment` metadata object `{ curve, entryPose, exitPose, length }`.
- `createTrain(sim)` — a composite of `createBox`es (hood, cabin,
  smokestack, wheels); driven analytically (no physics body).

### New game — `games/train/infinite-train.html`

Copied from `engine/template.html` (keeps import map + `Simulation` init),
adding:

- A `TrackWorld` that owns the segment pool window `[tailIdx .. headIdx]`:
  - Each frame `s += speed·dt`.
  - When ahead of `headIdx`, spawn a segment at `headIdx` (pick next curve
    type, stitch entry pose, seed = index) and `removeEntity` the tail
    segment.
  - Rebases the window by `L` periodically.
- **Speed control:** accelerate (`W`/`ArrowUp`), brake (`S`/`ArrowDown`).
- **First-person cab camera:** `sim.camera` at the cab seat, oriented to
  forward with a slight look-down.

### Registration

Add a card to `index.html` linking to the game (per the `new-game` skill's
gallery step).

## Files touched

- `engine/components.js` — add `createRailSegment`, `createTrain`.
- `games/train/infinite-train.html` — new game.
- `index.html` — gallery card.
- `engine/primitives.js` — likely untouched (reuse `createBox`,
  `createCylinder`).

## Out of scope for the first pass

- No on-foot free walking.
- No junctions / steering at splits.
- No obstacles or collectibles.
- The framing here (streaming `TrackWorld` + `createRailSegment` +
  `createTrain`) is the reusable core; later additions (on-foot movement,
  junction steering) can build on the same `TrackWorld`.
