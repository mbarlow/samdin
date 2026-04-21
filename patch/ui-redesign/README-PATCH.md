# SAM DIN — UI Redesign patch (`ui-redesign`)

Drop-in replacement for `src/` that restyles the app as a **floating HUD** (Blender/Figma-style corner clusters) while preserving every existing element ID so `src/js/main.js` keeps working untouched.

## What's in this patch

```
patch/ui-redesign/
└── src/
    ├── index.html              ← replaces src/index.html
    ├── css/style.css           ← replaces src/css/style.css
    └── js/
        └── ui/
            ├── hud.js          ← NEW — quickbar + status bar + FPS + edge toggle
            ├── cmdk.js         ← NEW — Cmd/Ctrl-K command palette
            └── kbd.js          ← NEW — `?` keyboard shortcut overlay
```

**Not touched:** `src/js/main.js`, `src/js/viewer.js`, `src/js/builder.js`, and every other app module. The redesign is CSS + DOM + three additive ES modules.

## How to apply

From repo root:

```bash
git checkout -b ui-redesign
cp -r patch/ui-redesign/src/* src/
make dev
```

Or, if you want to keep a clean revert path:

```bash
git checkout -b ui-redesign
mv src src.backup
mkdir -p src/js/ui
cp -r patch/ui-redesign/src/* src/
# restore everything main.js expects that the patch doesn't ship
cp -r src.backup/js src.backup/prefabs src.backup/specs src/ 2>/dev/null
# wait, specs/prefabs are siblings, only js needs restoring:
cp -r src.backup/js/*.js src/js/
# then js/ui/ is additive and the new index.html + css overwrite the old UI
```

Simpler: the patch only touches **three existing files** (`index.html`, `css/style.css`) and **adds** `js/ui/*.js`. You can apply it as a straight overlay on top of `src/`:

```bash
cp patch/ui-redesign/src/index.html       src/index.html
cp patch/ui-redesign/src/css/style.css    src/css/style.css
mkdir -p src/js/ui
cp patch/ui-redesign/src/js/ui/*.js       src/js/ui/
```

## What changed, visually

- Right-hand sidebar is gone. `<aside id="panel">` is still in the DOM (main.js scopes selectors inside it) but restyled as a floating cluster of glass cards anchored to the top-right.
- **Top-left** — brand pill showing SAM DIN + current spec name.
- **Top-center** — `HUD / FOCUS` toggle. FOCUS hides every chrome cluster for clean screenshots. (Also bound to backtick.)
- **Bottom-left** — quick-launch bar: Load, Load Spec, Paste, Editor · Fit, Screenshot, Export · Cmd-K, `?`. Each button delegates `.click()` to the real controls inside `#panel`, so main.js wiring is unchanged.
- **Bottom-center** — status bar: tris / verts / objs (mirrored live from `#info-*` via MutationObserver) + live FPS meter.
- **Spec editor** — now a floating glass panel on the left rather than a full-height column.
- **Modal / toast / polaroid strip / viewfinder** — same IDs and class names, restyled.

## What changed, behaviorally

### Preserved contracts (main.js should keep working)
- Every ID main.js queries still exists: `#btn-load`, `#btn-export`, `#btn-load-spec`, `#btn-paste-spec`, `#btn-open-editor`, `#btn-build`, `#file-input`, `#spec-file-input`, `#spec-select`, `#quality-tier`, `#terrain-mode`, `#btn-flip-normals`, `#btn-save-spec`, `#upload-*`, `#info-{tris,verts,objects}`, `#part-{name,position,geometry}`, `#camera-{mode,aspect,select}`, `#camera-flash`, `#fp-*`, `#btn-fit`, `#btn-screenshot`, `#cam-*`, `#lighting-*`, `#light-*`, `#shadow-quality`, `#exposure`, `#env-*`, `#fx-*`, `#clip-*`, `#state-*`, `#anim-*`, `#btn-{play,stop}`, `#editor-*`, `#paste-*`, `#toast-container`, `#fp-crosshair`, plus `.orbit-controls`, `.fp-controls`, `.fp-hint`, `.camera-settings`, `.color-grade-controls`, `.modal`, `.modal-backdrop`, `.library-tabs`, `.lib-tab`, `.lib-panel`, `.lib-grid`, `.lib-item`, `.part-details`, `.no-selection`, `.hotkey-hints`.
- `CameraSystem` injects `#polaroid-strip`, `#camera-viewfinder`, `#camera-flash`, `#photo-expanded`, `#export-photos`, `#fp-overlay` at runtime — all styled.
- The inline `document.querySelectorAll('#panel h2')` collapse script is preserved in `index.html`.

### New IDs (additive — nothing reads them except the new modules)
- `#hud-brand`, `#hud-spec-name`, `#hud-edge`, `#hud-quickbar`, `#hud-statusbar`, `#sb-{tris,verts,objects,fps,kbd-btn}`, `#sb-fps-wrap`, `#qb-cmdk`, `#qb-kbd`, `.qb-btn`, `.edge-btn`
- `#cmdk`, `#cmdk-input`, `#cmdk-results`, `.cmdk-*`
- `#kbd-overlay`, `#kbd-grid`, `.kbd-*`
- `#app[data-hud]` attribute ("visible" | "hidden") — only read by CSS.

### New keyboard shortcuts
| Key | Action |
|-----|--------|
| `⌘/Ctrl + K` | Open command palette |
| `?` | Toggle shortcut overlay |
| `` ` `` (backtick) | Toggle HUD / FOCUS mode |
| `Esc` | Close any palette / overlay (when visible) |

All existing hotkeys wired in `viewer.js` (G/R/S/X/Shift-D/Ctrl-Z) are untouched.

## Command palette contents

Pulled from DOM at open time, so anything you add to `#spec-select` / `#lighting-select` / the section headers shows up automatically. Categories:

- **Model** — Load, Load Spec, Paste, Editor, Export, Save Spec, Flip Normals
- **View** — Fit, Screenshot, all 8 camera presets, Orbit / First-Person mode, wireframe / grid toggles
- **Quality** — Draft / Standard / High
- **Panels** — open any collapsed section
- **Specs** — one entry per built-in spec (calls Build)
- **Lighting** — one entry per lighting preset
- **System** — show shortcuts, toggle HUD

Each command either `.click()`s the real button or sets a `<select>` value and dispatches `change`. No direct access to `window.app`.

## How to revert

```bash
git checkout main -- src/index.html src/css/style.css
rm -rf src/js/ui
```

Or just drop the branch: `git checkout main && git branch -D ui-redesign`.

## Known caveats

1. **Photo mode polaroid strip** sits above the status bar; if you take a lot of photos they scroll horizontally. The status bar floats above. On <900px viewports the polaroid strip reclaims the full width.
2. **The spec editor** is now 460px wide on the left. If you work on narrow screens, you may want to swap it back to a bottom drawer — the edit is isolated to `.editor-panel` in style.css.
3. **FPS meter** counts rAF frames, which tracks the renderer's actual loop closely enough for our purposes; for a more accurate reading, wire it to `viewer.setRenderCallback` and increment there.
4. **Command palette dynamic items** are collected at open time only. If you `registerSpec()` after opening the palette once, close and reopen to refresh.

## Testing checklist

After applying, verify:

- [ ] Default spec (`simpleDrone`) loads on init
- [ ] `<aside id="panel">` collapse/expand still works on section headers
- [ ] Load GLTF, Load Spec, Paste Spec, Editor, Export, Save Spec all still trigger their flows
- [ ] Quality tier change rebuilds current model
- [ ] Camera mode toggle shows/hides FP controls (CSS reads `.orbit-controls` / `.fp-controls`)
- [ ] First-person crosshair + overlay render
- [ ] Part click populates `#part-info` details
- [ ] Lighting / Env / Post-FX / Animation sections all function
- [ ] Part library tabs switch, items copy to clipboard
- [ ] Toast notifications appear at bottom-center
- [ ] Cmd-K opens palette, arrows navigate, Enter runs, Esc closes
- [ ] `?` toggles shortcut overlay
- [ ] `` ` `` toggles HUD / FOCUS mode
