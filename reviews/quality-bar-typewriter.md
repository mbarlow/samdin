# Worklog — quality-bar-typewriter

Spec: [`specs/quality-bar-typewriter.json`](../specs/quality-bar-typewriter.json) · Class: prop

## Target

> 1963 Olivetti Lettera 32 portable typewriter in signal blue, mid-typing with paper in the carriage. CSG-carved wedge chassis, three chrome front plates, dense round cream keycaps (four rows + spacebar/shift/tab/return), carriage with black platen, wood knobs, paper rest, ribbon spools, chrome return lever.

## Review — 2026-07-03 · score 84 · SHIP

Shots: `make review SPEC=specs/quality-bar-typewriter.json` (6 shaded + 2 wireframe). Graded per [docs/review-rubric.md](../docs/review-rubric.md).

| Dimension | w | Score | Note |
|---|---|---|---|
| Concept match | 0.25 | 85 | Reads as a signal-blue portable typewriter (side/back/wireframe). |
| Proportion & scale | 0.20 | 84 | Correct low wedge portable proportions. |
| Feature completeness | 0.20 | 86 | Dense keycap array, carriage, platen, paper, blue body. |
| Silhouette & readability | 0.15 | 82 | Low wedge reads cleanly from front and side. |
| Construction integrity | 0.10 | 82 | Wireframe shows dense keys, carriage, platen — solid, grounded. |
| Material & colour | 0.10 | 84 | Signal blue + cream keys + dark platen + paper. Good separation. |

**Formula:** 85&middot;.25 + 84&middot;.20 + 86&middot;.20 + 82&middot;.15 + 82&middot;.10 + 84&middot;.10 = **84**.

A competent portable typewriter, cool-palette as intended — clean keycap array, carriage, front chrome plate. The front/three-quarter frames initially rendered black (a review-shots near-plane-clip bug, #57, now fixed via camera dolly-out); re-rendered clean and re-confirmed.

### Open fixes
- none (model reads clean at all angles)
