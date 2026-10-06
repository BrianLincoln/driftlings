import { describe, expect, it } from 'vitest';
import { ISLAND_1, allNodes, currentNode, knownSkills, rescueIndex, rescuesHome } from './curriculum';
import type { Attempt } from './events';
import { askableGraphemes, blendItem, decodableWords, pickLetterItem, type GenContext } from './generator';
import type { Content, Item, Round } from './items';
import { TUNING, applyOutcome, confusions, emptyState, foldSkills, isDue, quality, statusOf, type SkillState } from './model';
import { seeded } from './rng';
import { gate, need, planCheckpoint, planLesson, planPractice, practiceTargets } from './scheduler';
import { blend, gpc, shapeOf, type SkillId } from './skills';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = 1_700_000_000_000;

const WORDS = ['am', 'at', 'mat', 'sat', 'map', 'pin', 'ant'];
function content(sounds: string, words = WORDS): Content {
  return { hasSound: (g) => sounds.includes(g), words: words.map((text) => ({ text, graphemes: [...text] })) };
}

function ctxFor(done: string[], opts: Partial<GenContext> & { seed?: number } = {}): GenContext {
  return {
    known: knownSkills(new Set(done)),
    foils: [],
    content: content('amstpfin'),
    states: new Map(),
    confusions: new Map(),
    rng: seeded(opts.seed ?? 1),
    ...opts,
  };
}

let n = 0;
function attempt(skill: SkillId, at: number, o: Partial<Attempt> = {}): Attempt {
  return {
    type: 'attempt', id: `t${++n}`, at, node: 'x', exercise: 'pick-letter', skills: [skill], supports: [],
    target: skill.slice(4), answer: skill.slice(4), correct: true, try: 1, helped: false, ms: 1500, ...o,
  };
}

const A1 = ISLAND_1.areas[0];
const ids = A1.nodes.map((x) => x.id);
const itemsOf = (rounds: Round[]): Item[] => rounds.flatMap((r) => r.items);

describe('skills and curriculum', () => {
  it('names word shapes', () => {
    expect(shapeOf(['a', 't'])).toBe('vc');
    expect(shapeOf(['s', 'a', 't'])).toBe('cvc');
    expect(shapeOf(['a', 'n', 't'])).toBe('other');
  });

  it('starts with a, m, s, t, then blending, then a checkpoint', () => {
    expect(A1.nodes.map((x) => x.teaches.join('+'))).toEqual(['gpc:a', 'gpc:m', 'gpc:s', 'gpc:t', 'blend:vc+blend:cvc', '']);
    expect(A1.nodes[5].kind).toBe('miniboss');
  });

  it('has unique node ids', () => {
    const all = allNodes().map((x) => x.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it('opens nodes one at a time', () => {
    expect(currentNode(A1, new Set())?.id).toBe(ids[0]);
    expect(currentNode(A1, new Set(ids.slice(0, 2)))?.id).toBe(ids[2]);
    expect(currentNode(A1, new Set(ids))).toBeNull();
  });

  it('sends rescues home only when the area checkpoint is done', () => {
    expect(rescuesHome(new Set(ids.slice(0, 5)))).toEqual([]);
    expect(rescuesHome(new Set(ids))).toEqual([0, 1, 2, 3, 4]);
    expect(rescueIndex(ISLAND_1.areas[1].nodes[0].id)).toBe(5);
  });
});

describe('skill model', () => {
  it('scores a response', () => {
    expect(quality({ correct: true, try: 1, helped: false, ms: 1000 }, null)).toBe(1);
    expect(quality({ correct: true, try: 1, helped: false, ms: 5000 }, 1000)).toBe(0.8);
    expect(quality({ correct: true, try: 2, helped: false, ms: 1000 }, null)).toBe(0.4);
    expect(quality({ correct: true, try: 1, helped: true, ms: 1000 }, null)).toBe(0.4);
    expect(quality({ correct: false, try: 1, helped: false, ms: 1000 }, null)).toBe(0);
  });

  it('does not let one sitting count as long-term memory', () => {
    let s = emptyState(gpc('m'));
    for (let i = 0; i < 10; i++) s = applyOutcome(s, 1, T0 + i * 5000);
    expect(s.intervalMs).toBe(TUNING.firstInterval);
    expect(s.strength).toBeGreaterThan(0.9);
  });

  it('grows the interval when recalled after a real gap', () => {
    let s = applyOutcome(emptyState(gpc('m')), 1, T0);
    s = applyOutcome(s, 1, T0 + 5 * HOUR);
    expect(s.intervalMs).toBe(TUNING.firstInterval * TUNING.growth);
    s = applyOutcome(s, 1, T0 + 2 * DAY);
    expect(s.intervalMs).toBe(TUNING.firstInterval * TUNING.growth ** 2);
  });

  it('never grows past the cap and shrinks hard on a miss', () => {
    let s = applyOutcome(emptyState(gpc('m')), 1, T0);
    let t = T0;
    for (let i = 0; i < 30; i++) s = applyOutcome(s, 1, (t += s.intervalMs));
    expect(s.intervalMs).toBe(TUNING.maxInterval);
    const missed = applyOutcome(s, 0, t + DAY);
    expect(missed.intervalMs).toBeLessThan(s.intervalMs * 0.5);
    expect(missed.strength).toBeLessThan(s.strength);
    expect(applyOutcome(emptyState(gpc('m')), 0, T0).intervalMs).toBe(TUNING.minInterval);
  });

  it('keeps strength within 0..1 whatever happens', () => {
    const rng = seeded(7);
    let s = emptyState(gpc('a'));
    for (let i = 0; i < 500; i++) {
      s = applyOutcome(s, [0, 0.4, 0.8, 1][Math.floor(rng() * 4)], T0 + i * HOUR * rng() * 50);
      expect(s.strength).toBeGreaterThanOrEqual(0);
      expect(s.strength).toBeLessThanOrEqual(1);
      expect(s.intervalMs).toBeGreaterThanOrEqual(TUNING.minInterval);
    }
  });

  it('calls a skill shaky, secure or learning from the evidence', () => {
    const wrong = [0, 1, 2, 3].map((i) => attempt(gpc('s'), T0 + i * 1000, { correct: false, answer: 'a' }));
    const right = [0, 1, 2, 3, 4].map((i) => attempt(gpc('m'), T0 + i * 1000));
    const states = foldSkills([...wrong, ...right, attempt(gpc('t'), T0)]);
    expect(statusOf(states.get(gpc('s')))).toBe('shaky');
    expect(statusOf(states.get(gpc('m')))).toBe('secure');
    expect(statusOf(states.get(gpc('t')))).toBe('learning');
    expect(statusOf(states.get(gpc('a')))).toBe('new');
  });

  it('is due once its interval has passed, and not before', () => {
    const s = foldSkills([attempt(gpc('m'), T0)]).get(gpc('m'));
    expect(isDue(s, T0 + HOUR)).toBe(false);
    expect(isDue(s, T0 + 5 * HOUR)).toBe(true);
    expect(isDue(undefined, T0)).toBe(false);
  });

  it('gives the same result whatever order the log arrives in', () => {
    const log = [0, 1, 2, 3, 4, 5].map((i) => attempt(gpc('m'), T0 + i * DAY, { correct: i !== 2 }));
    expect(foldSkills([...log].reverse())).toEqual(foldSkills(log));
  });

  it('credits supporting skills a little on success and never blames them', () => {
    const base = [attempt(gpc('s'), T0), attempt(gpc('s'), T0 + 1)];
    const before = foldSkills(base).get(gpc('s'))!;
    const ok = foldSkills([...base, attempt(blend('cvc'), T0 + 2, { exercise: 'blend', supports: [gpc('s')] })]).get(gpc('s'))!;
    const bad = foldSkills([...base, attempt(blend('cvc'), T0 + 2, { exercise: 'blend', supports: [gpc('s')], correct: false })]).get(gpc('s'))!;
    expect(ok.strength).toBeGreaterThan(before.strength);
    expect(ok.seen).toBe(before.seen);
    expect(bad).toEqual(before);
  });

  it('slows credit only against the child\'s own speed', () => {
    const fast = [0, 1, 2, 3, 4].map((i) => attempt(gpc('m'), T0 + i, { ms: 1000 }));
    const slow = attempt(gpc('a'), T0 + 10, { ms: 9000 });
    expect(foldSkills([...fast, slow]).get(gpc('a'))!.strength).toBeCloseTo(0.8 * 0.6);
    expect(foldSkills([slow]).get(gpc('a'))!.strength).toBeCloseTo(0.6);
  });

  it('counts what gets mixed up with what', () => {
    const c = confusions([
      attempt(gpc('m'), T0, { correct: false, answer: 's' }),
      attempt(gpc('m'), T0, { correct: false, answer: 's' }),
      attempt(gpc('m'), T0),
    ]);
    expect(c.get('m')?.get('s')).toBe(2);
  });
});

describe('generator', () => {
  it('never asks about an untaught letter or one without audio', () => {
    expect(pickLetterItem('m', ctxFor([ids[0]]))).toBeNull();
    expect(pickLetterItem('a', ctxFor([ids[0]], { content: content('mst'), foils: ['m'] }))).toBeNull();
  });

  it('uses foils as wrong choices only', () => {
    const item = pickLetterItem('a', ctxFor([ids[0]], { foils: ['m', 's'] }))!;
    expect(item.choices).toContain('a');
    expect(new Set(item.choices).size).toBe(3);
    expect(item.skills).toEqual([gpc('a')]);
    expect(pickLetterItem('a', ctxFor([ids[0]]))).toBeNull(); // nothing to choose between
  });

  it('prefers letters the child has confused before', () => {
    const conf = new Map([['m', new Map([['t', 50]])]]);
    let withT = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const item = pickLetterItem('m', ctxFor(ids.slice(0, 4), { confusions: conf, seed }), 2)!;
      if (item.choices.includes('t')) withT++;
    }
    expect(withT).toBeGreaterThan(180);
  });

  it('only offers words that are fully decodable and have the shape taught', () => {
    expect(decodableWords(ctxFor(ids.slice(0, 4)))).toEqual([]); // blending not taught yet
    const words = decodableWords(ctxFor(ids.slice(0, 5))).map((w) => w.text);
    expect(words.sort()).toEqual(['am', 'at', 'mat', 'sat']);
  });

  it('drops words whose letter sounds have no clip', () => {
    const words = decodableWords(ctxFor(ids.slice(0, 5), { content: content('ams') })).map((w) => w.text);
    expect(words).toEqual(['am']);
  });

  it('builds a blend check with the word among distinct choices', () => {
    const item = blendItem('sat', ctxFor(ids.slice(0, 5)))!;
    expect(item.choices).toContain('sat');
    expect(new Set(item.choices).size).toBe(item.choices.length);
    expect(item.choices.length).toBe(3);
    expect(item.skills).toEqual([blend('cvc')]);
    expect(item.supports).toEqual([gpc('s'), gpc('a'), gpc('t')]);
  });

  it('will not build a check with nothing to choose between', () => {
    expect(blendItem('am', ctxFor(ids.slice(0, 5), { content: content('am', ['am']) }))).toBeNull();
  });
});

describe('scheduler', () => {
  const sounds = 'amstpfin';
  const legal = (item: Item, ctx: GenContext) => {
    if (item.kind === 'meet') return ctx.known.has(gpc(item.grapheme)) && sounds.includes(item.grapheme);
    if (item.kind === 'pick-letter') return ctx.known.has(gpc(item.target)) && sounds.includes(item.target) && item.choices.includes(item.target);
    return item.graphemes.every((g) => ctx.known.has(gpc(g)) && sounds.includes(g)) &&
      ctx.known.has(blend(shapeOf(item.graphemes))) && item.choices.every((w) => WORDS.includes(w));
  };

  it('holds its invariants across every node and many seeds', () => {
    const nodes = allNodes();
    for (let seed = 1; seed <= 60; seed++) {
      nodes.forEach((node, i) => {
        const ctx = ctxFor(nodes.slice(0, i + 1).map((x) => x.id), { seed, foils: ['m', 's'] });
        const rounds = node.kind === 'lesson' ? planLesson(node, ctx, T0) : planCheckpoint(ISLAND_1.areas.find((a) => a.nodes.includes(node))!, ctx, T0);
        for (const r of rounds) {
          expect(r.items.length).toBeGreaterThan(0);
          for (const item of r.items) {
            expect(item.kind).toBe(r.exercise);
            expect(legal(item, ctx)).toBe(true);
          }
        }
      });
    }
  });

  it('teaches the first letter with nothing older to mix in', () => {
    const rounds = planLesson(A1.nodes[0], ctxFor([ids[0]], { foils: ['m', 's'] }), T0);
    expect(rounds.map((r) => r.exercise)).toEqual(['meet', 'pick-letter']);
    expect(rounds[1].items.every((i) => i.kind === 'pick-letter' && i.target === 'a')).toBe(true);
  });

  it('mixes old letters into a new lesson, but mostly the new one', () => {
    const rounds = planLesson(A1.nodes[2], ctxFor(ids.slice(0, 3)), T0);
    const targets = rounds.find((r) => r.exercise === 'pick-letter')!.items.map((i) => (i as { target: string }).target);
    const fresh = targets.filter((t) => t === 's').length;
    expect(fresh).toBeGreaterThanOrEqual(targets.length / 2);
    expect(fresh).toBeLessThan(targets.length);
  });

  it('leans review toward shaky letters', () => {
    const shaky = foldSkills([0, 1, 2, 3].map((i) => attempt(gpc('a'), T0 + i, { correct: false, answer: 'm' })));
    let a = 0;
    let m = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rounds = planLesson(A1.nodes[2], ctxFor(ids.slice(0, 3), { seed, states: shaky }), T0 + 10);
      for (const i of itemsOf(rounds)) if (i.kind === 'pick-letter') { if (i.target === 'a') a++; if (i.target === 'm') m++; }
    }
    expect(a).toBeGreaterThan(m * 1.4);
  });

  it('starts the blending lesson with blending and adds letter review', () => {
    const rounds = planLesson(A1.nodes[4], ctxFor(ids.slice(0, 5)), T0);
    expect(rounds.map((r) => r.exercise)).toEqual(['blend', 'pick-letter']);
    const words = rounds[0].items.map((i) => (i as { word: string }).word);
    expect(new Set(words).size).toBe(words.length);
  });

  it('covers every letter of the area in its checkpoint', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rounds = planCheckpoint(A1, ctxFor(ids, { seed }), T0);
      const targets = new Set(itemsOf(rounds).flatMap((i) => (i.kind === 'pick-letter' ? [i.target] : [])));
      expect([...targets].sort()).toEqual(['a', 'm', 's', 't']);
      expect(rounds.some((r) => r.exercise === 'blend')).toBe(true);
    }
  });

  it('offers practice only when something is overdue or shaky', () => {
    const learned = foldSkills(['a', 'm'].flatMap((g) => [0, 1, 2, 3, 4].map((i) => attempt(gpc(g), T0 + i))));
    const ctx = ctxFor(ids.slice(0, 2), { states: learned });
    expect(planPractice(ctx, T0 + HOUR)).toBeNull();
    expect(practiceTargets(ctx, T0 + DAY).sort()).toEqual([gpc('a'), gpc('m')]);
    const rounds = planPractice(ctx, T0 + DAY)!;
    expect(itemsOf(rounds).length).toBeGreaterThan(0);
    expect(planPractice(ctx, T0 + HOUR, true)).not.toBeNull();
  });

  it('aims practice at the weak skill', () => {
    const states = foldSkills([
      ...[0, 1, 2, 3, 4].map((i) => attempt(gpc('a'), T0 + i)),
      ...[0, 1, 2, 3].map((i) => attempt(gpc('m'), T0 + i, { correct: false, answer: 'a' })),
    ]);
    const rounds = planPractice(ctxFor(ids.slice(0, 2), { states }), T0 + HOUR)!;
    expect(itemsOf(rounds).every((i) => i.kind === 'pick-letter' && i.target === 'm')).toBe(true);
  });

  it('ranks need: shaky over due over new over secure', () => {
    const shaky: SkillState = { id: gpc('a'), seen: 5, strength: 0.2, intervalMs: HOUR, lastAt: T0, dueAt: T0 + HOUR };
    const secure: SkillState = { id: gpc('a'), seen: 5, strength: 0.95, intervalMs: DAY, lastAt: T0, dueAt: T0 + DAY };
    expect(need(shaky, T0)).toBeGreaterThan(need(secure, T0 + 2 * DAY));
    expect(need(secure, T0 + 2 * DAY)).toBeGreaterThan(need(undefined, T0));
    expect(need(undefined, T0)).toBeGreaterThan(need(secure, T0));
  });

  it('gates the next area only on well-evidenced weakness', () => {
    expect(gate(null, new Map())).toEqual([]);
    expect(gate(A1, new Map())).toEqual([]);
    const few = foldSkills([0, 1, 2].map((i) => attempt(gpc('s'), T0 + i, { correct: false })));
    expect(gate(A1, few)).toEqual([]);
    const many = foldSkills([0, 1, 2, 3, 4, 5, 6].map((i) => attempt(gpc('s'), T0 + i, { correct: false })));
    expect(gate(A1, many)).toEqual([gpc('s')]);
  });

  it('only asks about letters that have audio', () => {
    expect(askableGraphemes(ctxFor(ids.slice(0, 4), { content: content('am') })).sort()).toEqual(['a', 'm']);
  });
});

describe('layering', () => {
  it('has no dependency on rendering, the DOM or the rest of the app', async () => {
    const files = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    for (const [name, src] of Object.entries(files)) {
      if (name.endsWith('.test.ts')) continue;
      expect(src, name).not.toMatch(/from '(three|\.\.\/)/);
      expect(src, name).not.toMatch(/\b(document|window|localStorage|indexedDB)\b/);
    }
  });
});
