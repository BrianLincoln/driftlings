// The unit of learning. Everything the scheduler, generator and parent view
// talk about is a skill id. This layer has no dependency on rendering.

export type WordShape = 'vc' | 'cvc' | 'ccvc' | 'cvcc' | 'other';

/**
 * gpc:m       the letter-sound correspondence m -> /m/
 * blend:cvc   blending a word of that shape
 * heart:the   an irregular word known by heart
 * suffix:s    an s on the end of a word: more than one of the thing
 * second:s    the other sound a letter makes: s saying /z/, as in "is" and "beds"
 */
export type SkillId = `gpc:${string}` | `blend:${WordShape}` | `heart:${string}` | `suffix:${string}` | `second:${string}`;

export const gpc = (grapheme: string): SkillId => `gpc:${grapheme}`;
export const blend = (shape: WordShape): SkillId => `blend:${shape}`;
export const suffix = (ending: string): SkillId => `suffix:${ending}`;
export const second = (grapheme: string): SkillId => `second:${grapheme}`;
export const heart = (word: string): SkillId => `heart:${word}`;

export function graphemeOf(id: SkillId): string | null {
  return id.startsWith('gpc:') ? id.slice(4) : null;
}

export function heartOf(id: SkillId): string | null {
  return id.startsWith('heart:') ? id.slice(6) : null;
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/**
 * A word cut into its graphemes: one per sound, so "quit" is qu, i, t. `multi` are the graphemes of more than one
 * letter there are; the longest that fits is taken at each place. A dot forces a cut where that would be wrong
 * ("mis.hap" is not mi, sh, a, p); the dots are not part of the word.
 */
export function splitGraphemes(spelling: string, multi: readonly string[]): string[] {
  const longest = [...multi].sort((a, b) => b.length - a.length);
  return spelling.split('.').flatMap((part) => {
    const out: string[] = [];
    for (let i = 0; i < part.length; ) {
      const g = longest.find((m) => part.startsWith(m, i)) ?? part[i];
      out.push(g);
      i += g.length;
    }
    return out;
  });
}

/** Shape of a word from its graphemes, e.g. ['s','a','t'] -> 'cvc'. A grapheme of two letters is one place: qu, i, t is cvc too. */
export function shapeOf(graphemes: string[]): WordShape {
  const s = graphemes.map((g) => (VOWELS.has(g[0]) ? 'v' : 'c')).join('');
  return s === 'vc' || s === 'cvc' || s === 'ccvc' || s === 'cvcc' ? s : 'other';
}

/** Letters that make the same sound. Hearing the sound cannot tell them apart, so neither is offered beside the other. */
const SAME_SOUND = [['c', 'k']];

export const soundsLike = (a: string, b: string): boolean => a === b || SAME_SOUND.some((set) => set.includes(a) && set.includes(b));

/** Letters that say a sound as well as the letter whose sound it is: s says /z/ in "is". Asked for /z/, picking s is not a mistake to be shown. */
const ALSO_SAYS: Record<string, string[]> = { z: ['s'] };

/** True if `other` cannot stand as a wrong choice when the sound of `target` is asked for. The other way round it may: asked for /s/, z is wrong. */
export const answersFor = (target: string, other: string): boolean => soundsLike(target, other) || (ALSO_SAYS[target] ?? []).includes(other);
