import type { ReadWord } from '../learn/items';
import type { LetterTile } from '../scenes/letterTile';
import { TILE } from '../scenes/props';
import type { ExerciseKit } from './contract';

// Whole words standing in a line: each word's tiles touching, a gap between words.
// Shared by the exercises that show more than one word at once.

/** How far apart the tiles of one word stand, at full size: they touch, as they do once a word has been built. */
export const JOINED = 0.94;

export interface StoodWord {
  word: ReadWord;
  tiles: LetterTile[];
}

const width = (line: ReadWord[], between: number) => line.reduce((n, w) => n + w.graphemes.length * JOINED, 0) + (line.length - 1) * between;

/** The size at which the widest of these lines fits the row, and no bigger than `most`. `between` is the gap between words at full size. */
export function wordScale(kit: ExerciseKit, lines: ReadWord[][], between: number, most = 1): number {
  const widest = Math.max(...lines.map((l) => width(l, between)));
  // `fit` answers for tiles standing apart; ask it about as many as would take up this much room.
  return Math.min(most, kit.fit(1 + (widest - TILE.width) / 1.14));
}

export function standWords(kit: ExerciseKit, words: ReadWord[], scale: number): StoodWord[] {
  return words.map((word) => ({ word, tiles: word.graphemes.map((g, i) => kit.tile(g, scale, false, word.byHeart[i])) }));
}

/** Put a line of words in the tile row, centred, at depth `z` if given. */
export function placeLine(kit: ExerciseKit, line: StoodWord[], scale: number, between: number, z?: number): void {
  let x = -(width(line.map((w) => w.word), between) * scale) / 2 + (JOINED * scale) / 2;
  for (const w of line) {
    for (const tile of w.tiles) {
      tile.goal.copy(kit.spot('tiles', 0, 1));
      tile.goal.x = x;
      if (z !== undefined) tile.goal.z = z;
      x += JOINED * scale;
    }
    x += between * scale;
  }
}
