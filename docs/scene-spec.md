# Scene Spec Format

Samdin scenes are declarative JSON documents. The builder turns a spec into a Three.js `Group` at runtime; nothing is precompiled.

## Minimal shape

```json
{
  "name": "my-scene",
  "description": "A sample scene",
  "root": "scene_root",
  "parts": [
    {
      "name": "scene_root",
      "type": "group",
      "position": [0, 0, 0]
    },
    {
      "name": "my_box",
      "type": "box",
      "params": [1, 1, 1],
      "material": { "preset": "wood" },
      "position": [0, 0.5, 0],
      "rotation": [0, 45, 0],
      "scale": [1, 1, 1],
      "parent": "scene_root"
    }
  ]
}
```

Beyond the fields shown above, each part also accepts `category` (a tag; `"environment"` is consumed by the [Terrain compositor](#terrain-compositor)) and `flipNormals` (invert face winding on the part's meshes). A part's `type` accepts `module`, `csg`, `composite`, and `region` in addition to the primitive names, `prefab`, and `group` shown here — see the sections below.

## Scene-level settings

Specs can carry their own viewer/render mood:

```json
{
  "name": "scene-with-lookdev",
  "scene": {
    "quality": "high",
    "background": { "type": "gradient", "color": "#d6d0c7", "color2": "#090a0c" },
    "floor": { "visible": false },
    "ground": { "reflective": true },
    "fog": { "type": "exp2", "color": "#7a7772", "density": 0.02 },
    "lighting": {
      "preset": "industrialRuin",
      "intensity": 1.05,
      "shadowQuality": "high",
      "environment": "sunset",
      "envMapIntensity": 1.0
    },
    "exposure": 1.05,
    "toneMapping": "ACESFilmic",
    "camera": {
      "preset": "front",
      "distanceMultiplier": 0.45,
      "targetOffset": [0, -0.15, 0]
    },
    "postfx": {
      "ssao": { "enabled": true, "kernelRadius": 10, "minDistance": 0.004, "maxDistance": 0.16 },
      "bloom": { "enabled": true, "strength": 0.7, "radius": 0.35, "threshold": 0.72 },
      "colorGrade": { "enabled": true, "saturation": 0.85, "brightness": 0.95, "contrast": 1.08 },
      "fxaa": true
    }
  }
}
```

Every `scene.*` field is optional; omitted fields fall back to the viewer's current UI state (which `applySpecSettings` first resets to defaults on each load).

| Field | Description |
|-------|-------------|
| `quality` | Quality tier: `"draft"`, `"standard"`, or `"high"`. **Applied *before* geometry is built**, so a spec pins its own tier on the very first cold build (it no longer depends on session warmth or the current dropdown). The runtime default is `"standard"`; hero specs pin `"high"`. Higher tiers raise segment counts and sphere detail across the pipeline — it is a performance/iteration knob, not a quality knob. See [render tiers](quality-tiers.md). |
| `background` | `{ type, color, color2 }` — `type` is `solid` / `gradient` / etc. `color2` is the gradient's second stop. |
| `floor` | `{ visible }` — the ground helper plane. Defaults to visible; set `"visible": false` to hide it. |
| `ground` | `{ reflective }` — mirror-style reflective ground plane. Defaults to `false`; set `"reflective": true` to enable. |
| `fog` | `{ type, color, density }` — `type` is `linear` / `exp2` / etc. |
| `lighting.preset` | Named lighting rig (e.g. `studio`, `industrialRuin`). |
| `lighting.intensity` | Master light multiplier. |
| `lighting.shadowQuality` | `"low"` / `"medium"` / `"high"`. |
| `lighting.environment` | Image-based lighting (IBL) preset: `none` / `studio` / `outdoor` / `sunset` / `night`. Required for metals and glass to read — without an env map, reflective materials render flat. Defaults to `none`. |
| `lighting.envMapIntensity` | Strength of the env-map reflections, applied to all standard materials. |
| `exposure` | Renderer tone-mapping exposure. |
| `toneMapping` | e.g. `ACESFilmic`, `Reinhard`, `Linear`. |
| `camera` | Framing override (see below). |
| `postfx` | Post-processing stack (see below). |
| `terrain` | Terrain compositor (see [Terrain compositor](#terrain-compositor)). |

`scene.camera` supports `preset`, `fit`, `distanceMultiplier`, `scaleToModel`, `positionOffset`, and `targetOffset` — useful when a scene needs a specific gameplay or hero-shot framing without scaling the whole model. **Units differ:** `positionOffset` is added to the preset position *before* the model-size scale, so it is in preset-space units that grow with the model — a `[2, 2, 3]` offset on a 25 m scene moves the camera tens of meters. `targetOffset` is plain world meters (never scaled). For large scenes, frame with `distanceMultiplier` + `targetOffset` and keep `positionOffset` small or zero. `scaleToModel` (default `true`) and `distanceMultiplier` (default `1`) control the scaling.

### Post-processing (`scene.postfx`)

`postfx` is a map keyed by effect name. Each value is either a boolean or an object with an `enabled` flag (defaulting to `true` when the key is present) plus effect-specific options. The runtime reads twelve effects:

| Effect | Options (with defaults) |
|--------|-------------------------|
| `ssao` | `kernelRadius` (8), `minDistance` (0.005), `maxDistance` (0.1) |
| `dof` | `focus` (5.0), `aperture` (0.002), `maxblur` (0.01) |
| `ssr` | `thickness` (0.018), `maxDistance` (0.3), `opacity` (0.5) |
| `bloom` | `strength` (1.0), `radius` (0.4), `threshold` (0.8) |
| `outline` | `color` (`0xffffff`), `thickness` (2), `strength` (3) |
| `pixel` | `size` (4) |
| `vignette` | `intensity` (0.5), `softness` (0.5) |
| `chromatic` | `amount` (0.005) |
| `grain` | `intensity` (0.15) |
| `scanlines` | `intensity` (0.3), `count` (300) |
| `colorGrade` | `hue` (0), `saturation` (1), `brightness` (1), `contrast` (1) |
| `fxaa` | boolean, or `{ enabled }` — no other options |

Example:

```json
"postfx": {
  "dof": { "enabled": true, "focus": 4.0, "aperture": 0.004 },
  "ssr": { "enabled": true, "opacity": 0.6 },
  "vignette": { "enabled": true, "intensity": 0.4 },
  "grain": true
}
```

## Spec-local modules

Use top-level `modules` plus `type: "module"` instances to keep large scenes compositional:

```json
{
  "modules": {
    "signal-pylon": {
      "root": "pylon_root",
      "parts": [
        { "name": "pylon_root", "type": "group" },
        { "name": "shaft", "type": "box", "params": [1, 4, 1], "position": [0, 2, 0], "parent": "pylon_root" }
      ]
    }
  },
  "parts": [
    { "name": "pylon_a", "type": "module", "src": "signal-pylon", "position": [-5, 0, 0] },
    { "name": "pylon_b", "type": "module", "src": "signal-pylon", "position": [5, 0, 0] }
  ]
}
```

## Embedded CSG parts

Parts can host local boolean-op geometry directly:

```json
{
  "name": "ring",
  "type": "csg",
  "output": "final",
  "shapes": {
    "outer": { "type": "cylinder", "radius": 2, "height": 0.5, "position": [0, 0.25, 0] },
    "inner": { "type": "cylinder", "radius": 1.4, "height": 0.8, "position": [0, 0.4, 0] }
  },
  "operations": [
    { "op": "subtract", "a": "outer", "b": "inner", "result": "final" }
  ]
}
```

## Terrain compositor

An optional middle-pass that drapes a single unified mesh ("physics blanket") over every part tagged `category: "environment"` — ground plates, cliffs, rocks, and other natural scatter — while leaving structures and props untouched. The generated mesh is attached under the model root as `__terrain__` so it rides along with GLB exports.

```json
{
  "scene": {
    "terrain": {
      "enabled": true,
      "method": "heightfield",
      "display": "terrain",
      "flipNormals": true,
      "bounds": "auto",
      "resolution": 96,
      "smoothing": 0.35,
      "material": { "color": "#506874", "roughness": 0.9, "flatShading": true },
      "methodOptions": {
        "heightfield": { "padding": 0.75, "skirt": 3.0 }
      }
    }
  },
  "parts": [
    { "name": "rock_a", "type": "prefab", "src": "rock-large", "category": "environment" }
  ]
}
```

| Field | Description |
|-------|-------------|
| `enabled` | Master switch. When `false` or omitted, the compositor is a no-op. |
| `method` | `"heightfield"` (2.5D raycast grid), `"marching-cubes"` (volumetric iso-surface, supports overhangs), or `"cloth-drape"` (Verlet cloth that settles onto env meshes, bridges gaps). |
| `display` | `"primitives"` (hide terrain), `"terrain"` (hide env primitives), `"both"` (lookdev/debug). |
| `flipNormals` | Flip terrain normals. **Defaults to `true`** — sampled iso-surfaces and draped sheets read inside-out otherwise. Set `false` to opt out. |
| `bounds` | `"auto"` (derived from env meshes + padding) or `[minX, minZ, maxX, maxZ]`. |
| `resolution` | Grid resolution, clamped to `[4, 1024]`. |
| `smoothing` | Gaussian smoothing pass, `[0, 1]`. |
| `material` | Standard material object applied to the generated mesh. |
| `methodOptions.heightfield` | `{ padding, skirt }` for the default heightfield sampler. |
| `methodOptions.marchingCubes` | `{ padding, isoLevel, smoothingPasses }` for the volumetric sampler (`isoLevel` in `[0.05, 0.95]`). |
| `methodOptions.clothDrape` | `{ padding, skirt, iterations, stiffness, gravity, damping, thickness, startMargin, timeStep, shear }` for the Verlet cloth simulator. |
| `water` | Water as a level, not an object: `{ level, color, shoreline: { width, color }, opacity, roughness, resolution }`. Emits a `__water__` plane at `level` clipped to wherever the composited terrain sits below it — coves, rivers, tide pools all follow the same drape. Vertices within `shoreline.width` of the dry edge blend toward the shoreline color (the foam-line read cue). `opacity` < 1 (default 0.9) enables transparency; `resolution` clamps to `[8, 512]` (default 96). Works with every terrain method; the mesh toggles with the terrain in display modes and rides GLB exports. |

Heightfield sampling rasterizes a grid over the bounds, raycasts top-down against the tagged env meshes, optionally smooths, and triangulates with a skirt. Marching-cubes builds a 3D density grid from the same raycasts (odd crossings per column mark interior voxels), smooths in 3D, and extracts an iso-surface — use it when the env meshes have overhangs or fused silhouettes that a heightfield flattens. Cloth-drape initialises a grid of Verlet particles above the bounds and lets them fall under gravity with structural and shear distance constraints between neighbours; the final resting heights bridge gaps between disjoint env chunks into a single continuous blanket. Any part without `category: "environment"` is treated as a structure or prop and is rendered on top of the terrain.

The viewer exposes a **Terrain** dropdown that flips `display` live without a rebuild, and a **Flip Normals** button that targets the current selection or the `__terrain__` mesh by default. See [`../specs/examples/landscape-example.json`](../specs/examples/landscape-example.json) (heightfield), [`../specs/examples/landscape-marching-cubes.json`](../specs/examples/landscape-marching-cubes.json), [`../specs/examples/landscape-cloth-drape.json`](../specs/examples/landscape-cloth-drape.json), and [`../specs/examples/landscape-stress.json`](../specs/examples/landscape-stress.json) for working examples.


## Poses (`poses` / `pose`)

Spec-level named poses put the joint-chain convention to work: a pose maps joint node names to `[rx, ry, rz]` degrees, applied **additively** to each joint group's authored rotation after build (before terrain and ground snapping, so a posed figure still snaps correctly).

```json
"poses": {
  "sitting": { "hip_l": [-85, 0, 0], "knee_l": [85, 0, 0], "hip_r": [-85, 0, 0], "knee_r": [85, 0, 0] }
}
```

Activate with `"pose": "sitting"` at spec level, or per module/prefab placement — `{ "type": "module", "src": "worker", "name": "worker_sitting", "pose": "sitting" }` resolves joints with the placement prefix (`worker_sitting_hip_l`). Unknown joints warn and are skipped. See `specs/fixtures/pose-test.json` for the reference articulated-figure module (shoulder/elbow/hip/knee groups at anatomical pivots, meshes offset below them).

## Joint animation clips (`clips`)

Validated clips animate those same named joint groups and are exposed in the viewer's animation controls. Keyframe rotations use degrees and compile to quaternion tracks; positions use model-space units. `instances` expands reusable joint names across named top-level module placements.

```json
"clips": {
  "walk": {
    "duration": 1,
    "instances": ["worker_a", "worker_b"],
    "tracks": {
      "hip_l": { "rotation": [[0, [-30, 0, 0]], [0.5, [30, 0, 0]], [1, [-30, 0, 0]]] },
      "knee_l": { "rotation": [[0, [40, 0, 0]], [0.5, [10, 0, 0]], [1, [40, 0, 0]]] }
    }
  }
}
```

Each channel needs at least two `[time, [x, y, z]]` keyframes with strictly increasing non-negative times. When `duration` is omitted, Three.js derives it from the last keyframe. The clips are included in GLTF/GLB export. See `specs/examples/segmented-figures.json` for complete idle and walk cycles across waist, head, arms, hips, knees, and ankles.
