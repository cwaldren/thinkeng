---
name: new-game
description: Creates a new game.
---

You are generating a standalone HTML game file based on `engine/template.html`.

Ask the user for:

- The name of the game
- A short slug identifying the game (suggest 3)
  - Example: "Jetski fun" -> "jetski-fun"
- A short description.

## New game setup

1. **Read `engine/template.html`** as the strict boilerplate structure.
2. **Do NOT modify:**
   - The `<script type="importmap">` block or import paths (`three`, `cannon-es`, `engine/`).
   - The `Simulation` initialization code.
3. **Customize:**
   - Update `<title>`, `#title` text, and `#instructions` text to reflect the user's prompt.
   - Inject the user's requested mechanics inside a `setup(sim)` function.
   - Ensure `setup(sim)` is invoked before `sim.start()`.
4. **Output File:** Write the complete HTML result directly into `games/<game-slug>.html`.
