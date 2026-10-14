import manifest from './audio-manifest.json';
import endings from './endings.json';
import drawn from './drawn.json';
import hearts from './hearts.json';
import keywordGroups from './keywords.json';
import wordGroups from './words.json';
import { AREAS, areaVowels, multiGraphemes } from '../learn/curriculum';
import type { Content } from '../learn/items';
import { HEARD_AS, SECOND_SOUND, splitGraphemes } from '../learn/skills';

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

export const nameClip = (grapheme: string): ClipId => `letters/${grapheme}-name`;
/**
 * A capital stands for a letter saying its name (the e of "he" is E, and "I" is I): that is the clip of its name.
 * A grapheme that says just what one letter says (ff, ck) is heard from that letter's clip.
 */
export const soundClip = (grapheme: string): ClipId =>
  /^[A-Z]$/.test(grapheme) ? nameClip(grapheme.toLowerCase()) : `letters/${HEARD_AS[grapheme] ?? grapheme}-sound`;
/** Clip names are lower case, whatever the word ("I"). */
export const wordClip = (word: string): ClipId => `words/${word.toLowerCase()}`;
export const promptClip = (name: string): ClipId => `prompts/${name}`;

/** An everyday word that begins with the grapheme's sound, if one has been recorded. Only ever heard. */
export function keywordClip(grapheme: string): ClipId | null {
  const listed = (keywordGroups as Record<string, string[] | string>)[grapheme];
  return (Array.isArray(listed) ? listed.map(wordClip).find(hasClip) : null) ?? null;
}

const MULTI = multiGraphemes();
/** A listed word as the game holds it: its text, and its graphemes, one per sound (qu is one). A dot in the list forces a cut. */
export const cut = (spelling: string): { text: string; graphemes: string[] } => ({ text: spelling.replaceAll('.', ''), graphemes: splitGraphemes(spelling, MULTI) });

/** The words whose th says its first sound, as in "this" (`thSaysThis` in words.json). In every other word th says its second, as in "thin". */
const TH_FIRST = new Set((wordGroups as Record<string, string[] | string>).thSaysThis.toString().split(' '));
/** What each grapheme of a listed word says, where one says its second sound; nothing where every one says its own. */
const soundsOf = (w: { text: string; graphemes: string[] }): string[] | undefined =>
  w.graphemes.includes('th') && !TH_FIRST.has(w.text) ? w.graphemes.map((g) => (g === 'th' ? SECOND_SOUND.th : g)) : undefined;

/** The areas that go back over the vowels. Their groups of words are spelled with early letters (stop, stamp) and wait for their shapes. */
const REVIEWS = AREAS.filter((a) => areaVowels(a).length).map((a) => a.id);
const allWords = Object.entries(wordGroups as Record<string, string[] | string>)
  .filter((e): e is [string, string[]] => Array.isArray(e[1]))
  .flatMap(([group, list]) => list.map((w) => (REVIEWS.includes(group.split(' ')[0]) ? { ...cut(w), late: true } : cut(w))))
  .map((w) => ({ ...w, ...(soundsOf(w) ? { sounds: soundsOf(w) } : {}) }));

export const CONTENT: Content = {
  hasSound: (g) => hasClip(soundClip(g)),
  hasName: (g) => hasClip(nameClip(g)),
  hasPrompt: (name) => hasClip(promptClip(name)),
  words: [
    // Regular words: one grapheme, one sound.
    ...allWords,
    // And the few where the s on the end says /z/.
    ...endings.sSaysZ.map(cut).map((w) => ({ ...w, sounds: [...w.graphemes.slice(0, -1), 'z'] })),
  ].filter((w) => hasClip(wordClip(w.text))),
  many: Object.entries(endings.many)
    .flatMap(([sound, bases]) => bases.map((base) => ({ base, sound, graphemes: cut(base).graphemes })))
    .filter((m) => hasClip(wordClip(m.base)) && hasClip(wordClip(`${m.base}s`))),
  hearts: Object.entries(hearts.words)
    .map(([text, w]) => ({ text, ...w }))
    .filter((w) => hasClip(wordClip(w.text)) && w.sounds.every((s) => hasClip(soundClip(s)))),
  // Every thing with a drawing is listed in drawn.json (a test in scenes checks the two agree).
  drawable: drawn.things
    .filter((name) => hasClip(wordClip(name)))
    .map((name) => ({ name, on: hearts.on.includes(name), in: hearts.in.includes(name) })),
};
