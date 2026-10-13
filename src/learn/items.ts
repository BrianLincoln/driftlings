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
  /** What each letter says here, as the letter that usually says it: i, z for "is". */
  sounds: string[];
  stage: BlendStage;
  /** For an irregular word: which tiles are learned by heart. */
  byHeart?: boolean[];
  skills: SkillId[];
  supports: SkillId[];
}

/**
 * Letters drift down: catch every one that is the named letter and let the others go by.
 * Asked by the letter's name and answered on a moving target, so it is practice, not a test:
 * a catch is credited a little (`supports`) and a slip is never blamed (`skills` is empty).
 */
export interface CatchItem {
  kind: 'catch';
  key: string;
  target: string;
  /** The other letters that fall. Never the target. */
  others: string[];
  /** How many of the target to catch. */
  count: number;
  skills: SkillId[];
  supports: SkillId[];
}

/**
 * One of a thing, then several: an s goes on the end of its word.
 * show: the child sees one, then more, and taps the s on; nothing is asked.
 * ask: the word for one and the word for several stand side by side, one is said, and the child picks it.
 */
export interface ManyItem {
  kind: 'many';
  key: string;
  /** The word for one, e.g. "cup". The word for several is this with an s. */
  base: string;
  graphemes: string[];
  /** What the s says on the end of this word: 's' or 'z'. */
  sound: string;
  stage: 'show' | 'ask';
  /** The word said: `base`, or `base` with its s. For show, always the one with the s. */
  target: string;
  skills: SkillId[];
  supports: SkillId[];
}

/**
 * An irregular word. Each tile is one sound, and the ones that do not say what the child has been taught carry a heart.
 * meet: the child taps through its sounds and hears it; nothing is asked.
 * find: it stands among other words, it is said, and the child picks it.
 */
export interface HeartItem {
  kind: 'heart';
  key: string;
  word: string;
  /** One per tile: th, e. */
  graphemes: string[];
  /** What each tile says here, as the letter that usually says it: th, u. */
  sounds: string[];
  byHeart: boolean[];
  stage: 'meet' | 'find';
  /** meet: this is the first irregular word the child has ever met, so the heart itself is explained. */
  first: boolean;
  /** find: the words to choose between, this one among them, in the order they stand. */
  choices: ReadWord[];
  skills: SkillId[];
  supports: SkillId[];
}

/** A word as it stands on tiles. */
export interface ReadWord {
  text: string;
  graphemes: string[];
  sounds: string[];
  byHeart: boolean[];
}

/** What a phrase or a sentence describes, as something that can be stood on the grass: a bug, or a bug on a bed. */
export interface Picture {
  thing: string;
  where?: { rel: 'on' | 'in'; thing: string };
}

/**
 * Words nobody says: the child reads them and taps what they describe.
 * Every other choice differs from the right one in exactly one word.
 */
export interface ReadItem {
  kind: 'read';
  key: string;
  words: ReadWord[];
  target: Picture;
  /** Includes the target. Already in display order. */
  choices: Picture[];
  skills: SkillId[];
  supports: SkillId[];
}

/**
 * One step of a word chain: the word before it with one letter changed, in the same place.
 * spell: the new word is said, and the child puts in the letter that makes it.
 * read: the letter changes by itself, nobody says the new word, and the child picks its drawing from three.
 */
export interface ChainStep {
  mode: 'spell' | 'read';
  /** The word this step makes. */
  word: string;
  graphemes: string[];
  /** Which tile changes. */
  at: number;
  /**
   * spell: the letters offered, the right one among them, in the order they stand.
   * `makes` is the word a wrong one would spell, where that is a word that can be said. Empty for read.
   */
  letters: Array<{ grapheme: string; makes?: string }>;
  /** read: the words whose drawings are chosen between, the right one among them, in the order they stand. Empty for spell. */
  words: string[];
  skills: SkillId[];
  supports: SkillId[];
}

/** A word chain: a word, then three or four more, each one letter away from the last. Spelling first; every other step after is reading, where its word has a drawing. */
export interface ChainItem {
  kind: 'chain';
  key: string;
  /** The word the chain sets out from. It is said; nothing is asked about it. */
  start: string;
  graphemes: string[];
  steps: ChainStep[];
}

export type Item = MeetItem | PickLetterItem | BlendItem | CatchItem | ManyItem | HeartItem | ReadItem | ChainItem;
export type ItemKind = Item['kind'];

/** One exercise's worth of items, played in order. */
export interface Round {
  exercise: ItemKind;
  items: Item[];
}

export interface Word {
  text: string;
  graphemes: string[];
  sounds?: string[];
  /** Kept back until its shape has been taught: never sounded out and heard ahead of that, as other words are. */
  late?: boolean;
}

/** What the generator may draw on. Built from the audio manifest and the word list. */
export interface Content {
  /** True if an isolated sound clip exists for this grapheme. */
  hasSound(grapheme: string): boolean;
  /** True if a clip of this letter's name exists. */
  hasName(grapheme: string): boolean;
  /** Decodable words that have a spoken clip. `sounds` is given where a letter does not say its usual sound. */
  words: ReadonlyArray<Word>;
  /** Words for a thing that can be shown, one and several, with what the s says on the end. Both words have clips. `graphemes`: the word for one cut up, where that is not a letter at a time. */
  many: ReadonlyArray<{ base: string; sound: string; graphemes?: string[] }>;
  /** Irregular words, one grapheme per tile and what each says. The word and every sound have clips. */
  hearts: ReadonlyArray<Word>;
  /** Things that have a drawing and a spoken word: what a phrase can be about. `on` and `in`: something else can be put there. */
  drawable: ReadonlyArray<{ name: string; on: boolean; in: boolean }>;
  /** True if this spoken line has been recorded. Left out, none has: an exercise that cannot explain itself is not offered. */
  hasPrompt?(name: string): boolean;
}
