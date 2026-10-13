import manifest from './audio-manifest.json';
import endings from './endings.json';
import hearts from './hearts.json';
import keywordGroups from './keywords.json';
import wordGroups from './words.json';
import type { Content } from '../learn/items';

// What exists. The learning layer only ever generates from this, so a word
// becomes playable the moment its clip is built, with no other change.

const clips = manifest as Record<string, number>;

export type ClipId = string;

/**
 * `?unrecorded`: play as if every clip had been recorded. The missing ones are silent and take no time.
 * For looking at a lesson before its narration exists; never for players.
 */
const PRETEND = typeof location !== 'undefined' && new URLSearchParams(location.search).has('unrecorded');

/** True if the clip can be asked for. */
export const hasClip = (id: ClipId): boolean => PRETEND || id in clips;
/** True if there is really something to hear. */
export const recorded = (id: ClipId): boolean => id in clips;
export const clipSeconds = (id: ClipId): number => clips[id] ?? 0;
export const clipUrl = (id: ClipId): string => `${import.meta.env.BASE_URL}audio/${id}.mp3`;

export const soundClip = (grapheme: string): ClipId => `letters/${grapheme}-sound`;
export const nameClip = (grapheme: string): ClipId => `letters/${grapheme}-name`;
export const wordClip = (word: string): ClipId => `words/${word}`;
export const promptClip = (name: string): ClipId => `prompts/${name}`;

/** An everyday word that begins with the grapheme's sound, if one has been recorded. Only ever heard. */
export function keywordClip(grapheme: string): ClipId | null {
  const listed = (keywordGroups as Record<string, string[] | string>)[grapheme];
  return (Array.isArray(listed) ? listed.map(wordClip).find(hasClip) : null) ?? null;
}

const allWords = Object.entries(wordGroups as Record<string, string[] | string>)
  .filter(([, v]) => Array.isArray(v))
  .flatMap(([, v]) => v as string[]);

export const CONTENT: Content = {
  hasSound: (g) => hasClip(soundClip(g)),
  hasName: (g) => hasClip(nameClip(g)),
  words: [
    // Regular words: one letter, one sound.
    ...allWords.map((text) => ({ text, graphemes: [...text] })),
    // And the few where the s on the end says /z/.
    ...endings.sSaysZ.map((text) => ({ text, graphemes: [...text], sounds: [...text.slice(0, -1), 'z'] })),
  ].filter((w) => hasClip(wordClip(w.text))),
  many: Object.entries(endings.many)
    .flatMap(([sound, bases]) => bases.map((base) => ({ base, sound })))
    .filter((m) => hasClip(wordClip(m.base)) && hasClip(wordClip(`${m.base}s`))),
  hearts: Object.entries(hearts.words)
    .map(([text, w]) => ({ text, ...w }))
    .filter((w) => hasClip(wordClip(w.text)) && w.sounds.every((s) => hasClip(soundClip(s)))),
  // Every thing with a drawing is listed in endings.json (a test in scenes checks the two agree).
  drawable: Object.values(endings.many)
    .flat()
    .filter((name) => hasClip(wordClip(name)))
    .map((name) => ({ name, on: hearts.on.includes(name), in: hearts.in.includes(name) })),
};
