# Worklog — quality-bar-rangefinder-camera

Spec: [`specs/quality-bar-rangefinder-camera.json`](../specs/quality-bar-rangefinder-camera.json) · Class: prop

## Target

> 1960s Leica M-style rangefinder: brass top plate over vulcanite leatherette body; multi-coated front lens with concentric multi-ring assembly; viewfinder/rangefinder windows on front; hot shoe, shutter dial, advance lever, frame counter, rewind crank on top; eyepiece/LCD/thumb rest on back. Wood-and-leather plinth with brass lip.

## Review — 2026-07-03 · score 86 · SHIP

Shots: `make review SPEC=specs/quality-bar-rangefinder-camera.json` (6 shaded + 2 wireframe). Graded per [docs/review-rubric.md](../docs/review-rubric.md).

| Dimension | w | Score | Note |
|---|---|---|---|
| Concept match | 0.25 | 87 | Unmistakably a vintage rangefinder camera. |
| Proportion & scale | 0.20 | 85 | Correct camera proportions on the plinth. |
| Feature completeness | 0.20 | 86 | Detailed concentric lens, brass top plate, top dials/hot shoe, front windows. |
| Silhouette & readability | 0.15 | 85 | Clean camera silhouette front/three-quarter/side. |
| Construction integrity | 0.10 | 84 | Solid lens assembly, grounded. |
| Material & colour | 0.10 | 84 | Black leatherette + brass + glass lens; brass reads as metal under IBL. |

**Formula:** 87&middot;.25 + 85&middot;.20 + 86&middot;.20 + 85&middot;.15 + 84&middot;.10 + 84&middot;.10 = **86**.

Anchor-grade. The lens is the hero — concentric brass rings, real glass. Body leatherette is fairly flat black but the form reads.

### Open fixes
- [ ] Optional: vulcanite texture on the body so the leatherette reads closer.
