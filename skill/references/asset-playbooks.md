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

## Industrial And Mechanical Sets

- Use strong primary load-bearing forms first: beams, frames, platforms, racks, walls, or housings.
- Add functional secondary systems next: conduits, guard rails, access panels, vents, valves, cable runs.
- Add tertiary scale cues last: decals, warning bands, bolt-like accents, edge wear, emissive markers.
- Do not over-light every surface; keep glow localized to controls, hazards, or active machinery.
- Modules plus a few rotated or damaged variants beat one giant monolithic assembly.
