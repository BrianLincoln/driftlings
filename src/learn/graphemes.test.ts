import { describe, expect, it } from 'vitest';
import { AREAS, allNodes, knownSkills, multiGraphemes, rescueIndex, type NodeDef } from './curriculum';
import { blendItem, catchItem, decodableWords, meetItem, pickLetterItem, readableWords, type GenContext } from './generator';
import type { Content, Item, Round } from './items';
import { seeded } from './rng';
import { SIZES, planCheckpoint, planLesson } from './scheduler';
import { answersFor, blend, gpc, graphemeOf, shapeOf, splitGraphemes } from './skills';

// Graphemes of more than one letter: qu now, the digraphs (ck, sh, th, ch) from UFLI 42 on.
// One tile, one sound, one skill, wherever a word is cut, asked about or built.

const T0 = 1_700_000_000_000;
const MULTI = ['qu', 'sh', 'ch', 'th', 'ck', 'tch'];
const cut = (spelling: string) => ({ text: spelling.replaceAll('.', ''), graphemes: splitGraphemes(spelling, MULTI) });

describe('cutting a word into graphemes', () => {
  it('takes a letter at a time where there is nothing longer', () => {
    expect(splitGraphemes('sat', MULTI)).toEqual(['s', 'a', 't']);
    expect(splitGraphemes('quit', [])).toEqual(['q', 'u', 'i', 't']);
  });

  it('keeps two letters that make one sound together, wherever they stand', () => {
    expect(splitGraphemes('quit', MULTI)).toEqual(['qu', 'i', 't']);
    expect(splitGraphemes('squid', MULTI)).toEqual(['s', 'qu', 'i', 'd']);
    expect(splitGraphemes('ship', MULTI)).toEqual(['sh', 'i', 'p']);
    expect(splitGraphemes('duck', MULTI)).toEqual(['d', 'u', 'ck']);
    expect(splitGraphemes('thick', MULTI)).toEqual(['th', 'i', 'ck']);
  });

  it('takes the longest that fits, whatever order they are listed in', () => {
    expect(splitGraphemes('catch', MULTI)).toEqual(['c', 'a', 'tch']);
    expect(splitGraphemes('catch', ['tch', 'ch'])).toEqual(['c', 'a', 'tch']);
    expect(splitGraphemes('chat', MULTI)).toEqual(['ch', 'a', 't']);
  });

  it('cuts at a dot, which is not part of the word', () => {
    expect(splitGraphemes('mishap', MULTI)).toEqual(['m', 'i', 'sh', 'a', 'p']);
    expect(splitGraphemes('mis.hap', MULTI)).toEqual(['m', 'i', 's', 'h', 'a', 'p']);
    expect(cut('mis.hap').text).toBe('mishap');
  });

  it('counts one of them as one place in a word\'s shape', () => {
    expect(shapeOf(['qu', 'i', 't'])).toBe('cvc');
    expect(shapeOf(['s', 'qu', 'i', 'd'])).toBe('ccvc');
    expect(shapeOf(['qu', 'i', 'l', 't'])).toBe('cvcc');
    expect(shapeOf(['sh', 'i', 'p'])).toBe('cvc');
    expect(shapeOf(['d', 'u', 'ck'])).toBe('cvc');
  });

  it('is cut by whatever the lessons teach: so far, qu', () => {
    expect(multiGraphemes()).toEqual(['qu']);
  });
});

describe('the island that ends the alphabet', () => {
  const A = AREAS[5];
  const before = allNodes().slice(0, allNodes().indexOf(A.nodes[0])).map((x) => x.id);
  const LETTERS = ['w', 'j', 'y', 'x', 'qu', 'v', 'z'];
  const older = ['am', 'at', 'mat', 'sat', 'map', 'pin', 'dog', 'cat', 'bed', 'sun', 'kid', 'hat', 'red', 'log', 'trip', 'flag', 'help'];
  const WORDS = [...older, 'wet', 'win', 'jam', 'jet', 'yes', 'yum', 'fox', 'box', 'six', 'quit', 'quiz', 'van', 'vet', 'zip', 'zap', 'swim', 'squid', 'jump', 'next', 'quilt'];
  const heard = [...'amstpfinodcugbekhrlwjyxvz', 'qu'];
  const content = (words = WORDS): Content =>
    ({ hasSound: (g) => heard.includes(g), hasName: () => true, words: words.map(cut), many: [], hearts: [], drawable: [] });
  const node = (g: string) => A.nodes.find((x) => x.id === `i2a2-${g}`)!;
  /** Everything up to and including the node, as a child who has just reached it has it. */
  const ctxAt = (at: NodeDef, seed = 1, words = WORDS): GenContext => ({
    known: knownSkills(new Set([...before, ...A.nodes.slice(0, A.nodes.indexOf(at) + 1).map((x) => x.id)])),
    foils: [], content: content(words), states: new Map(), confusions: new Map(), rng: seeded(seed),
  });
  const itemsOf = (rounds: Round[]): Item[] => rounds.flatMap((r) => r.items);
  const blendsOf = (rounds: Round[]) => itemsOf(rounds).flatMap((i) => (i.kind === 'blend' ? [i] : []));

  it('teaches w, j, y, x, qu, v, z in UFLI\'s order and ends on a boss', () => {
    expect(A.id).toBe('i2a2');
    expect(A.nodes.map((x) => x.ufli)).toEqual([28, 29, 30, 31, 32, 33, 34, null]);
    expect(A.nodes.slice(0, -1).map((x) => x.teaches)).toEqual(LETTERS.map((g) => [gpc(g)]));
    expect(A.nodes.at(-1)!.kind).toBe('boss');
    // Every little one before this island keeps its number.
    expect(A.nodes.slice(0, -1).map((x) => rescueIndex(x.id))).toEqual([24, 25, 26, 27, 28, 29, 30]);
  });

  it('asks about qu as one thing: met on one tile, picked as one choice, and with no name to be caught by', () => {
    const ctx = ctxAt(node('qu'));
    expect(meetItem('qu', ctx)!.grapheme).toBe('qu');
    for (let seed = 1; seed <= 40; seed++) {
      const pick = pickLetterItem('qu', ctxAt(node('qu'), seed))!;
      expect(pick.target).toBe('qu');
      expect(pick.skills).toEqual([gpc('qu')]);
      expect(pick.choices).toContain('qu');
      for (const c of pick.choices) expect(c === 'qu' || c.length === 1, c).toBe(true);
      expect(pick.choices).not.toContain('q');
    }
    expect(catchItem('qu', ctx)).toBeNull();
    // It can still come down as one card among the letters that are not wanted.
    const fell = new Set(Array.from({ length: 80 }, (_, seed) => catchItem('v', ctxAt(node('v'), seed + 1))!.others).flat());
    expect(fell.has('qu')).toBe(true);
    expect(fell.has('q')).toBe(false);
  });

  it('gives the qu lesson everything a letter lesson has but the catching, and qu in its first word', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rounds = planLesson(node('qu'), ctxAt(node('qu'), seed), T0);
      expect(rounds.map((r) => r.exercise)).toEqual(['meet', 'pick-letter', 'blend']);
      expect(rounds[1].items[0]).toMatchObject({ target: 'qu' });
      const built = blendsOf(rounds);
      expect(built.length).toBe(SIZES.lessonBlends);
      expect(built[0].graphemes).toContain('qu');
      // "quiz" has to wait for z.
      expect(built.map((b) => b.word)).not.toContain('quiz');
    }
  });

  it('builds a word with qu in it out of one tile for the two letters', () => {
    const ctx = ctxAt(node('qu'));
    const quit = blendItem('quit', ctx)!;
    expect(quit.graphemes).toEqual(['qu', 'i', 't']);
    expect(quit.sounds).toEqual(['qu', 'i', 't']);
    expect(quit.skills).toEqual([blend('cvc')]);
    expect(quit.supports).toEqual([gpc('qu'), gpc('i'), gpc('t')]);
    expect(blendItem('squid', ctx)!.skills).toEqual([blend('ccvc')]);
    expect(blendItem('quilt', ctx)!.graphemes).toEqual(['qu', 'i', 'l', 't']);
  });

  it('cannot read a word with qu in it before qu is taught, though u is', () => {
    const ctx = ctxAt(node('x'));
    expect(ctx.known.has(gpc('u'))).toBe(true);
    expect(readableWords(ctx).map((w) => w.text)).not.toContain('quit');
    expect(blendItem('quit', ctx, 'read')).toBeNull();
    expect(decodableWords(ctxAt(node('qu'))).map((w) => w.text)).toContain('quit');
    // Nor without its sound to be heard.
    const silent: Content = { ...content(), hasSound: (g) => g !== 'qu' && heard.includes(g) };
    expect(readableWords({ ...ctxAt(node('qu')), content: silent }).map((w) => w.text)).not.toContain('quit');
  });

  it('uses each new letter in a word in its own lesson, x at the end of one', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const at of A.nodes.slice(0, -1)) {
        const g = graphemeOf(at.teaches[0])!;
        const built = blendsOf(planLesson(at, ctxAt(at, seed), T0));
        expect(built[0].graphemes, g).toContain(g);
        for (const b of built) expect(b.graphemes[0], b.word).not.toBe('x');
      }
    }
  });

  it('never sets s beside z when /z/ is asked for, since s says it too; asked for /s/, z is a fair wrong choice', () => {
    expect(answersFor('z', 's')).toBe(true);
    expect(answersFor('s', 'z')).toBe(false);
    const beside = (target: string) => new Set(Array.from({ length: 200 }, (_, seed) => pickLetterItem(target, ctxAt(node('z'), seed + 1))!.choices).flat());
    expect(beside('z').has('s')).toBe(false);
    expect(beside('s').has('z')).toBe(true);
  });

  it('goes round all seven in the checkpoint, and builds words with them in', () => {
    const boss = A.nodes.at(-1)!;
    for (let seed = 1; seed <= 40; seed++) {
      const rounds = planCheckpoint(A, ctxAt(boss, seed), T0);
      const asked = new Set(itemsOf(rounds).flatMap((i) => (i.kind === 'pick-letter' ? [i.target] : [])));
      for (const g of LETTERS) expect(asked.has(g), g).toBe(true);
      const built = blendsOf(rounds);
      expect(built.length).toBe(SIZES.checkpointBlends);
      for (const b of built) expect(b.graphemes.some((g) => LETTERS.includes(g)), b.word).toBe(true);
      expect(new Set(built.flatMap((b) => b.graphemes).filter((g) => LETTERS.includes(g))).size).toBeGreaterThanOrEqual(3);
    }
  });
});
