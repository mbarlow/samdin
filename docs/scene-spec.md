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

## Scene-level settings

Specs can carry their own viewer/render mood:

```json
{
  "name": "scene-with-lookdev",
  "scene": {
    "background": { "type": "gradient", "color": "#d6d0c7", "color2": "#090a0c" },
    "fog": { "type": "exp2", "color": "#7a7772", "density": 0.02 },
    "lighting": { "preset": "industrialRuin", "intensity": 1.05, "shadowQuality": "high" },
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

`scene.camera` supports `preset`, `fit`, `distanceMultiplier`, `scaleToModel`, `positionOffset`, and `targetOffset` — useful when a scene needs a specific gameplay or hero-shot framing without scaling the whole model.

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

Heightfield sampling rasterizes a grid over the bounds, raycasts top-down against the tagged env meshes, optionally smooths, and triangulates with a skirt. Marching-cubes builds a 3D density grid from the same raycasts (odd crossings per column mark interior voxels), smooths in 3D, and extracts an iso-surface — use it when the env meshes have overhangs or fused silhouettes that a heightfield flattens. Cloth-drape initialises a grid of Verlet particles above the bounds and lets them fall under gravity with structural and shear distance constraints between neighbours; the final resting heights bridge gaps between disjoint env chunks into a single continuous blanket. Any part without `category: "environment"` is treated as a structure or prop and is rendered on top of the terrain.

The viewer exposes a **Terrain** dropdown that flips `display` live without a rebuild, and a **Flip Normals** button that targets the current selection or the `__terrain__` mesh by default. See [`../specs/landscape-example.json`](../specs/landscape-example.json) (heightfield), [`../specs/landscape-marching-cubes.json`](../specs/landscape-marching-cubes.json), [`../specs/landscape-cloth-drape.json`](../specs/landscape-cloth-drape.json), and [`../specs/landscape-stress.json`](../specs/landscape-stress.json) for working examples.
