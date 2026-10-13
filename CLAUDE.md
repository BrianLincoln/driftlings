# Driftlings (working title)

A browser phonics game for ages 4 to 7. The kickoff brief and decisions live in
the conversation history; the reference look is in `references/`.

The curriculum follows UFLI Foundations. `docs/ufli.md` has its full lesson order, the eight steps of a
lesson, the irregular words by lesson, and what the game covers and misses. Read it before answering
anything about UFLI; do not go from memory.

## Speed first

The owner wants a fast loop and accepts the odd breakage for it. They play every change themselves on
the dev server; that is the real test. Fix what breaks when it breaks.

- After a change: `npx tsc --noEmit` and `npm test` (two seconds together), say it is ready at
  localhost:5173, stop.
- `npm run play` and a full `npm run shots` are not part of the loop. Run them only when the owner asks.
- A visual change gets at most one targeted shot of the scene it touched (`npm run shots -- map@i1a2`),
  and only when it moves or adds something in a stage box. Colour, timing and small tweaks get none.
- No `npm run build` before a push: the type-check covers it and the deploy builds anyway.
- Check what the change touched, once. Do not re-run a check that passed, or check the live build.
- Say in one line what was not checked, so the owner knows where to look.

## Commands

- `npm run dev` : dev server (the owner keeps one running on :5173)
- `npm test` : unit tests (Vitest)
- `npm run build` : type-check and build to `dist/`
- `npm run play` : slow, only when asked. Build, then play every open area end to end in headless Chromium through
  real taps and slides (area one, home, out to the next, home, and so on; about ten minutes);
  prints ok/FAIL and saves screenshots to `shots/play-*`
- `npm run shots` : the full set is slow, only when asked; name one scene instead. Screenshots each area's map and the home island (from the landing, and with the companion sent
  to three other parts of it) at four sizes into `shots/`.
  `npm run shots -- chart@i1a2` takes any `?scene=` at one area, `-- chart@sea3` the chart of a later sea; `-- crews` is home with every crew;
  `-- i1a3-c+chain` plays one exercise of a node through (as if every clip were recorded) with a picture at each step;
  `npm run shots -- things` is the sheet the drawings of things are judged on (`docs/things.md`)
- `npm run audio` : take in clips from `audio-inbox/`, rebuild `public/audio/` and the manifest
- `npm run audio:wanted` : write `audio-inbox/WANTED.md`, the clips the lessons ahead are missing,
  nearest lesson first. What a lesson needs follows from the skill it teaches: a grapheme needs its
  sound, its keyword words (`src/content/keywords.json`: heard in "like in ...", never read) and, for
  a single letter, its name; a blending lesson needs enough buildable words from the graphemes taught
  so far, and a lesson on new word shapes needs them of those shapes with its letter in. An irregular word needs its word and the sound of each of its tiles. Word chains need the three lines the exercise says (`CHAIN_PROMPTS` in `src/learn/chains.ts`); no chain is offered until all three are recorded. A new kind of skill gets its own rule in `scripts/audio-wanted.mjs`

URL switches: `?reset` clears the progress of the child who played last, `?demo` fills the home island, `?scene=map|home|who|sleeper|friends|<node id>`
(`who` is where children choose who is playing, with `&demo` a full row of six; `sleeper` replays the map scene where the sleeper takes the plank, `friends` the one where it gives it back;
`things` is the sheet of drawings, `&thing=cat` one of them close up;
`leave` holds the ship pulling away, `chart` the same with the chart unrolled over it, `arrive` the landing
at home with everyone getting off; `sail` plays the whole crossing home),
`?scene=i1a3-c&only=chain` opens a node with only that exercise's rounds,
`?area=i1a2` goes to that area whatever the progress (alone, or with any of the scenes above),
`?isles=43` draws the chart as it will be with that many islands (more sheets, not smaller islands), `?sea=3` with
`?scene=chart` the sheet of the third sea as on the crossing to its last island, `?q=low`,
`?unrecorded` plays as if every clip had been recorded (the missing ones are silent): for looking at a lesson
before its narration exists. `npm run play -- --unrecorded` does the same for the scripted play.

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
- The heart colour (`C.heart`) means "this part of the word is learned by heart": the heart on a tile and its letter. Nothing else.
- No text instructions in the game UI. Players cannot read. The one exception is the grown-ups' corner
  (`src/ui/grownups.ts`), behind a button that has to be held down.
- A change to what sits in a stage box is not done until one targeted shot of it has been looked at
  (`npm run shots -- <scene>@<area>`), `tall` and `wide`. Not the full set.
- Keep files small; split before a file passes about 300 lines.

## Layout

- `src/learn` : skills, event log, skill model, generator (`chains.ts` makes the word chains), scheduler (`rounds.ts` has its sizes and the runs of items it builds from). Pure logic: no three.js,
  no DOM, no imports from the rest of the app (a test enforces this). It has to be right.
- `src/content` : word list, audio manifest (generated), and the adapter the generator reads; `endings.json` lists the things shown as one and
  several (each needs a drawing in `scenes/things/`; a test checks) and the short words where s says /z/; `hearts.json` lists the
  irregular words, a tile to a sound (`docs/heart-words.md` has the design and what is built)
- `src/exercises` : one module per exercise, all satisfying `contract.ts`; `index.ts` is the catalogue
- `src/game` : one child's game (event log + everything derived), the children on this device (`children.ts`),
  the device store (one log per child; ids are uuids so an account can take them over later), and `areas.ts`:
  which areas are open and the big one who lives on each, with its manner
- `src/scenes` : dioramas (home island, where the child goes about as the companion (`steer.ts`) among creatures spending
  their day (`residents.ts`) at things to do (`pastime.ts` is the contract, `pastimes.ts` the list of places), area map, exercise host (`exerciseKit.ts` is what it lends an exercise, `stream.ts` the stream and stepping stones of the word chains), the crossing: `voyage.ts` at sea
  with `chart.ts` unrolling over it, then `landfall.ts` only when an island's crew come home to stay), `who.ts` where a child taps their own creature to play, the ship and the raft it tows, letter tile, scenery recipes,
  `places.ts`: what makes each area's island its own (outline, palette, scenery, stone path, chart drawing),
  and `things/`: the drawings of everyday things a word can be about, with `thingsSheet.ts` to look at them on
- `src/gfx` : palette, shared uniforms, shader chunks, materials, post chain, ground, sky
- `src/stage` : renderer loop, framing rule, quality tiers, tap picking, DOM glyph layer
- `src/cast` : creature rig, species and coats, companion (want + queued acts), springs
- `src/audio` : WebAudio clips, narration by clip id, synthesised effects
- `src/ui` : the buttons over a scene (`bar.ts`: the way back top left, who is playing top right, play bottom middle; never a button for where you already are) and progress pips, icons only, and the grown-ups' corner (add, name, remove children)
- `src/debug` : `window.__dl` hooks used by the scripts
- `audio-src/` : narration masters. `audio-inbox/` : where the owner drops new clips

## Drawing a thing

The small drawings of everyday things (cat, cup, bed) are recipes in `src/scenes/things/`. `docs/things.md`
is the brief: the rules, the approved nine to copy from, how the lines are placed by numbering parts, how to
run the sheet and the critic, and the words still to draw in batches. Read it before drawing one.

## Opening an area

An area is an island: the curriculum (`src/learn/curriculum.ts`) is one flat list of them, `AREAS`, in the
order the ship finds them. The chart has a sheet for each sea of six of them (`SEA` in `src/scenes/chartSheets.ts`),
and a crossing shows the sheet of the sea it is in. (The ids, `i1a1` to `i2a1`, are
left over from when areas were grouped; saved progress uses them, so they stay.)

The curriculum already lists it. Give it a big one in `BIG_ONES`
(`src/game/areas.ts`) and an entry in `PLACES` (`src/scenes/places.ts`); a test checks the two agree.
Add its nodes to `scripts/play.mjs` and its map to `scripts/shots.mjs`, run `npm run audio:wanted`,
and look at the chart in both layouts (`npm run shots -- chart@<area>`). The scripted play of it waits until the owner asks. Nothing on the chart is placed by hand: `src/scenes/chartSheets.ts`
cuts each sea's sheet into six spots, and an island's spot follows only from its place in the list, so adding
one to the end moves none of the others and the seventh of a sea starts a new sheet. An eleventh big one needs a spot at home (`DENS` in `homeIsland.ts`).

A lesson added to an area children have already played is marked `late` in the curriculum. Saved progress is keyed
by node id: a beaten checkpoint settles its whole area (`settled`), so nobody is sent back, and a child still there
finds the new lesson next on the path.

## Adding an exercise

Write one module in `src/exercises/` that satisfies `ExerciseModule`, add its item type to
`src/learn/items.ts`, and add it to the list in `src/exercises/index.ts`. Exercises know nothing
about islands, bosses, scheduling or rewards; the host scene (`scenes/exerciseScene.ts`) does.
