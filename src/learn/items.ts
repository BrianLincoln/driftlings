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

/**
 * How much a word asks of the child, easiest first.
 * read: sound it out and hear it. guided: then rebuild it after it is jumbled,
 * with each next letter shown. free: rebuild it unaided. Only free is scored.
 */
export type BlendStage = 'read' | 'guided' | 'free';

/** Sound out a word, hear it, and (past the first stage) put it back together. */
export interface BlendItem {
  kind: 'blend';
  key: string;
  word: string;
  graphemes: string[];
  stage: BlendStage;
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
