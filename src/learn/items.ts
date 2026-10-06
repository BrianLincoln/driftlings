import type { SkillId } from './skills';

// Items are what the generator produces and an exercise presents. An exercise
// declares which item kinds it can present; nothing else ties them together.

/** First meeting with a letter: see it, hear it. Exposure only, never scored. */
export interface MeetItem {
  kind: 'meet';
  key: string;
  grapheme: string;
}

/** Hear a sound, pick its letter. */
export interface PickLetterItem {
  kind: 'pick-letter';
  key: string;
  target: string;
  /** Includes the target. Already in display order. */
  choices: string[];
  skills: SkillId[];
}

/** Sound out a word, blend it, then pick which spoken word it was. */
export interface BlendItem {
  kind: 'blend';
  key: string;
  word: string;
  graphemes: string[];
  /** Spoken options for the check, including the word. Already in display order. */
  choices: string[];
  skills: SkillId[];
  supports: SkillId[];
}

export type Item = MeetItem | PickLetterItem | BlendItem;
export type ItemKind = Item['kind'];

/** One exercise's worth of items, played in order. */
export interface Round {
  exercise: ItemKind;
  items: Item[];
}

/** What the generator may draw on. Built from the audio manifest and the word list. */
export interface Content {
  /** True if an isolated sound clip exists for this grapheme. */
  hasSound(grapheme: string): boolean;
  /** Decodable words that have a spoken clip. */
  words: ReadonlyArray<{ text: string; graphemes: string[] }>;
}
