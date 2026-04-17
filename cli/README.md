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

### `inspect-model.js`

Loads a spec in headless Chromium, captures a preset sweep of screenshots (normal / wireframe / design-grid across all camera presets, plus the spec-defined first camera as `*-specCamera.png`), and writes a review template markdown file.

```bash
node inspect-model.js ../specs/showcase.json           # defaults to /tmp/samdin-inspect
node inspect-model.js ../specs/clinic.json ./out
node inspect-model.js ../specs/clinic.json ./out 8800  # override port
```

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

## Notes

- All scripts resolve paths relative to the `cli/` directory. Specs, prefabs, and media live in `../specs`, `../prefabs`, `../media`.
- The Playwright scripts serve `../src` as the app root and fall back to the repo root for `/specs`, `/prefabs`, and `/media` — same URL shape the dev server uses.
- Increase the Playwright timeouts inside the scripts if you're inspecting large scenes on a slow machine.
