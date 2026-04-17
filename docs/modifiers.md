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

### Mirror modifier

Mirror across axes:

```json
{
  "modifiers": {
    "mirror": { "x": true, "y": false, "z": false }
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

## Part properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Unique identifier (required) |
| `type` | string | Primitive type or `"prefab"` or `"group"` |
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
| `comment` | string | Documentation comment |
