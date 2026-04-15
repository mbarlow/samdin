# Asset Playbooks

Use this file when the request depends on asset-type-specific modeling judgment.

## Scale Cheatsheet

Use these as practical defaults unless the user specifies otherwise:

- adult human height: `1.6-1.9`
- interior door: `0.9 x 2.0-2.2`
- desk height: `0.72-0.78`
- counter height: `0.9`
- chair seat height: `0.42-0.48`
- car length: `4.0-5.0`
- car wheel radius: `0.28-0.38`
- street lane width: `3.0-3.6`

## Props

- Start with the primary silhouette and contact patch before cut lines or accessories.
- Give every hero prop 1-3 secondary details that explain use, wear, or function.
- Background props should be cheaper than hero props in both part count and material diversity.
- Put pivots where the object actually opens, folds, or rotates.
- If the prop will be seen up close, vary roughness and edge response; flat color alone will look synthetic.

## Vehicles

- Establish wheel diameter, wheelbase, and body silhouette first; these define the read more than trim.
- Group the vehicle as chassis, cabin, wheels, glazing, lights, and accents.
- Keep left and right wheel centers perfectly aligned unless damage is intentional.
- Glass, lights, and trim should help explain scale and orientation.
- Use CSG or hollow forms for mechanical sections when stacked boxes start looking fake.

## Characters And Creatures

- Start from height, pelvis, ribcage, head, hands, and feet. Those landmarks control the whole read.
- Build clean joint chains: shoulder to upper arm to elbow to forearm to wrist to hand, and hip to thigh to knee to shin to ankle to foot.
- Offset visible limb meshes away from the joint node so bends stay connected.
- Keep the rest pose readable and balanced before adding expressive asymmetry.
- Exaggerate hands, feet, and head enough to read at the intended viewing distance.

## Environments And Architecture

- Lock the ground plane, circulation path, and focal wall or focal axis first.
- Define a module width and height before building repeated bays, arches, storefronts, or catwalk runs.
- Break scenes into foreground, midground, and background layers.
- Use prefabs for repeat dressing so custom work stays focused on the hero areas.
- Empty planes need relief: trims, recesses, props, openings, or light variation.

## Foliage And Trees

- Start with trunk mass and root flare before canopy.
- Branches should taper in both length and radius as they iterate outward.
- Put foliage near branch tips, not as one centered blob.
- Species should differ in branching bias, canopy spread, and trunk character.
- If a tree reads like a lollipop or inverted brace, the branch hierarchy is wrong.

## Embedded CSG Recipes

Use these when composite primitives start fighting the silhouette. Embedded CSG parts live inside parts-based specs, support material and breakup on the final output, and accept `position` plus `rotation` on every shape in the `shapes` map.

### Sloped Wedge Chassis

For cases that slope from a taller back to a shorter front (C64 breadbin, retro console lids, tapered kiosk bodies): start with a rectangular body, then subtract a rotated box whose bottom plane defines the target slope.

```json
{
  "name": "chassis",
  "type": "csg",
  "output": "final",
  "shapes": {
    "body": { "type": "box", "size": [4.0, 0.75, 2.1], "position": [0, 0.375, 0] },
    "slope_cutter": {
      "type": "box",
      "size": [4.6, 0.8, 2.8],
      "position": [0, 1.05, 0],
      "rotation": [5.44, 0, 0]
    }
  },
  "operations": [
    { "op": "subtract", "a": "body", "b": "slope_cutter", "result": "final" }
  ],
  "material": { "color": "#c9bc9e", "roughness": 0.62 }
}
```

Sizing rules:

- Slope angle: `atan((back_height - front_height) / depth)`. A `0.20` drop over `2.1` depth is `~5.44` degrees.
- Position the cutter so its rotated bottom plane passes through `(z = -half_depth, y = back_height)` and `(z = +half_depth, y = front_height)`. The cutter's center goes at `y = (back_height + front_height) / 2 + cutter_height / 2`.
- Cutter footprint should exceed the body by `0.5` to `1.0` in each axis so the cut goes fully through at the edges.

**Rotation sign trap.** Three.js rotates around X with `y_new = y*cos - z*sin`. A **positive** X rotation drops `+z` (front) downward, which is what you want for a back-taller-than-front wedge. A negative rotation tilts the *back* down instead and the whole slope reads inverted. If the wedge comes out backwards, flip the sign before touching anything else.

### Recessed Sub-Feature On A Sloped Surface

For a keyboard well, instrument cluster, or any inset feature on the sloped top: add a second subtract whose cutter shares the same rotation as the slope. Put its center at the sloped surface so roughly half of it dips into the body.

```json
"keyboard_well": {
  "type": "box",
  "size": [3.02, 0.12, 1.42],
  "position": [-0.14, 0.65, 0.05],
  "rotation": [5.44, 0, 0]
}
```

Then overlay a thin dark plate in the recess, *also rotated to match the slope*, to sell the two-material read. Any child parts that sit on the recessed surface (keys, dials, screens) should go into a group that shares the same rotation, so their local frame is the surface itself.

### Port And Connector Cutouts

Back-panel cutouts read better as CSG subtracts than as dark decals floating on a solid face: the interior geometry gets real depth and real shadow.

```json
"cartridge_slot": { "type": "box", "size": [1.1, 0.18, 0.1], "position": [0.9, 0.56, -1.05] },
"video_din": { "type": "cylinder", "radius": 0.08, "height": 0.14, "segments": 24,
  "position": [0.15, 0.3, -1.05], "rotation": [90, 0, 0] }
```

Position cutters so their axis pokes through the back face (`z = -body_depth / 2`). Inset thin detail plates (pins, bezels, rocker switches) inside the hole to fill the cavity.

## Industrial And Mechanical Sets

- Use strong primary load-bearing forms first: beams, frames, platforms, racks, walls, or housings.
- Add functional secondary systems next: conduits, guard rails, access panels, vents, valves, cable runs.
- Add tertiary scale cues last: decals, warning bands, bolt-like accents, edge wear, emissive markers.
- Do not over-light every surface; keep glow localized to controls, hazards, or active machinery.
- Modules plus a few rotated or damaged variants beat one giant monolithic assembly.
