# Lookdev And Review

Use this file when the task is about presentation quality, camera framing, or diagnosing why a model still looks wrong.

## Quick Lookdev Defaults

- Product or hero prop: `scene.quality = "high"`, studio or showcase lighting, controlled reflective ground, restrained bloom
- Gameplay or readable scene: `scene.quality = "standard"`, clear camera framing, moderate fog, minimal postfx
- Clean interior: bright exposure, soft reflections, low grime, gentle bloom only where lighting is designed to glow
- Industrial or ruin: stronger value contrast, grime plus edge wear, decals, focused emissives, visible atmospheric depth

## Material Review Rules

- Primary non-emissive surfaces at `standard` or `high` should rarely stay perfectly flat.
- Glass needs transmission plus environment reflections or it will read as dull plastic.
- Painted metal benefits from clearcoat-like behavior, breakup, and value variation around edges.
- Foliage should not share the exact same green across every cluster.
- If two neighboring surfaces blend together, separate them with color, roughness, or metalness before adding geometry.

## Inspection Workflow

1. `node cli/validate-spec.cjs <spec.json>`
2. `node cli/inspect-model.js <spec.json> [out-dir]`
3. Review `*-specCamera.png`, preset views, wireframes, and design-grid views
4. Fix the concrete issue
5. Re-inspect if the change affects silhouette, hierarchy, or camera read

## Common Symptoms

- Asset floats above ground: base transforms or pivots are wrong
- Parts intersect where they should hinge: joint group is missing or misplaced
- Arms, lids, doors, or branches swing from the middle: rotating mesh geometry instead of a joint node
- Asset looks flat: poor material contrast, no breakup, or weak scene lighting
- Asset looks noisy: too many tiny parts before the primary silhouette is solved
- Vehicle looks toy-like unintentionally: wheel diameter, ride height, glazing, or body proportions are off
- Character feels stiff: rest pose, weight distribution, or joint offsets are too symmetrical and straight
- Tree reads as a blob: canopy mass is centralized instead of distributed on branch tips
- Environment feels empty: no foreground anchors, no repeated module rhythm, or no secondary props
- Industrial scene feels fake: no scale cues, no grime logic, and no separation between structural and functional parts

## Finish Checklist

- silhouette reads from front, side, and three-quarter views
- scale feels believable against known objects
- ground contact is intentional
- left and right relationships are coherent
- material families are distinct
- emissive accents have a reason
- camera framing matches the request
- validation passes
- inspection images support the claimed fix
