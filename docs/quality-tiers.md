# Quality Tiers

One knob, three settings, set by `scene.quality`:

- `draft` — cheap segment counts. Silhouette only.
- `standard` — the default. Believable curves, breakup on primary surfaces.
- `high` — hero shots. Dense tessellation, sphere detail, portfolio finish.

The tier scales tessellation across the whole pipeline: cylinder/cone/torus/ring segments, sphere and platonic-solid subdivision, cables, and every curved CSG primitive (pipes, elbows, domes, gears). It never changes a shape's identity — a hexagonal prism stays six-sided, gear teeth stay counted, at every tier.

## Same spec, three tiers

Locked camera. Only `scene.quality` changes.

![Samdin quality tiers — the same CSG primitives at draft, standard, and high](../media/quality-tiers.png)

Read the dome's silhouette and the elbow: faceted at draft, smooth at high. Same JSON, 8,380 → 41,981 triangles.

## Rules

- The tier is applied **before** geometry is built. A spec's `scene.quality` takes effect on the first build — no dependence on session state.
- Default is `standard`. It matches the UI dropdown and the docs' breakup promises.
- Pin `high` on hero specs so the inspection loop renders the tier you are judging.
- Box-based shapes (beams, walls, plain boxes) have no segments to scale — the tier is a no-op for them, by design.

## Guarding it

`make golden` fingerprints the quality-bar anchors by triangle/vertex/object count. A builder change that silently moves an anchor's geometry fails CI. That is how the tier work above shipped with proof: the fix moved the primitives that should scale, and nothing else.
