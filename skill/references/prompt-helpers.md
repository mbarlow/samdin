# Prompt Helpers

Use this file when translating an art-direction request into a concrete Samdin build plan.

## Parse Every Request Into

- deliverable: prop, vehicle, character, foliage, environment, kit piece, or scene
- priority: speed, quality, realism, stylization, or export readiness
- viewing distance: close hero, mid-shot, gameplay, background
- scale: real-world, miniature, oversized, or stylized
- motion: static, hinged, animated, or first-person framing
- mood: clean, industrial, moody, cozy, clinical, ruin, toy-like, etc.
- constraints: triangle budget, reuse, symmetry, deadline, existing spec, or required prefab

## Language Translation Shortcuts

- "blockout", "rough in", "layout only", "prototype": use `draft`, primitives first, skip micro detail
- "production", "ship it", "final pass": use `standard` or `high`, validate and inspect before handoff
- "hero", "portfolio", "marketing render", "beauty shot": use `high`, strong `scene` block, better breakup, controlled postfx
- "game prop", "gameplay readable": prioritize silhouette and scale over tiny detail; keep materials restrained
- "background prop": use the cheapest readable solution; prefer prefab reuse
- "modular", "kitbash", "tileable set": define bay width, spacing, and module rules before set dressing
- "animation-friendly", "riggable", "articulated": use joint groups and clean parent chains; never rotate centered meshes for hinges
- "realistic", "grounded": measure proportions, add breakup, reduce perfect symmetry, keep glow restrained
- "stylized", "toy-like": simplify form language, exaggerate proportions, use bolder color blocking, reduce surface noise
- "clean sci-fi": larger clean panels, limited grime, purposeful emissives, tighter color palette
- "industrial", "factory", "ruin": beams, channels, pipe runs, panels, decals, grime, worn edges
- "organic", "natural", "living": taper, asymmetry, branch logic, clustered masses, fewer hard straight lines
- "first-person": place key foreground parts close to camera and tune `scene.camera` for player framing

## Build Strategy By Request Type

- New asset from scratch: plan silhouette, hierarchy, and material families before writing JSON
- Existing spec is "wrong": inspect first, identify the concrete failure, then patch only the responsible hierarchy or material
- Fast variant request: reuse the existing spec structure and swap proportions, colors, details, or scene mood
- Environment request: lock the walkable plane, focal direction, and module dimensions before prop dressing

## Response Pattern

For a new asset or scene:

1. State the chosen build strategy in one or two sentences.
2. Write the spec.
3. Validate it.
4. Inspect it if quality matters.
5. Report what was built, what was checked, and what still needs eyes-on review.

For a repair task:

1. Name the visible symptom.
2. Explain the likely structural cause.
3. Patch the specific hierarchy, transform, material, or camera issue.
4. Re-run validation or inspection when possible.

## Fast Quality Upgrades

If the user wants "better quality" without a full redesign, spend effort in this order:

1. silhouette and proportion
2. hierarchy and grounding
3. material contrast and breakup
4. camera and scene framing
5. secondary props and decals
6. postfx polish
