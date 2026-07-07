# Samdin CLI

Companion tools for validating, inspecting, and exporting Samdin specs from the command line. Each tool runs outside the app — they do **not** require `make dev` to be running; the Playwright-driven scripts spin up their own static server pointed at `../src`.

## Install

```bash
cd cli
npm install
```

Playwright is a dep of this directory (not the app).

## Tools

### `validate-spec.cjs`

Static validation of a spec — parts trees, CSG blocks, module references, prefab `src` existence, scene-level settings. No browser.

```bash
node validate-spec.cjs ../specs/showcase.json
node validate-spec.cjs ../specs/*.json
```

Exit status is non-zero on validation failure.

#### `--strict` — quality-rule lint tier

Encodes the samdin skill's quality rules as advisory findings (prefixed `[strict:<rule>]`). **Never fails the build** — surfaces convention gaps the structural validator can't see. Run via `make lint`.

```bash
node validate-spec.cjs --strict ../specs/*.json
```

Rules: `scene-block` (presentation-scale asset with no scene), `camera-preset` / `lighting-preset` / `lighting-environment` / `tonemapping` (enum typos that silently fall back at runtime), `metal-no-env` (metallic material with no `scene.lighting.environment`), `emissive-budget` (more than ~6 emissive materials), `breakup` (large non-emissive, non-metal painted surface at quality standard/high with no `material.breakup`), `clone-read` (3+ `name_N` siblings with identical material/scale/rotation), `ground-contact` (nothing near `y=0` — heuristic, ignores rotation).

Suppress a rule with `lintIgnore`: `"lintIgnore": ["clone-read"]` at spec level, or on a part (`"lintIgnore": ["breakup", "ground-contact"]`). The dimension checks also honor a per-part `"lintIgnore": ["zero-dimension"]`. Use `"all"` to silence everything on a part.

### `schema-check.js`

Validates specs against [`schema/samdin-spec.schema.json`](../schema/samdin-spec.schema.json) (JSON Schema draft-07) using `ajv`. This is the **structural** layer — required fields, enums (type names, `lighting.preset` / `environment` / `toneMapping` / `camera.preset`, `scene.quality`), and value shapes. Per-type param counts, parent resolution, CSG wiring, and the quality lints stay in `validate-spec.cjs` (which is stdlib-only so it can gate CI with no install).

```bash
node schema-check.js ../specs/showcase.json
node schema-check.js ../specs/*.json      # or: make schema-check
```

The schema doubles as **editor autocomplete + inline validation**: add `"$schema": "../schema/samdin-spec.schema.json"` to a spec (or map it in your editor) and typos in preset names surface as you type. One source of truth — the schema catches the enum/shape drift the audit kept finding by hand.

### `shot.js`

One fast render — a single spec, a single camera, one screenshot. `inspect-model.js` sweeps ~18 angles (normal + wireframe + design-grid); when you're iterating on a model you want one image now. Use this in the modelling loop; use `inspect-model.js` for a full review sweep.

```bash
node shot.js ../specs/quality-bar-courier-pickup.json out.png            # threeQuarter
node shot.js ../specs/quality-bar-courier-pickup.json out.png front       # or: make shot SPEC=... VIEW=front
```

### `hero.js`

One clean gallery render of a spec: camera-relative **3-point front lighting** (key + fill + rim, always lighting the face the camera sees), centered, fully in frame, grid + UI off. The spec's own background and emissive accents are kept. This is what the README gallery shots are made with.

```bash
node hero.js ../specs/quality-bar-field-radio.json out.png   # or: make hero SPEC=...
```

### `inspect-model.js`

Loads a spec in headless Chromium, captures a preset sweep of screenshots (normal / wireframe / design-grid across all camera presets, plus the spec-defined first camera as `*-specCamera.png`), and writes a review template markdown file.

```bash
node inspect-model.js ../specs/showcase.json           # defaults to /tmp/samdin-inspect
node inspect-model.js ../specs/clinic.json ./out
node inspect-model.js ../specs/clinic.json ./out 8800  # override port
```

### `golden.js`

Regression guard for the `quality-bar-*` anchors. Two layers:

- **Structural fingerprint** (hard gate) — triangle / vertex / object counts per anchor. Renderer-independent, so it is stable across machines and gates CI. This is what catches a `qualityTier` or builder change that silently moves anchor geometry.
- **Canvas PNGs** (soft, local only) — per-anchor renders at `specCamera`, `threeQuarter`, `lowAngle`, diffed with `pixelmatch`. Skipped under CI (`GOLDEN_NO_PIXEL=1` / `CI=true`) because the browser renderer is not portable across GPUs.

```bash
node golden.js              # compare against ../goldens/, exit 1 on drift
node golden.js --update     # rewrite goldens after an intentional change
GOLDEN_NO_PIXEL=1 node golden.js   # fingerprint gate only (CI mode)
```

Goldens live in `../goldens/` (`fingerprints.json` + reference PNGs). Work renders land in `../.golden-work/` (gitignored); diff PNGs are written there on a pixel failure.

### `export-playwright.js`

Automates the viewer to export a spec as `.glb` with materials preserved.

```bash
node export-playwright.js ../specs/showcase.json           # writes showcase.glb next to the spec
node export-playwright.js ../specs/showcase.json out.glb
```

### `index.js`

Direct spec → `.obj` converter (or `.glb` via Blender when available). Useful for batch pipelines without Playwright.

```bash
node index.js ../specs/sedan.json                  # → sedan.obj
node index.js ../specs/sedan.json out.glb --glb    # → GLB via Blender
node index.js --batch ../specs ./out               # convert all specs in a dir
```

### `hullgen.mjs`

Procedural low-poly hull generator — lofts faceted cross-sections into one
continuous flat-shaded mesh and writes a self-contained `.gltf` (embedded
buffer, flat normals, stdlib-only, no Playwright/Blender). Ships are JSON
defs in `ships/`. Full schema + look rules: [docs/hullgen.md](../docs/hullgen.md).

```bash
node hullgen.mjs                              # build every def in ships/
node hullgen.mjs ships/arcwing-swarmling.json
# → ../media/models/<name>-hull.gltf  (served at /media/models/ in dev)
```

## Notes

- All scripts resolve paths relative to the `cli/` directory. Specs, prefabs, and media live in `../specs`, `../prefabs`, `../media`.
- The Playwright scripts serve `../src` as the app root and fall back to the repo root for `/specs`, `/prefabs`, and `/media` — same URL shape the dev server uses.
- Increase the Playwright timeouts inside the scripts if you're inspecting large scenes on a slow machine.
