# Runtime Reference

Use this file when you need the current Samdin contract, commands, or runtime-backed feature list.

## Source Of Truth Order

When documentation conflicts:

1. `CLAUDE.md`
2. `cli/validate-spec.cjs`
3. `src/js/builder.js`
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

- `node cli/validate-spec.cjs <spec.json>` — add `--strict` (or `make lint`) for the quality-rule lint tier (advisory: scene block, metals-need-env, clone-read, ground-contact, preset typos).
- `node cli/inspect-model.js <spec.json> [out-dir] [port]` — out-dir defaults to `/tmp/samdin-inspect`; `[port]` lets you run parallel inspections.
- `node cli/golden.js` (`make golden`) — fingerprint regression check on the quality-bar anchors; `--update` (`make golden-update`) reblesses after an intended change.
- `node cli/export-playwright.js <spec.json> [out.glb]`
- `node cli/index.js <spec.json> [out]`

Notes:

- `inspect-model.js`, `golden.js`, and `export-playwright.js` start their own local server; they do not require `make dev`.
- `make smoke` validates a hero anchor; `make test` validates every spec and prefab (also runs in CI on push/PR).

## Supported Authoring Paths

- Parts-based specs are the default path.
- Top-level CSG specs are valid for primarily boolean-built assets.
- Embedded `type: "csg"` parts are supported inside parts-based specs.
- Spec-local `modules` are supported.
- Nested `children` arrays are supported and flattened by the builder and validator.
- Procedural **modifiers** — `array` (scalar or grid `count:[x,y,z]`), `mirror` (`{x,y,z}` or `{axis:"xz"}`), `scatter` (with `seed` for reproducibility) — are stable and documented in `docs/modifiers.md`. There is no top-level `type: "procedural"`.
- The `scene.terrain` compositor (heightfield / marching-cubes / cloth-drape; normals flip by default) turns `category: "environment"` parts into ground. See `specs/examples/landscape-*.json`.
- The `animations` block exists but is unvalidated and used by no shipped spec — experimental.

## Frequently Missed Runtime Features

- `pivot` and `options.pivot` are both recognized by the builder.
- Materials support breakup, decals, roughness variation, transparency, transmission, emissive strips, and related overrides.
- `wire-mesh` is a real material preset in the runtime.
- Scene settings can drive background, fog, lighting, exposure, tone mapping, camera framing, and postfx.
- Quality tiers affect geometry density and surface treatment across the build pipeline.

## Files Worth Sampling Before Authoring

- `specs/examples/showcase.json`
- `specs/examples/clinic.json`
- `specs/examples/motorcycle-street.json`
- `prefabs/sedan.json`
- `prefabs/human-figure.json`
- `prefabs/oak-tree.json`
- `prefabs/catwalk-segment.json`

## Reality Checks

- The `prefabs/` directory is more reliable than any hard-coded prefab count in docs.
- Some example scenes mentioned in release notes are not present in the current `specs/` directory.
- The validator accepts bool-like light display params and the documented five-parameter `ibeam` and `tbeam` contracts. If new validation drift appears, re-check `cli/validate-spec.cjs` against the runtime builders before editing specs blindly.
- If you need the full primitive or material catalog, prefer the runtime, validator, and shipped examples over memorized tables.
