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
