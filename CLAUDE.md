# Driftlings (working title)

A browser phonics game for ages 4 to 7. The kickoff brief and decisions live in
the conversation history; the reference look is in `references/`.

## Commands

- `npm run dev` : dev server (the owner keeps one running on :5173)
- `npm test` : unit tests (Vitest)
- `npm run build` : type-check and build to `dist/`
- `npm run play` : build, then play both open areas end to end in headless Chromium through
  real taps and slides (area one, home, out to area two, home); prints ok/FAIL and saves
  screenshots to `shots/play-*`
- `npm run shots` : screenshot each area's map and the home island at four sizes into `shots/`.
  `npm run shots -- chart@i1a2` takes any `?scene=` at one area; `-- crews` is home with both crews
- `npm run audio` : take in clips from `audio-inbox/`, rebuild `public/audio/` and the manifest
- `npm run audio:wanted` : write `audio-inbox/WANTED.md`, the clips the lessons ahead are missing,
  nearest lesson first. What a lesson needs follows from the skill it teaches: a grapheme needs its
  sound, its keyword words (`src/content/keywords.json`: heard in "like in ...", never read) and, for
  a single letter, its name; a blending lesson needs enough buildable words from the graphemes taught
  so far. A new kind of skill gets its own rule in `scripts/audio-wanted.mjs`

URL switches: `?reset` clears progress, `?demo` fills the home island, `?scene=map|home|sleeper|friends|<node id>`
(`sleeper` replays the map scene where the sleeper takes the plank, `friends` the one where it gives it back;
`leave` holds the ship pulling away, `chart` the same with the chart unrolled over it, `arrive` the landing
at home with everyone getting off; `sail` plays the whole crossing home),
`?area=i1a2` goes to that area whatever the progress (alone, or with any of the scenes above), `?q=low`.

Pushing to `main` deploys `dist/` to GitHub Pages. Tell the owner a change is ready locally
before committing and deploying.

## Rules that are easy to break

- `src/core/colorSetup.ts` must be the first import in `main.ts`.
- Colour only from `src/gfx/palette.ts`. No image textures.
- Every scene shader lights with `toonLight` and writes through `writeG` (`src/gfx/glsl.ts`).
- Letters are DOM (`src/stage/glyphs.ts`), never drawn in WebGL.
- A scene declares a stage box per layout (`src/stage/framing.ts`); everything a child
  must see or touch stays inside it. Check both `tall` and `wide` in screenshots.
- Render scale is the device pixel ratio or half of it, nothing in between (`src/stage/quality.ts`).
- The glow colour means "touch this now" and the companion. Do not spend it elsewhere.
- No text instructions in the game UI. Players cannot read.
- Visual work is not done until `npm run shots` output has been looked at.
- Keep files small; split before a file passes about 300 lines.

## Layout

- `src/learn` : skills, event log, skill model, generator, scheduler. Pure logic: no three.js,
  no DOM, no imports from the rest of the app (a test enforces this). It has to be right.
- `src/content` : word list, audio manifest (generated), and the adapter the generator reads
- `src/exercises` : one module per exercise, all satisfying `contract.ts`; `index.ts` is the catalogue
- `src/game` : one child's game (event log + everything derived), the device store, and `areas.ts`:
  which areas are open and the big one who lives on each
- `src/scenes` : dioramas (home island, area map, exercise host, the crossing: `voyage.ts` at sea
  with `chart.ts` unrolling over it, then `landfall.ts` only when an island's crew come home to stay), the ship and the raft it tows, letter tile, scenery recipes,
  and `places.ts`: what makes each area's island its own (outline, palette, scenery, stone path, chart drawing)
- `src/gfx` : palette, shared uniforms, shader chunks, materials, post chain, ground, sky
- `src/stage` : renderer loop, framing rule, quality tiers, tap picking, DOM glyph layer
- `src/cast` : creature rig, species and coats, companion (want + queued acts), springs
- `src/audio` : WebAudio clips, narration by clip id, synthesised effects
- `src/ui` : top bar and progress pips (icons only)
- `src/debug` : `window.__dl` hooks used by the scripts
- `audio-src/` : narration masters. `audio-inbox/` : where the owner drops new clips

## Opening an area

The curriculum (`src/learn/curriculum.ts`) already lists it. Give it a big one in `BIG_ONES`
(`src/game/areas.ts`) and an entry in `PLACES` (`src/scenes/places.ts`); a test checks the two agree.
Add its nodes to `scripts/play.mjs` and its map to `scripts/shots.mjs`, run `npm run audio:wanted`,
and look at the chart in both layouts: a found island is drawn bigger than its blank.

## Adding an exercise

Write one module in `src/exercises/` that satisfies `ExerciseModule`, add its item type to
`src/learn/items.ts`, and add it to the list in `src/exercises/index.ts`. Exercises know nothing
about islands, bosses, scheduling or rewards; the host scene (`scenes/exerciseScene.ts`) does.
