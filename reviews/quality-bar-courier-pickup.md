# Worklog — quality-bar-courier-pickup

Spec: [`specs/quality-bar-courier-pickup.json`](../specs/quality-bar-courier-pickup.json)
Class: vehicle anchor.

## Target

> A compact courier pickup — the vehicle-class quality anchor. Two-tone utility body with an open cargo bed, a readable cabin interior (seats, dash, wheel), chrome lighting trim front and rear, glass with real transmission, rubber tires with hub detail. Two-tone paint separation and honest panel proportions over a boxy-but-deliberate silhouette. Reads immediately as a compact pickup a person uses.

Goal: **≥ 80** (anchor-grade). · **Status: SHIP at 80** (loop 4, 2026-07-03). Arc: 67 → 72 → 78 → 80.

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

## Review — 2026-07-03 (loop 2) · score 72 · REVISE

Executed the four fixes, re-shot, re-graded.

| Dim | 1 → 2 | Note |
|---|---|---|
| Concept match | 72 → 74 | Cleaner read from more angles. |
| Proportion & scale | 58 → **70** | Wheel track pulled in (`±1.0`→`±0.85`) — wheels no longer break the top/rear silhouette. Biggest gain. |
| Feature completeness | 74 → 76 | Bigger chrome rim face + brighter hub cap — helps, but see below. |
| Silhouette & readability | 65 → 70 | Top silhouette clean now; side a touch better with the taller greenhouse. |
| Construction integrity | 62 → **72** | Stage rotated 168° to match the truck — no longer crosswise/disconnected. |
| Material & colour | 68 → 70 | Tire lightened `#262b30`→`#3b4147`. |

**Formula:** 74·.25 + 70·.20 + 76·.20 + 70·.15 + 72·.10 + 70·.10 = **72** → still *revise* (target 80).

**What worked:** wheel track and stage alignment moved the two lowest dimensions up hard.
**What underdelivered:** the hub-detail fix. The wheels still read dark from every angle — a bigger chrome face wasn't enough against the near-black tire and the deep-set hub. Honest call: partial.

### Open fixes (loop 3)

- [x] wheel track in · [x] stage aligned · [x] greenhouse raised · [~] hub contrast (partial)
- [ ] **Hub still reads dark.** Try: lighter tire (`#4a5157`), a raised (proud) hub cap that catches light, and a visible lug pattern — or accept low-poly and move on.
- [ ] Front wheels sit slightly forward of the arch line — nudge `wheel_f* z` back ~0.1.
- [ ] Cab still a touch small vs the long bed — consider shortening the bed by ~0.2 rather than growing the cab.

*+5 in one loop. The structural fixes paid; the material one needs another pass. Loop again or ship at 72 as "good, not anchor-grade."*

---

## Review — 2026-07-03 (loop 3) · score 78 · REVISE (2 off ship)

Fixed the flagged hub, nudged the front wheels.

| Dim | 2 → 3 | Note |
|---|---|---|
| Concept match | 74 → 78 | Wheels read properly now; the truck is unambiguous from every angle. |
| Proportion & scale | 70 → 74 | Front wheels pulled back to the arch line (`z -1.62`→`-1.5`). |
| Feature completeness | 76 → **82** | **Hub detail now reads** — lighter tire `#4a5157`, lighter rim, a proud brighter hub cap, visible lug band. The prompt's "tires with hub detail" is satisfied. |
| Silhouette & readability | 70 → 76 | Defined wheels; clean from all six angles. |
| Construction integrity | 72 → 76 | Wheels at the arch line, stage aligned, grounded. |
| Material & colour | 70 → **78** | The wheels are no longer black voids. |

**Formula:** 78·.25 + 74·.20 + 82·.20 + 76·.15 + 76·.10 + 78·.10 = **78** → *revise*, 2 short of ship.

The hub fix that underdelivered in loop 2 landed here — making the hub *proud* (it catches light) plus lifting the tire out of near-black did it. A bigger flat chrome disc alone wasn't enough; depth was.

### Loop 4 (the last 2 points)

- [ ] **Cab-to-bed proportion** is the only dimension still under bar. The cab reads small against the long hood + bed in side profile. Shorten the bed ~0.2 (pull the rear in) rather than growing the cab — a compact pickup has a short bed. This should carry proportion 74→80 and cross the ship line.

*67 → 72 → 78 over three loops. One structural proportion pass left. The material and feature dimensions are now anchor-grade; the read is a real compact pickup.*

---

## Review — 2026-07-03 (loop 4) · score 80 · **SHIP**

Shortened the bed 0.2 (front fixed, rear + tailgate/bumper/plate/lights pulled in).

| Dim | 3 → 4 | Note |
|---|---|---|
| Concept match | 78 → 80 | Balanced compact pickup, unambiguous from every angle. |
| Proportion & scale | 74 → **80** | Bed shortened — cab no longer dwarfed by a long bed. The last dimension under bar, now at grade. |
| Feature completeness | 82 → 82 | Held. |
| Silhouette & readability | 76 → 80 | Balanced side profile; clean read. |
| Construction integrity | 76 → 78 | Grounded, aligned. |
| Material & colour | 78 → 78 | Held. |

**Formula:** 80·.25 + 80·.20 + 82·.20 + 80·.15 + 78·.10 + 78·.10 = **80** → **ship** (crosses the line).

### Arc

`67 → 72 → 78 → 80` over four loops. Revise, revise, revise, ship. Each loop the rubric named the lowest dimension and the fix moved it:

- L2: wheel track + stage → proportion 58→70, construction 62→72
- L3: proud hub + lighter wheel → feature 76→82, material 70→78
- L4: shorter bed → proportion 74→80

**The whole way, the golden fingerprint never moved — 46,904 tris across all four loops.** Every gain was position, colour, size, depth. `make golden` stayed green while the asset went from a squashed box on drums to a shippable compact pickup. Geometry gate blind; the review is the eye.

*Status: SHIP. Nothing open. Enhancements (fender flares, tow point) remain optional.*
