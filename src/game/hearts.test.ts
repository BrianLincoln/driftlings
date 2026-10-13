import { describe, expect, it } from 'vitest';
import hearts from '../content/hearts.json';
import { soundClip, wordClip } from '../content/content';
import { allNodes, knownSkills, rescueIndex, settled } from '../learn/curriculum';
import { byHeart } from '../learn/generator';
import type { Content } from '../learn/items';
import { graphemeOf, heartOf, second, type SkillId } from '../learn/skills';

// The irregular words as they really are (hearts.json) against the lessons as they really are.

const WORDS = Object.entries(hearts.words).map(([text, w]) => ({ text, ...w }));
const word = (text: string) => WORDS.find((w) => w.text === text)!;
const nodes = allNodes();
const nodeOf = (text: string) => nodes.find((n) => n.teaches.some((s) => heartOf(s) === text))!;
const none: Content = { hasSound: () => true, hasName: () => true, words: [], many: [], hearts: [], drawable: [] };
/** Where the hearts are for a child who has done everything up to and including `upTo`, and anything in `more`. */
const heartsAt = (text: string, upTo: string, more: SkillId[] = []) => {
  const order = nodes.map((n) => n.id);
  const known = new Set([...knownSkills(new Set(order.slice(0, order.indexOf(upTo) + 1))), ...more]);
  return byHeart(word(text), { known, foils: [], content: none, states: new Map(), confusions: new Map(), rng: () => 0 });
};

/** The lesson UFLI first has each word in (docs/ufli.md). */
const UFLI: Record<string, number> = { the: 1, a: 7, I: 1, said: 13, to: 15, do: 15, of: 17, see: 19, he: 23, be: 23, me: 23, from: 25, are: 27, was: 29, you: 31, what: 33, have: 33 };

describe('the irregular words, each at its lesson', () => {
  it('are listed in the order they are taught, none before UFLI has it', () => {
    expect(WORDS.map((w) => w.text)).toEqual(nodes.flatMap((n) => n.teaches.map(heartOf)).filter(Boolean));
    expect(Object.keys(UFLI).sort()).toEqual(WORDS.map((w) => w.text).sort());
    for (const w of WORDS) expect(nodeOf(w.text).ufli!, w.text).toBeGreaterThanOrEqual(UFLI[w.text]);
  });

  it('are one to a lesson, and none in a lesson that is already long: an ending, new word shapes, a checkpoint', () => {
    for (const n of nodes) {
      const count = n.teaches.filter((s) => heartOf(s)).length;
      expect(count, n.id).toBeLessThanOrEqual(1);
      if (n.kind !== 'lesson' || n.late || n.teaches.some((s) => /^(suffix|second|blend):/.test(s))) expect(count, n.id).toBe(0);
    }
  });

  it('carry a heart on just the tiles that do not say what has been taught by then', () => {
    const at: Record<string, boolean[]> = {
      the: [true, true], a: [true], I: [true],
      said: [false, true, false], to: [false, true], do: [false, true], of: [true, true],
      see: [false, true], he: [false, true], be: [false, true], me: [false, true],
      from: [false, false, true, false], was: [false, true, false], are: [true],
      you: [false, true], what: [true, true, false], have: [false, false, true],
    };
    for (const w of WORDS) expect(heartsAt(w.text, nodeOf(w.text).id), w.text).toEqual(at[w.text]);
  });

  it('lose a heart when the lessons catch up with a tile, and not before', () => {
    // A word seen early (as a choice beside another, say) has more hearts than at its own lesson.
    expect(heartsAt('said', 'i1a2-boss')).toEqual([false, true, true]);
    expect(heartsAt('said', 'i1a3-d')).toEqual([false, true, false]);
    // The s of "was" says /z/: by heart until that is taught, like the s of "is".
    expect(heartsAt('was', 'i2a1-add-s')).toEqual([true, true, true]);
    expect(heartsAt('was', 'i2a1-s-z')).toEqual([true, true, false]);
    expect(heartsAt('was', 'i2a2-w')).toEqual([false, true, false]);
    expect(heartsAt('from', 'i2a1-h')).toEqual([false, true, true, false]);
    expect(heartsAt('from', 'i2a1-r')).toEqual([false, false, true, false]);
    // Nothing in the six islands takes these away: the e of "he" still says its name, "the" still has two.
    for (const w of ['he', 'be', 'me', 'the', 'I', 'of', 'are']) expect(heartsAt(w, 'i2a2-boss').some(Boolean), w).toBe(true);
    // A later lesson that teaches e saying its name takes the last heart off "he", and it is an ordinary word.
    expect(heartsAt('he', 'i2a2-boss', [second('e')])).toEqual([false, false]);
    expect(heartsAt('me', 'i2a2-boss', [second('e')])).toEqual([false, false]);
  });

  it('are heard from clips that can exist: a taught letter, a letter saying its name, or one of three new sounds', () => {
    const letters = nodes.flatMap((n) => n.teaches.map(graphemeOf)).filter(Boolean);
    for (const w of WORDS) {
      for (const s of w.sounds) expect([...letters, 'th', 'oo', 'ar', 'E', 'I'], `${w.text}: ${s}`).toContain(s);
    }
    expect(soundClip('E')).toBe('letters/e-name');
    expect(soundClip('I')).toBe('letters/i-name');
    expect(soundClip('oo')).toBe('letters/oo-sound');
    expect(wordClip('I')).toBe('words/i');
  });

  it('send nobody back: no lesson was added for them, so every rescue keeps its number and a finished island stays finished', () => {
    const lessons = nodes.filter((n) => n.kind === 'lesson');
    expect(lessons.filter((n) => n.late).map((n) => n.id)).toEqual(['i2a1-r2', 'i2a1-l2']);
    // The six islands that were out when the words were added; later islands add lessons after these.
    expect(lessons.findIndex((n) => n.id === 'i2a2-z')).toBe(30);
    expect(rescueIndex('i2a2-z')).toBe(30);
    const done = new Set(nodes.map((n) => n.id));
    expect(settled(done)).toEqual(done);
  });
});
