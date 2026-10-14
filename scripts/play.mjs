// Plays the game through the real taps and slides, in headless Chromium, phone portrait and desktop side by side.
// Prints ok/FAIL per step and stops at the first FAIL.
//
// Play what the change touched. Everything before it is marked done, as if it had been played:
//
//   npm run play -- --area i2a3          one island: its lessons, its big one, the crossing home (two to four minutes)
//   npm run play -- --area i2a2,i2a3     several
//   npm run play -- --node i1a3-c        one lesson, and back to the map (under a minute)
//   npm run play -- --node i1a3-c --size phone
//
//   --shots        save a screenshot of each stage of play to shots/play-* (off unless asked for)
//   --no-build     play the dist/ that is there
//   --unrecorded   as if every clip had been recorded (the missing ones are silent): lessons whose narration is still to come
//
// The whole game from a clean start is `--full`. It is slow and grows with every island, and with an agent
// watching it has cost over half an hour and a great many tokens: an agent never runs it without the owner
// saying yes to exactly that (CLAUDE.md, "The scripted play"). `src/game/playthrough.test.ts` walks every
// lesson of every island in `npm test`, with no browser.

import { execSync } from 'node:child_process';
import { mkdirSync, writeSync } from 'node:fs';
import { chromium } from 'playwright';
import { preview } from 'vite';

const argv = process.argv.slice(2).flatMap((a) => (a.startsWith('--') && a.includes('=') ? a.split(/=(.*)/s).slice(0, 2) : [a]));
const flags = new Set(argv.filter((a) => a.startsWith('--')));
/** The names after an option, split at commas: `--area i2a2,i2a3`. */
const named = (flag) => (argv.includes(flag) ? (argv[argv.indexOf(flag) + 1] ?? '').split(',').filter((v) => v && !v.startsWith('--')) : []);
const out = (line) => writeSync(1, `${line}\n`);
const stop = (line) => { out(line); process.exit(2); };

const AREAS = [
  ['i1a1-a', 'i1a1-m', 'i1a1-s', 'i1a1-t', 'i1a1-blend', 'i1a1-boss'],
  ['i1a2-p', 'i1a2-f', 'i1a2-i', 'i1a2-n', 'i1a2-boss'],
  ['i1a3-o', 'i1a3-d', 'i1a3-c', 'i1a3-boss'],
  ['i1a4-u', 'i1a4-g', 'i1a4-b', 'i1a4-e', 'i1a4-boss'],
  ['i2a1-add-s', 'i2a1-s-z', 'i2a1-k', 'i2a1-h', 'i2a1-r', 'i2a1-r2', 'i2a1-l', 'i2a1-l2', 'i2a1-boss'],
  ['i2a2-w', 'i2a2-j', 'i2a2-y', 'i2a2-x', 'i2a2-qu', 'i2a2-v', 'i2a2-z', 'i2a2-boss'],
  ['i2a3-a', 'i2a3-i', 'i2a3-o', 'i2a3-aio', 'i2a3-u', 'i2a3-e', 'i2a3-boss'],
  ['i2a4-ff', 'i2a4-all', 'i2a4-ck', 'i2a4-sh', 'i2a4-th', 'i2a4-th2', 'i2a4-ch', 'i2a4-boss'],
];
const SHOOT = new Set(['i1a1-a', 'i1a1-blend', 'i1a1-boss', 'i1a2-p', 'i1a2-f', 'i1a2-boss', 'i1a3-c', 'i1a3-boss', 'i1a4-boss', 'i2a1-add-s', 'i2a1-s-z', 'i2a1-k', 'i2a1-r2', 'i2a1-l2', 'i2a1-boss', 'i2a2-x', 'i2a2-qu', 'i2a2-z', 'i2a2-boss', 'i2a3-a', 'i2a3-aio', 'i2a3-u', 'i2a3-boss', 'i2a4-ff', 'i2a4-all', 'i2a4-th2', 'i2a4-boss']);
/** How many little ones are home after each area. */
const HOME = [5, 9, 12, 16, 24, 31, 37, 44];
const ALL_SIZES = [
  { name: 'phone', width: 390, height: 844, dpr: 3, touch: true },
  { name: 'desktop', width: 1600, height: 900, dpr: 1, touch: false },
];

const areaOf = (id) => AREAS.findIndex((nodes) => nodes[0].split('-')[0] === id);
/** What to play, in the order of the game: each a whole island (`n`), or only some `nodes` of it. */
const PLAN = [
  ...named('--area').map((id) => ({ n: areaOf(id), nodes: null, name: id })),
  ...named('--node').map((id) => ({ n: AREAS.findIndex((nodes) => nodes.includes(id)), nodes: [id], name: id })),
].sort((a, b) => a.n - b.n || (a.nodes ? AREAS[a.n].indexOf(a.nodes[0]) : -1) - (b.nodes ? AREAS[b.n].indexOf(b.nodes[0]) : -1));
for (const p of PLAN) if (p.n < 0) stop(`play: no such area or node: ${p.name}`);
const FULL = flags.has('--full');
if (FULL && PLAN.length) stop('play: --full plays everything; leave out --area and --node, or leave out --full');
if (FULL) PLAN.push(...AREAS.map((_, n) => ({ n, nodes: null })));
if (!PLAN.length) {
  stop([
    'play: say what to play.',
    '',
    '  npm run play -- --area i2a3     one island (two to four minutes)',
    '  npm run play -- --node i1a3-c   one lesson (under a minute)',
    '',
    'The whole game is `npm run play -- --full`. It plays every island from a clean start, twice over, and starts',
    'again from nothing after any failure. With an agent watching it has taken 30+ minutes and a great many tokens.',
    'AGENTS: do not run --full unless the owner has just said yes to exactly that, after being told what it costs.',
    'Every lesson of every island is already walked by `npm test` (src/game/playthrough.test.ts).',
  ].join('\n'));
}
const SIZES = named('--size').length ? ALL_SIZES.filter((s) => named('--size').includes(s.name)) : ALL_SIZES;
if (!SIZES.length) stop('play: --size is phone or desktop');

const began = Date.now();
if (!flags.has('--no-build')) execSync('npx vite build', { stdio: ['ignore', 'ignore', 'inherit'] });
if (flags.has('--shots')) mkdirSync('shots', { recursive: true });
const server = await preview({ preview: { port: 4318 }, logLevel: 'silent' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
/** The first thing to go wrong ends the run: what follows it would only be more of the same, and slow. */
const fail = (msg) => { out(`FAIL ${msg}`); process.exit(1); };

async function run(size) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.dpr, hasTouch: size.touch, isMobile: size.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(`${size.name} page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') fail(`${size.name} console: ${m.text().slice(0, 300)}`); });
  const shot = (name) => (flags.has('--shots') ? page.screenshot({ path: `shots/play-${size.name}-${name}.png` }) : null);
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

  /** Play `nodes` of an area, one after another from the map. `all` is every node of the area. */
  const playArea = async (area, nodes, all) => {
    const boss = all[all.length - 1];
    const lastLesson = all[all.length - 2];
    for (const node of nodes) {
      // A stone takes no tap while a scene has the map (the plank scene is longer where the walk to the ship is): wait it out.
      let ok = false;
      for (let i = 0; i < 40 && !ok; i++) {
        ok = await page.evaluate((id) => window.__dl.tap(`node:${id}`), node);
        if (!ok) await step(30);
      }
      if (!ok) fail(`${size.name} could not tap ${node} on the map`);
      await page.waitForTimeout(450);
      await step(30);
      if ((await scene()) !== 'exercise') fail(`${size.name} ${node} did not open`);
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
      if (!done) fail(`${size.name} ${node} never finished`);
      await page.waitForTimeout(450);
      await step(70);
      out(`ok ${size.name} ${node} -> ${await scene()}`);
      if (node !== boss) await shot(`map-after-${node}`);
      if (node === lastLesson) {
        // The last little one goes aboard, the companion follows, and the big one gets in the way.
        for (let i = 0; i < 10; i++) {
          await step(i < 9 ? 50 : 300);
          await shot(`${area}-sleeper-${i}`);
        }
      }
    }
  };

  /** Every node finished so far, played or marked. */
  const finished = new Set();
  /** Where the ship lies: on the path of a fresh game to begin with, at home after an island played to its end. */
  let at = 'map';
  for (const { n, nodes } of PLAN) {
    const all = AREAS[n];
    const area = all[0].split('-')[0];
    const todo = nodes ?? all;
    // Everything before what is played counts as played: marked done, and its little ones long since seen home.
    const before = [...AREAS.slice(0, n).flat(), ...all.slice(0, all.indexOf(todo[0]))].filter((id) => !finished.has(id));
    if (before.length) {
      await page.evaluate(([ids, home]) => { window.__dl.complete(ids); window.__dl.welcome(home); }, [before, n ? HOME[n - 1] : 0]);
      for (const id of before) finished.add(id);
      // From home the ship makes for the newest island: put it there, then on that island's path.
      await page.evaluate(() => window.__dl.goto('home').then(() => window.__dl.goto('map')));
      await step(90);
      at = 'map';
    } else if (at === 'home') {
      // At home the play button calls; it takes the ship out to the next island.
      await page.click('button[data-name="play"]');
      await crossing('home', 'map', `${area}-out`, 1);
      await step(60);
      at = 'map';
    }
    if (n > 0) await shot(`${area}-map-start`);
    await playArea(area, todo, all);
    for (const id of todo) finished.add(id);
    if (nodes) continue;
    // The big one gives the plank back and everyone boards; then the crossing:
    // the ship pulls away under the chart, and landfall at home.
    await crossing('map', 'home', `${area}-home`, 2);
    at = 'home';
    await shot(`${area}-90-home-arriving`);
    await step(480);
    await shot(`${area}-91-home-settled`);
    const welcomed = await page.evaluate(() => window.__dl.events().filter((e) => e.type === 'welcomed').map((e) => e.count));
    if (welcomed[welcomed.length - 1] !== HOME[n]) fail(`${size.name} ${area}: expected ${HOME[n]} creatures welcomed home, saw ${JSON.stringify(welcomed)}`);
    out(`ok ${size.name} ${area} home with ${HOME[n]}`);
  }
  const summary = await page.evaluate(() => {
    const ev = window.__dl.events();
    return {
      attempts: ev.filter((e) => e.type === 'attempt').length,
      wrong: ev.filter((e) => e.type === 'attempt' && !e.correct).length,
      done: ev.filter((e) => e.type === 'node-done').length,
      chains: ev.filter((e) => e.type === 'attempt' && e.exercise === 'chain').length,
      welcomed: ev.filter((e) => e.type === 'welcomed').map((e) => e.count),
    };
  });
  out(`${size.name} ${JSON.stringify(summary)}`);
  if (summary.done !== finished.size) fail(`${size.name} expected ${finished.size} nodes done`);
  // Word chains wait on lines still to be recorded: with them pretended, every lesson after the first on blending has one.
  if (FULL && flags.has('--unrecorded') && summary.chains < 60) fail(`${size.name} expected word chains to be played, saw ${summary.chains} steps`);
  if (summary.wrong !== 0) fail(`${size.name} scripted play should make no mistakes`);
  await ctx.close();
}

await Promise.all(SIZES.map((size) => run(size).catch((e) => fail(`${size.name} ${String(e?.message ?? e).split('\n')[0]}`))));
out(`played in ${Math.round((Date.now() - began) / 1000)}s`);
await browser.close();
await server.close();
process.exit(0);
