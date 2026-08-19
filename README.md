# Architecture Design Document: Agent-First Zero-Toolchain Game Engine (AZE)

**Status:** Proposed  
**Target Shelf Life:** 10+ Years (Zero Build-Step, Zero External Dependencies)  
**Primary Goal:** Rapid creation of small interactive simulations/games generated via LLM agents based on human-crafted primitives.

---

## 1. Core Philosophy & Goals

1. **Zero-Toolchain Longevity:** The web platform is backwards-compatible by design. By using native browser standards (Vanilla JS, Web Components, ES Modules, WebGL) and committing core vendor assets locally, scenes will run unchanged for over a decade. No Node.js, Webpack, Vite, or compilation steps required.
2. **Agent-First Assembly:** The LLM acts strictly as an **assembler/configurator**, not a low-level engine architect. The human author builds reliable primitives; the agent instantiates and wires them together via simple declarative markup or code.
3. **Decoupled Engine & Content:** Engine logic and vendor libraries are strictly isolated from game-specific code to prevent hallucination, state corruption, and dependency bleed.

---

## 2. Directory Structure

All dependencies are vendor-hosted locally within the Git repository. External CDNs are strictly prohibited to protect against link rot.

```text
my-web-sims/
├── vendor/                   # Static external libraries (committed to Git)
│   ├── three.core.js         # 3D Renderer core (base library)
│   ├── three.module.js       # 3D Renderer (core + addons; imports three.core.js)
│   └── cannon-es.js          # Physics Engine
├── engine/                   # Core system & human-crafted primitives
│   ├── core.js               # Main game loop, scene manager, physics syncer
│   └── primitives.js         # Standard mesh generators & behaviors (Boids, Controls)
└── index.html                # Main portal / scene switcher
```
