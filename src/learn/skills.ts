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

export function graphemeOf(id: SkillId): string | null {
  return id.startsWith('gpc:') ? id.slice(4) : null;
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** Shape of a word from its graphemes, e.g. ['s','a','t'] -> 'cvc'. */
export function shapeOf(graphemes: string[]): WordShape {
  const s = graphemes.map((g) => (VOWELS.has(g[0]) ? 'v' : 'c')).join('');
  return s === 'vc' || s === 'cvc' || s === 'ccvc' || s === 'cvcc' ? s : 'other';
}

/** Letters that make the same sound. Hearing the sound cannot tell them apart, so neither is offered beside the other. */
const SAME_SOUND = [['c', 'k']];

export const soundsLike = (a: string, b: string): boolean => a === b || SAME_SOUND.some((set) => set.includes(a) && set.includes(b));
