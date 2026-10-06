// The screenshot loop: build, serve, drive headless Chromium on the real GPU,
// and save named views at phone-portrait, phone-landscape, tablet and desktop.
//
//   npm run shots                 all scenes, all sizes
//   npm run shots -- blend        one scene
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
const SCENES = only.length ? only : ['map', 'home'];
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
    await page.goto(`${base}?scene=${scene}&demo${flags.has('--low') ? '&q=low' : ''}`);
    await page.waitForFunction(() => window.__dl?.ready === true, null, { timeout: 15000 });
    // Fixed steps: the same frame every run, whatever the machine is doing.
    await page.evaluate(() => window.__dl.step(1 / 60, 150));
    const suffix = flags.has('--low') ? '-low' : '';
    await page.screenshot({ path: `shots/${scene}-${size.name}${suffix}.png` });
    if (scene === 'home') {
      // The island is wider than the screen: also capture it panned to one side.
      await page.evaluate(() => { window.__dl.pan(-4.5); window.__dl.step(1 / 60, 30); });
      await page.screenshot({ path: `shots/${scene}-${size.name}-panned${suffix}.png` });
    }
    const info = await page.evaluate(() => window.__dl.info());
    console.log(`ok ${scene} ${size.name}`, JSON.stringify(info));
  }
  await ctx.close();
}

await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
