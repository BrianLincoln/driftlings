# Driftlings (working title)

A browser phonics game for ages 4 to 7. The kickoff brief and decisions live in
the conversation history; the reference look is in `references/`.

## Commands

- `npm run dev` : dev server (also on the LAN, for a phone)
- `npm test` : unit tests (Vitest)
- `npm run build` : type-check and build to `dist/`
- `npm run shots -- --play` : build, then screenshot every scene at phone-portrait,
  phone-landscape, tablet and desktop into `shots/` (headless Chromium, real GPU)

Pushing to `main` deploys `dist/` to GitHub Pages.

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

- `src/gfx` : palette, shared uniforms, shader chunks, materials, post chain, ground, sky
- `src/stage` : renderer loop, framing rule, quality tiers, tap picking, DOM glyph layer
- `src/cast` : creature, companion (want + queued acts), springs
- `src/scenes` : dioramas and scenery recipes
- `src/audio` : WebAudio clips and synthesised effects
- `src/debug` : `window.__dl` hooks used by `scripts/shots.mjs`
- `audio/` : raw narration from the owner, not yet normalised
