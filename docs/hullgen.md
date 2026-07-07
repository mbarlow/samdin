# hullgen — procedural low-poly hulls

`cli/hullgen.mjs` generates sculpted, continuous low-poly meshes that the
parts/CSG spec pipeline cannot reach. Specs kitbash primitives; a starfighter
fuselage in the No Man's Sky style is *one flowing faceted volume* — lofted
cross-sections, not bolted boxes. hullgen writes that mesh directly as a
self-contained `.gltf` and samdin stays the lookdev/screenshot layer.

**When to use which:**

| Asset | Tool |
|---|---|
| Props, rooms, vehicles from parts, anything assembled | spec JSON (`specs/`) |
| Sculpted continuous hulls — ships, sleek vehicles, creature-adjacent volumes | hullgen ship def (`cli/ships/`) |

## Usage

```bash
node cli/hullgen.mjs                              # build every def in cli/ships/
node cli/hullgen.mjs cli/ships/arcwing-swarmling.json
# → media/models/<name>-hull.gltf  (served at /media/models/ in dev)
```

Stdlib-only Node. No deps, no Blender.

## Ship definition schema

A ship is a JSON def: a `palette` plus optional lofted components. Only
`fuselage` is required — anatomy varies per ship, the generator doesn't care.

```jsonc
{
  "name": "arcwing-interceptor",
  "palette": {
    "hull": "#2f5fd0",        // primary matte color
    "panel": "#17306e",       // darker panels / undersides
    "trim": "#ff7a2f",        // accent stripes, fin tips
    "glass": "#0b2136",       // canopy (optional)
    "glassGlow": "#1d5b8a",   // canopy inner glow (optional)
    "glow": "#33f2ff",        // engine throats / eyes
    "glowStrength": 2.6       // KHR emissive strength
  },

  // 8-pt chined cross-sections lofted nose→tail. Nose +Z.
  // yT top ridge · wS/yS shoulder · wC/yC chine (widest) · wB/yL lower chine · yB keel
  "fuselage": {
    "noseTip": [0, 0.0, 1.8],
    "tailCap": "panel",
    "underside": "panel",     // facet bands below the chine
    "stations": [ { "z": 1.15, "yT": 0.10, "wS": 0.09, "yS": 0.07,
                    "wC": 0.16, "yC": 0.0, "wB": 0.10, "yL": -0.07, "yB": -0.10 } ]
  },

  // ONE loft tip→tip THROUGH the hull — continuous wing, center stations buried.
  // 8-pt airfoil, sharp LE/TE. leTrim paints the upper leading-edge band.
  "wing": {
    "color": "hull", "underside": "panel", "leTrim": true,
    "stations": [ { "x": -1.65, "zLE": -0.78, "zTE": -1.22, "yMid": 0.07, "th": 0.045 } ]
  },

  // canted fins; define starboard (+x), mirrored automatically. Diamond section.
  "vtails": {
    "tipColor": "trim",
    "stations": [ { "x": 0.24, "y": 0.26, "zLE": -0.78, "zTE": -1.48, "th": 0.09 } ]
  },

  // octagonal nacelle: tapered intake, housing, rear rim, RECESSED emissive
  // throat (zThroat sits inside zBack — the recession is what sells the glow).
  "engines": [
    { "x": 0.22, "y": 0.22, "rOut": 0.155, "rIn": 0.115,
      "zFront": -0.35, "zBack": -1.56, "zThroat": -1.42, "mirror": true }
  ],

  // faceted blister set INTO the spine (sink). material "glass" = cockpit,
  // "glow" = monster eye (see arcwing-swarmling).
  "canopy": {
    "material": "glass", "sink": 0.03,
    "frontPoint": { "z": 0.72, "lift": 0.01 },
    "rearPoint": { "z": -0.18, "lift": 0.05 },
    "rings": [ { "z": 0.6, "w": 0.12, "h": 0.11 } ]
  },

  // wingtip octahedra — green starboard, red port
  "navPods": { "x": 1.68, "y": 0.07, "z": -1.0, "r": 0.05 }
}
```

## The look rules (learned the hard way)

- **Volume over plates.** Kitbashed thin boxes read as RC drones. Loft real
  cross-sections with height; collapse to a sharp nose tip.
- **Matte over chrome.** metal ~0.2, rough ~0.5. High metalness + showcase
  lighting goes dark and muddy.
- **Flat facets are free.** The mesh ships flat per-face normals — faceted
  shading with zero material flags.
- **Recess the glow.** An emissive disk *inside* a rim ring reads as an engine;
  an emissive blob stuck on the tail reads as a tail light.
- **Trim is a band, not a face.** Assign accent materials to narrow facet
  bands (upper LE strip, fin tips). A whole orange fin face is a mistake you
  will make once.

## Review loop

Load into the running viewer (`make dev`) headlessly or from the console:

```js
const m = await app.loader.loadFromURL('/media/models/arcwing-interceptor-hull.gltf');
app.setModel(m);
```

**Gotcha:** `setModel` resets lookdev — the model renders dark with shadow-acne
moiré until you re-apply. Drive the panel selects after *every* load:

```js
for (const [id, v] of [['lighting-select','showcase'], ['env-map-select','studio'],
                       ['shadow-quality','high']]) {
  const el = document.getElementById(id); el.value = v;
  el.dispatchEvent(new Event('change'));
}
```

Then judge from `threeQuarter` / `back` / `top` / `left` — never a single angle.
Numbers → regen → reload → screenshot takes seconds.

## Art target

`media/concepts/` holds the concept image each hull aims at, with the exact
generation prompt alongside (`*.prompt.txt`). Compare screenshots against the
concept, not against taste.
