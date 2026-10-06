# Style and tech handoff

Written 2026-10-06 for someone starting a new three.js game (fixed camera,
small diorama scenes, ages 4–7) who wants this project's look and its better
ideas, and who will never see this repository. Everything you need is meant to
be on this page; file names are given only so the last section makes sense.

The source project is a browser-playable, third-person, open-world sandbox in
a flat storybook style: about 40,000 lines of TypeScript, no backend, no
imported art. It has a wordless story led by a small companion creature.

**How far to trust this.** Values and code excerpts are copied from the source
as it stands today. Performance numbers are from one machine (an M1 Pro
laptop). The game has **never been run on a real phone or on real integrated
graphics** by the people who built it; everything said about phones below is
either a code path that exists or a fix made from one report of it looking bad
on an iPhone. Section 8 says which is which.

Screenshots are in `handoff-screenshots/` beside this file, captured from
today's build in headless Chromium at 1600×900 (the phone one at 844×390, 3x):

| File | Shows |
|---|---|
| `01-day-vista.png` | Daytime: three-band shading, warm outlines, layered distance |
| `02-dawn-monochrome.png` | Dawn palette: the whole frame in one hue family |
| `03-dusk.png` | Dusk palette: banded sky, purple clouds |
| `04-night-windows.png` | Night: blue palette, glowing window with bloom, accents kept |
| `05-what-each-pass-adds.png` | One frame four ways: full, no outlines, no grade, smooth fog |
| `06-companion.png` | The companion: cold, warm, pointing with a thought bubble, celebrating |
| `07-character-and-creature.png` | Player character on a creature, cast shadows, a key prompt |
| `08-touch-controls-phone.png` | Phone landscape: floating stick and button (and a debug panel that should not be there, see §9) |

---

## 1. Stack

| Piece | What | Version |
|---|---|---|
| Renderer | three.js, used directly | `^0.186.1` |
| Wrapper | **None.** No react-three-fiber, no React, no framework | |
| Language | TypeScript | `^7.0.2` |
| Build | Vite, static output, `base: './'` | `^8.3.1` |
| UI | Plain DOM elements and one CSS file, positioned over the canvas | |
| Debug panel | lil-gui | `^0.21.0` |
| Screenshots / tests | Playwright driving headless Chromium on the real GPU | `^1.63.0` |
| Audio | WebAudio: effects synthesised in code, music as MP3 loops | |
| Backend | None. Saves are `localStorage` | |

How it fits together:

- One `main.ts` owns the renderer, the scene, the camera and a single
  `requestAnimationFrame` loop. Each frame: read input → update game state →
  update shared shader uniforms → draw through a hand-written post pipeline.
- three.js is used as a thin layer: geometry, matrices, instancing, render
  targets. **None of its lights or built-in materials are used.** Every
  surface is a hand-written GLSL3 `ShaderMaterial`, and the post chain is
  hand-rolled on WebGL2 multiple render targets rather than `EffectComposer`.
- WebGL2, not WebGPU, because WebGL2 is everywhere and has what the look needs
  (MRT, half-float targets, instancing).
- The renderer is created like this, and colour management is switched off so
  a palette hex value is exactly the colour on screen:

```ts
// Must run before ANY module constructs a THREE.Color (so: its own file,
// imported first). Otherwise everything renders too dark.
THREE.ColorManagement.enabled = false;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 18000); // 36° vertical: flat, storybook perspective
```

- World generation runs in Web Workers. That is an open-world concern; a
  diorama game does not need it.

---

## 2. How the look is achieved

The target was "a flat-shaded storybook illustration": 2–3 hard light bands
per surface, thin warm outlines, a small desaturated palette, each scene
nearly one hue, distance as flat layers, and a blue night with glowing
windows.

### 2.1 What matters most

In my judgement, in order. `05-what-each-pass-adds.png` backs the claims
about outlines and the grade; the rest is from having iterated on it.

1. **Palette with a coloured shade.** Shade is never a darkening. Each time of
   day supplies three *colours* (light, mid, shade) that the surface colour is
   multiplied by; by day the shade is a warm purple-grey, at night a blue.
   Values stay high: nothing goes near black.
2. **Hard three-band lighting on smooth, rounded shapes.** The bands only look
   good when normals are smooth and segment counts are high enough that the
   band edge is a clean curve.
3. **Outlines from screen-space depth, in a warm dark colour.** Turning them
   off (top right of the sheet) loses most of the "drawn" feeling.
4. **A grade that pulls the frame toward one hue, with a few accents
   exempt.** In the sheet the difference is modest at midday (rock goes
   pinker, trees greener without it) and large at dawn, dusk and night.
5. **Ground-only cast shadows that land in the shade band**, plus small
   hand-drawn marks on the ground. These stop flat surfaces looking empty.
6. **Stepped fog.** Essential for kilometre-deep views; for a small diorama it
   matters little and its hard part (§2.6) should not be copied.

### 2.2 Palette

Colour comes from two tables and nothing else. There are no image textures in
the game.

**Time-of-day keyframes.** Each sets sky, fog, the three light bands, the grade
tint and its strength, clouds, outline colour and water.

| Field | Rose dawn | Golden | Olive noon | Coral dusk | Twilight | Blue night |
|---|---|---|---|---|---|---|
| skyTop | `#edcfb6` | `#ecd6a8` | `#e6d9b8` | `#76597f` | `#343d6a` | `#16213f` |
| skyMid | `#f2dcc6` | `#f2e2bc` | `#eee3c7` | `#d98583` | `#6a6690` | `#22325a` |
| skyHorizon | `#f6e6d4` | `#f7ecd1` | `#f3ead6` | `#f5b08e` | `#b08ca4` | `#34497a` |
| fog | `#efd6c3` | `#f1e2c0` | `#e7dbbd` | `#eca58e` | `#8a7ea0` | `#33466f` |
| **light** | `#fff8f0` | `#fff8e8` | `#fff8e6` | `#fff0e0` | `#d0c8e6` | `#8d9dd2` |
| **mid** | `#ecd6d0` | `#ecdcbe` | `#e8d8b8` | `#ecc2b8` | `#aaa4cc` | `#6d7cb2` |
| **shade** | `#cbaeb4` | `#c6b09c` | `#bca894` | `#bc92a0` | `#8480ac` | `#4d5989` |
| tint | `#c8918a` | `#c9ab72` | `#ad9a66` | `#d88c7c` | `#8a82b4` | `#5d74b0` |
| tintAmt | 0.62 | 0.46 | 0.40 | 0.54 | 0.72 | 0.86 |
| lift | 0.24 | 0.07 | 0.05 | 0.20 | 0.06 | 0.00 |
| cloud | `#fdf8f2` | `#fffaf0` | `#fffbf2` | `#86648a` | `#5e5a86` | `#2c3a62` |
| cloudShade | `#f0dcd2` | `#f3e6cc` | `#efe4cd` | `#6e5078` | `#4c4a74` | `#243256` |
| **outline** | `#5c3a3e` | `#4c3526` | `#402c20` | `#4a2a3a` | `#241c38` | `#141630` |
| water | `#b6a7b0` | `#a9b3a6` | `#9fb0a8` | `#8c86a6` | `#5c6490` | `#2a3a64` |

Hours they sit at over a 24 h day (smoothstep blend between neighbours):
night 0–4.6, twilight 5.8, rose 7.0, golden 9.5, olive 12.5, golden 16.0,
coral 18.2, twilight 19.6, night 20.8–24. A fixed-time game can simply pick
one column per scene.

**Base surface colours** (before lighting and grade):

```ts
meadow '#c6ae6c'  meadowDark '#b09860'  forestFloor '#8e7d4e'  heath '#a08a7a'
rock '#b8a39c'    rockDark '#8f7c78'    snow '#f6f1ea'         sand '#dcc59c'
path '#d8c197'    foliage '#5d5a3c'     trunk '#7a5244'        bush '#6c6a42'
tuft '#7a6a3a'    flower '#fbf6ec'      flowerCore '#e8c860'   buttercup '#f0d25a'
harebell '#9ea6e0' foam '#f2efe6'       moss '#727048'         stone '#9d918a'
cabinWall '#a9543f' (the one red accent) cabinRoof '#5c4040'   cabinTrim '#efe4d2'
cabinWindow '#3b3440' windowGlow '#ffd27a' cutWood '#e9cf9c'   steel '#8e9cab'
soot '#3e3238'    ember '#ffb45a'
```

UI and painted-feature colours used throughout: ink `#4a2e36` (icons) /
`#2e1f28` (creature eyes and mouths), parchment `#fbf3e4`, eye white
`#fffdf8`, highlight gold `#f0c26a`, blush `#ef9c93`.

### 2.3 Materials and shading

Every scene shader includes one shared block. This is the whole lighting model:

```glsl
uniform vec3 uLightDir, uLightCol, uMidCol, uShadeCol;
uniform float uBand1;  // 0.22
uniform float uBand2;  // -0.12

vec3 toonLight(vec3 n) {
  float d = dot(n, uLightDir);
  return d > uBand1 ? uLightCol : (d > uBand2 ? uMidCol : uShadeCol);
}
// surface colour = base * toonLight(normal)
```

One object holds those uniforms and is spread into every material
(`{ ...U, ...own }`), so changing the time of day or a debug slider updates
one place.

Rules that keep the bands clean:

- **The key light never grazes.** Its `y` is clamped to at least 0.24;
  lower, and everything falls into the shade band and the frame goes muddy.
  At night the moon becomes the key light.
- **Normals are authored for the band, not for accuracy.** Tree tiers and
  bushes blend their normals toward a sphere around the form, so each reads as
  one puffy shape with a lit top. Fur is displaced geometry that *keeps the
  undisplaced sphere's normals*, so only the silhouette is fluffy and the
  shading stays a clean curve.
- **Round things need segments.** 12-sided capsules showed facets in the band
  edge; the character was rebuilt from lathes and ellipsoids at high counts.
- **Per-instance tone variation** of about ±7% (`base *= 1 - 0.15*0.5 +
  0.15*tone`) stops instanced props looking stamped.
- **Detail is drawn in the shader, with hard steps**, e.g. clapboard lines:
  `base *= 1.0 - 0.18 * step(0.86, fract(localY * 2.4))`.

Every scene shader writes two render targets instead of a colour:

```glsl
layout(location = 0) out vec4 gColor;  // rgb = lit colour, a = emissive / grade flag
layout(location = 1) out vec4 gND;     // xyz = view normal * tag, w = linear view depth
void writeG(vec3 col, float emissive, vec3 nWorld, vec3 viewPos) {
  gColor = vec4(col, emissive);
  float tag = uIsProp > 2.5 ? 0.8 : uIsProp > 1.5 ? 0.62 : uIsProp > 0.5 ? 0.5 : 1.0;
  gND = vec4(normalize((viewMatrix * vec4(nWorld, 0.0)).xyz) * tag, -viewPos.z);
}
```

Two conventions ride on that and are worth copying exactly:

- **The colour alpha channel is a small protocol.** Positive = emissive
  strength (feeds bloom). Negative = "keep this much of my own colour through
  the grade" (accents: −0.45 for red walls, −0.55 water, about −0.7 for the
  player character, −0.95 for eye whites). 0.5 or more also skips the grade
  entirely, which is how a warm glowing character stays warm in a blue night.
- **The length of the stored normal is a category tag** (ground 1.0, props
  0.5, creatures 0.62). Post passes read it to treat categories differently
  without another buffer.

The one "you can use this" signal on interactable objects is in the same
shared block: a hard warm rim that breathes plus a thin shimmer that sweeps
across now and then, colour `vec3(1.0, 0.94, 0.72)`:

```glsl
float fres  = 1.0 - abs(dot(n, viewDir));
float rim   = step(0.8 - 0.08 * k, fres) * (0.55 + 0.45 * sin(uTime * 2.4));
float sweep = fract((world.x + world.z) * 0.11 + world.y * 0.16 - uTime * 0.32);
float shimmer = step(0.955, sweep) * step(sweep, 0.978);
```

It is halved on big objects (a whole tree flaring is too much) and on thin
ones (which are nearly all rim).

### 2.4 Outlines

Done in the composite pass from the normal+depth target; no inverted hulls,
no extra geometry. Settings: width 1.6 px, depth threshold 0.045, normal
threshold 0.4, fade from 220 m to 2600 m.

```glsl
vec2 o = uTexel * uOutlineWidth;
vec4 l = texture(tND, vUv - vec2(o.x, 0.0)), r = texture(tND, vUv + vec2(o.x, 0.0));
vec4 u = texture(tND, vUv + vec2(0.0, o.y)), b = texture(tND, vUv - vec2(0.0, o.y));
// Laplacian of INVERSE depth: zero on any plane, even at grazing angles,
// and positive only where this pixel is in front of its neighbours.
float ex = 2.0 - d / l.w - d / r.w;
float ey = 2.0 - d / u.w - d / b.w;
float de = max(ex, ey);
float depthEdge = smoothstep(uDepthThr, uDepthThr * 1.8, de);
// Normal creases, near the camera only, and only on the nearer side.
float ne = /* max over 4 neighbours of */ 1.0 - dot(n, nNeighbour);
float normalEdge = smoothstep(uNormalThr, uNormalThr + 0.15, ne) * step(-0.002, de)
                 * (1.0 - smoothstep(30.0, 160.0, d));
float edge = max(depthEdge, normalEdge) * (1.0 - smoothstep(uFade0, uFade1, d));
col = mix(col, uOutlineCol, edge);
```

Why this form: a plain depth difference draws false lines across flat ground
seen at a shallow angle; the inverse-depth Laplacian does not, and it puts the
line on the front object only.

Rules: the line colour comes from the palette (deep plum or brown, navy at
night, never black). Lines are drawn *before* fog, so distant lines become a
darker shade of their layer rather than ink. Small fuzzy things (creatures)
ease their line to 25% and toward their own colour between 14 m and 90 m, or
a distant group reads as a cluster of ink rings.

Limit to know: **this outline is too heavy for faces.** Geometric eyes and
cheeks got ringed and read as spectacles. Faces are painted in the shader
instead (§4).

### 2.5 Lighting, shadows, night

- There are no three.js lights. "Lighting" is the three band colours and one
  direction.
- **Cast shadows are a coverage mask, not a shadow map.** Each caster is
  flattened along the light onto the plane of its own base and drawn from
  straight above into a 2048² single-channel target covering 180 m. The
  ground shader samples it by world position and drops into the *shade band*,
  the same tone as the dark side of a hill. No depth compare, so no acne or
  bias tuning. Only the ground receives. Shadow length is capped at 1.5 m per
  metre of height; at 2.2 a low sun put the whole foreground in shade. Cost
  measured in isolation: about 0.4 ms on the M1 Pro.
- **Contact shadows** under characters are flat discs painted in the ground
  shader from a uniform array (player plus the 12 nearest creatures),
  shrinking with height. Cheap, and it makes jumps and hovering readable.
- **Night** is a palette, not darkness: the grade tint goes to 0.86 blue,
  windows mix to `#ffd27a` and write emissive, and that feeds bloom.

### 2.6 Fog and sky

Fog is applied in post so surfaces and outlines get identical treatment:

```glsl
float f = 1.0 - exp(-max(dist - 40.0, 0.0) * 0.00032);   // start 40 m
f = floor(f * 5.0 + 0.3) / 5.0;                           // 5 flat bands
f = min(f, 0.9);                                          // never fully fogged
col = mix(col, uFogCol, f);
```

Per-pixel bands cut diagonal stripes across a single mountain, so there is an
extra quarter-resolution "layer" pass that walks up the screen from each
terrain pixel to its silhouette ridge and fogs the whole hill by the ridge's
depth, making each range one flat tone. It works, and it was the most
fragile piece of the renderer. A diorama should get depth layers from its
composition (separate planes, each given a tone) and skip this.

Sky is one fullscreen triangle: elevation quantised into 7 flat strips
blending horizon → mid → top, a flat sun disc with two hard glow rings, a
crescent moon, hashed stars. Clouds are about 34 camera-facing quads on a far
dome; the fragment shader draws each as a signed-distance union of 5–7
circles cut by a flat bottom, with a rim band, a shade band and an in-shader
outline. Neither writes depth.

### 2.7 Post-processing chain

1. Scene → G-buffer (two half-float targets + depth).
2. Bloom: extract `rgb * max(alpha, 0)` to half resolution, two passes of a
   separable 9-tap Gaussian (weights 0.227, 0.195, 0.122, 0.054, 0.016).
3. Composite: grade → outlines → fog → add bloom.
4. An overlay scene with real transparency (thought bubbles, sketches,
   guidance marks) drawn on top, depth-tested by hand against the G-buffer.
5. FXAA to the screen. MSAA is off.

The grade, which is the "one hue family" rule as code:

```glsl
if (cc.a < 0.5) {                                   // glowing things skip it
  float keep = clamp(-cc.a, 0.0, 1.0);              // accents opt out partly
  float l  = dot(col,   vec3(0.299, 0.587, 0.114));
  float tl = dot(uTint, vec3(0.299, 0.587, 0.114));
  col = mix(col, uTint * (l / max(tl, 1e-3)), uTintAmt * (1.0 - keep));  // keep luminance, swap chroma
  col = mix(col, uFogCol, uLift * (1.0 - keep * 0.7));                   // high-key wash
}
```

### 2.8 Consistency rules

- Colours only from the two palette tables. No textures.
- Every shader writes the G-buffer through the one `writeG` function.
- Shade is a colour. Nothing is black, including outlines and crows.
- Accents are rare and deliberate: one red building, the player, white snow,
  warm windows. Everything else obeys the grade.
- Glowing orange means one thing in the fiction. Decide what your glow colour
  means and never spend it on anything else.
- No change is done until a screenshot has been looked at next to the
  references (§9).

---

## 3. Where assets come from

**Everything is built in code.** There are no imported models, no glTF, no
image textures, no fonts. The only files loaded at runtime are MP3 loops. The
one "texture" is a 256² four-channel tileable value-noise image generated at
startup, used to wobble boundaries and animate water.

Techniques used to build geometry:

- **Lathe profiles** for anything round: bodies, hats, pots. A list of
  `[radius, y]` pairs, 32–56 segments.
- **Scaled spheres and capsules**, merged, for limbs, feet, noses.
- **Sculpted spheres**: each direction on a sphere mapped through a shape
  function to a radius, normals from finite differences (used for a stag's
  barrel body).
- **Trees**: a tapered trunk plus 5–6 stacked tiers, each a scalloped,
  drooping skirt, with a small random offset per tier and per-instance lean
  and bend. Four levels of detail of the same recipe.
- **Boulders**: a sphere displaced by seeded noise with a flattened base.
- **Buildings**: boxes, pitched roofs and gables, with every vertex tagged
  with a "kind" index.

How colour gets on without textures: each vertex carries a **kind** (an index
into a uniform array of 29 palette colours) for props, or a **flat vertex
colour plus a paint tag** for creatures. Parts are merged into one mesh per
object, so an object is one draw call whatever its number of colours.

Adding a new prop: write a `build…()` function returning a merged
`BufferGeometry` with kinds; make a material with the prop factory (options:
wind sway, bend, tone variation, double-sided); draw it as an instanced mesh.
Adding a creature: §4.

Icons are also code: each is a function drawing canvas paths onto a 128×128
canvas (flat fills, a 6 px plum ink line, round joins). The same canvas is
used as a data URL in DOM elements and as a texture on in-world billboards,
so an icon looks identical in both places.

Sound effects are synthesised with WebAudio (sine glides for the companion's
chirps, filtered noise for wood and fire), through one compressor and a short
echo. The audio context is created on the first key or pointer press.

---

## 4. Characters and creatures

### Construction

A character is a small skeleton of plain `Object3D`s that is **never added to
the scene**. After animation each frame, the world matrix of each part is
copied into an instanced mesh for that part type ("all left ears"). Every
creature of a kind therefore costs a handful of draw calls in total, and a
worst case of 17 creatures on screen added about 10 draw calls.

Each instance also carries a tint colour (so one white-furred mesh serves
three coat colours, with a per-vertex mask so noses keep theirs) and a 4-float
"eye" attribute: look x, look y, lid openness, spare.

### Faces are painted, not modelled

The face is drawn by the body's fragment shader on the surface of the head
sphere. Fragments tagged as face convert their object-space direction to
(yaw, pitch) angles and evaluate distance functions for eyes, pupils, mouth
and blush:

```glsl
vec3 dir = normalize(vObj - uEyeOrigin);
vec2 p = vec2(atan(dir.x, dir.z), asin(clamp(dir.y, -1.0, 1.0)));
float aa = max(length(fwidth(dir)), 1e-4);   // from the direction: atan wraps at the back
float lw = max(0.012, aa * 1.1);             // ink line never thinner than ~1 px
```

Defaults for the companion: eye centre (0.36, 0.20) rad mirrored in x, eye
size (0.22, 0.27), pupil (0.085, 0.115), pupil travel (0.13, 0.11).

What this buys: expressions are a few uniforms. Lid value 1 = open, 0.05 =
blink, 0.55–0.8 = heavy or sad, **negative = happy upward arcs**. A brow cut
slants the top of the eye one way for resolve and the other for grief. Mouth
curvature is one number (positive smile, negative frown). Blush is two radii.

Lessons paid for:

- Both pupils must share one look direction. Offsetting each inward looks
  cross-eyed.
- Eyes high and well apart with a big open lower face read as friendly.
- Whites should be near-pure and exempt from the grade, with a thin crisp
  line; at night they take a little scene light so they do not glow.
- Anti-alias feature edges over ±0.5 px only. Wider made eyes muddy at play
  distance.
- Near-black creatures read as holes in a high-key scene; use a lifted slate.

### Animation

There are no animation clips, no skinning and no keyframes. All motion is
code:

- **Pose blending**: each state (ground, air, swim, ride…) computes a full
  pose; states blend by smoothed weights.
- **Stride phase advances with distance travelled**, and stride length grows
  with speed, so feet do not skate.
- **Springs for everything secondary**: one tiny class, used for squash and
  stretch, arm targets, hat tips, lean.

```ts
class Spring { v = 0; constructor(public x = 0) {}
  step(target: number, k: number, c: number, dt: number) {
    this.v += (k * (target - this.x) - c * this.v) * dt; this.x += this.v * dt; return this.x; } }
// arms: k=120, c=12   squash: k=180, c=14   lean: k=90, c=12
```

- **Volume-preserving squash**: `scale.set(1/√sy, sy, 1/√sy)`.
- **Exponential easing** for every follow value: `x += (target - x) * (1 - exp(-rate * dt))`,
  which is frame-rate independent.
- **Two-bone IK** where hands or feet must land on something (pedals, reins).
- **Little life**: random blinks every 1.6–4.8 s lasting 0.12 s, a 2% breathing
  scale, idle glances.
- Dust and sparkle puffs are opaque toon blobs that swell and shrink (the
  G-buffer has no transparency), from a pool of 40 in one instanced draw.

One timing bug worth knowing: testing "did we just pass time k" as
`t - dt < k && t >= k` can miss `k` to float rounding at a steady frame step.
Keep the time from before the frame and compare `t0 < k && t >= k`.

---

## 5. The companion: showing what to do without words

This is the system most worth carrying over. See `06-companion.png`.

### 5.1 What it is

A pebble-round body 0.34 m in radius with big painted eyes, two stubby arms,
two feet and a glowing spot on its chest. Deliberately minimal: arms that can
point, wave and reach; eyes that can look, blink and smile; a body that can
hop, squash, lean and spin. It never speaks. Everything it "says" is posture,
gesture, where it looks, one icon in a thought bubble, and a few synthesised
sounds.

Its colour is a progress meter: a single `warmth` value 0–1 eases its tint
from ash blue `#b8c6d8` through apricot `#ecc9ae` to amber `#f0924c`, turns
its frown to a smile, adds blush, and above about 0.55 makes it self-lit.

### 5.2 Architecture: a director, a "want" and a queue of acts

Three layers, cleanly separated:

1. **Steps as data.** The story is a table. Each row says what completes it
   and how the companion should behave meanwhile. The director only
   understands a handful of step *kinds* (meet, pick up, gather, build, light,
   catch, rest).

```ts
{ id: 'axe', kind: 'pickup', targets: 'axe', item: 'axe',
  anchor: 'stumpSpot',   // where the companion stands
  face: 'axe',           // what it looks and points at
  icon: 'axe',           // its thought bubble
  warmth: 0, hint: 'tug', onDone: 'celebrate' }
```

2. **A standing `want`.** On entering a step the director fills one struct and
   leaves the companion to act it out continuously:

```ts
interface Want {
  at: Vector3;             // where to be
  face: Vector3 | null;    // what to keep looking / pointing at
  pose: 'stand' | 'sit' | 'shiver' | 'warm' | 'point';
  icon: IconName | null;   // bubble
  count?, total?;          // a tally shown as "×n" beside the icon
  lead: boolean;           // wait for the player on the way there
  usher?: Vector3;         // "after you": sweep an arm into this doorway
  fetch?: Vector3;         // "go and get that, bring it here"
  present?: boolean;       // "build this": arms wide at the outline
  lasso?: Vector3;         // "like this": demonstrate the action on this target
  rally?: boolean;         // "come on, this way!"
  settled?: boolean;       // nothing to ask for: just be content
}
```

3. **A queue of one-shot acts** that interrupt the want and then return to it:
   `greet`, `celebrate`, `praise`, `hint`, `pat`, `emerge`.

The companion's update is: if an act is queued, run it; otherwise travel to
`want.at`; once there, run whichever looping pantomime the want selects. A
new instruction is a new field and a new branch, not a new system.

### 5.3 The behaviours

**Leading.** It walks ahead at 3.1 m/s (you jog at 6.2, so you catch up). If
you fall more than 10 m behind *and* are no closer to the goal than it is, it
stops, turns, waves one arm overhead, bounces, and calls every 3.5 s. It
resumes when you are within 6 m.

**Pointing at rest.** At its spot it glances at the target and raises an arm
at it for 1.6 s, then rests 2.6 s, repeating. Its eyes go to the target while
pointing and back to you between.

**The thought bubble.** A cream scalloped circle with two trailing dots and
one icon, drawn as a billboard above its head with a minimum on-screen size
of 44 px. Shown **only within 8 m** (9.5 m to hide, so the edge does not
flicker): from across the yard the pantomime does the talking; up close the
icon confirms it. It pops in with a 25% overshoot, bobs gently, hides while
the companion is walking, and shows a heart during celebrations. A tally
changes in place with a small bob. When the count needed reaches zero the
bubble disappears rather than showing "×0".

**The repeated hint ("tug").** After **20 s without progress** (and at least
4 s into the step), it runs to you at 5.2 m/s, stops 1 m short, reaches both
arms out and tugs toward the goal three times over 1.9 s with a sound on
each, calls, runs to the goal, then hops and points for 1.9 s. While a hint
runs, the glint on the relevant objects is boosted 1.5× for 8 s. It never
leaves a 45 m "yard" around home: past the edge it stops, hops and calls you
back instead.

**Looping pantomimes.** Each is a fixed cycle with a rest at the end. Each
makes a sound on the **first three cycles only**, then goes quiet, so it does
not nag.

| Meaning | Cycle | What it does |
|---|---|---|
| "After you" (usher) | 3.4 s | Stands beside a doorway, turned between you and it. Holds the near arm out to you low, palm up; sweeps it round into the opening with a hop; holds it there looking at you; drops it. |
| "Fetch that, bring it here" | 5.2 s | Turns and points at the source with a hop and a chirp (0.5–2.1 s), then turns to you and beckons (2.4–3.6 s). |
| "Build this" | 5.2 s | Throws both arms wide at the ghosted outline around it, looks it up and down, then back at you. |
| "Like this" (demonstration) | 4.8 s | Faces the target, performs a miniature of the action itself with its own tiny prop (whirl 0.2–1.95 s, throw to 2.95 s; the prop fades on arrival so the real act is still yours), then turns to you with a hop and happy eyes: "now you". |
| "This way!" (rally) | 5 s / 3.8 s | While travelling, stops every 5 s to turn, wave and hop. At the spot: hops and points for 2.6 s, then turns and waves you over for 1.2 s. |

**Praise.** On success it does one of two things. *Celebrate*: arms up,
bouncing, one spin, sparkles every 0.6 s, 1.8 s long, then happy-arc eyes for
1.5 s. *Praise* (for big moments): it runs over to you first, then a big jump
with two spins, hearts, sparkles and a coo over 3.4 s, then 4 s of happy
eyes. A celebrate already in progress is not restarted by a second trigger.

**Contentment.** When there is nothing to ask, it sits by the fire with palms
out, swaying, and never points or tugs. If you are within 7 m it looks round
at you every 5–11 s with happy eyes. It can be patted: it leans up, eyes
shut, squashes and coos on each of three beats, then bounces and spins.

**Moods** override the face and posture: scared (trembling, wide eyes, arms
in), sad, a quieter "down", resolved, and a lowest state with trudging, bent
posture, hanging arms, heavy slanted lids, a trembling lip, a sigh every
6.5 s and a tear every 4.3 s. While frightened or grieving it shows no bubble:
it is not asking for anything.

### 5.4 Supporting signals

- **Glint**: only things usable *right now* glint (§2.3). This is the main
  "touch this" cue and it is tied to the current step.
- **Ghosted outlines** of what is to be built: dashed ink edges that crawl
  slowly (ink `#4c2a38`, 2.7 px, dash length 0.26 m) over a pale hatched wash
  (`#fff6e4`), fading where something solid is in front.
- **An action badge**: a round parchment button showing an *icon of the
  verb* available here (a hand to pick up, an axe to chop). On touch it is
  the button itself. Beside it a small animated glyph shows *how*: a finger
  or a mouse, tapping for a press, pressing and staying for a hold.
- **Everything is one action.** One key, one click or the badge. Nothing
  triggers by walking into it.
- **A far-off pointer.** If you wander well away for **15 s**, three soft
  orange chevrons appear at waist height 2.3 m from you on the side the goal
  is on, lying nearly flat and pointing at it in the world, with a pulse
  running outward. Maximum opacity 0.6: "a hint, not a waypoint marker". It
  fades as you approach and hides behind solid things. This took three
  designs: a screen-edge arrowhead (disliked: its look, its position, and
  that it appeared at the very start), a flat CSS shape (sheared to a sliver
  at low camera angles), then this.
- **Sound carries meaning and distance.** The companion's voice is full
  within 50 m and silent by 110 m. A hard cutoff was tried and silenced the
  very hint that calls you back.

### 5.5 What playtesting changed

- A scripted beat where it walked off at night and pointed at a distant light
  read as "leading you off at random and then pointing back at the house". It
  was cut. Pointing at far things is weak; pointing at near things is strong.
- Standing at a gate pointing was not enough to teach a new verb. The
  demonstration cycle replaced it.
- A waiting-and-calling behaviour left on by default nagged whenever you were
  off doing the right thing. Default leading to off for steps where the
  player legitimately leaves.
- For young players the *target* was made forgiving too: the practice
  creature's flee radius was shrunk to 3 m and it was stopped from wandering.
- A head tuft was removed on feedback and nothing replaced it; the design
  still lacks a strong silhouette hook.

---

## 6. Camera and input

### Input abstraction

Raw devices are turned into one small `InputState` (move x/y in −1..1, run,
walk, jump held, jump pressed, up, down) plus accumulated look deltas and
zoom. Gameplay code only ever sees that. Touch does not have its own code
path through the game: on-screen buttons call `virtualKey('KeyE', true)` and
the stick calls `setStick(x, y, walk, run)`, so they are indistinguishable
from the keyboard downstream.

- **Mouse**: click locks the pointer; movement looks; wheel zooms; left click
  while locked is the action; right click is a second action.
- **Touch** is enabled when `matchMedia('(hover: none) and (pointer: coarse)')`
  matches. Pointer events with `pointerType === 'touch'` are routed to the
  touch layer and ignored by the mouse handler.
  - Left 45% of the screen: a floating stick that appears under the thumb
    (radius 56 px). Under 45% push = walk, past 115% = sprint and the knob
    turns gold.
  - Anywhere else: drag to look (gain 1.5). A second finger pinches to zoom.
  - Buttons are contextual: only those that do something right now are shown,
    and their labels change with context.
  - On touch, keyboard help and key prompts are hidden by a `body.touch` class.
- Required page setup, all of which bit at some point:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
```
```css
body.touch { touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.button { right: calc(22px + env(safe-area-inset-right)); bottom: calc(26px + env(safe-area-inset-bottom)); }
```
```ts
document.addEventListener('gesturestart', (e) => e.preventDefault()); // iOS page pinch
document.addEventListener('dblclick', (e) => e.preventDefault());     // double-tap zoom
```

### Camera

A third-person orbit camera that needs only a focus point. Most of it does
not apply to a fixed camera; the parts that might:

- **36° vertical field of view**, which flattens perspective toward an
  illustration.
- A damped spring "dip" on hard landings, a small look-ahead along velocity,
  and soft vertical follow while airborne so a jump reads as the character
  leaving the ground rather than the world dropping.
- No auto-recentre with a mouse (it fights the player). On touch, with no
  finger on the look side for 0.4 s, it eases round behind the direction of
  travel.
- Cutscene cameras are tables of timed shots. The recurring bug: the planned
  sightline was not checked against the actual ground and the camera ended up
  inside a hollow looking at its wall.

### Screen sizes and orientation

Honestly: little was done.

- A `resize` listener sets the canvas to the window, updates the camera
  aspect and resizes the render targets. That is all.
- **There is no orientation handling.** The touch layout assumes landscape
  (stick on the left 45%, buttons bottom right). Portrait was never designed
  or tested. No orientation lock, no rotate prompt.
- With a fixed vertical field of view, a portrait window gets a very narrow
  horizontal view. For fixed diorama scenes, decide the framing rule up front:
  fit the scene by whichever of width or height is tighter, and design each
  scene inside a safe rectangle.
- Safe-area insets are respected for buttons; nothing else adapts.
- One media query moves the inventory from bottom-left to top on coarse
  pointers so it clears the stick.

---

## 7. Text and UI

The game was built to have **no text**, so this is thin, and a phonics game
will need more than is here.

What exists and why it stays crisp:

- **All UI is DOM over the canvas**, not drawn in WebGL. The browser renders
  it at the device's native pixel ratio regardless of the 3D render scale, so
  when adaptive quality drops the 3D to 55% the UI is untouched. This is the
  main reason anything is crisp.
- Fonts are system stacks, nothing downloaded: a rounded stack for counts
  (`ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', 'Nunito',
  system-ui`, weight 800, 21 px) and Georgia for button labels. Colour is the
  ink `#4a2e36` on parchment `rgba(251, 243, 228, 0.86)`, with a 2–3 px ink
  ring made from `box-shadow`. Pop-in uses an overshoot curve,
  `cubic-bezier(.3, 1.8, .5, 1)`.
- Icons are 128 px canvases shown at 34–52 CSS px, so they stay sharp on
  3x screens.
- **In-world icons** (the thought bubble) are textured billboards drawn in the
  overlay pass with a minimum on-screen size:

```glsl
float px = uSize * projectionMatrix[1][1] / max(depth, 1e-3) * uRes.y * 0.5;  // world size in pixels
float s  = max(px, uMinPx) * uScale;                                          // never smaller than uMinPx
```

Weaknesses to design around:

- The overlay is drawn **before FXAA** and at the 3D render scale, so in-world
  icons soften when quality drops. The only in-world text is a "×3" tally
  baked into a 128 px bubble canvas; it is legible but not sharp.
- For letters that must be perfectly crisp and are the point of the game:
  use DOM elements positioned from projected 3D points, or draw text after
  anti-aliasing at native resolution (large canvases or signed-distance-field
  glyphs). Do not put letterforms through this project's overlay path as is.
- A few leftover DOM key prompts and a loading veil contain English words.
  The "no text" rule was not fully kept.

---

## 8. Performance

### Measured (M1 Pro laptop, 1600×900, headless Chromium, uncapped)

- 4.2 ms average frame, 7.8 ms 99th percentile on a moving run, with vsync
  off. With vsync on it holds 60 fps.
- Visible load at nine test places: 3.5–8.2 million triangles, 640–890 draw
  calls.
- Where the frame goes (one thing switched off at a time, two places):
  trees 36–54%, ground and water 5–12%, halving the pixel count 10%, the
  shadow mask pass 6–7%, all other props 10–12%, and **FXAA, fog and outlines
  1–2% each**. The post chain that makes the look is nearly free. The cost is
  vertices.
- Main thread: 2.9–4.7 ms a frame, of which game logic about 0.5; the rest is
  issuing draw calls.

A diorama will have a tiny fraction of that geometry, so the same shading and
post chain should be cheap. That is an inference, not a measurement.

### Techniques

- **Instancing everywhere**; creatures as instanced parts (§4).
- **Merged geometry with per-vertex colour indices**: one draw per object.
- **Pixel-ratio cap**: 1.5 on desktop, 2 on touch devices.
- **Adaptive quality**: averages frame time over 1.5 s windows and acts only
  after two slow windows in a row, ignoring single hitches and hidden tabs.
  It sheds in order: render resolution down to 70% → cast shadows off →
  geometry detail → resolution down to 55%; and restores in reverse once
  frames are under 1/55 s. Outlines and flat colour survive downscaling well,
  which is why pixels go first.
- Half-resolution bloom, quarter-resolution fog layering.
- Shared geometry and index buffers between chunks (and a hard-won rule never
  to dispose a shared buffer when one user of it goes away).
- Levels of detail for trees; a simpler far shape cut the average frame from
  about 5.6 to 4.2 ms.
- Audio: loops are fetched small but decoded only when first needed and
  dropped 45 s after falling silent, because a decoded loop is about 40 MB a
  minute.

### Phones: known problems and unknowns

Fixed after it "looked bad on an iPhone":

- **The adaptive controller mistook a frame cap for a slow GPU.** iOS caps
  `requestAnimationFrame` at 30 fps in Low Power Mode; the "slow" test was
  anything under 50 fps, so the phone always fell to the lowest quality. On
  touch devices the threshold is now about 27 fps.
- **A 1.5 pixel-ratio cap on a 3x screen** looked soft with chunky outlines
  after FXAA. Touch devices now cap at 2.
- A 32-bit float render target was changed to 16-bit because half-float
  targets are renderable on more mobile GPUs.

Not known:

- Nobody re-tested on a real phone after those fixes. Safari itself is
  untested: the automated WebKit build crashed on the development machine.
- No measurement exists on Intel or AMD integrated graphics. "3–4× slower
  than the M1" is an estimate.
- The G-buffer needs WebGL2 with renderable half-float colour targets and two
  draw buffers. There is **no fallback** if a device lacks them; the game was
  never made to detect that.
- Decoded music held 70–100 MB in the worst case. Not tried on a phone.
- Outline width is in render pixels, so line weight changes with pixel ratio
  and with adaptive scaling. Not compensated.
- The debug panel is visible on phones (see `08-touch-controls-phone.png`).

### Measuring pitfalls

- Timings need the GPU to themselves. Another tab or another headless browser
  doubled to tenfolded them. Triangle and draw-call counts are reliable at any
  time; frame times are not.
- `gl.finish()` does not wait in Chrome. Use a one-pixel `readPixels` to force
  a sync, and then trust differences, not totals.

---

## 9. Honest retrospective

### What worked and I would do again

- **The screenshot loop.** A script builds the game, drives a headless browser
  on the real GPU, waits until loading is idle, and saves named views; another
  tiles them into a contact sheet to compare with reference images. Nearly
  every visual bug was found by looking at these, not by reading code. Build
  this in week one.
- **A debug hook object on `window`** with: set time, teleport, frame the
  camera on a thing, jump to any story step, and **step frames by hand at a
  fixed dt**. Manual stepping made animation and cutscene bugs reproducible.
- **Scripts that play the game by the real keys** and print ok/FAIL per step.
  They found bugs that unit tests of the parts would not.
- **A checkpoint strip** in dev: reload at any story step from nothing.
- **Steps as data, a small set of verbs, one companion interface** (§5).
- **One shared uniform block** and one G-buffer write function.
- **Painted faces.** More expressive, cheaper and cleaner than modelled ones.
- **Writing down why**, including what was tried and rejected.

### What was painful

- **Colour management.** Constants created before it was disabled made
  everything dark, and it was only visible in screenshots.
- **No transparency in the G-buffer.** Every soft or see-through thing needed
  a workaround: opaque puffs, a separate overlay scene with a hand-written
  depth test, clouds outside the depth buffer.
- **Layered fog.** Stripes, streaks through trees, wedges across objects; four
  separate fixes and it still misassigns pixels at silhouettes.
- **Hand-set bounding volumes.** One inverted box silently culled whole
  chunks of ground.
- **Giant files.** `main.ts` is about 2,060 lines, the shader file 2,050, two
  story files about 1,900 each. The shader file is GLSL in template strings
  with magic indices into a 29-entry colour array, and tag values compared by
  float ranges (`tag > 1.5 && tag < 2.5`). It works and it is hard to change.
- **The decision log grew to about 5,000 lines** and stopped being readable.
- **Guidance design took many rounds** (§5.4, §5.5) and each round was only
  resolved by someone actually playing.
- **Performance numbers that were wrong** because something else was using
  the GPU. One "20% regression" was probably an artefact.
- **Saves tied to generated content.** Changing world generation invalidated
  every save; the fix was a version number that wipes them all.
- **Testing only by script.** Several finished sections have still not been
  played by a person.

### What I would do differently

- Test on a real phone and a cheap laptop in the first week, and keep doing
  it. This is the largest gap in the project.
- Decide the screen-size and orientation policy before building any UI.
- Split the shader file by material and replace magic numbers with named
  constants shared between TypeScript and GLSL.
- Keep the debug panel out of production builds and off touch devices.
- Keep the decision log short; move settled history out.
- Add a capability check and a plain fallback for devices without the needed
  render-target support.
- Scale outline width by pixel ratio.
- Add a mute button. The code has a mute flag but the player has no control for it.

### What should NOT be copied

- **Anything open-world**: terrain streaming, the quadtree, worker-built
  chunks, seeded world generation, level-of-detail machinery, collision
  rebuilt from scatter data. None of it serves a diorama.
- **The layered fog pass.** Compose depth with scene layers instead.
- **The day/night cycle** unless the game needs time to pass. Pick a palette
  column per scene.
- **Third-person camera feel code** (speed kicks, look-ahead, cutaway of
  objects between camera and player).
- **The control scheme.** A virtual stick, pinch zoom, sprint thresholds and
  hold-to-act are too much for ages 4–7. The useful parts are the input
  abstraction, the single action, the verb-icon badge and the page setup.
- **In-world icons through a pre-anti-aliasing overlay** for anything that
  must be read as a letter.
- **Session-random behaviour mixed with seeded content** without a clear rule
  for which is which. It caused repeated confusion.
- **English text in the DOM** in a game that claims to be wordless.
- **The reference style's own characters and names.** The look was inspired by
  an existing animated series; all creatures and names here are original, and
  yours should be too.

---

## 10. Key files

Line counts are approximate and given as a rough guide to weight.

**Rendering**

| File | Lines | What it is |
|---|---|---|
| `src/core/colorSetup.ts` | 5 | Turns colour management off; must be the first import |
| `src/gfx/palette.ts` | 200 | Time-of-day keyframes, their blending, base surface colours |
| `src/gfx/shaders.ts` | 2050 | All scene GLSL: shared toon block, G-buffer write, terrain, props, water, sky, clouds, creatures, faces |
| `src/gfx/materials.ts` | 400 | The shared uniform block and a factory per material type |
| `src/gfx/post.ts` | 430 | G-buffer, bloom, composite (grade, outlines, fog), overlay, FXAA |
| `src/gfx/environment.ts` | 65 | Clock, sun and moon direction, pushes the palette into uniforms |
| `src/gfx/sky.ts` | 60 | Fullscreen sky triangle and cloud billboards |
| `src/gfx/groundShadow.ts` | 80 | The cast-shadow coverage mask |
| `src/gfx/geometry.ts` | 530 | Procedural trees, boulders, bushes, flowers, buildings |
| `src/gfx/puffs.ts` | 85 | Pooled opaque dust and sparkle blobs |

**Characters**

| File | Lines | What it is |
|---|---|---|
| `src/mobs/parts.ts` | 180 | Instanced part batches, lathe and merge helpers, the spring, fur |
| `src/player/character.ts` | 1200 | The player rig: construction, pose blending, IK |
| `src/mobs/floof.ts`, `crow.ts`, `stelk.ts` | 470–950 | One creature each: geometry, brain, animation |
| `src/mobs/beast.ts` | 820 | A shared brain and body for eleven further kinds |
| `src/mobs/manager.ts` | 630 | Spawning, culling, contact shadows, soft collision |

**Companion and guidance**

| File | Lines | What it is |
|---|---|---|
| `src/story/spirit.ts` | 960 | The companion: want, acts, every pantomime, face and colour |
| `src/story/phase1.ts` | 100 | Story steps as a data table, and the step kinds |
| `src/story/story.ts` | 1890 | The director: runs steps, hint timer, glint, inventory, save |
| `src/story/pointer.ts` | 155 | The far-off chevrons |
| `src/story/overlay.ts` | 260 | Transparent overlay: dashed sketches, billboards, depth test |
| `src/story/icons.ts` | 850 | Every icon and the thought bubble, drawn with canvas paths |
| `src/story/hud.ts` | 190 | DOM inventory tabs, the action badge, the how-to glyph |
| `src/story/audio.ts` | 350 | Synthesised sound effects |

**Input, camera, shell**

| File | Lines | What it is |
|---|---|---|
| `src/player/input.ts` | 135 | Keyboard, mouse and virtual keys → one input state |
| `src/ui/touch.ts` | 180 | Floating stick, look drag, pinch, contextual buttons |
| `src/player/orbitCamera.ts` | 150 | The orbit camera |
| `src/style.css` | 90 | All non-story UI styling, including touch layout |
| `src/main.ts` | 2060 | Renderer setup, the frame loop, resize, adaptive quality, debug hooks |
| `src/ui/debug.ts` | 235 | The lil-gui panel and stats readout |
| `src/ui/checkpoints.ts` | 110 | Dev strip to reload at any story step |

**Tooling**

| File | What it is |
|---|---|
| `scripts/shots.mjs` | Build, serve, headless screenshots of named views, and a perf run |
| `scripts/sheet.mjs` | Tile images into a contact sheet |
| `scripts/probe.mjs` | Load the build, run an expression in the page, optionally screenshot |
| `scripts/touch.mjs` | Drive real touch events in a phone-sized context |
| `scripts/perf-audit.mjs` | Draws and triangles by kind; frame cost with one thing off at a time |
