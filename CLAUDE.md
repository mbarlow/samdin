# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Development server and tooling go through the Makefile:

- `make dev [PORT=7777]` — Start the dev server with hot reload via `browser-sync` (see `scripts/dev.sh`). Override the port with `PORT=...`.
- `make serve` — Plain static server via `bunx serve -s .` (no hot reload).
- `make smoke` — Run the CLI validator against `specs/showcase.json` as a smoke check.
- `make help` — List targets.

CLI scripts in `cli/` (run with `node` from inside `cli/`, paths are relative to the project root):

- `node cli/validate-spec.cjs <spec.json>` — Validate a spec file.
- `node cli/inspect-model.js <spec.json> [out-dir]` — Spins up its own local HTTP server, loads the spec in headless Chromium (via Playwright), and captures a preset sweep of screenshots + a review template. Defaults output to `/tmp/samdin-inspect`.
- `node cli/export-playwright.js <spec.json> [out.glb]` — Automates the viewer to export a spec as GLB with materials preserved.
- `node cli/index.js <spec.json> [out]` — Convert spec to OBJ (or GLB via Blender with `--glb`, batch with `--batch`).

Install CLI deps once with `cd cli && npm install` (Playwright is a dep of `cli/`, not the app).

## Architecture

Samdin is a browser-based 3D scene viewer/builder. It is a **static web app**: there is no build step for the frontend — `index.html` loads `js/main.js` as an ES module directly. All logic lives in the browser; the CLI is an optional companion for validation, headless inspection, and GLB export.

### Runtime entry + app composition

`js/main.js` defines `App`, which wires together the subsystems created in `init()`:

- `Viewer` (`js/viewer.js`) — Three.js scene/camera/renderer, orbit + first-person controls, camera presets (`front`, `back`, `left`, `right`, `top`, `threeQuarter`, `lowAngle`, `highAngle`), `fitToModel()`, wireframe/grid toggles, and the animation loop. It exposes `setRenderCallback()` so the app can drive post-processing and animation ticks.
- `ModelBuilder` (`js/builder.js`) — The core of the project. Holds a `Map` of registered specs and a prefab cache. Turns spec JSON into Three.js `Group`s.
- `LightingManager`, `PostFXManager`, `AnimationController`, `ModelLoader`, `ModelExporter`, `CameraSystem` — Named subsystems attached to `App`. `CameraSystem` is a first-person "photography" layer (viewfinder, polaroid strip, photo export), distinct from the orbit camera on `Viewer`.

`App` is exposed on `window.app` (and `window._app`), which is how automation (inspect/export CLI scripts, MCP Playwright, manual debugging) reaches the builder and viewer.

### Spec → model pipeline

The data model is a JSON "spec". `ModelBuilder.build(spec)` → Three.js `Group`. Key points when working with specs:

- **Registration is keyed by `spec.name`.** `registerSpec(spec)` does `this.specs.set(spec.name, spec)`. `loadSpec(name)` (on `App`) only accepts a name that's already in that map — it will not take a raw spec object. To load an arbitrary JSON from disk at runtime: `builder.registerSpec(spec); app.loadSpec(spec.name)`.
- Specs support a `parts[]` tree (each with `name`, `type`, `params`, `material`, `position/rotation/scale`, `parent`, `pivot`), spec-local `modules` referenced via `type: "module"`, embedded `type: "csg"` parts (boolean ops over local shapes), prefab instances via `type: "prefab"` + `src`, and scene-level settings under `scene` (background, fog, lighting preset, tone mapping, exposure, camera framing, postfx).
- Builder pipeline (order matters): `normalizeSpec` → `expandPrefabs` / `expandCompositeRefs` / `expandRegions` → `expandProcedural` (array/mirror/scatter modifiers) → `sortByDependency` (parent chains) → `createPart` → `finalizePart` → surface treatments (material breakup, roughness variation, decals, emissive strips).
- `buildCSG` / `CSGBuilder.js` / `CSGPrimitives.js` handle boolean-op geometry (I-beams, hollow boxes, gears, etc. — see README prefab list).
- `qualityTier` ("draft" / "standard" / "high") affects segment counts and surface detail across the pipeline; the Quality dropdown in the UI drives it via `setQualityTier`.

### Assets on disk

- `specs/` — Scene specs (`*.json`). `make smoke` validates `specs/showcase.json`.
- `prefabs/` — Reusable `type: "prefab"` JSON components loaded lazily by the builder (`prefabsBasePath`). README lists categories but may lag behind disk; trust the directory listing.
- `index.html` is the single HTML entry; all UI panels (`#model-section`, `#info`, `#camera`, etc.) are static markup wired up in `App.setupUI()`.

### Service worker

There is no service worker in samdin. (If you see cached-content weirdness during dev, it's not from this project — check the browser for stale registrations from sibling projects on the same `localhost` origin.)

### Headless automation

`cli/inspect-model.js` and `cli/export-playwright.js` both start their **own** static HTTP server inside the script and launch Playwright against it — they do **not** require `make dev` to be running. When driving the running dev server manually (e.g. via MCP Playwright), load arbitrary specs with:

```js
const spec = await (await fetch('/specs/foo.json')).json();
app.builder.registerSpec(spec);
await app.loadSpec(spec.name);
app.viewer.setCameraPreset('front');
app.viewer.fitToModel();
```
