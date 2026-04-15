# Runtime Reference

Use this file when you need the current Samdin contract, commands, or runtime-backed feature list.

## Source Of Truth Order

When documentation conflicts:

1. `CLAUDE.md`
2. `cli/validate-spec.cjs`
3. `js/builder.js`
4. shipped `prefabs/*.json` and `specs/*.json`
5. `README.md`
6. `docs/RELEASE_NOTES.md`

## Commands

Repo-level commands:

- `make dev [PORT=7777]`
- `make serve`
- `make smoke`
- `make help`

CLI commands:

- `node cli/validate-spec.cjs <spec.json>`
- `node cli/inspect-model.js <spec.json> [out-dir]`
- `node cli/export-playwright.js <spec.json> [out.glb]`
- `node cli/index.js <spec.json> [out]`

Notes:

- `inspect-model.js` and `export-playwright.js` start their own local server; they do not require `make dev`.
- `make smoke` validates `specs/showcase.json`.

## Supported Authoring Paths

- Parts-based specs are the default path.
- Top-level CSG specs are valid for primarily boolean-built assets.
- Embedded `type: "csg"` parts are supported inside parts-based specs.
- Spec-local `modules` are supported.
- Nested `children` arrays are supported and flattened by the builder and validator.
- Procedural specs exist, but treat them as experimental unless verified in the current runtime.

## Frequently Missed Runtime Features

- `pivot` and `options.pivot` are both recognized by the builder.
- Materials support breakup, decals, roughness variation, transparency, transmission, emissive strips, and related overrides.
- `wire-mesh` is a real material preset in the runtime.
- Scene settings can drive background, fog, lighting, exposure, tone mapping, camera framing, and postfx.
- Quality tiers affect geometry density and surface treatment across the build pipeline.

## Files Worth Sampling Before Authoring

- `specs/showcase.json`
- `specs/clinic.json`
- `specs/motorcycle-street.json`
- `prefabs/sedan.json`
- `prefabs/human-figure.json`
- `prefabs/oak-tree.json`
- `prefabs/catwalk-segment.json`

## Reality Checks

- The `prefabs/` directory is more reliable than any hard-coded prefab count in docs.
- Some example scenes mentioned in release notes are not present in the current `specs/` directory.
- The current validator is stricter than the runtime for some light params with boolean display flags; if legacy light specs fail validation, verify whether the viewer still renders them correctly before treating the spec as broken.
- If you need the full primitive or material catalog, prefer the runtime, validator, and shipped examples over memorized tables.
