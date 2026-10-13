import { describe, expect, it } from 'vitest';
import { AREAS, allNodes, findNode, knownSkills } from './curriculum';
import type { Attempt } from './events';
import { byHeart, heartBuild, heartFind, heartMeet, type GenContext } from './generator';
import type { Content, HeartItem, Item, Round } from './items';
import { confusions, foldSkills } from './model';
import { seeded } from './rng';
import { gate, planCheckpoint, planLesson } from './scheduler';
import { gpc, heart, heartOf } from './skills';

const T0 = 1_700_000_000_000;
const THE = { text: 'the', graphemes: ['th', 'e'], sounds: ['th', 'u'] };
const A = { text: 'a', graphemes: ['a'], sounds: ['u'] };
const plain = (text: string) => ({ text, graphemes: [...text] });
const WORDS = [...['am', 'at', 'mat', 'sat', 'map', 'pat', 'tap', 'on', 'in', 'cat', 'pot', 'cup', 'bed', 'bug'].map(plain), { text: 'is', graphemes: ['i', 's'], sounds: ['i', 'z'] }];
const THINGS = ['map', 'cat', 'pot', 'cup', 'bed', 'bug'].map((name) => ({ name, on: ['bed', 'pot', 'cup'].includes(name), in: ['cup', 'pot'].includes(name) }));

function content(o: Partial<Content> = {}): Content {
  return { hasSound: () => true, hasName: () => true, words: WORDS, many: [], hearts: [THE, A], drawable: THINGS, ...o };
}

/** A child who has finished everything up to and including `upTo`. */
function at(upTo: string, o: Partial<GenContext> & { seed?: number } = {}): GenContext {
  const order = allNodes().map((n) => n.id);
  return {
    known: knownSkills(new Set(order.slice(0, order.indexOf(upTo) + 1))),
    foils: [], content: content(), states: new Map(), confusions: new Map(), rng: seeded(o.seed ?? 1), ...o,
  };
}

let n = 0;
const answered = (word: string, correct = true, o: Partial<Attempt> = {}): Attempt => ({
  type: 'attempt', id: `h${++n}`, at: T0 + n, node: 'x', exercise: 'heart', skills: [heart(word)], supports: [],
  target: word, answer: correct ? word : 'mat', correct, try: 1, helped: false, ms: 1500, ...o,
});

const node = (id: string) => findNode(id)!.node;
const items = (rounds: Round[]): Item[] => rounds.flatMap((r) => r.items);
const hearts = (rounds: Round[]) => items(rounds).filter((i): i is HeartItem => i.kind === 'heart');

describe('irregular words', () => {
  it('come one to a lesson: "the", then "a"', () => {
    expect(node('i1a2-p').teaches).toContain(heart('the'));
    expect(node('i1a2-f').teaches).toContain(heart('a'));
    expect(heartOf(heart('the'))).toBe('the');
    expect(heartOf(gpc('a'))).toBeNull();
    for (const x of allNodes()) expect(x.teaches.filter((s) => heartOf(s)).length, x.id).toBeLessThanOrEqual(1);
  });

  it('put a heart on every tile that does not say what has been taught, and take it off when the lessons catch up', () => {
    expect(byHeart(THE, at('i1a2-p'))).toEqual([true, true]);
    // e is taught, but not as saying this.
    expect(byHeart(THE, at('i2a1-boss'))).toEqual([true, true]);
    const is = WORDS.find((w) => w.text === 'is')!;
    expect(byHeart(is, at('i1a2-boss'))).toEqual([false, true]);
    expect(byHeart(is, at('i2a1-s-z'))).toEqual([false, false]);
    const then = { ...THE, graphemes: ['th', 'e'], sounds: ['th', 'e'] };
    expect(byHeart(then, { ...at('i2a1-boss'), known: new Set([...at('i2a1-boss').known, gpc('th')]) })).toEqual([false, false]);
  });

  it('are not shown before they are taught, or without their clips', () => {
    expect(heartMeet('the', at('i1a1-boss'))).toBeNull();
    expect(heartMeet('the', at('i1a2-p', { content: content({ hearts: [A] }) }))).toBeNull();
    expect(heartMeet('the', at('i1a2-p'))).toMatchObject({ stage: 'meet', skills: [], supports: [], graphemes: ['th', 'e'] });
  });

  it('are picked from among real words, and spelled only if there is more than one tile', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const find = heartFind('the', at('i1a2-p', { seed }))!;
      expect(find.skills).toEqual([heart('the')]);
      expect(find.choices.map((c) => c.text)).toContain('the');
      expect(new Set(find.choices.map((c) => c.text)).size).toBe(3);
      for (const c of find.choices) expect(['the', ...WORDS.map((w) => w.text)]).toContain(c.text);
    }
    expect(heartBuild('the', at('i1a2-p'), 'free')).toMatchObject({ kind: 'blend', skills: [heart('the')], byHeart: [true, true] });
    expect(heartBuild('a', at('i1a2-f'), 'free')).toBeNull();
  });

  it('are met, asked for straight after, and spelled once, in the lesson that teaches one', () => {
    const rounds = planLesson(node('i1a2-p'), at('i1a2-p'), T0);
    const h = hearts(rounds);
    expect(h[0]).toMatchObject({ stage: 'meet', word: 'the', first: true });
    expect(h.slice(1).every((i) => i.stage === 'find' && i.word === 'the')).toBe(true);
    expect(h.length).toBeGreaterThanOrEqual(4);
    expect(items(rounds).some((i) => i.kind === 'blend' && i.word === 'the' && i.stage === 'guided')).toBe(true);
    // Nothing before it changed: the letter is still met first.
    expect(rounds[0].exercise).toBe('meet');
  });

  it('are met before anything asks about them, by a child who was past the lesson before the game had them', () => {
    const h = hearts(planLesson(node('i1a3-o'), at('i1a3-o'), T0));
    expect(h.filter((i) => i.stage === 'meet').map((i) => i.word)).toEqual(['the', 'a']);
    expect(h.filter((i) => i.stage === 'meet').map((i) => i.first)).toEqual([true, false]);
    for (const w of ['the', 'a']) expect(h.some((i) => i.stage === 'find' && i.word === w)).toBe(true);
    expect(h.findIndex((i) => i.stage === 'find')).toBe(2);
  });

  it('are left alone in a lesson once known, and asked for again at their checkpoint', () => {
    const states = foldSkills([answered('the'), answered('a')]);
    expect(hearts(planLesson(node('i1a3-o'), at('i1a3-o', { states }), T0))).toEqual([]);
    const check = planCheckpoint(AREAS[1], at('i1a2-n', { states }), T0);
    expect(hearts(check).map((i) => `${i.stage} ${i.word}`).sort()).toEqual(['find a', 'find the']);
    expect(items(check).some((i) => i.kind === 'blend' && i.word === 'the' && i.stage === 'free')).toBe(true);
  });

  it('are met again when they have gone shaky', () => {
    const states = foldSkills([answered('the', false), answered('the', false), answered('the', false), answered('a')]);
    const h = hearts(planLesson(node('i1a3-o'), at('i1a3-o', { states }), T0));
    expect(h[0]).toMatchObject({ stage: 'meet', word: 'the', first: false });
  });

  it('do not hold a child back from the next area, and their mix-ups are kept apart from letters', () => {
    const states = foldSkills(Array.from({ length: 8 }, () => answered('a', false)));
    expect(gate(AREAS[1], states)).toEqual([]);
    const c = confusions([answered('a', false)]);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('word:a')?.get('mat')).toBe(1);
  });

  it('are caught up on two to a lesson, in the order they are taught, by a child who was past their lessons', () => {
    const SAID = { text: 'said', graphemes: ['s', 'ai', 'd'], sounds: ['s', 'e', 'd'] };
    const I = { text: 'I', graphemes: ['I'], sounds: ['I'] };
    const four = content({ hearts: [THE, A, I, SAID] });
    const meets = (known: string[]) => hearts(planLesson(node('i1a4-u'), at('i1a4-u', { content: four, states: foldSkills(known.map((w) => answered(w))) }), T0)).filter((i) => i.stage === 'meet').map((i) => i.word);
    expect(meets([])).toEqual(['the', 'a']);
    expect(meets(['the', 'a'])).toEqual(['I', 'said']);
    expect(meets(['the', 'a', 'I', 'said'])).toEqual([]);
    // The word a lesson teaches comes before any the child is behind on, and no word is asked about or shown unmet.
    const h = hearts(planLesson(node('i1a3-d'), at('i1a3-d', { content: four }), T0));
    expect(h.filter((i) => i.stage === 'meet').map((i) => i.word)).toEqual(['said', 'the', 'a']);
    expect(h.filter((i) => i.stage === 'find').some((i) => i.word === 'I' || i.choices.some((c) => c.text === 'I'))).toBe(false);
    expect(h.find((i) => i.word === 'said')!.byHeart).toEqual([false, true, false]);
  });
});
