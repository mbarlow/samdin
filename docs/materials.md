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
