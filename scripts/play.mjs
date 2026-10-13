// Plays the game from a clean start through the real taps and slides: the
// first area, the crossing home, then out again with the map button to each
// area after it, and home again every time. Prints ok/FAIL per step.
// Screenshots of each stage of play go to shots/play-*.
//
//   npm run play                 phone portrait and desktop
//   npm run play -- --no-build
//   npm run play -- --unrecorded   as if every clip had been recorded (the missing ones are silent): lessons whose narration is still to come

import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { preview } from 'vite';

const flags = new Set(process.argv.slice(2));
const SIZES = [
  { name: 'phone', width: 390, height: 844, dpr: 3, touch: true },
  { name: 'desktop', width: 1600, height: 900, dpr: 1, touch: false },
];
const AREAS = [
  ['i1a1-a', 'i1a1-m', 'i1a1-s', 'i1a1-t', 'i1a1-blend', 'i1a1-boss'],
  ['i1a2-p', 'i1a2-f', 'i1a2-i', 'i1a2-n', 'i1a2-boss'],
  ['i1a3-o', 'i1a3-d', 'i1a3-c', 'i1a3-boss'],
  ['i1a4-u', 'i1a4-g', 'i1a4-b', 'i1a4-e', 'i1a4-boss'],
  ['i2a1-add-s', 'i2a1-s-z', 'i2a1-k', 'i2a1-h', 'i2a1-r', 'i2a1-r2', 'i2a1-l', 'i2a1-l2', 'i2a1-boss'],
  ['i2a2-w', 'i2a2-j', 'i2a2-y', 'i2a2-x', 'i2a2-qu', 'i2a2-v', 'i2a2-z', 'i2a2-boss'],
  ['i2a3-a', 'i2a3-i', 'i2a3-o', 'i2a3-aio', 'i2a3-u', 'i2a3-e', 'i2a3-boss'],
];
const SHOOT = new Set(['i1a1-a', 'i1a1-blend', 'i1a1-boss', 'i1a2-p', 'i1a2-f', 'i1a2-boss', 'i1a3-c', 'i1a3-boss', 'i1a4-boss', 'i2a1-add-s', 'i2a1-s-z', 'i2a1-k', 'i2a1-r2', 'i2a1-l2', 'i2a1-boss', 'i2a2-x', 'i2a2-qu', 'i2a2-z', 'i2a2-boss', 'i2a3-a', 'i2a3-aio', 'i2a3-u', 'i2a3-boss']);
/** How many little ones are home after each area. */
const HOME = [5, 9, 12, 16, 24, 31, 37];

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

  await page.goto(`${base}?reset${flags.has('--unrecorded') ? '&unrecorded' : ''}`);
  await page.waitForFunction(() => window.__dl?.ready === true, null, { timeout: 15000 });
  await step(90);
  await shot('00-map-start');

  /** Step through a crossing until `until` is showing, with a screenshot of each of its `legs`. */
  const crossing = async (from, until, label, legs) => {
    let seen = from;
    let leg = 0;
    for (let i = 0; i < 90 && (await scene()) !== until; i++) {
      await step(40);
      await page.waitForTimeout(40);
      if (from === 'map' && (i === 2 || i === 6 || i === 10 || i === 13)) await shot(`${label}-friends-${i}`);
      const now = await scene();
      if (now !== seen && now !== until) {
        seen = now;
        await step(70);
        await shot(`${label}-sail-${leg++}-${now}`);
      }
    }
    if (leg !== legs) fail(`${size.name} ${label}: expected ${legs} legs to the crossing, saw ${leg}`);
    await page.waitForTimeout(450);
    await step(60);
  };

  const playArea = async (area, nodes) => {
    const boss = nodes[nodes.length - 1];
    const lastLesson = nodes[nodes.length - 2];
    for (const node of nodes) {
      const ok = await page.evaluate((id) => window.__dl.tap(`node:${id}`), node);
      if (!ok) { fail(`${size.name} could not tap ${node} on the map`); return false; }
      await page.waitForTimeout(450);
      await step(30);
      if ((await scene()) !== 'exercise') { fail(`${size.name} ${node} did not open`); return false; }
      let last = '';
      let shots = 0;
      let chainShots = 0;
      let done = false;
      for (let i = 0; i < 1500 && !done; i++) {
        const s = await page.evaluate(() => window.__dl.exercise());
        const kind = !s ? 'none' : s.finished ? 'finished' : s.steer ? 'steer' : s.tap ? `tap:${s.tap[0].split(':')[0]}` : 'waiting';
        // A word chain comes late in a lesson, past the count of pictures: its steps get a few of their own.
        const chain = kind === 'tap:option' && chainShots < 6 && SHOOT.has(node);
        if (chain) chainShots++;
        if (kind !== last && kind !== 'waiting' && SHOOT.has(node) && (shots < 12 || chain)) {
          await step(18);
          await shot(`${node}-${String(shots++).padStart(2, '0')}-${kind.replace(':', '-')}`);
        }
        last = kind === 'waiting' ? last : kind;
        if (s?.tap) for (const id of s.tap) {
          if (!(await page.evaluate((t) => window.__dl.tap(t), id))) fail(`${size.name} ${node}: tap ${id} missed`);
        }
        if (s?.steer) await page.evaluate(([x, z]) => window.__dl.steer(x, z), s.steer);
        await step(12);
        if (!s || s.finished) {
          await page.waitForTimeout(60);
          done = (await scene()) !== 'exercise';
        }
      }
      if (!done) { fail(`${size.name} ${node} never finished`); return false; }
      await page.waitForTimeout(450);
      await step(70);
      console.log(`ok ${size.name} ${node} -> ${await scene()}`);
      if (node !== boss) await shot(`map-after-${node}`);
      if (node === lastLesson) {
        // The last little one goes aboard, the companion follows, and the big one gets in the way.
        for (let i = 0; i < 10; i++) {
          await step(i < 9 ? 50 : 300);
          await shot(`${area}-sleeper-${i}`);
        }
      }
    }
    return true;
  };

  for (const [n, nodes] of AREAS.entries()) {
    const area = nodes[0].split('-')[0];
    if (n > 0) {
      // At home the play button calls; it takes the ship out to the next island.
      await page.click('button[data-name="play"]');
      await crossing('home', 'map', `${area}-out`, 1);
      await step(60);
      await shot(`${area}-map-start`);
    }
    if (!(await playArea(area, nodes))) break;
    // The big one gives the plank back and everyone boards; then the crossing:
    // the ship pulls away under the chart, and landfall at home.
    await crossing('map', 'home', `${area}-home`, 2);
    await shot(`${area}-90-home-arriving`);
    await step(480);
    await shot(`${area}-91-home-settled`);
    const welcomed = await page.evaluate(() => window.__dl.events().filter((e) => e.type === 'welcomed').map((e) => e.count));
    if (welcomed[welcomed.length - 1] !== HOME[n]) fail(`${size.name} ${area}: expected ${HOME[n]} creatures welcomed home, saw ${JSON.stringify(welcomed)}`);
    else console.log(`ok ${size.name} ${area} home with ${HOME[n]}`);
  }
  const summary = await page.evaluate(() => {
    const ev = window.__dl.events();
    return {
      attempts: ev.filter((e) => e.type === 'attempt').length,
      wrong: ev.filter((e) => e.type === 'attempt' && !e.correct).length,
      done: ev.filter((e) => e.type === 'node-done').map((e) => e.node),
      chains: ev.filter((e) => e.type === 'attempt' && e.exercise === 'chain').length,
      welcomed: ev.filter((e) => e.type === 'welcomed').map((e) => e.count),
    };
  });
  console.log(size.name, JSON.stringify(summary));
  if (summary.done.length !== AREAS.flat().length) fail(`${size.name} expected ${AREAS.flat().length} nodes done`);
  // Word chains wait on lines still to be recorded: with them pretended, every lesson after the first on blending has one.
  if (flags.has('--unrecorded') && summary.chains < 60) fail(`${size.name} expected word chains to be played, saw ${summary.chains} steps`);
    if (summary.wrong !== 0) fail(`${size.name} scripted play should make no mistakes`);
  await ctx.close();
}

await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
