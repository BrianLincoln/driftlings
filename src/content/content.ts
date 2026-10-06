import manifest from './audio-manifest.json';
import wordGroups from './words.json';
import type { Content } from '../learn/items';

// What exists. The learning layer only ever generates from this, so a word
// becomes playable the moment its clip is built, with no other change.

const clips = manifest as Record<string, number>;

export type ClipId = string;

export const hasClip = (id: ClipId): boolean => id in clips;
export const clipSeconds = (id: ClipId): number => clips[id] ?? 0;
export const clipUrl = (id: ClipId): string => `${import.meta.env.BASE_URL}audio/${id}.mp3`;

export const soundClip = (grapheme: string): ClipId => `letters/${grapheme}-sound`;
export const wordClip = (word: string): ClipId => `words/${word}`;
export const promptClip = (name: string): ClipId => `prompts/${name}`;

const allWords = Object.entries(wordGroups as Record<string, string[] | string>)
  .filter(([, v]) => Array.isArray(v))
  .flatMap(([, v]) => v as string[]);

export const CONTENT: Content = {
  hasSound: (g) => hasClip(soundClip(g)),
  // These are all regular words: one letter, one sound.
  words: allWords.filter((w) => hasClip(wordClip(w))).map((text) => ({ text, graphemes: [...text] })),
};
