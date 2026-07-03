# Worklog — quality-bar-courier-pickup

Spec: [`specs/quality-bar-courier-pickup.json`](../specs/quality-bar-courier-pickup.json)
Class: vehicle anchor.

## Target

> A compact courier pickup — the vehicle-class quality anchor. Two-tone utility body with an open cargo bed, a readable cabin interior (seats, dash, wheel), chrome lighting trim front and rear, glass with real transmission, rubber tires with hub detail. Two-tone paint separation and honest panel proportions over a boxy-but-deliberate silhouette. Reads immediately as a compact pickup a person uses.

Goal: **≥ 80** (anchor-grade).

---

## Review — 2026-07-03 · score 67 · REVISE

Shots: `make review SPEC=specs/quality-bar-courier-pickup.json` (6 shaded + 2 wireframe). Graded per [docs/review-rubric.md](../docs/review-rubric.md).

| Dim | Score | Note |
|---|---|---|
| Concept match | 72 | Reads as a compact pickup from three-quarter/front. Side profile is where it wobbles. |
| Proportion & scale | 58 | **Wheels sit outboard of the body** (top + rear views: tires poke past the sides). Cab reads small against the long bed in side profile. |
| Feature completeness | 74 | Two-tone ✓, open bed ✓, cabin interior ✓, glass ✓, front lights ✓. **Hub detail barely reads** — prompt asked for it. |
| Silhouette & readability | 65 | Clean front/three-quarter; awkward small-cab-long-body side read; wheels break the top silhouette. |
| Construction integrity | 62 | Wireframe solid, no floaters in the truck. **Display stage sits axis-aligned while the truck is rotated 168°** — disconnected. Wheels outboard. |
| Material & colour | 68 | Good two-tone separation. **Tires/rims near-black** — no rim/hub contrast. |

**Formula:** 72·.25 + 58·.20 + 74·.20 + 65·.15 + 62·.10 + 68·.10 = **67** → *revise* (no dim < 40, no hard fail).

**What multi-angle caught that the single shot didn't:** the wheels-outboard and the small-cab side proportion are invisible from three-quarter alone. The threeQuarter this spec last shipped on looked "done."

### Open fixes (ordered, execute then re-review)

- [ ] **Pull the wheel track in.** Wheel instances x `±1.0` → `±0.86` so tires tuck under the body instead of past it. Re-check top + rear.
- [ ] **Wheel hub/rim contrast.** The rubber is `#262b30` and the chrome rim never reads. Lighten the rim face or add a brighter hub cap so "hub detail" is visible.
- [ ] **Grow the cab a touch** in side profile — a slightly taller/longer greenhouse balances the long bed. Re-check `left`/`right`.
- [ ] **Align the stage.** `display_base` is axis-aligned; the truck is rotated 168°. Rotate the stage to match, or drop it.

### Enhancements (beyond the bar)

- Wheel-arch flares / fender lips to seat the wheels visually.
- A hint of front bumper + tow point for utility read.

---

*Next: execute the fixes, `make review` again, re-grade toward 80.*
