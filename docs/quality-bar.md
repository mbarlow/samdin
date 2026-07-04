# Quality Bar — Anchor Prompts

Seven hero specs anchor the current quality bar — all shipped in [`../specs/`](../specs/) and built from the prompts below. Drop a comparable prompt at an LLM and you should get a result in this neighborhood; if it lands lower, iterate on screenshots, not JSON.

The [Anchor rubric](#anchor-rubric) at the bottom is the acceptance test — what "match the quality bar" concretely means.

## Field radio

Spec: [`specs/quality-bar-field-radio.json`](../specs/quality-bar-field-radio.json)

![Samdin — mid-century field radio quality anchor](../media/hero-field-radio.png)

> Build a hero-quality mid-century field radio. Rugged two-tone painted shell with darker side caps, recessed dark fascia framing two windows: a multi-layer speaker (bezel + wire-mesh + slat array + chrome badge) on the left, and an amber tuning dial (glow strip + tick marks + red needle behind glass) on the right. Knurled rubber knobs as reusable modules, top utility carry handle, telescoping antenna at angle. Stage on a small concrete plinth, studio lighting, restrained bloom, three-quarter camera tight on the prop.

## Rangefinder camera

Spec: [`specs/quality-bar-rangefinder-camera.json`](../specs/quality-bar-rangefinder-camera.json)

![Samdin — 1960s rangefinder camera quality anchor](../media/hero-rangefinder-camera.png)

> A 1960s 35mm rangefinder camera, Leica M-style. Brass top plate over vulcanite leatherette body wrap; multi-coated front lens element with real glass transmission; concentric multi-ring lens assembly (focus ring with rubber tab + distance scale band + aperture ring with engraved indices); rangefinder, viewfinder, and illuminator windows on the front; hot shoe, shutter speed dial, advance lever, frame counter window, rewind crank on top; eyepiece, LCD, and thumb rest on the back. Stage on a wood-and-leather plinth with brass lip. Match the field radio quality bar.

## Espresso machine

Spec: [`specs/quality-bar-espresso-machine.json`](../specs/quality-bar-espresso-machine.json)

![Samdin — prosumer espresso machine quality anchor](../media/hero-espresso-machine.png)

> A prosumer single-boiler espresso machine, E61-style group head. Mirror-polished chrome shell with brass front fascia plate; brass-trimmed group head with portafilter locked in (walnut handle, twin chrome spouts); pressure gauge with cream face, red over-pressure zone, black needle, and transmission glass; green READY LED + red power LED + rocker switch on the front; brass top warming plate with railed perimeter; chrome steam wand on the right with wood steam knob; chrome hot-water spout on the left with matching wood knob; stainless drip tray with slatted grate; demitasse cup of fresh espresso resting on the tray. Stage on the same wood-and-leather plinth used for the radio and camera. Active state — warm group-head glow, LEDs lit. Match the field radio and rangefinder camera quality bar.

## Anglepoise desk lamp

Spec: [`specs/quality-bar-anglepoise-lamp.json`](../specs/quality-bar-anglepoise-lamp.json)

![Samdin — 1950s Anglepoise desk lamp quality anchor](../media/hero-anglepoise-lamp.png)

> A 1950s Anglepoise 1227 desk lamp, switched on, captured mid-pose with the arm angled forward over the plinth and the red shade tilted down to read the surface. Cast iron base, short vertical post, articulated joint chain (base → lower arm → elbow → upper arm → wrist → shade) with real joint groups and axle hardware; twin chrome tension springs at every joint, rendered as stacked helical coil tori; chrome arm tubes with polished reflective finish; brass end caps on the axles; red enamel bell-shaped shade with cream interior, chrome rim around the wide opening, brass bulb socket, warm glowing bulb inside. A warm three-tier emissive halo spills onto the leather plinth where the light lands. Power cord trailing from the base. Stage on the same wood-and-leather plinth as the other anchors. Match the field radio, rangefinder camera, and espresso machine quality bar.

## Olivetti typewriter

Spec: [`specs/quality-bar-typewriter.json`](../specs/quality-bar-typewriter.json)

![Samdin — 1963 Olivetti Lettera 32 typewriter quality anchor](../media/hero-typewriter.png)

> A 1963 Olivetti Lettera 32 portable typewriter in signal blue, mid-typing with a sheet of paper in the carriage and two lines of typed text visible on the page plus a cursor mark where the next letter will land. CSG-carved wedge chassis with clean body seams and three chrome plates on the front (logo, engraving, model badge). Dense round cream keycaps with dark legend dots, arrayed in a four-row layout plus spacebar, shift, tab, and return. Carriage across the back: black rubber platen with visible rod through it, wood platen knobs on each end with chrome collars, angled metal paper rest, hinted ribbon spools, chrome carriage return lever angled down on the left. A few darker type bar hints rising toward the platen from inside the body. Rubber feet, plinth with wood + leather + brass lip to match the other anchors. First anchor with a cool palette to balance the warm-heavy set.

## Sony minidisc

Spec: [`specs/quality-bar-minidisc.json`](../specs/quality-bar-minidisc.json)

![Samdin — Sony minidisc quality anchor](../media/hero-minidisc.png)

> A Sony-style 7cm minidisc. Translucent blue shell with a visible inner hub disc reading through the plastic, an anodized metal shutter sliding across the read window, and a recessed white sticker label area on the top face for printed text. Real transmission on the shell, brushed-metal shutter, crisp shutter-track detail. Stage on the shared wood-and-leather plinth with brass lip. Match the hard-surface quality bar — the test here is believable translucency and a clean, small, high-density object that still reads as premium at a tight camera.

## Courier pickup

Spec: [`specs/quality-bar-courier-pickup.json`](../specs/quality-bar-courier-pickup.json)

![Samdin — compact courier pickup quality anchor](../media/hero-courier-pickup.png)

> A compact courier pickup — the vehicle-class quality anchor. Two-tone utility body with an open cargo bed, a readable cabin interior (seats, dash, wheel), chrome lighting trim front and rear, glass with real transmission, rubber tires with hub detail. Two-tone paint separation and honest panel proportions over a boxy-but-deliberate silhouette. Stage on the shared product-shot plinth. The vehicle bar: silhouette and stance first, then cabin and trim read, before micro-detail. The radio remains the stricter overall hero anchor.

## Anchor rubric

"Match the quality bar" means, concretely, before an anchor is accepted:

1. **Silhouette first.** The form reads as a deliberate hero prop, not a rough procedural sketch — clean stance, believable proportions, footprint sized so the model (not the plinth) drives framing.
2. **Material separation.** Adjacent surfaces read at a glance — shell vs fascia vs metal trim vs glass vs knobs differ in color family, roughness, or metalness. Non-emissive primary surfaces carry `breakup` (noise + roughnessVariation); metals and glass sit on `scene.lighting.environment`.
3. **Staged render, judged from screenshots.** Every revision is validated (`node cli/validate-spec.cjs`) and inspected through the actual viewer (`node cli/inspect-model.js`) — construction problems get fixed from render evidence, not JSON theory.
4. **Spec-camera hero view.** The spec's own `scene.camera` frames a strong three-quarter hero shot without manual adjustment; the broader preset sweep is acceptable but the spec camera is the bar.
5. **No renderer-hostile detail.** Micro-detail that produces broken shadow artifacts is removed rather than kept for its own sake.
6. **Grounded and honest.** Feet/base contact the plinth (`make lint` ground-contact catches floaters); emissive stays a 1–3 accent focal tool, not wallpaper.

Regression is guarded by `make golden` — a builder change that moves any anchor's geometry fails CI. Build the next anchor by the same discipline: silhouette, staged render, then detail.
