import { describe, expect, it } from 'vitest';
import { AREAS, allNodes, currentNode, findNode, knownSkills, rescueIndex, rescuesHome, settled, type NodeDef } from './curriculum';
import type { Attempt } from './events';
import { askableGraphemes, blendItem, catchItem, decodableWords, manyItem, pickLetterItem, readableWords, type GenContext } from './generator';
import type { Content, Item, Round } from './items';
import { TUNING, applyOutcome, confusions, emptyState, foldSkills, isDue, quality, statusOf, type SkillState } from './model';
import { seeded } from './rng';
import { SIZES, gate, need, planCheckpoint, planLesson, planPractice, practiceTargets } from './scheduler';
import { blend, gpc, graphemeOf, second, shapeOf, soundsLike, suffix, type SkillId } from './skills';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = 1_700_000_000_000;

const WORDS = ['am', 'at', 'mat', 'sat', 'map', 'pin', 'ant'];
function content(sounds: string, words = WORDS): Content {
  return { hasSound: (g) => sounds.includes(g), hasName: (g) => sounds.includes(g) && g !== 'n', words: words.map((text) => ({ text, graphemes: [...text] })), many: [] };
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

const A1 = AREAS[0];
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
    expect(rescueIndex(AREAS[1].nodes[0].id)).toBe(5);
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

  it('credits a catch a little and never counts a slip against the letter', () => {
    const caught = foldSkills([attempt(gpc('m'), T0), attempt(gpc('m'), T0 + 1, { exercise: 'catch', skills: [], supports: [gpc('m')] })]);
    const slipped = foldSkills([attempt(gpc('m'), T0), attempt(gpc('m'), T0 + 1, { exercise: 'catch', skills: [], supports: [gpc('m')], correct: false, answer: 's' })]);
    const before = foldSkills([attempt(gpc('m'), T0)]).get(gpc('m'))!;
    expect(caught.get(gpc('m'))!.strength).toBeGreaterThan(before.strength);
    expect(caught.get(gpc('m'))!.seen).toBe(1);
    expect(slipped.get(gpc('m'))).toEqual(before);
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

  it('sends a taught letter falling among others, and only if its name can be said', () => {
    const item = catchItem('a', ctxFor([ids[0]], { foils: ['m', 's'] }))!;
    expect(item.others.sort()).toEqual(['m', 's']);
    expect(item.supports).toEqual([gpc('a')]);
    expect(catchItem('a', ctxFor([ids[0]]))).toBeNull(); // nothing to watch out for
    expect(catchItem('m', ctxFor([ids[0]], { foils: ['m'] }))).toBeNull(); // not taught
    expect(catchItem('n', ctxFor(allNodes().slice(0, 10).map((x) => x.id)))).toBeNull(); // no name clip
  });

  it('builds a word item from its letters', () => {
    const item = blendItem('sat', ctxFor(ids.slice(0, 5)))!;
    expect(item.graphemes).toEqual(['s', 'a', 't']);
    expect(item.stage).toBe('free');
    expect(item.skills).toEqual([blend('cvc')]);
    expect(item.supports).toEqual([gpc('s'), gpc('a'), gpc('t')]);
  });

  it('will not build a word the child cannot sound out yet', () => {
    expect(blendItem('map', ctxFor(ids.slice(0, 5)))).toBeNull();
  });
});

describe('scheduler', () => {
  const sounds = 'amstpfin';
  const legal = (item: Item, ctx: GenContext) => {
    if (item.kind === 'meet') return ctx.known.has(gpc(item.grapheme)) && sounds.includes(item.grapheme);
    if (item.kind === 'pick-letter') return ctx.known.has(gpc(item.target)) && sounds.includes(item.target) && item.choices.includes(item.target);
    if (item.kind === 'catch') {
      return ctx.known.has(gpc(item.target)) && sounds.includes(item.target) && item.target !== 'n' &&
        item.others.length > 0 && !item.others.includes(item.target) && item.skills.length === 0;
    }
    if (item.kind === 'many') return false; // nothing here can be shown as one and several
    return item.graphemes.every((g) => ctx.known.has(gpc(g)) && sounds.includes(g)) &&
      (item.stage === 'read' || ctx.known.has(blend(shapeOf(item.graphemes)))) && WORDS.includes(item.word);
  };

  it('holds its invariants across every node and many seeds', () => {
    const nodes = allNodes();
    for (let seed = 1; seed <= 60; seed++) {
      nodes.forEach((node, i) => {
        const ctx = ctxFor(nodes.slice(0, i + 1).map((x) => x.id), { seed, foils: ['m', 's'] });
        const rounds = node.kind === 'lesson' ? planLesson(node, ctx, T0) : planCheckpoint(findNode(node.id)!.area, ctx, T0);
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
    expect(rounds.map((r) => r.exercise)).toEqual(['meet', 'pick-letter', 'catch']);
    expect(rounds[1].items.every((i) => i.kind === 'pick-letter' && i.target === 'a')).toBe(true);
    expect(rounds[1].items.length).toBe(SIZES.soloPicks);
    expect(SIZES.soloPicks).toBeLessThan(SIZES.lessonPicks);
  });

  it('mixes old letters into a new lesson, but mostly the new one', () => {
    const rounds = planLesson(A1.nodes[2], ctxFor(ids.slice(0, 3)), T0);
    const targets = rounds.find((r) => r.exercise === 'pick-letter')!.items.map((i) => (i as { target: string }).target);
    const fresh = targets.filter((t) => t === 's').length;
    expect(fresh).toBeGreaterThanOrEqual(targets.length / 2);
    expect(fresh).toBeLessThan(targets.length);
  });

  it('asks about the letter just met before anything else', () => {
    for (let seed = 1; seed <= 60; seed++) {
      allNodes().forEach((node, i, nodes) => {
        const met = node.teaches.map(graphemeOf).filter((g): g is string => !!g && sounds.includes(g));
        if (node.kind !== 'lesson' || met.length === 0) return;
        const rounds = planLesson(node, ctxFor(nodes.slice(0, i + 1).map((x) => x.id), { seed, foils: ['m', 's'] }), T0);
        expect(rounds[0].exercise).toBe('meet');
        expect(rounds[1].exercise).toBe('pick-letter');
        expect((rounds[1].items[0] as { target: string }).target).toBe(met[met.length - 1]);
      });
    }
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

  it('sounds words out in letter lessons as soon as their letters are known, asking nothing', () => {
    const words = (n: number) => itemsOf(planLesson(A1.nodes[n], ctxFor(ids.slice(0, n + 1), { foils: ['m', 's'] }), T0))
      .flatMap((i) => (i.kind === 'blend' ? [i] : []));
    expect(words(0)).toEqual([]);
    expect(words(1).map((i) => i.word)).toEqual(['am']);
    expect(words(2).map((i) => i.word)).toEqual(['am']);
    expect(words(3).length).toBe(SIZES.lessonBlends);
    for (const n of [1, 2, 3]) expect(words(n).every((i) => i.stage === 'read')).toBe(true);
  });

  it('never asks for a word to be rebuilt before its shape is taught', () => {
    const ctx = ctxFor(ids.slice(0, 4));
    expect(blendItem('am', ctx, 'read')).not.toBeNull();
    expect(blendItem('am', ctx, 'guided')).toBeNull();
    expect(blendItem('am', ctx)).toBeNull();
  });

  it('opens the word-building lesson on the first word in the list and shows how once per shape', () => {
    for (let i = 0; i < 20; i++) {
      const items = planLesson(A1.nodes[4], ctxFor(ids.slice(0, 5)), T0)[0].items as Array<{ word: string; stage: string }>;
      expect(items.map((x) => x.word)).toEqual(['am', 'at', 'mat', 'sat']);
      expect(items.map((x) => x.stage)).toEqual(['guided', 'free', 'guided', 'free']);
    }
  });

  it('shows how to rebuild the first word of a checkpoint, then leaves the child to it', () => {
    const stages = (states: Map<SkillId, SkillState>) =>
      itemsOf(planCheckpoint(A1, ctxFor(ids, { states }), T0)).flatMap((i) => (i.kind === 'blend' ? [i.stage] : []));
    expect(stages(new Map())).toEqual(['guided', 'free', 'free']);
    const going = foldSkills(['vc', 'cvc'].flatMap((s) => [0, 1].map((i) => attempt(blend(s as 'vc'), T0 + i, { exercise: 'blend' }))));
    expect(stages(going)).toEqual(['free', 'free', 'free']);
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

describe('the k h r l area', () => {
  const A = AREAS[4];
  const before = allNodes().slice(0, allNodes().indexOf(A.nodes[0])).map((x) => x.id);
  // As the game has it: one word to build with k, two with l, and a long list of older words.
  const older = ['am', 'at', 'mat', 'sat', 'map', 'pin', 'dog', 'cat', 'cot', 'bed', 'sun', 'pig', 'net', 'cup', 'bus', 'top'];
  const words = [...older, 'kid', 'hat', 'hen', 'rat', 'red', 'lip', 'log', 'elk', 'milk'];
  // And once the words with two consonants together are recorded.
  const two = ['trip', 'drum', 'crab', 'frog', 'skip', 'flag', 'clap', 'plum', 'help', 'belt', 'desk', 'nest'];
  const node = (id: string) => A.nodes.find((x) => x.id === `i2a1-${id}`)!;
  // The area opens with the two lessons on an s at the end; its letters come after.
  const letters = ['k', 'h', 'r', 'l'].map(node);
  /** Everything up to and including the node, as a child who has just reached it has it. */
  const ctxAt = (at: NodeDef, seed: number, list = words) =>
    ctxFor([...before, ...A.nodes.slice(0, A.nodes.indexOf(at) + 1).map((x) => x.id)], { seed, content: { ...content('amstpfinodcugbekhrl', list), hasName: () => true } });
  const blendsOf = (rounds: Round[]) => itemsOf(rounds).flatMap((i) => (i.kind === 'blend' ? [i] : []));
  const shape = (word: string) => shapeOf([...word]);

  it('follows the island 1 boss, with the lessons on an s at the end first', () => {
    expect(A.nodes.map((x) => x.ufli)).toEqual([20, 21, 22, 23, 24, 25, 26, 27, null]);
    expect(rescueIndex(A.nodes[0].id)).toBe(16);
  });

  it('always uses the new letter in a word, however few words it has', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const at of letters) {
        const rounds = planLesson(at, ctxAt(at, seed), T0);
        expect(rounds.map((r) => r.exercise)).toEqual(['meet', 'pick-letter', 'catch', 'blend']);
        const built = blendsOf(rounds);
        expect(built.length).toBe(SIZES.lessonBlends);
        expect(built[0].graphemes).toContain(graphemeOf(at.teaches[0]));
      }
    }
  });

  it('only sounds out a word whose shape is not taught', () => {
    for (let seed = 1; seed <= 60; seed++) {
      // At l the shape of "milk" is still to come, and "elk" is a shape no lesson teaches.
      for (const i of blendsOf(planLesson(node('l'), ctxAt(node('l'), seed), T0))) expect(i.stage === 'read').toBe(i.word === 'elk' || i.word === 'milk');
      for (const i of blendsOf(planLesson(node('k'), ctxAt(node('k'), seed, [...words, ...two]), T0))) expect(i.stage === 'read').toBe(i.word === 'desk' || i.word === 'skip');
    }
  });

  it('goes round the area\'s letters in the checkpoint, and never asks for a word of a shape no lesson teaches', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const check = blendsOf(planCheckpoint(A, ctxAt(node('boss'), seed), T0));
      expect(check.length).toBe(SIZES.checkpointBlends);
      // Three words, each bringing one of the area's letters the others have not.
      expect(new Set(check.flatMap((i) => i.graphemes.filter((g) => 'khrl'.includes(g)))).size).toBeGreaterThanOrEqual(3);
      expect(check.every((i) => words.includes(i.word) && i.word !== 'elk' && i.stage !== 'read')).toBe(true);
    }
  });

  it('teaches two consonants together: r after one at the start, then l there and before one at the end', () => {
    expect(node('r2').teaches).toEqual([blend('ccvc')]);
    expect(node('l2').teaches).toEqual([blend('ccvc'), blend('cvcc')]);
    expect(A.nodes.map((x) => x.id.slice(5))).toEqual(['add-s', 's-z', 'k', 'h', 'r', 'r2', 'l', 'l2', 'boss']);
    expect(shape('trip')).toBe('ccvc');
    expect(shape('milk')).toBe('cvcc');
  });

  it('builds words of the new shape with the letter in, showing how on the first of each shape', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const list = [...words, ...two];
      const r2 = planLesson(node('r2'), ctxAt(node('r2'), seed, list), T0);
      expect(r2.map((r) => r.exercise)).toEqual(['blend', 'pick-letter']);
      expect(blendsOf(r2).map((i) => [i.word, i.stage])).toEqual([['trip', 'guided'], ['drum', 'free'], ['crab', 'free'], ['frog', 'free']]);
      // Two of each shape, in list order: l in each, and nothing with a letter not yet taught.
      const l2 = blendsOf(planLesson(node('l2'), ctxAt(node('l2'), seed, list), T0));
      expect(l2.map((i) => [i.word, i.stage])).toEqual([['milk', 'guided'], ['flag', 'guided'], ['clap', 'free'], ['help', 'free']]);
    }
    // Before r2, "flag" has an l nobody has met, and at r2 itself nothing is built that is not the new shape.
    expect(readableWords(ctxAt(node('r2'), 1, [...words, ...two])).map((w) => w.text)).not.toContain('flag');
  });

  it('makes do with the words there are: another shape\'s share, a word without the letter, or just the letters', () => {
    const l2 = (list: string[]) => blendsOf(planLesson(node('l2'), ctxAt(node('l2'), 1, list), T0)).map((i) => i.word);
    // As recorded today: only "milk" and (as a keyword) "nest".
    expect(l2([...words, 'nest'])).toEqual(['milk', 'nest']);
    expect(l2([...words, 'nest', 'flag'])).toEqual(['milk', 'flag', 'nest']);
    const r2 = planLesson(node('r2'), ctxAt(node('r2'), 1), T0);
    expect(r2.map((r) => r.exercise)).toEqual(['pick-letter']);
    expect(itemsOf(r2).length).toBe(SIZES.blendLessonPicks);
  });

  it('builds the new shapes in the lessons after', () => {
    const ctx = ctxAt(node('boss'), 1, [...words, ...two]);
    expect(decodableWords(ctx).map((w) => w.text)).toEqual(expect.arrayContaining(['trip', 'flag', 'milk', 'help', 'nest']));
    expect(decodableWords(ctx).map((w) => w.text)).not.toContain('elk');
    expect(blendItem('trip', ctxAt(node('r'), 1, [...words, ...two]))).toBeNull();
    expect(blendItem('trip', ctxAt(node('r'), 1, [...words, ...two]), 'read')).not.toBeNull();
  });

  it('never sets c beside k: the sound cannot tell them apart', () => {
    expect(soundsLike('c', 'k')).toBe(true);
    expect(soundsLike('c', 'd')).toBe(false);
    for (let seed = 1; seed <= 80; seed++) {
      const ctx = ctxAt(node('boss'), seed);
      for (const i of itemsOf([...planLesson(node('k'), ctxAt(node('k'), seed), T0), ...planCheckpoint(A, ctx, T0)])) {
        if (i.kind === 'pick-letter' && 'ck'.includes(i.target)) expect(i.choices.filter((g) => 'ck'.includes(g))).toEqual([i.target]);
      }
      expect(pickLetterItem('c', ctx)!.choices).not.toContain('k');
      expect(catchItem('k', ctx)!.others).not.toContain('c');
    }
  });
});

describe('a lesson added to an area already out', () => {
  const A = AREAS[4];
  const ids = A.nodes.map((x) => x.id);
  const was = ids.filter((id) => id !== 'i2a1-r2' && id !== 'i2a1-l2');
  const earlier = AREAS.slice(0, 4).flatMap((a) => a.nodes.map((x) => x.id));

  it('is done for a child who had beaten the area: finished, known, and its little one home', () => {
    const done = settled(new Set([...earlier, ...was]));
    expect(ids.every((id) => done.has(id))).toBe(true);
    expect(currentNode(A, done)).toBeNull();
    expect(knownSkills(done)).toEqual(new Set(allNodes().flatMap((x) => x.teaches)));
    expect(rescuesHome(done)).toEqual(Array.from({ length: 24 }, (_, i) => i));
  });

  it('is the next thing to do for a child still there, who keeps everything already done', () => {
    // All six old lessons done and the checkpoint not: the two new ones come before it.
    let done = settled(new Set([...earlier, ...was.slice(0, -1)]));
    expect(done.size).toBe(earlier.length + 6);
    expect(currentNode(A, done)!.id).toBe('i2a1-r2');
    done = new Set([...done, 'i2a1-r2']);
    expect(currentNode(A, done)!.id).toBe('i2a1-l2');
    expect(currentNode(A, new Set([...done, 'i2a1-l2']))!.id).toBe('i2a1-boss');
    // Partway: nothing skipped, nothing undone.
    expect(currentNode(A, settled(new Set([...earlier, ...was.slice(0, 5)])))!.id).toBe('i2a1-r2');
    expect(currentNode(A, settled(new Set([...earlier, ...was.slice(0, 3)])))!.id).toBe('i2a1-h');
    expect(rescuesHome(settled(new Set([...earlier, ...was.slice(0, -1)])))).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it('leaves everyone already woken who they were', () => {
    // As numbered before the two lessons were added: every lesson in order.
    expect(was.slice(0, -1).map(rescueIndex)).toEqual([16, 17, 18, 19, 20, 21]);
    expect(['i2a1-r2', 'i2a1-l2'].map(rescueIndex)).toEqual([22, 23]);
    expect(new Set(allNodes().filter((x) => x.kind === 'lesson').map((x) => rescueIndex(x.id))).size).toBe(24);
  });

  it('settles nothing in an area whose checkpoint is not beaten', () => {
    expect(settled(new Set(['i1a1-a', 'i1a1-m']))).toEqual(new Set(['i1a1-a', 'i1a1-m']));
    expect(settled(new Set(['i1a1-boss'])).size).toBe(AREAS[0].nodes.length);
  });
});

describe('an s on the end', () => {
  const A = AREAS[4];
  const [addS, sZ] = A.nodes;
  const before = allNodes().slice(0, allNodes().indexOf(addS)).map((x) => x.id);
  const many = [{ base: 'cup', sound: 's' }, { base: 'pot', sound: 's' }, { base: 'top', sound: 's' }, { base: 'bed', sound: 'z' }, { base: 'pan', sound: 'z' }, { base: 'pin', sound: 'z' }];
  const words = [
    ...['am', 'at', 'mat', 'sat', 'cup', 'pot', 'bed'].map((text) => ({ text, graphemes: [...text] })),
    ...['is', 'as', 'his'].map((text) => ({ text, graphemes: [...text], sounds: [...text.slice(0, -1), 'z'] })),
  ];
  const ctxAt = (done: string[], seed = 1, sounds = 'amstpfinodcugbez') =>
    ctxFor([...before, ...done], { seed, content: { hasSound: (g) => sounds.includes(g), hasName: () => true, words, many } });
  const manys = (rounds: Round[]) => itemsOf(rounds).flatMap((i) => (i.kind === 'many' ? [i] : []));

  it('teaches the ending and the second sound as skills of their own', () => {
    expect(addS.teaches).toEqual([suffix('s')]);
    expect(sZ.teaches).toEqual([second('s')]);
    expect(graphemeOf(suffix('s'))).toBeNull();
    expect(graphemeOf(second('s'))).toBeNull();
  });

  it('shows nothing as one and several before the ending is taught, and nothing whose s says /z/ before that is', () => {
    expect(manyItem('cup', ctxAt([]), 'show')).toBeNull();
    expect(manyItem('cup', ctxAt([addS.id]), 'show')!.target).toBe('cups');
    expect(manyItem('bed', ctxAt([addS.id]), 'show')).toBeNull();
    expect(manyItem('bed', ctxAt([addS.id, sZ.id]), 'ask', false)).toMatchObject({ target: 'bed', sound: 'z', skills: [suffix('s')], supports: [second('s')] });
    expect(manyItem('bed', ctxAt([addS.id, sZ.id], 1, 'amstpfinodcugbe'), 'show')).toBeNull(); // no clip of the /z/ sound
  });

  it('counts a show as evidence of nothing', () => {
    expect(manyItem('cup', ctxAt([addS.id]), 'show')).toMatchObject({ skills: [], supports: [] });
  });

  it('opens the first lesson with three things whose s says /s/, then asks for one word of each pair, both kinds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rounds = planLesson(addS, ctxAt([addS.id], seed), T0);
      expect(rounds.map((r) => r.exercise)).toEqual(['many', 'blend', 'pick-letter']);
      const items = manys(rounds);
      expect(items.map((i) => i.stage)).toEqual(['show', 'show', 'show', 'ask', 'ask', 'ask', 'ask']);
      expect(items.every((i) => i.sound === 's')).toBe(true);
      const asked = items.slice(3).map((i) => i.target === i.base);
      expect(asked).toContain(true);
      expect(asked).toContain(false);
      // Words where s says /z/ are not read yet.
      expect(itemsOf(rounds).some((i) => i.kind === 'blend' && i.sounds.includes('z'))).toBe(false);
    }
  });

  it('gives the second lesson the things whose s says /z/, one from before, and only words where s says it', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rounds = planLesson(sZ, ctxAt([addS.id, sZ.id], seed), T0);
      const items = manys(rounds);
      expect(items.slice(0, 3).map((i) => `${i.stage} ${i.sound}`)).toEqual(['show z', 'show z', 'show z']);
      expect(items.slice(3).map((i) => i.sound)).toEqual(['z', 'z', 'z', 's']);
      const built = itemsOf(rounds).flatMap((i) => (i.kind === 'blend' ? [i] : []));
      expect(built.map((i) => i.word).sort()).toEqual(['as', 'is']);
      expect(built[0]).toMatchObject({ sounds: [built[0].word[0], 'z'], supports: expect.arrayContaining([second('s')]) });
    }
  });

  it('keeps a word where s says /z/ out of reach until that is taught, and its other letters are', () => {
    const texts = (ctx: GenContext) => readableWords(ctx).map((w) => w.text);
    expect(texts(ctxAt([addS.id]))).not.toContain('is');
    expect(texts(ctxAt([addS.id, sZ.id]))).toContain('is');
    expect(texts(ctxAt([addS.id, sZ.id]))).not.toContain('his');
  });

  it('asks about the ending again in the area checkpoint, and in practice when it is shaky', () => {
    const done = A.nodes.map((x) => x.id);
    expect(manys(planCheckpoint(A, ctxAt(done), T0)).map((i) => i.stage)).toEqual(['ask', 'ask']);
    const shaky = { ...emptyState(suffix('s')), seen: 4, strength: 0.2, lastAt: T0, dueAt: T0 + DAY };
    const practice = planPractice(ctxAt(done, 1), T0, false) ?? [];
    expect(manys(practice).length).toBe(0);
    const aimed = planPractice({ ...ctxAt(done), states: new Map([[suffix('s'), shaky]]) }, T0) ?? [];
    expect(manys(aimed).length).toBe(SIZES.practiceMany);
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
