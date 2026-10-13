import { describe, expect, it } from 'vitest';
import { AREAS, allNodes, areaVowels, findNode } from './curriculum';
import { changedAt } from './chains';
import { readableWords, type GenContext } from './generator';
import { readItem } from './reads';
import type { BlendItem, ChainItem, Content, PickLetterItem, Round } from './items';
import { seeded } from './rng';
import { planCheckpoint, planLesson } from './scheduler';
import { blend, heart, isVowel, shapeOf } from './skills';

const T0 = 1_700_000_000_000;

// Some of the game's words, old and new (this layer may not import the list). The new ones are `late`.
const OLD = ['sat', 'sit', 'set', 'pan', 'pin', 'pun', 'cat', 'cot', 'cut', 'cap', 'cup', 'map', 'mop', 'tap', 'tip', 'top', 'fan', 'fin', 'fun', 'bed', 'bud', 'big', 'bug', 'net', 'nut', 'slip', 'slap', 'slop', 'flip', 'flap', 'help', 'held', 'desk', 'hunt'];
const NEW = ['hit', 'hot', 'hut', 'stop', 'step', 'spin', 'span', 'spun', 'lamp', 'limp', 'lump', 'best', 'rest', 'stamp', 'stomp', 'stump', 'clamp', 'clump', 'crust', 'crest', 'blend', 'blond', 'spend', 'strap', 'strip', 'scrap', 'strum', 'strut', 'scrub', 'split', 'splat'];
const THINGS = ['cat', 'cot', 'cap', 'cup', 'map', 'mop', 'pan', 'pin', 'fan', 'fin', 'tap', 'top', 'bed', 'bug'];

const content: Content = {
  hasSound: () => true,
  hasName: () => true,
  hasPrompt: () => true,
  words: [...OLD.map((text) => ({ text, graphemes: [...text] })), ...NEW.map((text) => ({ text, graphemes: [...text], late: true }))],
  many: [],
  hearts: [{ text: 'the', graphemes: ['th', 'e'], sounds: ['th', 'u'] }],
  drawable: THINGS.map((name) => ({ name, on: false, in: false })),
};

function at(nodeId: string, seed = 1): GenContext {
  const order = allNodes();
  const upTo = order.slice(0, order.findIndex((n) => n.id === nodeId) + 1);
  return { known: new Set(upTo.flatMap((n) => n.teaches)), foils: [], content, states: new Map(), confusions: new Map(), rng: seeded(seed) };
}

const AREA = AREAS.find((a) => a.id === 'i2a3')!;
const node = (id: string) => findNode(id)!.node;
const of = <T extends { kind: string }>(rounds: Round[], kind: string) => rounds.flatMap((r) => r.items).filter((i) => i.kind === kind) as unknown as T[];
const wordsOf = (c: ChainItem) => [[...c.graphemes], ...c.steps.map((s) => s.graphemes)];
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

describe('the review of the short vowels (UFLI 35 to 41)', () => {
  it('is one node a lesson, the last the checkpoint, and teaches no letter: only the two shapes of five sounds', () => {
    expect(AREA.nodes.map((n) => n.ufli)).toEqual([35, 36, 37, 38, 39, 40, 41]);
    expect(AREA.nodes.flatMap((n) => n.teaches).sort()).toEqual([blend('cccvc'), blend('ccvcc')]);
    expect(AREA.nodes.slice(0, -1).every((n) => n.review)).toBe(true);
    expect(areaVowels(AREA).sort()).toEqual(['a', 'e', 'i', 'o', 'u']);
    expect(AREAS.slice(0, 6).flatMap(areaVowels)).toEqual([]);
    expect(shapeOf([...'stamp'])).toBe('ccvcc');
    expect(shapeOf([...'strap'])).toBe('cccvc');
    expect(shapeOf(['s', 'qu', 'i', 'n', 't'])).toBe('ccvcc');
    expect(shapeOf([...'sprint'])).toBe('other');
  });

  it('keeps a late word back until its shape is taught, however early its letters are', () => {
    const early = readableWords(at('i1a4-boss')).map((w) => w.text);
    expect(readableWords(at('i2a1-h')).map((w) => w.text)).toContain('hit');
    for (const w of ['stop', 'lamp', 'stamp', 'strap']) expect(early).not.toContain(w);
    const blends = readableWords(at('i2a1-l2')).map((w) => w.text);
    expect(blends).toContain('stop');
    expect(blends).toContain('lamp');
    expect(blends).not.toContain('stamp');
    expect(readableWords(at('i2a3-aio')).map((w) => w.text)).toContain('stamp');
    expect(readableWords(at('i2a3-aio')).map((w) => w.text)).not.toContain('strap');
    expect(readableWords(at('i2a3-u')).map((w) => w.text)).toContain('strap');
  });

  it('asks which vowel makes a sound with only vowels to choose between, the lesson\'s own first and most', () => {
    for (const n of AREA.nodes.slice(0, -1)) for (const seed of SEEDS) {
      const picks = of<PickLetterItem>(planLesson(n, at(n.id, seed), T0), 'pick-letter');
      expect(picks.length).toBe(5);
      expect(picks[0].target).toBe(n.favours![0]);
      expect(picks.every((p) => p.choices.every(isVowel) && p.choices.length === 3)).toBe(true);
      expect(picks.filter((p) => n.favours!.includes(p.target)).length).toBeGreaterThanOrEqual(3);
      if (n.favours!.length === 1) expect(picks.some((p) => p.target !== n.favours![0])).toBe(true);
    }
  });

  it('builds words with the lesson\'s vowel, the first two of a new shape and shown how', () => {
    for (const n of AREA.nodes.slice(0, -1)) for (const seed of SEEDS) {
      const built = of<BlendItem>(planLesson(n, at(n.id, seed), T0), 'blend');
      expect(built.length).toBe(4);
      expect(built.every((b) => b.graphemes.some((g) => n.favours!.includes(g))), `${n.id}: ${built.map((b) => b.word)}`).toBe(true);
      if (n.teaches.length) {
        expect(built.slice(0, 2).every((b) => b.skills[0] === n.teaches[0])).toBe(true);
        expect(built[0].stage).toBe('guided');
      }
    }
    // Three consonants first, before the lesson on them: not built, and (being late) not even sounded out.
    expect(of<BlendItem>(planLesson(node('i2a3-aio'), at('i2a3-aio'), T0), 'blend').some((b) => b.graphemes.length === 5 && b.skills[0] === blend('cccvc'))).toBe(false);
  });

  it('gives two chains, and they turn on the vowel: most steps change it, and a vowel asked for stands among vowels', () => {
    let steps = 0;
    let onVowel = 0;
    for (const n of AREA.nodes) for (const seed of SEEDS) {
      const ctx = at(n.id, seed);
      const chains = of<ChainItem>(n.kind === 'lesson' ? planLesson(n, ctx, T0) : planCheckpoint(AREA, ctx, T0), 'chain');
      expect(chains.length, n.id).toBe(2);
      expect(chains[0].graphemes.length).toBe(3);
      expect(chains[1].graphemes.length).toBeGreaterThan(3);
      for (const c of chains) {
        const words = wordsOf(c);
        c.steps.forEach((s, i) => {
          expect(changedAt(words[i], words[i + 1])).toBe(s.at);
          steps++;
          if (!isVowel(s.graphemes[s.at])) return;
          onVowel++;
          if (s.mode === 'spell') expect(s.letters.every((l) => isVowel(l.grapheme)), c.start).toBe(true);
        });
      }
    }
    expect(onVowel / steps).toBeGreaterThan(0.7);
    // The lesson on three consonants first has a chain of its own shape: strap, strip.
    const own = of<ChainItem>(planLesson(node('i2a3-u'), at('i2a3-u'), T0), 'chain')[1];
    expect(shapeOf(own.graphemes)).toBe('cccvc');
  });

  it('reads a thing whose word is another\'s but for the vowel, with that other beside it', () => {
    const twin = (a: string, b: string) => a.length === b.length && [...a].filter((c, i) => c !== b[i]).length === 1 && [...a].some((c, i) => c !== b[i] && isVowel(c));
    let twinned = 0;
    for (const seed of SEEDS) {
      const ctx = at('i2a3-a', seed);
      (ctx.known as Set<string>).add(heart('the'));
      const item = readItem(ctx, ['the'], 'phrase', Infinity, ['a'])!;
      if (item.choices.some((c) => twin(c.thing, item.target.thing))) twinned++;
    }
    expect(twinned).toBeGreaterThanOrEqual(10);
  });

  it('checks every vowel at the end: each asked for, and five words built', () => {
    for (const seed of SEEDS) {
      const rounds = planCheckpoint(AREA, at('i2a3-boss', seed), T0);
      expect(new Set(of<PickLetterItem>(rounds, 'pick-letter').map((p) => p.target)).size).toBe(5);
      expect(of<BlendItem>(rounds, 'blend').length).toBe(5);
    }
  });
});
