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
- `js/builder.js`
- shipped `prefabs/*.json` and `specs/*.json`
- `README.md` and `docs/RELEASE_NOTES.md`

Current practical rules:

- Prefer parts-based specs for almost everything.
- Use top-level `type: "csg"` only when the asset is primarily boolean geometry.
- Treat procedural specs as experimental unless you verify them in the current runtime.
- The runtime supports more than the older docs emphasize, including nested `children`, `pivot` or `options.pivot`, material breakup, `decals`, emissive strips, `wire-mesh`, and scene-owned camera/lookdev settings.
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
- Character or creature: parts-based joint chains; do not default to procedural
- Environment or room: scene root plus reusable modules, prefabs, and a full `scene` block
- Repeated architecture: module definitions first, then `type: "module"` placements
- Broken existing spec: inspect first, then edit the failing hierarchy, scale, material, or camera

## Quality Modes

Match effort to the request:

- `draft`: silhouette first, cheap segment counts, minimal materials, no micro detail
- `standard`: default for most work; readable hierarchy, believable scale, breakup on primary non-emissive surfaces
- `high`: hero shots and portfolio work; richer breakup, stronger camera framing, cleaner asymmetry, denser secondary detail

If the user does not specify, default to `standard`.

## Core Workflow

1. Parse the request into asset type, viewing distance, style target, scale, motion needs, mood, and output goal.
2. Choose the cheapest valid strategy: prefab reuse, parts-based assembly, modules, embedded CSG, or top-level CSG.
3. Block primary forms first. Get silhouette, stance, and scale right before adding tertiary detail.
4. Build hierarchy around real attachment points rather than convenience.
5. Add material contrast and a `scene` block early enough to judge the asset in context.
6. Validate with `node cli/validate-spec.cjs <spec.json>`.
7. Inspect with `node cli/inspect-model.js <spec.json> [out-dir]`.
8. Revise from concrete screenshot findings, not vague taste-only notes.

## Non-Negotiable Authoring Rules

- Keep dimensions believable. Work in meter-like proportions unless the user explicitly wants stylized scale.
- Start with one root group and name parts clearly enough for debugging and animation targeting.
- Parents must resolve cleanly. Use nested `children` when it improves local clarity, but keep the parent-child logic obvious.
- Use `pivot` or `options.pivot` for simple base or top pivots. Use dedicated joint groups for real hinges, lids, elbows, knees, doors, suspension, branch starts, and canopy tips.
- Child meshes should be offset away from their joint node. If a moving part swings from its middle, the hierarchy is wrong.
- Keep ground contact honest. Most planted assets should touch or slightly overlap the floor at `y = 0`.
- Repetition needs variation. On arrays or modular placements, vary scale, rotation, tone, or dressing enough to avoid clone reads.
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
- believable scale and grounded hierarchy
- a `scene` block when presentation matters
- validation before handoff
- inspection screenshots before declaring quality issues solved
- a concise summary of what changed, what was validated, and any remaining risks
