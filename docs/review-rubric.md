# Review Rubric

How to grade a Samdin asset or scene against the prompt that created it. The judge is a vision model looking at the shot-set, not a script — this rubric makes that judgment repeatable and legible.

## Inputs

- The **prompt / target** (what the asset is supposed to be). Lives in the spec's worklog (`reviews/<name>.md`).
- The **shot-set**: `node cli/review-shots.js <spec>` renders six shaded angles (threeQuarter, front, left, back, top, lowAngle), two wireframes (threeQuarter, top), and model stats.
- The **grid** in each shot is a 1-unit reference. Use it for scale.

## Dimensions

Score each 0–100. Judge from *all* angles, not one.

| # | Dimension | What it measures | Weight |
|---|---|---|---|
| 1 | **Concept match** | Does it read as the thing the prompt asked for, at a glance? | 0.25 |
| 2 | **Proportion & scale** | Believable dimensions and relative sizes (a cab a person fits, a wheel that matches the body). Check against the grid. | 0.20 |
| 3 | **Feature completeness** | Are the features the prompt named present and correct, in the right place? | 0.20 |
| 4 | **Silhouette & readability** | Clean read from front / side / three-quarter. Distinct parts, no mush. | 0.15 |
| 5 | **Construction integrity** | From wireframe + all angles: no floating parts, no gross intersections, grounded, sensible structure. | 0.10 |
| 6 | **Material & colour** | Believable surface reads, palette, separation between adjacent surfaces. | 0.10 |

## Formula

```
score = round( Σ dᵢ · wᵢ )        dᵢ ∈ [0,100], Σ wᵢ = 1
```

**Hard floor:** if any single dimension < 40, the asset fails regardless of the total. A truck with no wheels does not pass on nice paint.

## Thresholds

| Score | Verdict | Action |
|---|---|---|
| ≥ 80 | **ship** | anchor-grade |
| 65–79 | **revise** | fix the lowest dimensions, re-review |
| 50–64 | **rework** | structural problems; targeted re-model |
| < 50 or any dim < 40 | **reject** | rebuild the failing subsystem |

## Below threshold → fixes

For every dimension under ~65, emit **concrete, spec-level** fixes — the part to change and the change, not "make it better". Pull from the playbook:

- **Proportion** — a volume reads wrong: name the part, give the new dimension against the grid (e.g. "cab greenhouse collapsed: drop `cab_lower` height 0.62→0.36, raise the roof, add pillars").
- **Feature missing/wrong** — add the part, or fix its placement/rotation (e.g. "gear teeth twist: rotation sign; wheel axle vertical: rotate module `[0,0,90]`").
- **Floating / ungrounded** — pin to `y=0`, tuck wheels into arches, connect the stage to the asset (`make lint` ground-contact catches gross cases).
- **Silhouette mush** — separate adjacent surfaces by colour/roughness; add the panel seam / trim that defines the form.
- **Scale** — resize against real-world reference: human ~1.7m, door ~2m, car ~4.5m, wheel ~0.65m.

Write the fixes into the worklog as an ordered checklist. Then execute, re-shoot, re-grade — the loop, not one pass.

## Scene rubric

The dimensions above grade an *asset*. A scene can score well on every one of them and still be a feature checklist instead of a composition — showcase-cove shipped exactly that way: every machine gate green, nobody scoring the picture. Scenes (showcase/environment/landscape specs — anything whose subject is a composition) are graded on their own dimensions:

| # | Dimension | What it measures | Weight |
|---|---|---|---|
| 1 | **Concept match** | Does the render read as the concept image (`media/concepts/<scene>.png`, per the concept gate)? Composition, mood, and subject — not pixel identity. | 0.25 |
| 2 | **Composition** | Focal hierarchy (one clear subject, supporting elements, filler), negative space, eye-path. A scene where everything shouts is a 40. | 0.25 |
| 3 | **Silhouette & massing** | Per sweep angle: do the major masses read as deliberate shapes? Skyline/coastline profile, no accidental mush between masses. | 0.15 |
| 4 | **Terrain believability** | Ground reads as one continuous believable surface: drape follows the forms, shorelines/transitions read natural, no seams, floating edges, or inside-out normals. | 0.15 |
| 5 | **Palette cohesion** | The scene shares one light and one palette. Props that ignore the scene's color temperature read pasted-in. | 0.10 |
| 6 | **Read-distance clarity** | Backed off to gameplay/thumbnail distance: does the scene still read? Focal point findable in under a second. | 0.10 |

Same formula, same hard floor (< 40 on any dimension fails), same thresholds and verdicts as the asset rubric. Scoreboard dims for scenes: `concept, composition, silhouette, terrain, palette, clarity`.

Judging inputs differ in one way: the concept image is primary. Grade dimension 1 against `media/concepts/<scene>.png`; if no concept exists, say so in the review — per the concept gate (skill), a scene without a reference is not reviewable, only backfillable. Probe findings (`cli/probe.js`) are evidence for dimensions 3–4: overlap and contact findings are construction defects at scene scale.

### Scene fixes below threshold

- **Composition** — name the mass to move/cut and where the negative space goes ("hut competes with boat: pull hut to [-6, 0, -2], let the bay own the right half").
- **Silhouette** — name the angle that fails and the mass change ("back sweep is a flat wall: vary dune heights 1.2/0.7/1.6").
- **Terrain** — level, bounds, resolution, smoothing, or water changes, with numbers ("shoreline stair-steps: water.resolution 96→160").
- **Palette** — name the offending materials and the target family ("crate #8a6f4d fights the dusk palette: shift toward #6d5a48").
- **Clarity** — one dominant read cue ("add the campfire glow as the single warm accent; kill the three competing emissives").

## Worklog

Every reviewed spec gets `reviews/<name>.md`: the target prompt, a dated review log (score + per-dimension breakdown + findings), and the open fix list. It is the memory that drives the next iteration — read it before touching the spec, update it after.
