// The screenshot loop: build, serve, drive headless Chromium on the real GPU,
// and save named views at phone-portrait, phone-landscape, tablet and desktop.
//
//   npm run shots                 all scenes, all sizes
//   npm run shots -- blend        one scene
//   npm run shots -- chart@i1a2   a scene at one area (any `?scene=` name, then `@` and the area)
//   npm run shots -- chart@sea3   the chart's sheet for a later sea
//   npm run shots -- crews        the home island with every open area's crew, as play leaves it
//   npm run shots -- i1a3-c+chain one exercise of a node (`+` and the exercise), played through with a picture at each step;
//                                 as if every clip were recorded, so an exercise can be seen before its narration exists
//   npm run shots -- things       the drawings of things (docs/things.md): pages of them at play size, each one
//                                 three times closer with its name in the file name only, and a numbered
//                                 sheet of those with no names anywhere; tall and wide
//   npm run shots -- things cat   the same for the ones named
//   npm run shots -- --no-build   reuse dist/
//
// `npm run play` covers the exercises: it plays the first area end to end.

import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { preview } from 'vite';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const only = args.filter((a) => !a.startsWith('--'));
const THINGS = only[0] === 'things';
const SCENES = THINGS ? [] : only.length ? only : ['map', 'map@i1a2', 'map@i1a3', 'map@i1a4', 'map@i2a1', 'map@i2a2', 'home', 'who', 'i1a3-c+chain', 'i2a1-l2+chain'];
/** Every node of the areas that are open, for `crews`. */
const ALL = [
  'i1a1-a', 'i1a1-m', 'i1a1-s', 'i1a1-t', 'i1a1-blend', 'i1a1-boss',
  'i1a2-p', 'i1a2-f', 'i1a2-i', 'i1a2-n', 'i1a2-boss',
  'i1a3-o', 'i1a3-d', 'i1a3-c', 'i1a3-boss',
  'i1a4-u', 'i1a4-g', 'i1a4-b', 'i1a4-e', 'i1a4-boss',
  'i2a1-add-s', 'i2a1-s-z', 'i2a1-k', 'i2a1-h', 'i2a1-r', 'i2a1-l', 'i2a1-boss',
  'i2a2-w', 'i2a2-j', 'i2a2-y', 'i2a2-x', 'i2a2-qu', 'i2a2-v', 'i2a2-z', 'i2a2-boss',
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
for (const size of THINGS ? SIZES.slice(0, 2) : SIZES) {
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
  if (THINGS) await things(page, size, only.slice(1));
  for (const scene of SCENES) {
    const [name, area] = scene.split('@');
    const low = flags.has('--low') ? '&q=low' : '';
    const [node, exercise] = scene.split('+');
    if (exercise) {
      await page.goto(`${base}?reset&scene=${node}&only=${exercise}&unrecorded${low}`);
      await page.waitForFunction(() => window.__dl?.ready === true, null, { timeout: 15000 });
      // Played by its own debug hook: a picture each time it waits for a tap, and a last one when it is over.
      let [n, quiet] = [0, 0];
      for (let i = 0; i < 400 && n < 14; i++) {
        const s = await page.evaluate(() => window.__dl.exercise());
        if (!s || s.finished) break;
        if (s.tap) {
          await page.evaluate(() => window.__dl.step(1 / 60, 30));
          await page.screenshot({ path: `shots/${node}-${exercise}-${size.name}-${String(n++).padStart(2, '0')}.png` });
          for (const id of s.tap) await page.evaluate((t) => window.__dl.tap(t), id);
          await page.evaluate(() => window.__dl.step(1 / 60, 50));
          await page.screenshot({ path: `shots/${node}-${exercise}-${size.name}-${String(n++).padStart(2, '0')}.png` });
        }
        // Three seconds after the last tap with nothing more asked: the companion is on its way over.
        quiet = s.tap ? 0 : quiet + 1;
        if (quiet === 11 && n > 0) await page.screenshot({ path: `shots/${node}-${exercise}-${size.name}-after.png` });
        await page.evaluate(() => window.__dl.step(1 / 60, 12));
      }
      await page.evaluate(() => window.__dl.step(1 / 60, 100));
      await page.screenshot({ path: `shots/${node}-${exercise}-${size.name}-over.png` });
      if (n === 0) { console.log(`  FAIL ${scene}: nothing to tap`); failed = true; }
      console.log(`ok ${scene} ${size.name}`);
      continue;
    }
    await page.goto(name === 'crews' ? `${base}?reset&scene=map${low}` : `${base}?scene=${name}${area ? (/^sea\d+$/.test(area) ? `&sea=${area.slice(3)}` : `&area=${area}`) : ''}&demo${low}`);
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

/** The things sheet in one size: pages at play size, each thing close up, and those tiled and numbered. */
async function things(page, size, wanted) {
  const layout = size.width < size.height ? 'tall' : 'wide';
  const open = async (query) => {
    await page.goto(`${base}?scene=things${query}`);
    await page.waitForFunction(() => window.__dl?.ready === true, null, { timeout: 15000 });
    await page.evaluate(() => window.__dl.step(1 / 60, 150));
    return page.evaluate(() => window.__dl.info());
  };
  const { things: all, perPage } = await open('');
  const names = wanted.length ? wanted : all;
  if (!wanted.length) {
    for (let p = 0; p * perPage < all.length; p++) {
      await open(`&page=${p}`);
      await page.screenshot({ path: `shots/things-page${p + 1}-${layout}.png` });
    }
  }
  const close = [];
  for (const name of names) {
    await open(`&thing=${name}`);
    const path = `shots/things-${name}-${layout}.png`;
    // The middle of the picture, where the thing is: the rest is grass.
    const side = Math.min(size.width, size.height) * 0.9;
    await page.screenshot({ path, clip: { x: (size.width - side) / 2, y: (size.height - side) / 2, width: side, height: side } });
    close.push(path);
  }
  // For the critic: every close-up on one sheet, with a number and no name.
  const cells = close.map((path, i) => `<figure><img src="data:image/png;base64,${readFileSync(path).toString('base64')}"><figcaption>${i + 1}</figcaption></figure>`);
  const sheet = await page.context().newPage();
  await sheet.setViewportSize({ width: 1500, height: 500 });
  await sheet.setContent(`<style>body{margin:0;display:grid;grid-template-columns:repeat(${Math.min(5, cells.length)},1fr);gap:6px;padding:6px;background:#fff}
    figure{margin:0;position:relative}img{width:100%;display:block}figcaption{position:absolute;left:8px;top:4px;font:700 28px sans-serif;color:#222}</style>${cells.join('')}`);
  await sheet.screenshot({ path: `shots/things-numbered-${layout}.png`, fullPage: true });
  await sheet.close();
  console.log(`ok things ${layout}: ${names.join(' ')}`);
}

await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
