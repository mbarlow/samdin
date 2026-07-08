# Validation & Inspection

CLI-side tools for checking specs without booting the viewer, and for capturing a review sweep of screenshots from a headless browser.

See [`../cli/README.md`](../cli/README.md) for full command reference.

## Quick checks

```bash
# Static validation
node cli/validate-spec.cjs specs/showcase.json

# Screenshot sweep + review template (defaults to /tmp/samdin-inspect)
node cli/inspect-model.js specs/showcase.json /tmp/showcase-inspect

# Export to GLB with materials preserved
node cli/export-playwright.js specs/showcase.json out.glb
```

The inspector captures the spec-defined first camera as `*-specCamera.png` before running the preset sweep, so hero framing is always present.

## Example scenes

### Primitive tests
- [`specs/lathe-test.json`](../specs/lathe-test.json) — Lathe examples (vases, glasses, goblets)
- [`specs/cables-test.json`](../specs/cables-test.json) — Cables, catenaries, and pipes
- [`specs/lights-test.json`](../specs/lights-test.json) — Light primitive examples

### Prefab tests
- [`specs/furniture-test.json`](../specs/furniture-test.json) — Furniture in room layouts
- [`specs/vehicles-test.json`](../specs/vehicles-test.json) — All vehicle types

### Showcase scenes
- [`specs/showcase.json`](../specs/showcase.json) — Combined feature showcase
- [`specs/clinic.json`](../specs/clinic.json) — Clinic interior scene
- [`specs/motorcycle-street.json`](../specs/motorcycle-street.json) — Motorcycle on a street scene
- [`prefabs/prefab-test.json`](../prefabs/prefab-test.json) — Street scene with prefabs


## Rendered-space linting (`cli/probe.js`)

`validate-spec.cjs` checks spec-space; the probe checks what actually builds and renders. It loads the spec headless and emits machine-readable findings:

```bash
node cli/probe.js specs/my-scene.json [--json findings.json]
# or: make probe SPEC=specs/my-scene.json
```

| Check | Finds | Severity |
|-------|-------|----------|
| `contact` | root-level parts / modifier instances floating above or buried in the ground (terrain → env meshes → y=0); parts with authored `snapToGround` are skipped | warning |
| `albedo` | materials whose effective albedo (`color × mean vertex color`) renders near-black or blown | error / warning |
| `clones` | instance families (≥ 4) with zero rotation and scale variance — clone read | warning |
| `luma` | render histogram: crushed-shadow / blown-highlight pixel share | warning |

Findings are `{ severity, check, part, value, hint }`; exit code 1 on errors so it can gate CI. First run caught a real latent bug: a hidden env plate whose color had been double-darkened by an authoring workaround — invisible in every screenshot pass.
