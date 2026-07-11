# Primitives

Primitive types you can use as a part's `type`. `params` is type-specific.

## Basic shapes

| Type | Params | Description |
|------|--------|-------------|
| `box` | `[width, height, depth]` | Rectangular box |
| `sphere` | `[radius, detail]` | Sphere (detail 0-3) |
| `cylinder` | `[radiusTop, radiusBottom, height, segments]` | Cylinder or cone |
| `cone` | `[radius, height, segments]` | Cone |
| `torus` | `[radius, tube, radialSegments, tubularSegments]` | Donut shape |
| `capsule` | `[radius, length, capSegments, radialSegments]` | Pill shape |
| `plane` | `[width, height, segmentsW, segmentsH]` | Flat plane |
| `ring` | `[outerRadius, innerRadius, segments]` | Flat ring |

> **`ring` param order:** outer radius comes **first**, then inner. This is inverted from Three.js's own `RingGeometry(inner, outer)` — don't be surprised. Author against the order shown here.

## Geometric solids

| Type | Params | Description |
|------|--------|-------------|
| `tetrahedron` | `[radius, detail]` | 4-sided solid (detail subdivides) |
| `octahedron` | `[radius, detail]` | 8-sided solid (detail subdivides) |
| `dodecahedron` | `[radius, detail]` | 12-sided solid (detail subdivides) |
| `icosahedron` | `[radius, detail]` | 20-sided solid |
| `prism` | `[radius, height, sides]` | N-sided prism |
| `pyramid` | `[baseWidth, baseDepth, height]` | Pyramid (omit `baseDepth` for square base) |
| `wedge` | `[width, height, depth]` | Triangular wedge |

## Architectural

| Type | Params | Description |
|------|--------|-------------|
| `roundedBox` | `[width, height, depth, radius, segments]` | Box with rounded edges |
| `stairs` | `[width, height, depth, steps]` | Staircase |
| `arch` | `[width, height, depth, segments]` | Archway |
| `tube` | `[outerRadius, innerRadius, height, segments]` | Hollow cylinder |

## Lathe & extrusion

| Type | Params | Description |
|------|--------|-------------|
| `lathe` | `[points, segments, phiStart, phiLength]` | Revolve 2D profile around Y axis |
| `extrudePath` | `[shape, shapeParams, waypoints, segments, closed]` | Extrude shape along curved path |

**Lathe example** (wine glass):
```json
{
  "type": "lathe",
  "params": [
    [[0.06, 0], [0.06, 0.01], [0.01, 0.02], [0.01, 0.15], [0.03, 0.2], [0.06, 0.35]],
    12
  ]
}
```

**ExtrudePath shapes**: `"circle"` `[radius]`, `"square"` `[size]`, `"rectangle"` `[width, height]`

### PolyMesh

`type: "polyMesh"` provides deterministic Nendo/Wings3D-style box modelling
inside a normal Samdin part. It keeps a polygon control cage while operations
run, addresses faces through persistent tags, then emits a flat-shaded triangle
mesh for the existing material, hierarchy, pose, inspection, and GLTF pipeline.

```json
{
  "name": "torso",
  "type": "polyMesh",
  "polyMesh": {
    "base": { "type": "cube", "size": [0.22, 0.25, 0.2], "center": [0.11, 0, 0] },
    "operations": [
      { "op": "select", "tag": "top" },
      { "op": "extrude", "distance": 0.16, "scale": [1.12, 1, 0.92], "pivot": [0, 0, 0], "tag": "waist" },
      { "op": "extrude", "distance": 0.24, "scale": [1.28, 1, 1.16], "pivot": [0, 0, 0], "tag": "chest" }
    ],
    "modifiers": [
      { "type": "mirror", "axis": "x", "threshold": 0.00001 }
    ]
  },
  "material": { "color": "#54708a", "flatShading": true }
}
```

Cube bases begin with `front`, `back`, `left`, `right`, `top`, and `bottom`
face tags. An explicit cage uses `base.type: "mesh"` with `vertices` and convex
polygon `faces`; a face may be an index array or `{vertices, tag|tags}`.

| Operation | Key fields | Result |
|-----------|------------|--------|
| `select` | `tag`, `criteria` | Replaces the active face selection |
| `extrude` | `distance` or `offset`, `scale`, `pivot`, `tag` | Extrudes each selected face and selects the new cap |
| `inset` | `factor` or `amount`, `tag` | Creates and selects an inner face plus a border ring |
| `translate` | `offset` | Moves the selected faces' shared vertices |
| `scale` | `factor`, optional `pivot` | Scales selected vertices around their centroid or pivot |
| `rotate` | `angle`, `axis`, optional `pivot` | Rotates selected vertices in degrees |

An edit operation can use `selection: "tag"` instead of a preceding `select`.
`tag` on `extrude`/`inset` names the new cap; it is not an input selector.
Selection criteria support `lastCreated`, `all`, face normal, face-center
position, and numeric face IDs. Prefer tags because IDs change with topology.

The `mirror` modifier expects a half-cage on one side of its axis. Faces lying
entirely on the center plane are removed, center vertices are welded, and the
remaining faces are duplicated with corrected winding. Region extrusion,
Catmull-Clark subdivision, UV generation, and concave polygon triangulation are
not part of the initial runtime contract. See `specs/fixtures/polymesh-test.json`.

### Loft

`type: "loft"` lofts faceted cross-sections along an arbitrary (curved) path into one continuous flat-shaded mesh — the sculpted-hull look the primitive kitbash can't reach (creature bodies, boat hulls, fins, sleek fuselages). Same math as `cli/hullgen.mjs`; see `specs/fixtures/loft-test.json` (the hullgen whale rebuilt as spec parts).

```json
{
  "name": "fin",
  "type": "loft",
  "loft": {
    "mirror": true,
    "startPoint": [0.1, -0.05, 0.7],
    "stations": [
      { "at": [0.2, -0.09, 0.6],  "points": [[0.11, 0.018], [0, 0.03], [-0.11, 0.018], [0, -0.03]] },
      { "at": [0.58, -0.24, 0.38], "points": [[0.09, 0.014], [0, 0.024], [-0.09, 0.014], [0, -0.024]] },
      { "at": [0.95, -0.34, 0.16], "points": [[0.05, 0.01],  [0, 0.016], [-0.05, 0.01],  [0, -0.016]] }
    ]
  },
  "material": { "color": "#3a5a72", "flatShading": true }
}
```

- `stations` (≥ 2): each is a ring — `points` (same count everywhere, ≥ 3) are `[px, py]` profile coordinates mapped onto a plane perpendicular to the local path tangent (px ≈ horizontal, py ≈ vertical).
- `startPoint` / `endPoint`: optional pointed caps (noses, tails, fin tips); omitted ends get a flat centroid fan.
- `mirror: true` duplicates the loft mirrored across X into the same mesh.
- One material per part; where hullgen used per-band materials, use several loft parts.
- Anchor rule from hullgen applies: appendages must bury their root ring inside the parent volume or they float.

## Cables & wires

| Type | Params | Description |
|------|--------|-------------|
| `cable` | `[waypoints, radius, segments, radialSegments, tension]` | Smooth cable along waypoints |
| `catenary` | `[start, end, sag, radius, segments, radialSegments]` | Gravity-sagging cable between points |

**Tension options**: `"tight"`, `"normal"`, `"loose"`

**Catenary example** (power line):
```json
{
  "type": "catenary",
  "params": [[-3, 2.8, 0], [3, 2.8, 0], 0.2, 0.015, 24, 6]
}
```

## Organic & coils

| Type | Params | Description |
|------|--------|-------------|
| `helix` | `[radius, tubeRadius, coils, height]` | Tube swept along a helix — springs, coils, screw threads |
| `rock` | `[radius, seed, roughness]` | Noise-displaced icosahedron, faceted. Deterministic per `seed` |
| `canopy` | `[radius, lobes, seed]` | Rounded foliage blob for tree crowns and shrubs. Deterministic per `seed` |

`rock` and `canopy` displace vertices by a smooth function of direction, so the surface never cracks; vary `seed` for a different lump without changing the silhouette budget. Both default to a stone-grey / foliage-green material and honor the quality tier (higher tiers subdivide further). `helix` segment density scales with the tier.

**Spring example** (tension coil):
```json
{
  "type": "helix",
  "params": [0.18, 0.03, 6, 0.5],
  "material": { "preset": "chrome" }
}
```

**Tree example** (trunk + crown):
```json
{ "name": "trunk", "type": "cylinder", "params": [0.08, 0.1, 0.9, 8], "material": { "preset": "wood" } },
{ "name": "crown", "type": "canopy", "params": [0.5, 4, 9], "position": [0, 0.7, 0] }
```

## Lights

| Type | Params | Description |
|------|--------|-------------|
| `pointLight` | `[intensity, distance, decay, showBulb, bulbSize]` | Omnidirectional light |
| `spotLight` | `[intensity, distance, angle, penumbra, showCone]` | Directional cone light |
| `areaLight` | `[width, height, intensity, showPanel]` | Rectangular soft light |

Light color is set via `material.color`:
```json
{
  "type": "pointLight",
  "params": [2, 10, 2, true, 0.08],
  "material": { "color": "#ffaa44" },
  "position": [0, 2, 0]
}
```

## CSG (Constructive Solid Geometry)

Complex shapes created via boolean operations:

| Type | Params | Description |
|------|--------|-------------|
| `ibeam` | `[width, height, depth, flangeThickness, webThickness]` | I-beam structural (`webThickness` defaults to `flangeThickness`) |
| `lbeam` | `[width, height, depth, thickness]` | L-shaped angle |
| `tbeam` | `[width, height, depth, flangeThickness, webThickness]` | T-beam (`webThickness` defaults to `flangeThickness`) |
| `channel` | `[width, height, depth, thickness]` | C-channel |
| `hbeam` | `[width, height, depth, flangeThickness, webThickness]` | H-beam |
| `angle` | `[width, height, depth, thickness]` | Angle bracket |
| `hollowBox` | `[width, height, depth, thickness]` | Hollow rectangular tube |
| `hollowCylinder` | `[outerRadius, innerRadius, height, segments]` | Pipe/tube |
| `pipeFlange` | `[pipeRadius, flangeRadius, flangeThickness, pipeLength, boltHoles]` | Pipe flange |
| `elbow` | `[radius, tubeRadius, angle, segments]` | Pipe elbow |
| `bracket` | `[width, height, depth, thickness, holeRadius]` | Mounting bracket |
| `gear` | `[radius, teeth, height, toothDepth]` | Gear wheel |
| `cross` | `[armLength, armWidth, thickness]` | Plus/cross shape |
| `frame` | `[width, height, border, depth]` | Picture frame |
| `windowFrame` | `[width, height, frameWidth, frameDepth, divisions]` | Window with panes |
| `dome` | `[radius, thickness, segments]` | Hollow half-sphere shell (`thickness` = shell wall) |
| `hexNut` | `[radius, height, holeRadius]` | Hexagonal nut |
| `countersunk` | `[headRadius, shaftRadius, headHeight, shaftLength]` | Countersunk screw |
| `keyhole` | `[width, height, depth, circleRadius, slotWidth]` | Keyhole mount |
| `halfTorus` | `[radius, tube, segments]` | Half donut |
| `sphereSlab` | `[radius, thickness, segments]` | Sliced sphere |
| `notchedCylinder` | `[radius, height, notchWidth, notchDepth, segments]` | Cylinder with notch |
| `steppedPyramid` | `[baseSize, height, steps]` | Mayan-style pyramid |
| `boxSphereIntersect` | `[boxSize, sphereRadius]` | Rounded cube |
| `cylinderIntersect` | `[radius, height, segments]` | Cylinder intersection |
| `swissCheese` | `[width, height, depth, holeRadius, holes]` | Block with random holes |

For embedded CSG blocks that compose multiple shapes with boolean ops, see [scene-spec.md](scene-spec.md#embedded-csg-parts).
