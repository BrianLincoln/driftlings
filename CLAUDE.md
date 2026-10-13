# Driftlings (working title)

A browser phonics game for ages 4 to 7. The kickoff brief and decisions live in
the conversation history; the reference look is in `references/`.

## Commands

- `npm run dev` : dev server (the owner keeps one running on :5173)
- `npm test` : unit tests (Vitest)
- `npm run build` : type-check and build to `dist/`
- `npm run play` : build, then play every open area end to end in headless Chromium through
  real taps and slides (area one, home, out to the next, home, and so on; about ten minutes);
  prints ok/FAIL and saves screenshots to `shots/play-*`
- `npm run shots` : screenshot each area's map and the home island (from the landing, and with the companion sent
  to three other parts of it) at four sizes into `shots/`.
  `npm run shots -- chart@i1a2` takes any `?scene=` at one area; `-- crews` is home with every crew
- `npm run audio` : take in clips from `audio-inbox/`, rebuild `public/audio/` and the manifest
- `npm run audio:wanted` : write `audio-inbox/WANTED.md`, the clips the lessons ahead are missing,
  nearest lesson first. What a lesson needs follows from the skill it teaches: a grapheme needs its
  sound, its keyword words (`src/content/keywords.json`: heard in "like in ...", never read) and, for
  a single letter, its name; a blending lesson needs enough buildable words from the graphemes taught
  so far. A new kind of skill gets its own rule in `scripts/audio-wanted.mjs`

URL switches: `?reset` clears the progress of the child who played last, `?demo` fills the home island, `?scene=map|home|who|sleeper|friends|<node id>`
(`who` is where children choose who is playing, with `&demo` a full row of six; `sleeper` replays the map scene where the sleeper takes the plank, `friends` the one where it gives it back;
`leave` holds the ship pulling away, `chart` the same with the chart unrolled over it, `arrive` the landing
at home with everyone getting off; `sail` plays the whole crossing home),
`?area=i1a2` goes to that area whatever the progress (alone, or with any of the scenes above),
`?isles=43` draws the chart as it will be with that many islands, `?q=low`.

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
- No text instructions in the game UI. Players cannot read. The one exception is the grown-ups' corner
  (`src/ui/grownups.ts`), behind a button that has to be held down.
- Visual work is not done until `npm run shots` output has been looked at.
- Keep files small; split before a file passes about 300 lines.

## Layout

- `src/learn` : skills, event log, skill model, generator, scheduler. Pure logic: no three.js,
  no DOM, no imports from the rest of the app (a test enforces this). It has to be right.
- `src/content` : word list, audio manifest (generated), and the adapter the generator reads; `endings.json` lists the things shown as one and
  several (each needs a drawing in `scenes/things.ts`; a test checks) and the short words where s says /z/
- `src/exercises` : one module per exercise, all satisfying `contract.ts`; `index.ts` is the catalogue
- `src/game` : one child's game (event log + everything derived), the children on this device (`children.ts`),
  the device store (one log per child; ids are uuids so an account can take them over later), and `areas.ts`:
  which areas are open and the big one who lives on each, with its manner
- `src/scenes` : dioramas (home island, where the child goes about as the companion (`steer.ts`) among creatures spending
  their day (`residents.ts`) at things to do (`pastime.ts` is the contract, `pastimes.ts` the list of places), area map, exercise host, the crossing: `voyage.ts` at sea
  with `chart.ts` unrolling over it, then `landfall.ts` only when an island's crew come home to stay), `who.ts` where a child taps their own creature to play, the ship and the raft it tows, letter tile, scenery recipes,
  and `places.ts`: what makes each area's island its own (outline, palette, scenery, stone path, chart drawing)
- `src/gfx` : palette, shared uniforms, shader chunks, materials, post chain, ground, sky
- `src/stage` : renderer loop, framing rule, quality tiers, tap picking, DOM glyph layer
- `src/cast` : creature rig, species and coats, companion (want + queued acts), springs
- `src/audio` : WebAudio clips, narration by clip id, synthesised effects
- `src/ui` : the buttons over a scene (`bar.ts`: the way back top left, who is playing top right, play bottom middle; never a button for where you already are) and progress pips, icons only, and the grown-ups' corner (add, name, remove children)
- `src/debug` : `window.__dl` hooks used by the scripts
- `audio-src/` : narration masters. `audio-inbox/` : where the owner drops new clips

## Opening an area

An area is an island: the curriculum (`src/learn/curriculum.ts`) is one flat list of them, `AREAS`, in the
order the ship finds them, and there is one chart with all of them on it. (The ids, `i1a1` to `i2a1`, are
left over from when areas were grouped; saved progress uses them, so they stay.)

The curriculum already lists it. Give it a big one in `BIG_ONES`
(`src/game/areas.ts`) and an entry in `PLACES` (`src/scenes/places.ts`); a test checks the two agree.
Add its nodes to `scripts/play.mjs` and its map to `scripts/shots.mjs`, run `npm run audio:wanted`,
and look at the chart in both layouts. Nothing on the chart is placed by hand: `src/scenes/chartSheets.ts`
cuts the sheet into a spot for every area the curriculum lists, so adding one to the list makes the rest a
little smaller. An eleventh big one needs a spot at home (`DENS` in `homeIsland.ts`).

## Adding an exercise

Write one module in `src/exercises/` that satisfies `ExerciseModule`, add its item type to
`src/learn/items.ts`, and add it to the list in `src/exercises/index.ts`. Exercises know nothing
about islands, bosses, scheduling or rewards; the host scene (`scenes/exerciseScene.ts`) does.
