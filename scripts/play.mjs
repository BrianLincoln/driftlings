// Plays the first area from a clean start to the creatures arriving home,
// through the real taps and slides, and prints ok/FAIL per step. Screenshots
// of each stage of play go to shots/play-*.
//
//   npm run play                 phone portrait and desktop
//   npm run play -- --no-build

import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { preview } from 'vite';

const flags = new Set(process.argv.slice(2));
const SIZES = [
  { name: 'phone', width: 390, height: 844, dpr: 3, touch: true },
  { name: 'desktop', width: 1600, height: 900, dpr: 1, touch: false },
];
const NODES = ['i1a1-a', 'i1a1-m', 'i1a1-surprise', 'i1a1-s', 'i1a1-t', 'i1a1-blend', 'i1a1-boss'];
const SHOOT = new Set(['i1a1-a', 'i1a1-blend', 'i1a1-boss']);

if (!flags.has('--no-build')) execSync('npx vite build', { stdio: 'inherit' });
mkdirSync('shots', { recursive: true });
const server = await preview({ preview: { port: 4318 }, logLevel: 'silent' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
let failed = false;
const fail = (msg) => { console.log(`FAIL ${msg}`); failed = true; };

for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.dpr, hasTouch: size.touch, isMobile: size.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(`${size.name} page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') fail(`${size.name} console: ${m.text().slice(0, 300)}`); });
  const shot = (name) => page.screenshot({ path: `shots/play-${size.name}-${name}.png` });
  const step = (n = 12) => page.evaluate((k) => window.__dl.step(1 / 60, k), n);
  const scene = () => page.evaluate(() => window.__dl.info().scene);

  await page.goto(`${base}?reset`);
  await page.waitForFunction(() => window.__dl?.ready === true, null, { timeout: 15000 });
  await step(90);
  await shot('00-map-start');

  for (const node of NODES) {
    const ok = await page.evaluate((id) => window.__dl.tap(id === 'i1a1-surprise' ? 'surprise' : `node:${id}`), node);
    if (!ok) { fail(`${size.name} could not tap ${node} on the map`); break; }
    await page.waitForTimeout(450);
    await step(30);
    if ((await scene()) !== 'exercise') { fail(`${size.name} ${node} did not open`); break; }
    let last = '';
    let shots = 0;
    let done = false;
    for (let i = 0; i < 1500 && !done; i++) {
      const s = await page.evaluate(() => window.__dl.exercise());
      const kind = !s ? 'none' : s.finished ? 'finished' : s.slide ? 'slide' : s.tap ? `tap:${s.tap[0].split(':')[0]}` : 'waiting';
      if (kind !== last && kind !== 'waiting' && SHOOT.has(node) && shots < 7) {
        await step(18);
        await shot(`${node}-${String(shots++).padStart(2, '0')}-${kind.replace(':', '-')}`);
      }
      last = kind === 'waiting' ? last : kind;
      if (s?.tap) for (const id of s.tap) {
        if (!(await page.evaluate((t) => window.__dl.tap(t), id))) fail(`${size.name} ${node}: tap ${id} missed`);
      }
      if (s?.slide) await page.evaluate(() => window.__dl.slide());
      await step(12);
      if (!s || s.finished) {
        await page.waitForTimeout(60);
        done = (await scene()) !== 'exercise';
      }
    }
    if (!done) { fail(`${size.name} ${node} never finished`); break; }
    await page.waitForTimeout(450);
    await step(70);
    console.log(`ok ${size.name} ${node} -> ${await scene()}`);
    if (node === 'i1a1-a' || node === 'i1a1-m' || node === 'i1a1-blend') await shot(`map-after-${node}`);
  }

  await step(60);
  await shot('90-home-arriving');
  await step(420);
  await shot('91-home-settled');
  const summary = await page.evaluate(() => {
    const ev = window.__dl.events();
    return {
      attempts: ev.filter((e) => e.type === 'attempt').length,
      wrong: ev.filter((e) => e.type === 'attempt' && !e.correct).length,
      done: ev.filter((e) => e.type === 'node-done').map((e) => e.node),
      welcomed: ev.filter((e) => e.type === 'welcomed').map((e) => e.count),
    };
  });
  console.log(size.name, JSON.stringify(summary));
  if (summary.done.length !== NODES.length) fail(`${size.name} expected ${NODES.length} nodes done`);
  if (summary.wrong !== 0) fail(`${size.name} scripted play should make no mistakes`);
  if (summary.welcomed[0] !== 5) fail(`${size.name} expected 5 creatures welcomed home`);
  await ctx.close();
}

await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
