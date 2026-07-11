# Release Notes

## 2026-07-10

### Tagged PolyMesh Box Modelling

- Added parts-based `type: "polyMesh"` geometry for Nendo/Wings3D-style
  low-poly control cages without leaving the normal Samdin hierarchy.
- Cube and explicit polygon bases support persistent face tags plus
  `select`, `extrude`, `inset`, `translate`, `scale`, and `rotate` operations.
- Half-cage mirroring removes construction caps, welds center-plane vertices,
  and corrects mirrored face winding.
- The CLI validator and JSON Schema reject malformed cages, unsupported edit
  operations, missing selections, and unknown face tags.
- Added `polymesh-test.json` and a side-by-side segmented humanoid bust proof.
- Rebuilt the canonical segmented man and woman with directional polyMesh body
  cages and complete waist/head/shoulder/elbow/wrist/hip/knee/ankle chains.
- Added validated, reusable joint clips with degree-to-quaternion compilation,
  viewer playback, and GLTF/GLB animation export; the figures ship idle and
  walk cycles.
- Existing quality anchors remain structurally unchanged.

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
