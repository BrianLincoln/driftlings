import { describe, expect, it } from 'vitest';
import { AREAS, allNodes, findNode } from './curriculum';
import { CHAIN_PROMPTS, chainItem, chainWords, changedAt } from './chains';
import { foldSkills, quality } from './model';
import type { Attempt } from './events';
import type { GenContext } from './generator';
import type { ChainItem, Content, Round } from './items';
import { seeded } from './rng';
import { planCheckpoint, planLesson, planPractice } from './scheduler';
import { blend, gpc, graphemeOf, heartOf, shapeOf, soundsLike, type SkillId } from './skills';

const T0 = 1_700_000_000_000;

// The game's own regular words, as src/content/words.json has them (this layer may not import it).
const WORDS = [
  'am', 'at', 'mat', 'sat',
  'an', 'in', 'it', 'if', 'map', 'nap', 'pan', 'pin', 'tip', 'tin', 'sit', 'fan', 'man', 'pat', 'tap', 'sip', 'pit', 'fit', 'fin', 'fat', 'tan',
  'on', 'cat', 'cot', 'dot', 'pot', 'top', 'mop', 'dip', 'dim', 'nod', 'sad', 'mad', 'dad', 'cap', 'can', 'cod',
  'up', 'us', 'bat', 'bed', 'big', 'bit', 'bud', 'bus', 'cab', 'cob', 'cup', 'cut', 'dig', 'dog', 'dug', 'fun', 'gap', 'gas', 'got', 'gum', 'mud', 'net', 'pig', 'pun', 'sun', 'ten', 'bug', 'peg', 'men', 'set', 'get', 'tub', 'nut',
  'kid', 'hat', 'hen', 'him', 'hop', 'lip', 'log', 'rat', 'red', 'rub', 'run', 'elk', 'milk',
  'trip', 'drum', 'crab', 'frog', 'grab', 'drop', 'skip', 'skin', 'flag', 'clap', 'plum', 'sled', 'glad', 'slip',
  'help', 'belt', 'gulp', 'held', 'desk', 'mask', 'hand', 'hunt', 'ant', 'nest',
];
const ODD = ['is', 'as', 'his', 'has'];
const LETTERS = 'amstpfinodcugbekhrl';

// The words with drawings, as src/content/drawn.json has them.
const DRAWN = ['cup','pot','bed','cat','bat','map','dog','pig','bug','mat','man','pan','fan','pin','tin','fin','tap','cap','cot','can','dot','top','mop','cod','dad','bud','bus','cab','cob','sun','net','nut','peg','tub','gum','mud','hat','hen','rat','log','lip'];

function content(o: { words?: string[]; sounds?: string; prompts?: boolean; drawn?: string[] } = {}): Content {
  const sounds = o.sounds ?? `${LETTERS}z`;
  return {
    hasSound: (g) => sounds.includes(g),
    hasName: () => true,
    words: [
      ...(o.words ?? WORDS).map((text) => ({ text, graphemes: [...text] })),
      ...ODD.map((text) => ({ text, graphemes: [...text], sounds: [...text.slice(0, -1), 'z'] })),
    ],
    many: [],
    hearts: [],
    drawable: (o.drawn ?? DRAWN).map((name) => ({ name, on: false, in: false })),
    hasPrompt: () => o.prompts ?? true,
  };
}

/** The context of a child doing this node: everything before it and what it teaches. */
function at(nodeId: string, o: Partial<GenContext> & { seed?: number } = {}): GenContext {
  const order = allNodes();
  const upTo = order.slice(0, order.findIndex((n) => n.id === nodeId) + 1);
  return { known: new Set(upTo.flatMap((n) => n.teaches)), foils: [], content: content(), states: new Map(), confusions: new Map(), rng: seeded(o.seed ?? 1), ...o };
}

const wordsOf = (c: ChainItem) => [c.start, ...c.steps.map((s) => s.word)];
const chainsIn = (rounds: Round[]) => rounds.flatMap((r) => r.items).filter((i): i is ChainItem => i.kind === 'chain');

/** Everything a chain must be, whatever the child knows. */
function check(c: ChainItem, ctx: GenContext): void {
  const ok = new Map(chainWords(ctx).map((w) => [w.text, w]));
  const taught = new Set([...ctx.known].map(graphemeOf).filter((g): g is string => !!g));
  const words = wordsOf(c);
  expect(new Set(words).size).toBe(words.length);
  expect(c.graphemes.join('')).toBe(c.start);
  let before = c.graphemes;
  c.steps.forEach((s, i) => {
    // One tile changes, in place, and the step says which.
    expect(s.graphemes.join('')).toBe(s.word);
    expect(changedAt(before, s.graphemes)).toBe(s.at);
    expect(s.at).toBeGreaterThanOrEqual(0);
    // Spelling first; reading only on every other step after, and only of a word with a drawing.
    if (i % 2 === 0) expect(s.mode).toBe('spell');
    const drawn = new Set(ctx.content.drawable.map((d) => d.name));
    if (s.mode === 'read') expect(drawn.has(s.word)).toBe(true);
    if (i % 2 === 1 && s.mode === 'spell') expect(drawn.has(s.word) && [...ok.keys()].filter((w) => drawn.has(w)).length >= 3).toBe(false);
    const shape = blend(shapeOf(s.graphemes));
    expect(ctx.known.has(shape)).toBe(true);
    const target = s.graphemes[s.at];
    if (s.mode === 'spell') {
      const offered = s.letters.map((l) => l.grapheme);
      expect(s.words).toEqual([]);
      expect(offered.filter((g) => g === target).length).toBe(1);
      expect(new Set(offered).size).toBe(offered.length);
      expect(offered.length).toBeGreaterThanOrEqual(2);
      expect(offered.length).toBeLessThanOrEqual(3);
      for (const l of s.letters) {
        expect(taught.has(l.grapheme)).toBe(true);
        expect(ctx.content.hasSound(l.grapheme)).toBe(true);
        const spelt = s.graphemes.map((g, n) => (n === s.at ? l.grapheme : g)).join('');
        if (l.grapheme === target) expect(l.makes).toBeUndefined();
        else {
          expect(soundsLike(l.grapheme, target)).toBe(false);
          expect(soundsLike(l.grapheme, before[s.at])).toBe(false);
          // What a wrong letter is said to make is exactly what it spells, and a word that can be said; and if it spells one, it is said.
          expect(l.makes).toBe(ok.has(spelt) ? spelt : undefined);
        }
      }
      expect(s.skills).toEqual([gpc(target), shape]);
      expect(s.supports).not.toContain(gpc(target));
    } else {
      expect(s.letters).toEqual([]);
      expect(s.words.filter((w) => w === s.word).length).toBe(1);
      expect(new Set(s.words).size).toBe(s.words.length);
      // Three drawings, each of a word the child can read.
      expect(s.words.length).toBe(3);
      for (const w of s.words) expect(ok.has(w) && drawn.has(w)).toBe(true);
      expect(s.skills).toEqual([shape]);
      expect(s.supports).toContain(gpc(target));
    }
    for (const id of [...s.skills, ...s.supports]) expect(ctx.known.has(id)).toBe(true);
    before = s.graphemes;
  });
  // Every word is one the child can build, said by its letters' usual sounds.
  for (const w of words) expect(ok.has(w)).toBe(true);
}

describe('where two words differ', () => {
  it('is one tile, in place', () => {
    expect(changedAt([...'sat'], [...'mat'])).toBe(0);
    expect(changedAt([...'sat'], [...'sit'])).toBe(1);
    expect(changedAt([...'sat'], [...'sad'])).toBe(2);
    expect(changedAt(['sh', 'i', 'p'], ['ch', 'i', 'p'])).toBe(0);
  });
  it('is nowhere for the same word, two changes, a letter added, or letters swapped round', () => {
    expect(changedAt([...'sat'], [...'sat'])).toBe(-1);
    expect(changedAt([...'sat'], [...'mad'])).toBe(-1);
    expect(changedAt([...'at'], [...'sat'])).toBe(-1);
    expect(changedAt([...'ant'], [...'at'])).toBe(-1);
    expect(changedAt([...'pat'], [...'tap'])).toBe(-1);
    expect(changedAt(['sh', 'i', 'p'], [...'ship'])).toBe(-1);
  });
});

describe('word chains', () => {
  it('hold their rules at every node, for many seeds', () => {
    let made = 0;
    // The lessons that go back over vowels teach no letter, and their chains have tests of their own (review.test.ts).
    for (const node of allNodes().filter((n) => !n.review)) {
      for (let seed = 1; seed <= 60; seed++) {
        const ctx = at(node.id, { seed });
        const c = chainItem(ctx);
        if (!c) continue;
        made++;
        check(c, ctx);
        expect(c.steps.length).toBeGreaterThanOrEqual(3);
        expect(c.steps.length).toBeLessThanOrEqual(4);
      }
    }
    expect(made).toBeGreaterThan(1000);
  });

  it('are not made before words can be built, or where they do not link up three times', () => {
    expect(chainItem(at('i1a1-t'))).toBeNull();
    // am, at, mat, sat: two pairs, no chain.
    expect(chainItem(at('i1a1-boss'))).toBeNull();
    expect(chainItem(at('i1a2-boss', { content: content({ words: ['sat', 'mat', 'pat', 'pin'] }) }))).toBeNull();
    for (let seed = 1; seed < 20; seed++) expect(chainItem(at('i1a2-p', { seed }))).not.toBeNull(); // tap map mat sat pat
  });

  it('are four steps where the words go that far, three where they do not, and fewer only if asked', () => {
    for (let seed = 1; seed < 20; seed++) expect(chainItem(at('i1a2-boss', { seed }))!.steps.length).toBe(4);
    const short = content({ words: ['sat', 'mat', 'pat', 'pit', 'fin'] });
    for (let seed = 1; seed < 20; seed++) {
      const ctx = at('i1a2-boss', { seed, content: short });
      const c = chainItem(ctx)!;
      expect(c.steps.length).toBe(3);
      check(c, ctx);
    }
    const two = content({ words: ['sat', 'mat', 'pat', 'fin'] });
    expect(chainItem(at('i1a2-boss', { content: two }))).toBeNull();
    expect(chainItem(at('i1a2-boss', { content: two }), { min: 2 })!.steps.length).toBe(2);
    expect(chainItem(at('i1a2-boss'), { steps: 3 })!.steps.length).toBe(3);
  });

  it('never use a word with no clip, an untaught letter, an untaught shape, or a letter saying its other sound', () => {
    for (let seed = 1; seed <= 80; seed++) {
      // "pat" has no clip here; c and d are not taught at this node; s says /z/ in "is" and "as".
      const ctx = at('i2a1-s-z', { seed, content: content({ words: WORDS.filter((w) => w !== 'pat') }) });
      const used = [wordsOf(chainItem(ctx)!), ...chainItem(ctx)!.steps.map((s) => [...s.words, ...s.letters.flatMap((l) => (l.makes ? [l.makes] : []))])].flat();
      expect(used).not.toContain('pat');
      for (const w of used) expect(ODD).not.toContain(w);
      const early = at('i1a2-boss', { seed });
      for (const w of wordsOf(chainItem(early)!)) expect(/[odcugbekhrl]/.test(w)).toBe(false);
      // Four-letter words are in the list from the start, but nobody is asked to build one before the lesson on them.
      for (const w of wordsOf(chainItem(at('i2a1-l', { seed }))!)) expect(w.length).toBeLessThanOrEqual(3);
    }
  });

  it('offer no letter whose sound has no clip, and none at all without two to choose between', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const ctx = at('i1a2-boss', { seed, content: content({ sounds: 'amstpi' }) });
      const c = chainItem(ctx);
      if (!c) continue;
      for (const w of wordsOf(c)) expect(/[fn]/.test(w)).toBe(false);
      for (const s of c.steps) for (const l of s.letters) expect('amstpi').toContain(l.grapheme);
    }
  });

  it('take in words with two consonants together once they are taught, and keep to them when asked', () => {
    const four = (w: { graphemes: string[] }) => w.graphemes.length === 4;
    for (let seed = 1; seed <= 40; seed++) {
      const ctx = at('i2a1-l2', { seed });
      const c = chainItem(ctx, { only: four, min: 2 })!;
      check(c, ctx);
      expect(wordsOf(c).every((w) => w.length === 4)).toBe(true);
    }
    // Before l2 only ccvc is taught: no chain goes through "help" or "milk".
    for (let seed = 1; seed <= 40; seed++) {
      const c = chainItem(at('i2a1-r2', { seed }), { only: four, min: 2 });
      for (const w of c ? wordsOf(c) : []) expect(shapeOf([...w])).toBe('ccvc');
    }
  });

  it('bring in a favoured letter, as the letter a spelling step asks for where one can be', () => {
    let asked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const c = chainItem(at('i1a4-b', { seed }), { favour: ['b'] })!;
      expect(wordsOf(c).some((w) => w.includes('b'))).toBe(true);
      if (c.steps.some((s) => s.mode === 'spell' && s.graphemes[s.at] === 'b')) asked++;
    }
    expect(asked).toBeGreaterThan(30);
  });

  it('do not change the same tile every time where the words allow another', () => {
    let varied = 0;
    for (let seed = 1; seed <= 40; seed++) if (new Set(chainItem(at('i1a4-boss', { seed }))!.steps.map((s) => s.at)).size > 1) varied++;
    expect(varied).toBeGreaterThan(36);
  });

  it('set beside the right letter one the child has put there before', () => {
    let n = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const confusions = new Map([['i', new Map([['e', 6]])]]);
      const c = chainItem(at('i1a4-boss', { seed, confusions }))!;
      for (const s of c.steps) if (s.mode === 'spell' && s.graphemes[s.at] === 'i' && s.letters.some((l) => l.grapheme === 'e')) n++;
    }
    expect(n).toBeGreaterThan(0);
  });

  it('read only a word with a drawing, beside two other drawn words; a step that cannot be read is spelt', () => {
    let reads = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const c = chainItem(at('i1a4-boss', { seed }))!;
      reads += c.steps.filter((s) => s.mode === 'read').length;
      // Nothing is drawn: every step is spelling, and the chain is as long as ever.
      const none = chainItem(at('i1a4-boss', { seed, content: content({ drawn: [] }) }))!;
      expect(none.steps.map((s) => s.mode)).toEqual(['spell', 'spell', 'spell', 'spell']);
      // Two drawn words are not enough to choose between.
      const two = chainItem(at('i1a4-boss', { seed, content: content({ drawn: ['cat', 'bat'] }) }))!;
      expect(two.steps.every((s) => s.mode === 'spell')).toBe(true);
      // A drawing of a word the child cannot read yet is no use: h is not taught here.
      for (const s of c.steps) expect(s.words).not.toContain('hat');
    }
    // With the drawings there are, most chains still have a word to read.
    expect(reads).toBeGreaterThan(40);
  });

  it('set beside the word to read ones a letter away from it', () => {
    let near = 0;
    let all = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (const s of chainItem(at('i1a4-boss', { seed }))!.steps.filter((x) => x.mode === 'read')) {
        all++;
        if (s.words.some((w) => w !== s.word && changedAt([...w], s.graphemes) >= 0)) near++;
      }
    }
    expect(near / all).toBeGreaterThan(0.8);
  });

  it('are the same for the same seed, and need their lines recorded', () => {
    expect(wordsOf(chainItem(at('i1a3-boss', { seed: 7 }))!)).toEqual(wordsOf(chainItem(at('i1a3-boss', { seed: 7 }))!));
    expect(chainItem(at('i1a3-boss', { content: content({ prompts: false }) }))).toBeNull();
    const { hasPrompt: _, ...bare } = content();
    expect(chainItem(at('i1a3-boss', { content: bare }))).toBeNull();
    expect(Object.values(CHAIN_PROMPTS).length).toBe(2);
  });
});

describe('what a chain is evidence of', () => {
  let n = 0;
  const attempt = (o: Partial<Attempt>): Attempt => ({ type: 'attempt', id: `c${++n}`, at: T0 + n, node: 'x', exercise: 'chain', skills: [], supports: [], target: '', answer: '', correct: true, try: 1, helped: false, ms: 1500, ...o });

  it('a spelling step counts for the letter put in and the shape; a reading step for the shape', () => {
    const c = chainItem(at('i1a2-boss'))!;
    const [spell, read] = c.steps;
    const states = foldSkills([
      attempt({ skills: spell.skills, supports: spell.supports, target: spell.graphemes[spell.at], answer: spell.graphemes[spell.at] }),
      attempt({ skills: read.skills, supports: read.supports, target: read.word, answer: read.word }),
    ]);
    expect(states.get(gpc(spell.graphemes[spell.at]))!.seen).toBe(1);
    expect(states.get(blend('cvc'))!.seen).toBe(2);
    // The other letters of the word were used, not asked about.
    for (const id of spell.supports) expect(states.get(id)!.seen).toBe(0);
    for (const id of spell.supports) expect(states.get(id)!.strength).toBeGreaterThan(0);
  });

  it('a wrong letter counts against the letter asked for, and nothing is credited', () => {
    const spell = chainItem(at('i1a2-boss'))!.steps[0];
    const states = foldSkills([attempt({ skills: spell.skills, supports: spell.supports, correct: false })]);
    expect(states.get(spell.skills[0])!.strength).toBe(0);
    expect(spell.supports.every((id: SkillId) => !states.has(id))).toBe(true);
    expect(quality({ correct: true, try: 2, helped: false, ms: 1 }, null)).toBe(0.4);
  });
});

describe('the scheduler and chains', () => {
  const node = (id: string) => findNode(id)!.node;
  const plan = (id: string, o: Partial<GenContext> & { seed?: number } = {}) => planLesson(node(id), at(id, o), T0);

  it('offers none up to the first blending lesson, and one in every lesson and checkpoint after', () => {
    for (const id of ['i1a1-a', 'i1a1-m', 'i1a1-s', 'i1a1-t', 'i1a1-blend']) expect(chainsIn(plan(id))).toEqual([]);
    expect(chainsIn(planCheckpoint(AREAS[0], at('i1a1-boss'), T0))).toEqual([]);
    const later = allNodes().slice(allNodes().findIndex((n) => n.id === 'i1a2-p'));
    for (const n of later) {
      for (let seed = 1; seed <= 10; seed++) {
        const ctx = at(n.id, { seed });
        const rounds = n.kind === 'lesson' ? planLesson(n, ctx, T0) : planCheckpoint(findNode(n.id)!.area, ctx, T0);
        const cs = chainsIn(rounds);
        // A stop for an irregular word alone has none.
        if (n.teaches.length && n.teaches.every(heartOf)) { expect(cs).toEqual([]); continue; }
        // A lesson that goes back over vowels, and its checkpoint, have two: one of short words and one of longer.
        expect(cs.length).toBe(findNode(n.id)!.area.nodes.some((x) => x.review) ? 2 : 1);
        for (const c of cs) check(c, ctx);
        expect(rounds.filter((r) => r.exercise === 'chain').length).toBe(1);
      }
    }
  });

  it('puts it after the lesson\'s own teaching and takes nothing away from it', () => {
    for (const id of ['i1a2-f', 'i1a4-g', 'i2a1-add-s', 'i2a1-r2']) {
      for (let seed = 1; seed <= 10; seed++) {
        const kinds = (rounds: Round[]) => rounds.map((r) => `${r.exercise}x${r.items.length}`);
        const withIt = kinds(plan(id, { seed }));
        const without = kinds(plan(id, { seed, content: content({ prompts: false }) }));
        expect(withIt.filter((k) => !k.startsWith('chain'))).toEqual(without);
        const i = withIt.indexOf('chainx1');
        // Everything the lesson teaches with comes first: there is no meeting, picking, catching or building after the chain.
        expect(i).toBeGreaterThan(0);
        expect(withIt.slice(i + 1).every((k) => /^(heart|read|blend)/.test(k))).toBe(true);
        expect(withIt.slice(0, i).some((k) => /^(pick-letter|blend|many)/.test(k))).toBe(true);
      }
    }
  });

  it('brings in the lesson\'s letter, and gives a lesson on new shapes a chain of those shapes', () => {
    let withB = 0;
    for (let seed = 1; seed <= 20; seed++) if (wordsOf(chainsIn(plan('i1a4-b', { seed }))[0]).some((w) => w.includes('b'))) withB++;
    expect(withB).toBe(20);
    for (let seed = 1; seed <= 20; seed++) {
      // slip, skip, skin: short, but the lesson's own. Before l is taught the ccvc words do not link up twice, and the chain is of older words.
      const c = chainsIn(plan('i2a1-l2', { seed }))[0];
      expect(wordsOf(c).every((w) => w.length === 4)).toBe(true);
      expect(c.steps.length).toBeGreaterThanOrEqual(2);
      expect(wordsOf(chainsIn(plan('i2a1-r2', { seed }))[0]).every((w) => w.length === 3)).toBe(true);
    }
  });

  it('is in practice only when word building is', () => {
    expect(chainsIn(planPractice(at('i1a3-boss'), T0, true)!).length).toBe(1);
    const shakyLetter = foldSkills([1, 2, 3].map((i) => ({ type: 'attempt' as const, id: `p${i}`, at: T0 - i, node: 'x', exercise: 'pick-letter', skills: [gpc('m')], supports: [], target: 'm', answer: 's', correct: false, try: 1, helped: false, ms: 900 })));
    expect(chainsIn(planPractice(at('i1a3-boss', { states: shakyLetter }), T0)!)).toEqual([]);
  });
});
