# Modifiers & Part Properties

## Procedural modifiers

Modifiers can be written either on the part directly (`array`, `mirror`, `scatter`) or under `modifiers`.

### Array modifier

Duplicate parts in a pattern:

```json
{
  "name": "fence_post",
  "type": "cylinder",
  "params": [0.05, 0.05, 1, 6],
  "modifiers": {
    "array": { "count": 10, "offset": [0.5, 0, 0] }
  }
}
```

`count` may also be an `[x, y, z]` array for a 3D grid. Each axis steps by the matching component of `offset` (missing dimensions default to `1`):

```json
{
  "modifiers": {
    "array": { "count": [4, 1, 3], "offset": [1, 0, 1.5] }
  }
}
```

**Per-instance jitter** — seeded variation so array clones don't read as clones. Deterministic under `seed` (default `1`):

```json
{
  "modifiers": {
    "array": {
      "count": [3, 1, 2], "offset": [0.92, 0, 0.94],
      "jitter": { "rotation": [0, 15, 0], "scale": 0.12, "offset": [0.05, 0, 0.05], "tone": 0.1 },
      "seed": 7
    }
  }
}
```

`rotation` = ± degrees per axis, `scale` = ± uniform fraction, `offset` = ± meters per axis, `tone` = ± fractional color lighten/darken (needs a plain `material.color`).

**Array along a path** — instead of `offset`, give waypoints; instances are sampled along a Catmull-Rom curve through them. `orient: true` (default) yaws each instance so its +Z faces along the local tangent:

```json
{
  "modifiers": {
    "array": {
      "path": [[-6.5, 0, 4.2], [-3, 0, 2.6], [0.5, 0, 3.4], [3.8, 0, 2.2]],
      "count": 10,
      "orient": true,
      "snapToGround": true
    }
  }
}
```

### Mirror modifier

Mirror across axes:

```json
{
  "modifiers": {
    "mirror": { "x": true, "y": false, "z": false }
  }
}
```

You can also give the axes as a string under `axis`. Multiple letters mirror across each and generate all combinations (`"xz"` yields the X, Z, and XZ mirrors):

```json
{
  "modifiers": {
    "mirror": { "axis": "xz" }
  }
}
```

### Scatter modifier

Random distribution:

```json
{
  "modifiers": {
    "scatter": { "count": 20, "radius": 5, "randomRotation": true }
  }
}
```

Scatter fields:

| Field | Type | Description |
|-------|------|-------------|
| `count` | number | How many copies (default `5`) |
| `radius` | number | Circular spread around `center` in X/Z |
| `center` | `[x, y, z]` | Center of the spread (defaults to the part `position`) |
| `height` | number | Vertical range above `center` when using `radius` (default `0`) |
| `bounds` | `[[x0,x1],[y0,y1],[z0,z1]]` | Explicit min/max box; overrides `radius`/`center`/`height` |
| `randomRotation` | boolean | Randomize Y rotation (default `true`) |
| `scaleVariation` | number | Fractional random scale, e.g. `0.2` = ±20% |
| `seed` | number | RNG seed — see below |
| `snapToGround` | boolean | Snap each instance onto the ground after build (see Ground snapping) |

**`seed` makes scatter deterministic.** Without it, the seed defaults to `Date.now()`, so every reload produces a different layout. Set an explicit `seed` to get the exact same placement every time — the difference between a reproducible scene and a random one:

```json
{
  "modifiers": {
    "scatter": {
      "count": 30,
      "bounds": [[-8, 8], [0, 0], [-8, 8]],
      "scaleVariation": 0.2,
      "seed": 42
    }
  }
}
```

## Ground snapping

`snapToGround: true` on any part (or inside a `scatter`/`array` modifier for per-instance snapping) drops the part onto the ground after the model builds: its bounding-box bottom is raycast down onto — in order of preference — the generated `__terrain__` mesh, `category: "environment"` meshes (they still raycast when `display: "terrain"` hides them), or world `y = 0`. `groundOffset` (meters) sinks or hovers relative to the hit point.

```json
{ "type": "roundedBox", "params": [0.7, 0.7, 0.7], "position": [-4.5, 0, -1.5], "snapToGround": true }
```

This removes the float/bury class of defects on terrain scenes — see `specs/fixtures/surface-test.json`.

## Deformers

Opt-in per-part `deform` block — gestural vertex deforms applied after geometry creation and before breakup (vertex colors follow the deformed shape). Order: taper → twist → bend.

```json
{
  "type": "cylinder",
  "params": [0.16, 0.3, 2.2, 7],
  "options": { "heightSegments": 12 },
  "deform": {
    "taper": 0.55,
    "twist": 25,
    "bend": { "angle": 14, "axis": "z" }
  }
}
```

| Deformer | Value | Effect |
|----------|-------|--------|
| `taper` | number or `{ amount, axis }` | Cross-section scales 1 → amount from base to top of the along axis (default `y`) |
| `twist` | degrees or `{ angle, axis }` | Rotation about the along axis runs 0 → angle base-to-top |
| `bend` | `{ angle, axis }` | The Y axis arcs by angle about the given rotation axis, pivoting at the base |

Deformers are pure vertex transforms — the primitive must have enough along-axis resolution to show the curve. `box` takes `options.segments: [sx, sy, sz]`; `cylinder`/`cone` take `options.heightSegments`. A bend on a 1-segment box just tilts the top face. See `specs/fixtures/deform-test.json`.

## Part properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Unique identifier (required) |
| `type` | string | Primitive type, or `"prefab"`, `"group"`, `"module"`, `"csg"`, `"region"` |
| `params` | array | Parameters for the primitive |
| `material` | object | Material definition |
| `position` | `[x, y, z]` | Position in world/parent space |
| `rotation` | `[x, y, z]` | Rotation in degrees |
| `scale` | `[x, y, z]` | Scale multiplier |
| `parent` | string | Name of parent part |
| `pivot` | string | Pivot point: `"center"`, `"bottom"`, `"top"` |
| `castShadow` | boolean | Whether to cast shadows |
| `receiveShadow` | boolean | Whether to receive shadows |
| `visible` | boolean | Visibility toggle |
| `category` | string | Tags the part (stored on `userData.category`) for terrain/region systems |
| `flipNormals` | boolean | Flips this part's normals when `true`; persisted by "Save Spec" |
| `comment` | string | Documentation comment |
