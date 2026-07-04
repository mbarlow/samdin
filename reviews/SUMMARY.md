# Anchor review scoreboard

All seven quality-bar anchors, graded from the render against their prompts ([rubric](../docs/review-rubric.md)). 2026-07-03.

| Anchor | Score | Verdict | Read |
|---|---|---|---|
| anglepoise-lamp | **88** | ship | Strongest. Active bulb glow + articulated pose sell a genuinely lit lamp. |
| field-radio | **86** | ship | Every named feature reads; glowing amber dial. Antenna thin, back plain. |
| rangefinder-camera | **86** | ship | Concentric brass lens is the hero; body leatherette a bit flat. |
| typewriter | **84** | ship | Signal-blue portable; clean keycap array + carriage. |
| courier-pickup | **80** | ship | Reached 80 over four review loops (67 → 72 → 78 → 80). |
| minidisc | **80** | ship | Faithful but simple flat object; low silhouette by nature. |
| espresso-machine | **81** | ship | Widened the body (killed the monolith); side vents help. Pure side still wants a boiler bulge. |

## What the sweep found that a single shot wouldn't

- **espresso-machine** looks hero-grade from the front and it has *always* been shown from the front three-quarter. The multi-angle sweep is the first thing to see that its sides and back are featureless slabs — that's why it lands at 79. One fix (break up the side panels) crosses it.
- **courier-pickup** was the reason this system exists: it passed every geometry check as a squashed box on drums. Four review loops walked it to ship.
- The rest hold up — the original anchors are genuinely good, and the rubric agrees (84–88), which is the calibration check: it discriminates rather than rubber-stamping.

## Open

- Enhancements per anchor live in each `reviews/quality-bar-*.md`.
