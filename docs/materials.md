# Materials

Use `"material": { "preset": "name" }` or combine with color: `{ "preset": "wood", "color": "#d4a574" }`.

## Metals

| Preset | Description |
|--------|-------------|
| `chrome` | Shiny chrome mirror |
| `steel` | Brushed steel |
| `metal` | Generic metal |
| `gold` | Gold metallic |
| `brass` | Brass finish |
| `copper` | Copper finish |
| `painted-metal` | Painted metal surface |
| `rusted-metal` | Oxidized rusty metal |
| `wire-mesh` | Wire/screen mesh (semi-metallic grey) |

## Building materials

| Preset | Description |
|--------|-------------|
| `concrete` | Concrete surface |
| `asphalt` | Road asphalt |
| `brick` | Brick material |
| `tile` | Ceramic tile |
| `cinder-block` | Cinder block |
| `wall-paint` | Painted wall |

## Natural

| Preset | Description |
|--------|-------------|
| `wood` | Wood grain |
| `fence-wood` | Weathered fence wood |
| `grass` | Grass surface |
| `dirt-path` | Dirt/earth path |
| `foliage` | Leaf/plant material |
| `water` | Water surface |

## Fabrics & soft

| Preset | Description |
|--------|-------------|
| `fabric` | Cloth material |
| `leather` | Leather surface |
| `cushion` | Soft cushion |
| `carpet` | Carpet texture |
| `rubber` | Rubber material |

## Glass & transparent

| Preset | Description |
|--------|-------------|
| `glass` | Clear glass |
| `glass-tinted` | Tinted glass |

## Other

| Preset | Description |
|--------|-------------|
| `plastic` | Plastic surface |
| `ceramic` | Ceramic/porcelain |
| `matte` | Matte finish |

## Emissive / glow

| Preset | Description |
|--------|-------------|
| `glow` | Glowing emissive |
| `neon` | Neon light effect |
| `screen` | LCD/LED screen |
| `rgb` | RGB LED strip |
| `sky` | Sky gradient |
| `cloud` | Cloud material |

## Custom materials

```json
{
  "material": {
    "color": "#ff5500",
    "metalness": 0.8,
    "roughness": 0.2,
    "emissive": "#ff0000",
    "emissiveIntensity": 0.5,
    "flatShading": true
  }
}
```

All fields honored by the material factory (`Materials.create`):

| Field | Description |
|-------|-------------|
| `color` | Base/diffuse color (default `#888888`) |
| `metalness` | Metalness 0–1 (default `0.3`) |
| `roughness` | Roughness 0–1 (default `0.7`) |
| `emissive` | Emissive color (default black) |
| `emissiveIntensity` | Emissive strength (default `1.0`) |
| `flatShading` | Faceted shading when `true` (default `false`) |
| `side` | `"front"` (default), `"back"`, or `"double"` |
| `doubleSide` | Shorthand for `side: "double"` when `true` |
| `transparent` | Enable alpha blending (auto-on when `opacity < 1`) |
| `opacity` | Opacity 0–1 (default `1`) |
| `envMapIntensity` | Environment-map reflection strength (default `1`) |
| `vertexColors` | Use per-vertex colors when `true` (default `false`) |
| `clearcoat` | Clearcoat layer 0–1 (default `0`) |
| `clearcoatRoughness` | Clearcoat roughness 0–1 (default `0`) |
| `transmission` | Light transmission 0–1 for real glass (default `0`) |
| `ior` | Index of refraction (default `1.5`) |
| `alphaTest` | Alpha cutoff threshold |

Setting `clearcoat`, `transmission`, or `ior` promotes the material to a
`MeshPhysicalMaterial` (true refractive glass). The rangefinder anchor's lens
uses `transmission` + `ior`; the built-in `glass` / `glass-tinted` presets set
them for you.

## Surface treatments

Per-surface procedural detail lives under `material` alongside the preset/color
fields, and is applied after the mesh is built. These treatments are what
separate `standard` / `high` renders from flat, toy-like output — the shipped
`specs/anchors/quality-bar-*.json` anchors lean on them heavily. They are cheap enough
to leave in draft but are the whole point of the quality bar.

### `material.breakup`

Bakes per-vertex color and roughness variation into the surface (writes vertex
colors + a `roughnessShift` attribute, then patches the shader). Sub-fields:

| Field | Description | Typical range |
|-------|-------------|---------------|
| `noise.amount` | Strength of speckled color noise | `0.025`–`0.14` |
| `noise.scale` | Noise frequency (higher = finer grain) | `2.0`–`14.0` |
| `noise.color` | Color the noise lerps toward | hex (default `#9a9a9a`) |
| `grime.amount` | Strength of directional grime buildup | `0.1`–`0.26` |
| `grime.axis` | Axis grime accumulates along (`x`/`y`/`z`) | default `y` |
| `grime.bias` | Shifts where grime starts along the axis | default `0` |
| `grime.color` | Grime color | hex (default `#181818`) |
| `edgeWear.amount` | Strength of worn/exposed edges | `0.04`–`0.08` |
| `edgeWear.color` | Exposed-edge color | hex (default `#d9d4cb`) |
| `edgeWear.contrast` | Edge falloff sharpness | default `3.5` |
| `roughnessVariation` | Per-vertex roughness jitter | `0.04`–`0.06` |

```json
"material": {
  "color": "#8a8478",
  "roughness": 0.95,
  "breakup": {
    "noise": { "amount": 0.05, "scale": 5.0, "color": "#23272b" },
    "grime": { "amount": 0.15, "axis": "y", "color": "#3a3830" },
    "edgeWear": { "amount": 0.06, "color": "#d4a85a" },
    "roughnessVariation": 0.05
  }
}
```

### `material.decals`

Array of flat overlay panels laid onto a face of the part's bounding box
(labels, stickers, screens). Each entry takes `face`
(`front`/`back`/`left`/`right`/`top`/`bottom`), `size` `[w, h]`, `offset`
`[u, v]`, optional `inset`/`thickness`, and a `material` block (preset or custom
fields — including `emissive`/glow).

```json
"material": {
  "decals": [
    { "face": "front", "size": [1.9, 0.18], "offset": [0, 1.15],
      "material": { "preset": "glow", "color": "#ff5933", "emissiveIntensity": 1.3, "opacity": 0.8 } }
  ]
}
```

### `material.emissiveStrips`

Array of glowing strips on a face — a decal shorthand tuned for light bars.
Each entry: `face`, `axis` (`x`/`y`) for the repeat direction, `count`,
`spacing`, `length`, `width`, plus `color` / `intensity` (defaults `#ff5533` @
`1.8`) and optional `offset` / `opacity`.

```json
"material": {
  "emissiveStrips": [
    { "face": "front", "axis": "y", "count": 3, "spacing": 0.65,
      "width": 0.08, "length": 1.7, "color": "#ff5f36", "intensity": 1.35 }
  ]
}
```


## Curvature edge wear

`edgeWear` defaults to the bounding-box mask (`mode: "bbox"`), which only reads on boxy parts. `mode: "curvature"` measures real creases — the max angle between normals sharing a vertex position — so wear lands on lathe profiles, loft ridges, and CSG boolean edges:

```json
"breakup": {
  "edgeWear": { "amount": 0.3, "color": "#d9c9a8", "mode": "curvature" }
}
```

`contrast` still shapes the falloff (higher = tighter to hard edges). See `specs/fixtures/wear-detail-test.json` for curvature vs bbox side by side.

## Triplanar detail

`material.detail` adds world-space procedural value-noise that modulates roughness (± `amount`) and albedo (± `amount`/2) — surface richness on large faces with no UVs and no textures. Chains cleanly with `roughnessVariation`:

```json
"material": {
  "color": "#8a6f50",
  "roughness": 0.65,
  "detail": { "scale": 2.2, "amount": 0.22 }
}
```

`scale` is noise cells per meter (higher = finer grain).
