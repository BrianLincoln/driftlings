import { describe, expect, it } from 'vitest';
import { AREAS, allNodes, knownSkills, multiGraphemes, type NodeDef } from './curriculum';
import { chainWords } from './chains';
import { blendItem, decodableWords, meetItem, pickLetterItem, readableWords, secondMeetItem, secondPickItem, type GenContext } from './generator';
import type { Content, Item, Round, Word } from './items';
import { seeded } from './rng';
import { planCheckpoint, planLesson, planPractice } from './scheduler';
import { SECOND_SOUND, answersFor, blend, gpc, second, shapeOf, splitGraphemes } from './skills';

// The digraphs, UFLI 42 to 48 (island i2a4): doubled letters, the glued sounds, ck, sh, th with its two sounds, ch.
// Each is one tile, as qu is; th as in "thin" is th's second sound, taught as s saying /z/ is.

const T0 = 1_700_000_000_000;
const MULTI = multiGraphemes();
const UNVOICED = SECOND_SOUND.th;
/** A word as content.ts holds it: th says its second sound unless the word is one of these. */
const VOICED = ['this', 'that', 'then', 'them', 'than', 'with'];
const word = (spelling: string): Word => {
  const graphemes = splitGraphemes(spelling, MULTI);
  const text = spelling.replaceAll('.', '');
  return graphemes.includes('th') && !VOICED.includes(text) ? { text, graphemes, sounds: graphemes.map((g) => (g === 'th' ? UNVOICED : g)) } : { text, graphemes };
};
const WORDS = [
  'cat', 'sat', 'mat', 'bat', 'pat', 'hat', 'bit', 'pit', 'sit', 'hit', 'fit', 'pin', 'tin', 'bin', 'fin', 'bun',
  'puff', 'cuff', 'bell', 'tell', 'sell', 'hill', 'fill', 'kiss', 'miss', 'buzz', 'fizz', 'spill', 'still',
  'ball', 'call', 'tall', 'fall', 'small', 'roll', 'toll', 'troll', 'scroll', 'bull', 'pull', 'full',
  'back', 'pack', 'sack', 'kick', 'sick', 'duck', 'luck', 'black', 'stack',
  'ship', 'shop', 'shin', 'fish', 'dish', 'wish', 'cash', 'shell',
  'this', 'that', 'then', 'them', 'than', 'with', 'thin', 'thick', 'bath', 'math', 'path', 'moth', 'cloth',
  'chip', 'chin', 'chop', 'chat', 'much', 'rich', 'chick', 'bench',
].map(word);
const AREA = AREAS.find((a) => a.id === 'i2a4')!;
const node = (id: string) => AREA.nodes.find((n) => n.id === `i2a4-${id}`)!;
const content = (unvoiced = true): Content => ({
  hasSound: (g) => g !== UNVOICED || unvoiced, hasName: (g) => g.length === 1, hasPrompt: () => true,
  words: WORDS, many: [], hearts: [], drawable: [],
});
const ctxAt = (at: NodeDef, seed = 1, c = content()): GenContext => {
  const order = allNodes();
  return {
    known: knownSkills(new Set(order.slice(0, order.indexOf(at) + 1).map((n) => n.id))),
    foils: [], content: c, states: new Map(), confusions: new Map(), rng: seeded(seed),
  };
};
const itemsOf = (rounds: Round[]): Item[] => rounds.flatMap((r) => r.items);
const texts = (ws: Word[]) => ws.map((w) => w.text);

describe('the digraphs island', () => {
  it('teaches UFLI 42 to 48 in order, one tile for each grapheme, and ends on a checkpoint of ours', () => {
    expect(AREA.nodes.map((n) => n.ufli)).toEqual([42, 43, 44, 45, 46, 47, 48, null]);
    expect(node('ff').teaches.filter((s) => s.startsWith('gpc:'))).toEqual(['ff', 'll', 'ss', 'zz'].map(gpc));
    expect(node('all').teaches.filter((s) => s.startsWith('gpc:'))).toEqual(['all', 'oll', 'ull'].map(gpc));
    expect(node('th2').teaches).toEqual([second('th')]);
  });

  it('cuts each new grapheme as one tile, the longest first, and counts a glued sound as a vowel and a consonant', () => {
    expect(splitGraphemes('ball', MULTI)).toEqual(['b', 'all']);
    expect(splitGraphemes('shell', MULTI)).toEqual(['sh', 'e', 'll']);
    expect(splitGraphemes('chick', MULTI)).toEqual(['ch', 'i', 'ck']);
    expect(splitGraphemes('scroll', MULTI)).toEqual(['s', 'c', 'r', 'oll']);
    expect(splitGraphemes('do.ll', MULTI)).toEqual(['d', 'o', 'll']);
    expect(shapeOf(['b', 'all'])).toBe('cvc');
    expect(shapeOf(['s', 'm', 'all'])).toBe('ccvc');
    expect(shapeOf(['s', 'c', 'r', 'oll'])).toBe('cccvc');
    expect(shapeOf(['sh', 'i', 'p'])).toBe('cvc');
    expect(shapeOf(['b', 'e', 'n', 'ch'])).toBe('cvcc');
  });

  it('never sets a doubled letter or ck beside the letter that says the same sound', () => {
    for (const [a, b] of [['f', 'ff'], ['l', 'll'], ['s', 'ss'], ['z', 'zz'], ['k', 'ck'], ['c', 'ck']]) {
      expect(answersFor(a, b), `${a} ${b}`).toBe(true);
      expect(answersFor(b, a), `${b} ${a}`).toBe(true);
    }
    for (let seed = 1; seed <= 60; seed++) {
      const pick = pickLetterItem('ff', ctxAt(node('ff'), seed))!;
      expect(pick.choices).toContain('ff');
      expect(pick.choices).not.toContain('f');
    }
  });

  it('reads words with th as in "this" from UFLI 46, and as in "thin" only from 47', () => {
    const at46 = texts(readableWords(ctxAt(node('th'))));
    expect(at46).toEqual(expect.arrayContaining(['this', 'that', 'then', 'with']));
    for (const w of ['thin', 'thick', 'bath', 'cloth']) expect(at46, w).not.toContain(w);
    const at47 = texts(decodableWords(ctxAt(node('th2'))));
    expect(at47).toEqual(expect.arrayContaining(['thin', 'thick', 'bath', 'cloth', 'this']));
    const thin = blendItem('thin', ctxAt(node('th2')))!;
    expect(thin.sounds).toEqual([UNVOICED, 'i', 'n']);
    expect(thin.supports).toEqual([gpc('th'), second('th'), gpc('i'), gpc('n')]);
    // Not until its sound can be heard.
    expect(texts(readableWords(ctxAt(node('th2'), 1, content(false))))).not.toContain('thin');
  });

  it('keeps th as in "thin" out of word chains, where a tile must say the same in every word', () => {
    const chainable = texts(chainWords(ctxAt(node('ch'))));
    expect(chainable).toContain('this');
    for (const w of ['thin', 'bath', 'math', 'path']) expect(chainable, w).not.toContain(w);
  });

  it('meets th again with its second sound, asks for it by that sound, and builds words that have it', () => {
    expect(meetItem('th', ctxAt(node('th2')))!.sound).toBeUndefined();
    expect(secondMeetItem('th', ctxAt(node('th')))).toBeNull();
    expect(secondMeetItem('th', ctxAt(node('th2')))).toMatchObject({ grapheme: 'th', sound: UNVOICED });
    expect(secondPickItem('th', ctxAt(node('th2')))).toMatchObject({ target: 'th', sound: UNVOICED, skills: [second('th')] });
    for (let seed = 1; seed <= 30; seed++) {
      const rounds = planLesson(node('th2'), ctxAt(node('th2'), seed), T0);
      expect(rounds.slice(0, 3).map((r) => r.exercise)).toEqual(['meet', 'pick-letter', 'blend']);
      expect(rounds[1].items[0]).toMatchObject({ target: 'th', sound: UNVOICED });
      // th is never asked for by its first sound in the same round.
      for (const i of rounds[1].items) if (i.kind === 'pick-letter' && i.target === 'th') expect(i.sound).toBe(UNVOICED);
      for (const i of rounds[2].items) if (i.kind === 'blend') expect(i.sounds, i.word).toContain(UNVOICED);
    }
  });

  it('teaches nothing of the second sound before it is recorded, and still has a lesson', () => {
    const rounds = planLesson(node('th2'), ctxAt(node('th2'), 1, content(false)), T0);
    expect(rounds.length).toBeGreaterThan(0);
    expect(itemsOf(rounds).some((i) => (i.kind === 'pick-letter' || i.kind === 'meet') && i.sound)).toBe(false);
  });

  it('asks for both sounds of th at the checkpoint, and for the second in practice when it is shaky', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const picks = itemsOf(planCheckpoint(AREA, ctxAt(node('boss'), seed), T0)).flatMap((i) => (i.kind === 'pick-letter' ? [i] : []));
      expect(picks.some((p) => p.target === 'th' && !p.sound)).toBe(true);
      expect(picks.some((p) => p.target === 'th' && p.sound === UNVOICED)).toBe(true);
      for (const g of ['ff', 'll', 'ss', 'zz', 'all', 'oll', 'ull', 'ck', 'sh', 'ch']) expect(picks.some((p) => p.target === g), g).toBe(true);
    }
    const ctx = ctxAt(node('boss'));
    const shaky = { ...ctx, states: new Map([[second('th'), { id: second('th'), seen: 5, strength: 0.2, intervalMs: 0, lastAt: T0, dueAt: T0 + 1e9 }]]) };
    const picks = itemsOf(planPractice(shaky, T0)!).flatMap((i) => (i.kind === 'pick-letter' ? [i] : []));
    expect(picks.some((p) => p.sound === UNVOICED)).toBe(true);
  });

  it('builds a glued sound only beside another glued sound in a chain', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rounds = planLesson(node('all'), ctxAt(node('all'), seed), T0);
      for (const c of itemsOf(rounds)) {
        if (c.kind !== 'chain') continue;
        for (const s of c.steps) {
          const glued = ['all', 'oll', 'ull'].includes(s.graphemes[s.at]);
          for (const l of s.letters) expect(['all', 'oll', 'ull'].includes(l.grapheme), `${s.word} ${l.grapheme}`).toBe(glued);
        }
      }
    }
  });

  it('puts a new grapheme in the first word of its own lesson', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const id of ['ff', 'all', 'ck', 'sh', 'th', 'ch']) {
        const fresh = node(id).teaches.flatMap((s) => (s.startsWith('gpc:') ? [s.slice(4)] : []));
        const built = itemsOf(planLesson(node(id), ctxAt(node(id), seed), T0)).flatMap((i) => (i.kind === 'blend' && i.skills[0]?.startsWith('blend:') ? [i] : []));
        expect(built.length, id).toBeGreaterThan(0);
        expect(built[0].graphemes.some((g) => fresh.includes(g)), `${id}: ${built[0].word}`).toBe(true);
        expect(built.every((b) => b.skills[0] === blend(shapeOf(b.graphemes)))).toBe(true);
      }
    }
  });
});
