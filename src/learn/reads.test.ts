import { describe, expect, it } from 'vitest';
import { AREAS, allNodes, findNode, knownSkills } from './curriculum';
import type { Attempt } from './events';
import type { GenContext } from './generator';
import type { Content, Item, ReadItem, Round } from './items';
import { foldSkills } from './model';
import { pictureLabel, readItem } from './reads';
import { seeded } from './rng';
import { SIZES, planCheckpoint, planLesson } from './scheduler';
import { blend, gpc, heart, second } from './skills';

const T0 = 1_700_000_000_000;
const HEARTS = [
  { text: 'the', graphemes: ['th', 'e'], sounds: ['th', 'u'] },
  { text: 'a', graphemes: ['a'], sounds: ['u'] },
  { text: 'I', graphemes: ['I'], sounds: ['I'] },
  { text: 'said', graphemes: ['s', 'ai', 'd'], sounds: ['s', 'e', 'd'] },
  { text: 'see', graphemes: ['s', 'ee'], sounds: ['s', 'E'] },
  { text: 'you', graphemes: ['y', 'ou'], sounds: ['y', 'oo'] },
  { text: 'have', graphemes: ['h', 'a', 've'], sounds: ['h', 'a', 'v'] },
];
const plain = (text: string) => ({ text, graphemes: [...text] });
const WORDS = [...['am', 'at', 'mat', 'sat', 'map', 'pat', 'tap', 'it', 'on', 'in', 'cat', 'pot', 'cup', 'bed', 'bug'].map(plain), { text: 'is', graphemes: ['i', 's'], sounds: ['i', 'z'] }];
const THINGS = ['map', 'cat', 'pot', 'cup', 'bed', 'bug'].map((name) => ({ name, on: ['bed', 'pot', 'cup'].includes(name), in: ['cup', 'pot'].includes(name) }));

function content(o: Partial<Content> = {}): Content {
  return { hasSound: () => true, hasName: () => true, words: WORDS, many: [], hearts: HEARTS.slice(0, 2), drawable: THINGS, ...o };
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
const answered = (word: string): Attempt => ({
  type: 'attempt', id: `r${++n}`, at: T0 + n, node: 'x', exercise: 'heart', skills: [heart(word)], supports: [],
  target: word, answer: word, correct: true, try: 1, helped: false, ms: 1500,
});
const node = (id: string) => findNode(id)!.node;
const items = (rounds: Round[]): Item[] => rounds.flatMap((r) => r.items);
const reads = (rounds: Round[]) => items(rounds).filter((i): i is ReadItem => i.kind === 'read');
const text = (r: ReadItem) => r.words.map((w) => w.text).join(' ');

describe('words nobody says', () => {
  const met = ['the', 'a'];

  it('need three drawn things the child can read, and an irregular word the child has met', () => {
    expect(readItem(at('i1a2-boss'), met)).toBeNull(); // only the map
    expect(readItem(at('i1a3-c'), [])).toBeNull();
    expect(readItem(at('i1a3-c', { content: content({ drawable: THINGS.slice(0, 2) }) }), met)).toBeNull();
  });

  it('show a phrase and three things, one of them what it says', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = readItem(at('i1a3-c', { seed }), met)!;
      expect(r.words.length).toBe(2);
      expect(met).toContain(r.words[0].text);
      expect(r.words[1].text).toBe(r.target.thing);
      const things = r.choices.map((c) => c.thing);
      expect(things).toContain(r.target.thing);
      expect(new Set(things).size).toBe(3);
      for (const t of things) expect(['map', 'cat', 'pot']).toContain(t);
      expect(r.skills).toEqual([blend('cvc')]);
      expect(r.supports).toContain(heart(r.words[0].text));
    }
  });

  it('make a thing on or in another only once "is" can be read, with each wrong picture wrong by one word', () => {
    expect(readItem(at('i1a4-boss'), met, 'scene')!.words.length).toBe(2);
    for (let seed = 1; seed <= 60; seed++) {
      const r = readItem(at('i2a1-s-z', { seed }), met, 'scene')!;
      expect(r.words.map((w) => w.text).slice(2, 4)).toEqual(['is', r.target.where!.rel]);
      const labels = r.choices.map(pictureLabel);
      expect(new Set(labels).size).toBe(3);
      expect(labels).toContain(pictureLabel(r.target));
      for (const c of r.choices) {
        expect(c.where!.rel).toBe(r.target.where!.rel);
        expect(c.thing).not.toBe(c.where!.thing);
        if (c.where!.rel === 'in') expect(['cup', 'pot']).toContain(c.where!.thing);
        const same = Number(c.thing === r.target.thing) + Number(c.where!.thing === r.target.where!.thing);
        expect(same).toBeGreaterThanOrEqual(1);
      }
      expect(r.supports).toContain(second('s'));
    }
  });

  const all = content({ hearts: HEARTS });
  const everyone = HEARTS.map((w) => w.text);

  it('put only "the" or "a" before a thing, whatever other irregular words the child has met', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = readItem(at('i2a2-boss', { seed, content: all }), everyone)!;
      expect(r.words.length).toBe(2);
      expect(['the', 'a']).toContain(r.words[0].text);
    }
  });

  it('make a sentence that says which thing, from words the child has met or can sound out, and a phrase until then', () => {
    // "see" is taught, but this child has not met it.
    expect(readItem(at('i1a4-boss', { content: all }), ['the', 'a', 'I'], 'sentence')!.words.length).toBe(2);
    // Met, somehow, but not yet taught: it is not in this child's game at all.
    expect(readItem(at('i1a3-c', { content: all }), everyone, 'sentence')!.words.length).toBe(2);
    // And never with a word whose clip is missing.
    expect(readItem(at('i1a4-boss', { content: content({ hearts: HEARTS.filter((w) => w.text !== 'see') }) }), everyone, 'sentence')!.words.length).toBe(2);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const r = readItem(at('i2a1-k', { seed, content: all }), ['the', 'a', 'I', 'see'], 'sentence', SIZES.sentenceTiles)!;
      const lead = r.words.slice(0, -2).map((w) => w.text).join(' ');
      seen.add(lead);
      expect(['I see', 'it is']).toContain(lead);
      expect(['the', 'a']).toContain(r.words.at(-2)!.text);
      expect(r.words.at(-1)!.text).toBe(r.target.thing);
      expect(r.words.reduce((k, w) => k + w.graphemes.length, 0)).toBeLessThanOrEqual(SIZES.sentenceTiles);
      // Still three things to choose between, and the thing's word is what the answer is evidence for.
      expect(r.choices.every((c) => !c.where)).toBe(true);
      expect(new Set(r.choices.map((c) => c.thing)).size).toBe(3);
      expect(r.skills).toEqual([blend('cvc')]);
      if (lead === 'I see') expect(r.supports).toEqual(expect.arrayContaining([heart('I'), heart('see'), gpc('s')]));
      if (lead === 'it is') {
        expect(r.supports).toEqual(expect.arrayContaining([gpc('i'), gpc('t'), second('s')]));
        expect(r.words.at(-2)!.text).toBe('a'); // "it is the cat" is a tile too long
      }
      const see = r.words.find((w) => w.text === 'see');
      if (see) expect(see.byHeart).toEqual([false, true]);
    }
    expect([...seen].sort()).toEqual(['I see', 'it is']);
    // "it is" waits for s saying /z/.
    for (let seed = 1; seed <= 30; seed++) expect(text(readItem(at('i1a4-boss', { seed, content: all }), ['the', 'a'], 'sentence')!)).not.toMatch(/ is /);
  });

  it('use "you" and "have" once they are taught and met, where the words fit', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const r = readItem(at('i2a2-boss', { seed, content: all }), everyone, 'sentence', SIZES.sentenceTiles)!;
      seen.add(r.words.slice(0, -1).map((w) => w.text).join(' '));
    }
    expect([...seen].sort()).toEqual(['I have a', 'I see a', 'I see the', 'it is a', 'you see a']);
  });

  it('end a lesson with a phrase and then a sentence, once the words of one have been met', () => {
    const states = foldSkills(everyone.map(answered));
    const lesson = reads(planLesson(node('i2a1-h'), at('i2a1-h', { content: all, states }), T0));
    expect(lesson.map((r) => r.words.length)).toEqual([2, 4]);
    // A child who has only just been taught them meets two at a time, and reads none of the others meanwhile.
    for (const r of reads(planLesson(node('i2a1-h'), at('i2a1-h', { content: all }), T0))) {
      for (const w of r.words) expect(['the', 'a', 'it', 'is', ...THINGS.map((t) => t.name)]).toContain(w.text);
    }
    expect(reads(planCheckpoint(AREAS[4], at('i2a1-l2', { content: all, states }), T0)).every((r) => !r.target.where)).toBe(true);
  });

  it('end a lesson and a checkpoint with a phrase or two, and never yet a thing on another', () => {
    const lesson = reads(planLesson(node('i1a3-c'), at('i1a3-c'), T0));
    expect(lesson.length).toBe(2);
    expect(reads(planCheckpoint(AREAS[4], at('i2a1-l2'), T0)).every((r) => !r.target.where)).toBe(true);
    expect(reads(planLesson(node('i1a2-p'), at('i1a2-p'), T0))).toEqual([]);
  });
});
