---
name: samdin
description: Use when generating, revising, validating, or inspecting Samdin JSON specs for props, vehicles, characters, foliage, architecture, and full scenes. Covers fast draft generation, production-quality hierarchy and lookdev, camera framing, animation-friendly joints, and screenshot-driven revision loops.
---

# Samdin

Samdin is a JSON-to-Three.js scene builder. Use this skill to create new specs, improve existing ones, and finish them through validation plus screenshot review instead of stopping at first-pass JSON.

## Runtime Truth

Treat the local runtime as source of truth when docs disagree. Check these in order:

- `CLAUDE.md`
- `cli/validate-spec.cjs`
- `src/js/builder.js`
- shipped `prefabs/*.json` and `specs/*.json`
- `README.md` and `docs/RELEASE_NOTES.md`

Current practical rules:

- Prefer parts-based specs for almost everything.
- Use top-level `type: "csg"` only when the asset is primarily boolean geometry.
- For repetition, use the **procedural modifiers** — `array` (scalar or grid `count: [x,y,z]`, a `path: [[x,y,z],...]` waypoint mode with tangent `orient`, and per-instance `jitter: {rotation, scale, offset, tone}` under a `seed`), `mirror` (`{x,y,z}` or `{axis:"xz"}`), and `scatter` (with a fixed `seed`). Documented in `docs/modifiers.md`; reach for them before hand-copying `name_1..name_N` parts. (There is no top-level `type: "procedural"`.)
- **Ground contact is solved, not guessed**: `snapToGround: true` on any part (plus `groundOffset`), and inside `scatter`/`array` for per-instance snapping onto the terrain drape. Never hand-tune y offsets against terrain again.
- **Deformers**: per-part `deform: {taper, twist, bend}` for gestural shapes (tree trunks, bent pipes, hull wedges). Needs along-axis resolution: `options.segments: [sx,sy,sz]` on box, `options.heightSegments` on cylinder/cone. See `specs/deform-test.json`.
- **Lofts are in-spec now**: `type: "loft"` with `loft: {stations, startPoint?, endPoint?, mirror?}` — the hullgen math as a standard part that composes with materials/breakup/terrain (see `specs/loft-test.json`, the whale). Use `cli/hullgen.mjs` only when you need gltf/--lua export output.
- **Poses**: spec-level `poses: {name: {joint: [rx,ry,rz]}}` + `pose` on the spec or a module/prefab placement (joints resolve with the placement prefix). Reference articulated figure: `specs/pose-test.json`.
- **Lookdev**: `edgeWear.mode: "curvature"` puts wear on real creases (lathes/lofts/CSG); `material.detail: {scale, amount}` adds UV-free triplanar noise on large faces.
- The runtime supports more than the older docs emphasize, including nested `children`, `pivot` or `options.pivot`, material breakup, `decals`, emissive strips, `wire-mesh`, the `scene.terrain` compositor, category-driven regions, and scene-owned camera/lookdev settings.
- The `animations` spec block exists but is unvalidated and unused by any shipped spec — treat as experimental; verify in the runtime before relying on it.
- Trust the actual `prefabs/` directory over hard-coded prefab counts in docs.

## Use This Skill For

- New props, vehicles, characters, foliage, architectural kits, or full scenes
- Quality upgrades on existing specs
- Hierarchy, articulation, scale, material, or framing fixes
- Validation, inspection, and export-ready cleanup

## Pick The Right Build Path

Use this default decision tree:

- Background prop or filler object: simple parts or an existing prefab
- Hero prop: parts-based assembly with stronger material breakup and a presentation `scene` block
- Vehicle or mechanical asset: parts-based assembly plus embedded CSG where cutouts, beams, brackets, or hollow sections matter
- Character or creature: parts-based joint chains, not modifiers
- Environment or room: scene root plus reusable modules, prefabs, and a full `scene` block; for large ground use the `scene.terrain` compositor (tag ground parts `category: "environment"`). **Scenes are concept-gated** — see "Scene Concept Gate" below before placing the first part.
- Terrain / landscape: `scene.terrain` block — `method` heightfield / marching-cubes / cloth-drape, `display` primitives|terrain|both. Normals flip by default now; only set `flipNormals: false` to opt out. See the four `specs/landscape-*.json` examples.
- Repeated architecture: module definitions first, then `type: "module"` placements; or an `array`/`scatter` modifier for grids and fields
- Repeated scatter (rocks, foliage, debris): a `scatter` modifier with a fixed `seed`
- Sculpted continuous hull (starfighters, sleek vehicles — the No Man's Sky chunky-lowpoly look): **do NOT kitbash primitives** — bolted boxes read as RC drones and were rejected on sight. Use in-spec `type: "loft"` parts when the result lives in a scene spec, or `cli/hullgen.mjs` + a `cli/ships/` def when you need gltf/--lua export (see "Procedural hulls" below)
- Broken existing spec: inspect first, then edit the failing hierarchy, scale, material, or camera

## Quality Modes

Match effort to the request:

- `draft`: silhouette first, cheap segment counts, minimal materials, no micro detail
- `standard`: default for most work; readable hierarchy, believable scale, breakup on primary non-emissive surfaces
- `high`: hero shots and portfolio work; richer breakup, stronger camera framing, cleaner asymmetry, denser secondary detail

If the user does not specify, default to `standard` — this now matches the runtime: the builder defaults to `standard`, and a spec's `scene.quality` is applied *before* geometry is built, so it takes effect on the first build (no longer dependent on session warmth). Pin `scene.quality: "high"` on hero specs so the inspect loop renders the tier you are judging.

## Core Workflow

1. Parse the request into asset type, viewing distance, style target, scale, motion needs, mood, and output goal.
2. Choose the cheapest valid strategy: prefab reuse, parts-based assembly, modules, embedded CSG, or top-level CSG.
3. Block primary forms first. Get silhouette, stance, and scale right before adding tertiary detail.
4. Build hierarchy around real attachment points rather than convenience.
5. Add material contrast and a `scene` block early enough to judge the asset in context.
6. Validate with `node cli/validate-spec.cjs <spec.json>`. Run `node cli/validate-spec.cjs --strict <spec.json>` (or `make lint`) to surface quality-rule gaps — missing scene block, metals without environment lighting, un-varied clones, floating geometry, preset typos.
7. Inspect with `node cli/inspect-model.js <spec.json> [out-dir] [port]` (out-dir defaults to `/tmp/samdin-inspect`; pass a `[port]` to run parallel inspections).
8. Probe with `node cli/probe.js <spec.json>` (`make probe SPEC=...`) — rendered-space lint: ground-contact gaps, near-black/blown effective albedo, clone-read families, crushed/blown luma. Fix errors before judging screenshots; its findings are machine-precise where eyeballing fails (it caught a hidden double-darkened plate no screenshot pass saw).
9. Revise from concrete screenshot + probe findings, not vague taste-only notes.
10. If you touch the builder or a shared primitive, run `make golden` — it fingerprint-checks the quality-bar anchors so a change can't silently move their geometry. Rebless intended changes with `make golden-update`.

## Scene Concept Gate

Scenes (showcase/environment/landscape specs — anything whose subject is a composition, not a single asset) do not start in JSON. hullgen proved this: ships get compared against a reference and converge; showcase-cove skipped it, steered by taste for ten rounds, and shipped a feature checklist instead of a composition. The gate:

1. **Concept image first.** Generate or obtain a reference image before modeling. Park it at `media/concepts/<scene>.png` with its prompt as `media/concepts/<scene>.prompt.txt` — the same convention ships use. No concept on disk → no scene build.
2. **Composition thumbnail before detail.** Block the scene as ≤10 mass primitives — ground, dominant masses, focal object, nothing else. Inspect it and judge the *layout* from all four sweep angles (threeQuarter/front/left/top): focal hierarchy, negative space, silhouette. Only when the blocked layout matches the concept's composition do you start detailing.
3. **Every review round opens with the concept.** The first question is "closer to or further from the concept?" — not "does it look good?". Findings that don't reference the concept or a probe/validator result are taste, and taste drifts.

This is a process gate, not a runtime feature: the validator cannot check it, so the review loop must. When revising an existing scene that has no concept image, backfill one first (render the current state, decide what the composition *should* be, write the prompt) — otherwise every revision is another taste iteration.

## Procedural Hulls (hullgen)

For sculpted continuous low-poly hulls. The same loft math is now a spec part type (`type: "loft"`, see Runtime Truth above) — prefer that inside scenes; hullgen remains the path to standalone `.gltf` output and the `--lua` arcwing emitter. Full schema + look rules: `docs/hullgen.md`. Reference ships: `cli/ships/arcwing-interceptor.json` (full anatomy), `cli/ships/arcwing-swarmling.json` (minimal — shows optional components).

- **Concept first.** Generate/obtain a concept image before modeling; park it in `media/concepts/` with its prompt as `*.prompt.txt`. Compare screenshots against the concept, not taste.
- Ship = JSON def: `palette` + optional lofted components (`fuselage` required; `wing`, `vtails`, `engines`, `canopy`, `navPods` optional). Anatomy varies per ship, generator code doesn't change.
- `node cli/hullgen.mjs` → `media/models/<name>-hull.gltf` (served at `/media/models/` in dev).
- Review loop: `app.loader.loadFromURL(url)` → `app.setModel(m)`. **setModel resets lookdev** — after every load re-drive the panel selects (`lighting-select`=showcase, `env-map-select`=studio, `shadow-quality`=high, each with a `change` event) or the model renders dark with shadow-acne moiré. Judge from threeQuarter/back/top/left, never one angle.
- Look rules: volume over plates; matte over chrome (metal ~0.2, rough ~0.5); recess emissive throats inside a rim (never glue glow blobs on); trim = narrow facet band, not a whole face; `canopy.material: "glow"` makes a monster eye instead of a cockpit.
- **Not just ships.** The `lofts` component is fully generic — arbitrary profile points along an arbitrary curved path — and works with NO other components. Creatures, boats, organic volumes: see `cli/ships/whale.json` (a humpback from four lofts + eye pods, 248 tris). Dividing line: assembled → spec kitbash; grown/sculpted → loft. Anchor rule applies doubly: fins/appendages must bury their root ring inside the parent volume or they float (side view catches it).

## Non-Negotiable Authoring Rules

- Keep dimensions believable. Work in meter-like proportions unless the user explicitly wants stylized scale.
- Start with one root group and name parts clearly enough for debugging and animation targeting.
- Parents must resolve cleanly. Use nested `children` when it improves local clarity, but keep the parent-child logic obvious.
- Use `pivot` or `options.pivot` for simple base or top pivots. Use dedicated joint groups for real hinges, lids, elbows, knees, doors, suspension, branch starts, and canopy tips.
- Child meshes should be offset away from their joint node. If a moving part swings from its middle, the hierarchy is wrong.
- Keep ground contact honest. Most planted assets should touch or slightly overlap the floor at `y = 0` — on terrain scenes use `snapToGround` instead of guessing offsets, and verify with `cli/probe.js`.
- Repetition needs variation. Use `array.jitter` / scatter `scaleVariation`+`randomRotation`; the probe's clone check flags families with zero variance.
- Use prefabs aggressively for background dressing and commodity objects. Spend custom detail budget where the camera will care.
- For symmetry, establish one side correctly, then mirror deliberately. Do not eyeball left and right independently.

## Material And Lookdev Rules

- Non-emissive primary surfaces at `standard` or `high` should usually get breakup. Minimum: `noise` plus `roughnessVariation`.
- Metals, glass, polished paint, and wet surfaces need environment lighting to read well. Set `scene.lighting.environment` and `envMapIntensity`.
- Emissive is a focal tool, not wallpaper. Prefer 1-3 controlled glow accents over large glowing surfaces.
- Adjacent surfaces should differ in at least one of color family, roughness, or metalness.
- Use decals, hazard stripes, panels, and emissive strips to communicate scale and function on industrial assets.
- Avoid flat monochrome materials unless the user explicitly wants toy-like or abstract styling.

## Scene And Camera Rules

- Every presentation-worthy asset should ship with a `scene` block unless it is purely a reusable prefab fragment.
- Use camera presets plus `distanceMultiplier`, `targetOffset`, or `positionOffset` instead of rescaling the asset to fake framing.
- Background, fog, exposure, and postfx should support the asset read, not bury it.
- For gameplay framing, optimize readability first. For hero shots, optimize silhouette, reflections, and depth cues.
- If the user says "first-person", "side view", "isometric", "turntable", or "hero shot", bake that into `scene.camera`.

## References

Load these only when relevant:

- Prompt translation and request parsing: [references/prompt-helpers.md](references/prompt-helpers.md)
- Modeling heuristics for props, vehicles, characters, environments, and foliage: [references/asset-playbooks.md](references/asset-playbooks.md)
- Lookdev, review loops, and common fix patterns: [references/lookdev-review.md](references/lookdev-review.md)
- Commands, runtime features, and source-of-truth files: [references/runtime-reference.md](references/runtime-reference.md)

## Good Delivery

A solid Samdin result usually includes:

- a saved JSON spec in `specs/` when creating a new asset or scene
- for scenes: a concept image in `media/concepts/` that the shipped composition was judged against
- believable scale and grounded hierarchy
- a `scene` block when presentation matters
- validation before handoff
- inspection screenshots before declaring quality issues solved
- a concise summary of what changed, what was validated, and any remaining risks
