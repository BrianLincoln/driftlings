// The unit of learning. Everything the scheduler, generator and parent view
// talk about is a skill id. This layer has no dependency on rendering.

export type WordShape = 'vc' | 'cvc' | 'ccvc' | 'cvcc' | 'ccvcc' | 'cccvc' | 'other';

/**
 * gpc:m       the letter-sound correspondence m -> /m/
 * blend:cvc   blending a word of that shape
 * heart:the   an irregular word known by heart
 * suffix:s    an s on the end of a word: more than one of the thing
 * second:s    the other sound a letter makes: s saying /z/, as in "is" and "beds"; th saying /th/ as in "thin"
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
/** True of a grapheme that is a short vowel: the middle of every word so far. */
export const isVowel = (g: string): boolean => VOWELS.has(g);
/**
 * A glued sound (UFLI 43): a vowel and the ll after it on one tile, because together they do not say what the letters
 * say apart (ball, roll, pull). In a word's shape it stands for the vowel and the consonant: ball is cvc, small ccvc.
 */
const GLUED = new Set(['all', 'oll', 'ull']);
export const isGlued = (g: string): boolean => GLUED.has(g);
const SHAPES: ReadonlySet<string> = new Set(['vc', 'cvc', 'ccvc', 'cvcc', 'ccvcc', 'cccvc']);

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

/**
 * Shape of a word from its graphemes, e.g. ['s','a','t'] -> 'cvc'. A grapheme of two letters is one place: qu, i, t is cvc too,
 * and so is sh, i, p. A glued sound is two: b, all is cvc. The longest are five places: stamp, strap.
 */
export function shapeOf(graphemes: string[]): WordShape {
  const s = graphemes.map((g) => (isVowel(g) ? 'v' : isGlued(g) ? 'vc' : 'c')).join('');
  return SHAPES.has(s) ? (s as WordShape) : 'other';
}

/**
 * Letters that make the same sound. Hearing the sound cannot tell them apart, so neither is offered beside the other.
 * A doubled letter (UFLI 42) and ck (44) say just what the single letter says.
 */
const SAME_SOUND = [['c', 'k', 'ck'], ['f', 'ff'], ['l', 'll'], ['s', 'ss'], ['z', 'zz']];

/** Graphemes heard from another's clip, because they say exactly that: ff is heard as f. Nothing new to record for them. */
export const HEARD_AS: Readonly<Record<string, string>> = { ff: 'f', ll: 'l', ss: 's', zz: 'z', ck: 'k' };

/**
 * A grapheme's second sound, where it has one, as the token its clip is named by: th says /th/ as in "this" first
 * (UFLI 46, the sound "the" already uses) and /th/ as in "thin" second (47). s saying /z/ is an ending of its own (`planEnding`).
 */
export const SECOND_SOUND: Readonly<Record<string, string>> = { th: 'th-unvoiced' };

export const soundsLike = (a: string, b: string): boolean => a === b || SAME_SOUND.some((set) => set.includes(a) && set.includes(b));

/** Letters that say a sound as well as the letter whose sound it is: s says /z/ in "is". Asked for /z/, picking s is not a mistake to be shown. */
const ALSO_SAYS: Record<string, string[]> = { z: ['s'], zz: ['s'] };

/** True if `other` cannot stand as a wrong choice when the sound of `target` is asked for. The other way round it may: asked for /s/, z is wrong. */
export const answersFor = (target: string, other: string): boolean => soundsLike(target, other) || (ALSO_SAYS[target] ?? []).includes(other);
