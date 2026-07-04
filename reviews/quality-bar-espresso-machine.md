# Worklog — quality-bar-espresso-machine

Spec: [`specs/quality-bar-espresso-machine.json`](../specs/quality-bar-espresso-machine.json) · Class: prop

## Target

> Prosumer single-boiler E61 espresso machine: mirror-polished chrome shell, brass front fascia, group head with locked portafilter (walnut handle, twin spouts), pressure gauge, green READY + red power LEDs, rocker switch, brass top warming plate, chrome steam wand + wood knob, chrome hot-water spout + wood knob, slatted drip tray, demitasse cup. Active state.

## Review — 2026-07-03 · score 79 · REVISE

Shots: `make review SPEC=specs/quality-bar-espresso-machine.json` (6 shaded + 2 wireframe). Graded per [docs/review-rubric.md](../docs/review-rubric.md).

| Dimension | w | Score | Note |
|---|---|---|---|
| Concept match | 0.25 | 78 | Reads as an espresso machine from the front; a plain tall box from the sides. |
| Proportion & scale | 0.20 | 76 | Tall monolithic slab — less machine-like in the round. |
| Feature completeness | 0.20 | 84 | Front is rich: gauge, group head, portafilter, lit LED, fascia, drip tray. |
| Silhouette & readability | 0.15 | 74 | Front strong; sides and back are featureless chrome slabs. |
| Construction integrity | 0.10 | 82 | Solid internals, grounded; side wand/spout are thin stubs. |
| Material & colour | 0.10 | 84 | Mirror chrome (IBL) + brass fascia + walnut. Good. |

**Formula:** 78&middot;.25 + 76&middot;.20 + 84&middot;.20 + 74&middot;.15 + 82&middot;.10 + 84&middot;.10 = **79**.

The one anchor the multi-angle review docks below ship. The front is genuinely anchor-grade — but the sides and back are bare chrome slabs and the body is a tall monolith. A single front three-quarter (what it last shipped on) hid that.

### Open fixes
- [ ] Break up the side/back slabs: portafilter well, a side panel seam, feet, a rear boiler bulge — anything so the sides read as a machine, not a fridge.
- [ ] Widen/shorten the body a touch; the monolith proportion reads slab-like.
- [ ] Make the steam wand + hot-water spout read as real arms, not thin stubs.

---

## Review — 2026-07-03 (loop 2) · score 81 · SHIP

Widened the body 1.16→1.32 and added recessed dark side panels + vent slots.

| Dim | 1 → 2 | Note |
|---|---|---|
| Concept match | 78 → 80 | Wider body reads as a proper machine, not a narrow monolith. |
| Proportion & scale | 76 → **80** | The widen is the lever — the slab-tall read is gone. |
| Feature completeness | 84 → 84 | Held; side vents add a little. |
| Silhouette & readability | 74 → 77 | Three-quarter / low-angle much better; the **pure side and back are still the weakest** — flat dark panels get eaten by the reflective chrome. Partial. |
| Construction integrity | 82 → 82 | Solid, grounded. |
| Material & colour | 84 → 84 | Chrome + brass + walnut held. |

**Formula:** 80·.25 + 80·.20 + 84·.20 + 77·.15 + 82·.10 + 84·.10 = **81** → ship.

**What worked:** widening the body killed the monolith proportion — the single biggest lever. **What underdelivered:** flat side panels on mirror chrome don't read; the pure side still wants *geometry* (a boiler bulge that breaks the silhouette), not a painted panel. Crossed the bar at 81; the boiler is a noted enhancement, not a blocker.

### Enhancement (beyond ship)
- [ ] A boiler cylinder poking out the upper side would break the side slab with real geometry — the one thing flat panels can't do against chrome.

---

## Review — 2026-07-04 (adversarial multi-angle) · score 66 · REVISE

Full 6-shaded + 2-wireframe sweep, graded from every angle — not the hero. The prior 81/ship was a front-three-quarter read; the round tells a worse story. Two hard construction defects the front hides: the steam wand / hot-water wand are **floating detached fragments**, and the demitasse cup is **stranded ~0.45u below and behind the spouts**.

| Dimension | w | Score | Note |
|---|---|---|---|
| Concept match | 0.25 | 68 | Front reads espresso machine, but group head sits dead-centre (real E61 is lower-third), cup disconnected from spouts, brass fascia reads black, wands are toothpick stubs. |
| Proportion & scale | 0.20 | 58 | body_shell 1.32w × 1.95h × 1.18d = a ~2-unit fridge; deep cube; group head too high leaves the entire lower front dead. |
| Feature completeness | 0.20 | 80 | Every prompt feature is present — gauge, group, twin-spout walnut portafilter, both LEDs, rocker, top warming plate, both wands+knobs, tray, cup. Defects are placement, not absence. |
| Silhouette & readability | 0.15 | 60 | Front upper only. Sides + back are bare chrome slabs; lower front is empty; wand fragments read as floating noise, not silhouette. 4 of 6 angles are a plain box. |
| Construction integrity | 0.10 | 52 | Steam wand arm_a/arm_b/tip march off the right side detached from the pivot collar; knob spheres hover off both flanks (back/left/front). Cup floats far from where coffee exits. |
| Material & colour | 0.10 | 68 | Chrome + walnut + top brass good, but the headline **brass front fascia reads as a black hole** in every front angle; shell blows to pure white in back/top under bloom. |

**Formula:** 68·.25 + 58·.20 + 80·.20 + 60·.15 + 52·.10 + 68·.10 = **66** → revise. No hard floor (lowest dim = construction 52).

### Findings (worst first)
1. **[construction] Floating wands.** `steam_wand_arm_a` (x0.78) / `arm_b` (x0.92) / `steam_wand_tip` (x0.985) step off the right flank disconnected from `steam_wand_pivot_collar` (x0.6) — visible as detached specks in shaded-front (right) and shaded-back (left, mirrored). `steam_knob`/`water_knob` spheres hover off the sides in shaded-left. Water spout same on the left flank.
2. **[construction/concept] Cup stranded.** Spouts land at ~y0.82 / z0.85; `demitasse_cup` sits at y0.37 / z0.42 — 0.45u down and 0.43u back. In "active state" the pour falls into empty air; cup is invisible from the front (buried low behind the front plane). Seen in wire-threeQuarter + shaded-lowAngle.
3. **[proportion] Group head too high, dead lower front.** Group at y1.05 on a 1.98-tall body = dead centre; the entire lower half of the front is blank chrome down to a thin grille. Seen in shaded-front, shaded-lowAngle.
4. **[proportion] Fridge scale.** ~2u tall, 1.18u deep — a deep monolith. Real home machine ~0.35m tall, deeper-than-wide. Seen every angle.
5. **[material] Brass fascia reads black.** `front_brass_plate` is only lit by the group glow; SSAO + surround-chrome shadow it to a near-black inset — the opposite of "brass front fascia." Seen in shaded-front, shaded-threeQuarter.
6. **[silhouette] Bare side/back slabs.** side_panel + 3 vent slits don't survive against mirror chrome; back is featureless. Seen in shaded-left, shaded-back.

### Refreshed fix list
- [ ] **Weld the wands.** Rebuild steam wand as a continuous chain anchored at `steam_wand_pivot_collar`: pull `steam_wand_arm_a` in so it starts at the collar face (no x0.6→0.78 gap), chain arm_b + tip end-to-end. Same for `water_spout`. Ensure `steam_knob`/`water_knob` stems visibly bridge sphere→body. Zero gaps.
- [ ] **Cup under the spouts.** Move `demitasse_saucer/cup/coffee/crema/handle` to z≈0.85, y≈0.44 (rim just under spouts at y0.58 after the group drop) so the pour lands in the cup.
- [ ] **Drop the group head ~0.33.** Move `group_head_*` + `portafilter_assembly` from y1.05 → ~y0.72 into the lower third; keep gauge/LEDs up top. Fills the dead lower front.
- [ ] **De-fridge the body.** Reduce `body_shell` height 1.95→~1.5 and depth 1.18→~0.92 (keep width ~1.32); reposition top plate/gauge/seams to match. Or scale `machine_root` to a believable footprint.
- [ ] **Make the brass read.** Raise `front_brass_plate` envMapIntensity + add a small fascia fill light (or lift its base value); it must read brass, not a black hole.
- [ ] **Give the sides geometry.** Boiler cylinder bulge on the upper flank + a rear plumbing/boss so side and back silhouettes aren't plain rectangles (the long-standing enhancement — now a blocker for the multi-angle grade).
- [ ] **Tame bloom clip.** Lower bloom strength or shell envMapIntensity so back/top don't blow to pure white and lose form.

---

## Review — 2026-07-04 (re-grade after fix pass) · score 68 · REVISE

Fresh 6-shaded + 2-wireframe sweep, verified from every angle. Two of the six prior fixes landed; the two structural ones did not.

| Dimension | w | 66 → 68 | Note |
|---|---|---|---|
| Concept match | 0.25 | 68 → 70 | Front reads E61 clearly; brass now lit (not black). But group head dead-centre on a 2u body leaves the whole lower front blank, cup marooned at the base, sides/back are a fridge. |
| Proportion & scale | 0.20 | 58 → **57** | Unchanged: body_shell 1.32w × 1.95h × 1.18d = ~2u-tall deep monolith. De-fridge never applied. Group head at mid-body → dead lower half. |
| Feature completeness | 0.20 | 80 → 80 | All named features present. Wands now welded but buried against the side, so they barely read. Placement, not absence. |
| Silhouette & readability | 0.15 | 60 → 60 | Front upper only. Left + back + most of top are a plain tall rectangle; lower front blank; wands don't project past the shell. |
| Construction integrity | 0.10 | 52 → **74** | **Big win.** Wands welded to their collars — no floating specks anymore. Grounded, solid. Remaining nit: wood knobs (x±0.6) sit inside the 0.66 half-width, intersecting the shell; cup-to-spout is a logical gap, not a physical float. |
| Material & colour | 0.10 | 68 → 68 | Brass fascia now reads (lit orange). But top warming plate reads white-chrome not brass; back/top still blow to pure white under bloom; fascia reads hot-orange more than brushed brass. |

**Formula:** 70·.25 + 57·.20 + 80·.20 + 60·.15 + 74·.10 + 68·.10 = **68** → revise. No hard floor (lowest = proportion 57).

### Fix verification (did the claimed fixes land?)
- **Floating wands → WELDED. ✔** `steam_wand`/`water_wand` groups now sit on their pivot collars (steam group [0.62,1.18,0.30] vs collar [0.6,…]); arm chains anchor at the collar face. No detached specks in any angle. Construction jumped 52→74. *But* both wands sit at x±0.6 / z0.30 — tucked inside the shell half-width and mid-depth, so they hug the side and barely project. They read as stubs against chrome, not steam/water arms reaching down toward the tray.
- **Cup under the spouts → NOT LANDED.** Cup moved forward (z0.42→0.80) so it's now roughly under the spout line horizontally, but y is unchanged (0.366) and the group head was **not** dropped (still y1.05). Spouts land ~y0.815, cup rim ~y0.44 — a ~0.37u vertical void. In shaded-front, shaded-lowAngle and wire-threeQuarter the pour would fall into empty chrome; cup is marooned on the base tray far below the portafilter. This is the headline remaining defect.
- **Brass fascia → READS NOW. ✔** `front_brass_plate` lit by the group glow + emissive 0.14 reads warm orange in shaded-front / threeQuarter — no longer a black inset. Slightly *over*-hot (reads backlit-orange rather than brushed brass), but the black-hole defect is gone.

### Findings (worst first)
1. **[proportion/concept] Still a 2u fridge with a dead lower front.** `body_shell` 1.95 tall × 1.18 deep, group head at y1.05 = dead centre. Whole lower half of the front is blank chrome down to the tray. Seen in shaded-front, shaded-lowAngle, wire-threeQuarter. The single biggest unmoved lever.
2. **[concept/construction] Cup stranded ~0.37u below the spouts.** Horizontally aligned now but vertically marooned on the base tray; the "active" pour lands in air. Seen in shaded-front, shaded-lowAngle, wire-threeQuarter.
3. **[silhouette] Left/back/top are a plain tall rectangle.** Side panels + vents eaten by mirror chrome; no boiler bulge or rear plumbing to break the slab. Seen in shaded-left, shaded-back.
4. **[feature/silhouette] Wands buried against the side.** Welded but tucked inside the half-width at mid-depth; they don't project or reach down. Barely visible in shaded-front/left. Seen in shaded-left, wire-threeQuarter.
5. **[material] Top warming plate reads white, not brass.** `warming_plate_well` (#a8804a) blows to light chrome under the env map; only the thin rails read gold. Seen in shaded-top.
6. **[material] Back/top blow to pure white.** Bloom + shell envMapIntensity 2.6 clip the rear/top to featureless white. Seen in shaded-back, shaded-top.

### Refreshed fix list (ordered by leverage)
- [ ] **De-fridge the body — the top lever.** `body_shell` 1.95→~1.45 tall, 1.18→~0.95 deep (keep width ~1.32). Reposition top plate / gauge / seams / feet to match. This alone lifts proportion + silhouette + concept.
- [ ] **Drop the group head into the lower third + lift the cup to meet it.** Move `group_head_*` + `portafilter_assembly` y1.05→~0.74; raise `demitasse_*` y0.366→~0.50 so rim sits ~0.10 under the spouts. Kill the void; make the pour land in the cup.
- [ ] **Push the wands out and down.** Move `steam_wand`/`water_wand` collars to x±0.70 (clear of the 0.66 shell), keep z toward the front (~0.45), lengthen/steepen so the tip drops toward tray height. Pull knobs to x±0.70 so their spheres clear the shell instead of intersecting it.
- [ ] **Break the side/back slab with geometry.** Add a boiler cylinder bulge on an upper flank + a rear plumbing boss so left/back/top aren't bare rectangles (flat panels don't survive against chrome — needs real silhouette).
- [ ] **Make the top plate read brass.** Lower `warming_plate_well` roughness/raise its base value or drop shell/plate envMapIntensity so #a8804a reads brass, not white chrome.
- [ ] **Tame the bloom clip.** Reduce bloom strength (0.18) or shell envMapIntensity (2.6) so back/top hold form instead of blowing to white.
- [ ] **Cool the fascia a touch.** Trim `front_brass_plate` emissiveIntensity (0.14) / the group inner-glow spill so it reads brushed brass rather than backlit orange.
