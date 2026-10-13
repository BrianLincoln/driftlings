// The screenshot loop: build, serve, drive headless Chromium on the real GPU,
// and save named views at phone-portrait, phone-landscape, tablet and desktop.
//
//   npm run shots                 all scenes, all sizes
//   npm run shots -- blend        one scene
//   npm run shots -- chart@i1a2   a scene at one area (any `?scene=` name, then `@` and the area)
//   npm run shots -- crews        the home island with every open area's crew, as play leaves it
//   npm run shots -- --no-build   reuse dist/
//
// `npm run play` covers the exercises: it plays the first area end to end.

import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { preview } from 'vite';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const only = args.filter((a) => !a.startsWith('--'));
const SCENES = only.length ? only : ['map', 'map@i1a2', 'map@i1a3', 'map@i1a4', 'map@i2a1', 'home', 'who'];
/** Every node of the areas that are open, for `crews`. */
const ALL = [
  'i1a1-a', 'i1a1-m', 'i1a1-s', 'i1a1-t', 'i1a1-blend', 'i1a1-boss',
  'i1a2-p', 'i1a2-f', 'i1a2-i', 'i1a2-n', 'i1a2-boss',
  'i1a3-o', 'i1a3-d', 'i1a3-c', 'i1a3-boss',
  'i1a4-u', 'i1a4-g', 'i1a4-b', 'i1a4-e', 'i1a4-boss',
  'i2a1-add-s', 'i2a1-s-z', 'i2a1-k', 'i2a1-h', 'i2a1-r', 'i2a1-l', 'i2a1-boss',
];
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 844, dpr: 3, touch: true },
  { name: 'phone-landscape', width: 844, height: 390, dpr: 3, touch: true },
  { name: 'tablet-portrait', width: 820, height: 1180, dpr: 2, touch: true },
  { name: 'desktop', width: 1600, height: 900, dpr: 1, touch: false },
];

if (!flags.has('--no-build')) execSync('npx vite build', { stdio: 'inherit' });
mkdirSync('shots', { recursive: true });

const server = await preview({ preview: { port: 4317, strictPort: false }, logLevel: 'silent' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});

let failed = false;
for (const size of SIZES) {
  const ctx = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.dpr,
    hasTouch: size.touch,
    isMobile: size.touch,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      console.log(`  [${m.type()}] ${m.text().slice(0, 600)}`);
      if (m.type() === 'error') failed = true;
    }
  });
  page.on('pageerror', (e) => {
    console.log(`  [pageerror] ${e.message}`);
    failed = true;
  });
  for (const scene of SCENES) {
    const [name, area] = scene.split('@');
    const low = flags.has('--low') ? '&q=low' : '';
    await page.goto(name === 'crews' ? `${base}?reset&scene=map${low}` : `${base}?scene=${name}${area ? `&area=${area}` : ''}&demo${low}`);
    await page.waitForFunction(() => window.__dl?.ready === true, null, { timeout: 15000 });
    if (name === 'crews') {
      // Everyone comes up from the ship; wait until the last of them has found its spot.
      await page.evaluate(async (ids) => { window.__dl.complete(ids); await window.__dl.goto('home'); window.__dl.step(1 / 60, 720); }, ALL);
    }
    // Fixed steps: the same frame every run, whatever the machine is doing.
    await page.evaluate(() => window.__dl.step(1 / 60, 150));
    const suffix = flags.has('--low') ? '-low' : '';
    const file = scene.replace('@', '-');
    await page.screenshot({ path: `shots/${file}-${size.name}${suffix}.png` });
    if (name === 'home' || name === 'crews') {
      // The companion goes all over the island and the camera with it: also capture it off to one side, in the middle, and down at the near shore.
      for (const [x, z, as] of [[-9, -8, 'west'], [3, 3, 'middle'], [-2, 17, 'south']]) {
        await page.evaluate(([sx, sz]) => { window.__dl.steer(sx, sz); window.__dl.step(1 / 60, 240); }, [x, z]);
        await page.screenshot({ path: `shots/${file}-${size.name}-${as}${suffix}.png` });
      }
    }
    const info = await page.evaluate(() => window.__dl.info());
    console.log(`ok ${scene} ${size.name}`, JSON.stringify(info));
  }
  await ctx.close();
}

await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
