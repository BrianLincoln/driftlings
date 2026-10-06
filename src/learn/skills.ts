// The unit of learning. Everything the scheduler, generator and parent view
// talk about is a skill id. This layer has no dependency on rendering.

export type WordShape = 'vc' | 'cvc' | 'ccvc' | 'cvcc' | 'other';

/**
 * gpc:m       the letter-sound correspondence m -> /m/
 * blend:cvc   blending a word of that shape
 * heart:the   an irregular word known by heart
 */
export type SkillId = `gpc:${string}` | `blend:${WordShape}` | `heart:${string}`;

export const gpc = (grapheme: string): SkillId => `gpc:${grapheme}`;
export const blend = (shape: WordShape): SkillId => `blend:${shape}`;

export function graphemeOf(id: SkillId): string | null {
  return id.startsWith('gpc:') ? id.slice(4) : null;
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** Shape of a word from its graphemes, e.g. ['s','a','t'] -> 'cvc'. */
export function shapeOf(graphemes: string[]): WordShape {
  const s = graphemes.map((g) => (VOWELS.has(g[0]) ? 'v' : 'c')).join('');
  return s === 'vc' || s === 'cvc' || s === 'ccvc' || s === 'cvcc' ? s : 'other';
}
