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
   - You MAY add named imports for engine modules (e.g. `createMaterial` from `engine/materials.js`, a composite from `engine/components.js`) as needed by `setup(sim)`.
3. **Customize:**
   - Update `<title>`, `#title` text, and `#instructions` text to reflect the user's prompt.
   - Inject the user's requested mechanics inside a `setup(sim)` function.
   - Ensure `setup(sim)` is invoked before `sim.start()`.
4. **Output File:** Write the complete HTML result directly into `games/<game-slug>.html`.

Don't actually implement any game mechanics! We are focused only on setting up the template for the new game.

## Register the game in the gallery

After writing the game file, add it to the gallery in `index.html`:

1. **Read `index.html`** and locate the card grid (`<main class="grid">`).
2. **Add a new card** matching the existing card structure:
   ```html
   <a class="card" href="games/<game-slug>.html">
     <h2><Game Title></h2>
     <p><Short description></p>
   </a>
   ```
3. Use the same title and a concise version of the description you gave the game.
4. Insert the card alongside the others (alphabetical order preferred).
