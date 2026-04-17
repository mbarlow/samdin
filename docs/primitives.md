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
| `plane` | `[width, height]` | Flat plane |
| `ring` | `[innerRadius, outerRadius, segments]` | Flat ring |

## Geometric solids

| Type | Params | Description |
|------|--------|-------------|
| `tetrahedron` | `[radius]` | 4-sided solid |
| `octahedron` | `[radius]` | 8-sided solid |
| `dodecahedron` | `[radius]` | 12-sided solid |
| `icosahedron` | `[radius, detail]` | 20-sided solid |
| `prism` | `[radius, height, sides]` | N-sided prism |
| `pyramid` | `[baseWidth, height]` | Square pyramid |
| `wedge` | `[width, height, depth]` | Triangular wedge |

## Architectural

| Type | Params | Description |
|------|--------|-------------|
| `roundedBox` | `[width, height, depth, radius, segments]` | Box with rounded edges |
| `stairs` | `[width, height, depth, steps]` | Staircase |
| `arch` | `[width, height, depth, segments]` | Archway |
| `tube` | `[outerRadius, innerRadius, height, segments]` | Hollow cylinder |
| `dome` | `[radius, widthSegments, heightSegments, phiLength]` | Hemisphere/dome |

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
| `ibeam` | `[width, height, length, flangeThickness, webThickness]` | I-beam structural |
| `lbeam` | `[width, height, length, thickness]` | L-shaped angle |
| `tbeam` | `[width, height, length, flangeThickness, webThickness]` | T-beam |
| `channel` | `[width, height, length, thickness]` | C-channel |
| `hbeam` | `[width, height, length, flangeThickness, webThickness]` | H-beam |
| `angle` | `[width, height, length, thickness]` | Angle bracket |
| `hollowBox` | `[width, height, depth, wallThickness]` | Hollow rectangular tube |
| `hollowCylinder` | `[outerRadius, innerRadius, height, segments]` | Pipe/tube |
| `pipeFlange` | `[pipeRadius, flangeRadius, flangeThickness, pipeLength, boltHoles]` | Pipe flange |
| `elbow` | `[radius, tubeRadius, angle, segments]` | Pipe elbow |
| `bracket` | `[width, height, depth, thickness, holeRadius]` | Mounting bracket |
| `gear` | `[radius, teeth, thickness, toothDepth]` | Gear wheel |
| `cross` | `[armLength, armWidth, thickness]` | Plus/cross shape |
| `frame` | `[width, height, thickness, depth]` | Picture frame |
| `windowFrame` | `[width, height, frameWidth, frameDepth, divisions]` | Window with panes |
| `hexNut` | `[radius, height, holeRadius]` | Hexagonal nut |
| `countersunk` | `[headRadius, shaftRadius, headHeight, shaftLength]` | Countersunk screw |
| `keyhole` | `[width, height, depth, holeRadius, slotWidth]` | Keyhole mount |
| `halfTorus` | `[radius, tube, segments]` | Half donut |
| `sphereSlab` | `[radius, thickness]` | Sliced sphere |
| `notchedCylinder` | `[radius, height, notchWidth, notchDepth, segments]` | Cylinder with notch |
| `steppedPyramid` | `[baseWidth, height, steps]` | Mayan-style pyramid |
| `boxSphereIntersect` | `[boxSize, sphereRadius]` | Rounded cube |
| `cylinderIntersect` | `[radius, height, segments]` | Cylinder intersection |
| `swissCheese` | `[width, height, depth, holeRadius, holeCount]` | Block with random holes |

For embedded CSG blocks that compose multiple shapes with boolean ops, see [scene-spec.md](scene-spec.md#embedded-csg-parts).
