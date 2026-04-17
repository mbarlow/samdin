# Editor & Keyboard Shortcuts

## Editor features

- **Grid overlay** — toggle reference grid
- **Part highlighting** — click to select parts
- **Transform gizmos** — Blender-style G/R/S modal transforms with axis constraining
- **Undo/redo** — full undo stack for transforms, deletes, and duplicates
- **Spec editor** — edit JSON in real-time
- **Part library** — browse available primitives, prefabs, and CSG shapes
- **Validation** — automatic spec validation

All transforms sync back to the spec JSON so exports reflect edits.

## Transform (Blender-style)

Select a part by clicking it, then use these hotkeys:

| Key | Action |
|-----|--------|
| `G` | **Grab/Move** — enter translate mode (drag to move, click/Enter to confirm) |
| `R` | **Rotate** — enter rotate mode |
| `S` | **Scale** — enter scale mode |
| `X` | **Axis constrain** (in transform mode) — lock to X axis |
| `Y` | **Axis constrain** (in transform mode) — lock to Y axis |
| `Z` | **Axis constrain** (in transform mode) — lock to Z axis |
| `Escape` | **Cancel** current transform (reverts to original) |
| `Enter` / click | **Confirm** current transform |
| `Ctrl` (hold) | **Snap** — translate 0.25 units, rotate 15°, scale 0.1 increments |

## Edit operations

| Key | Action |
|-----|--------|
| `X` | **Delete** selected part (when not in transform mode) |
| `Shift+D` | **Duplicate** selected part (offset copy + spec entry) |
| `Ctrl+Z` | **Undo** last transform/delete/duplicate |
| `Ctrl+Shift+Z` | **Redo** |

## First-person mode

| Key | Action |
|-----|--------|
| `W` / `↑` | Move forward |
| `S` / `↓` | Move backward |
| `A` / `←` | Strafe left |
| `D` / `→` | Strafe right |
| `Space` | Move up |
| `Shift` | Move down |
| `Escape` | Exit first-person mode |
