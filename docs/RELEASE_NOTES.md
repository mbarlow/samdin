# Release Notes

## 2026-03-07

This update expands Samdin from a basic parts-based model builder into a more complete scene-authoring workflow.

### Highlights

- Scene-level spec settings now drive background, fog, lighting, exposure, tone mapping, post-processing, and camera framing.
- Parts-based specs now support spec-local `modules`, embedded `type: "csg"` parts, nested `children`, and richer array/mirror/scatter modifier handling.
- Materials can now express more look-dev detail, including transparency/transmission controls, surface breakup, decals, emissive strips, and roughness variation.
- The viewer ships reusable industrial/ruin prefabs for environment assembly:
  - `catwalk-segment`
  - `pipe-rack`
  - `factory-wall-bay`
  - `broken-column`
  - `arch-fragment`
  - `machine-altar`
  - `hazard-gate`

### Runtime Improvements

- Scene settings from specs are now applied consistently when loading built-in specs, pasted specs, and spec files.
- Camera specs support:
  - `preset`
  - `fit`
  - `distanceMultiplier`
  - `scaleToModel`
  - `positionOffset`
  - `targetOffset`
- Lighting supports both named presets and explicit per-light scene configs.
- Post-processing supports scene-driven SSAO, bloom, vignette, grain, chromatic aberration, scanlines, color grading, FXAA, and related toggles.

### Validation and Inspection

- Added `cli/validate-spec.cjs` for local validation of parts-based and top-level CSG specs.
- Validation now understands:
  - embedded CSG parts
  - spec-local modules
  - nested `children`
  - scene settings
  - broader primitive coverage
- The inspection flow now:
  - captures the spec-defined first camera as `*-specCamera.png`
  - writes `review-template.md`
  - preserves a more useful screenshot/review loop for scene iteration

### CSG Compatibility Fixes

- CSG primitive parameter handling was aligned with the documented contracts.
- Backwards-compatible call shapes were preserved so existing short-form usages that pass `opts` positionally continue to build correctly.
- This specifically removed invalid-geometry issues seen during scene inspection while keeping older content functional.

### New Example Scenes

- `specs/industrial-ruin-foundry.json`
- `specs/ruined-civic-plaza.json`
- `specs/nier-automata-boss-arena-remastered.json`
- `specs/super-mario-level-gameplay.json`

### Practical Impact

You can now author full scenes with reusable internal modules, hybrid parts-plus-CSG assembly, scene-owned look-dev, and more reliable inspection/revision loops without needing to treat each scene as a one-off custom build.
