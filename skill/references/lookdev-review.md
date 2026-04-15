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

## Hero-Shot Scene Recipes

Paste into `scene` as a starting point and tune from there. All three assume `quality: "high"`.

**Product shot** — clean studio, clear silhouette, controlled reflections:

```json
{
  "quality": "high",
  "background": { "type": "gradient", "color": "#2a2a32", "color2": "#0a0a0e" },
  "lighting": { "preset": "showcase", "environment": "studio", "envMapIntensity": 1.1, "shadowQuality": "high" },
  "ground": { "reflective": true },
  "exposure": 1.05,
  "toneMapping": "ACESFilmic",
  "postfx": {
    "ssao": { "enabled": true, "kernelRadius": 8, "minDistance": 0.003, "maxDistance": 0.12 },
    "bloom": { "enabled": true, "strength": 0.25, "radius": 0.3, "threshold": 0.92 },
    "colorGrade": { "enabled": true, "saturation": 1.0, "contrast": 1.06 },
    "fxaa": true
  }
}
```

**Cinematic** — moody, dramatic, high contrast:

```json
{
  "quality": "high",
  "background": { "type": "gradient", "color": "#1a1520", "color2": "#000000" },
  "lighting": { "preset": "dramatic", "environment": "night", "shadowQuality": "high" },
  "exposure": 0.9,
  "toneMapping": "ACESFilmic",
  "postfx": {
    "ssao": { "enabled": true },
    "bloom": { "enabled": true, "strength": 0.8, "threshold": 0.7 },
    "vignette": { "enabled": true, "intensity": 0.6 },
    "chromatic": { "enabled": true, "amount": 0.003 },
    "grain": { "enabled": true, "intensity": 0.08 },
    "colorGrade": { "enabled": true, "saturation": 0.85, "contrast": 1.1 },
    "fxaa": true
  }
}
```

**Architectural** — clean, bright, readable:

```json
{
  "quality": "high",
  "lighting": { "preset": "overcast", "environment": "outdoor", "envMapIntensity": 0.8, "shadowQuality": "high" },
  "exposure": 1.1,
  "toneMapping": "ACESFilmic",
  "postfx": {
    "ssao": { "enabled": true, "kernelRadius": 12 },
    "bloom": { "enabled": true, "strength": 0.2, "threshold": 0.95 },
    "fxaa": true
  }
}
```

Avoid DOF on product shots unless the aperture is very tight (`0.0003`) and `focus` is matched to camera distance; a mismatched DOF is what makes hero renders look blurry.

## First-Person Polaroid Capture

The runtime has a built-in photography mode that is separate from the preset sweep in `inspect-model.js`. Use it when the request calls for hand-framed shots (hero renders, README art, marketing captures) rather than programmatic coverage.

Workflow:

1. Switch the viewer into first-person mode and click into the scene to engage pointer-lock. Move with WASD plus mouse look.
2. Hold right mouse button to raise the viewfinder overlay. The viewfinder crops the final image to its bounds.
3. Scroll to resize the viewfinder (10 to 90 percent of viewport). Press `F` to toggle flash.
4. Release right mouse button to capture. The shot is cropped, stamped with a caption, appended to the polaroid strip, and copied to the clipboard.
5. Click `Export` on the polaroid strip to download the full roll as PNGs.

When to choose polaroid over `inspect-model.js`:

- You need a specific focal point or framing the preset cameras do not cover.
- The asset has interior spaces that only read from first-person.
- You want the "walked up and took a photo" look for marketing or README art.
- You want multiple angles on a single run with caption metadata baked in.

When to choose `inspect-model.js`:

- You need reproducible preset coverage for diagnosis or comparison.
- You want wireframe and design-grid variants for review.
- The task is automation (CI, batch renders, regression checks).

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
