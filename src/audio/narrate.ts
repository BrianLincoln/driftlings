import { clipSeconds, clipUrl, hasClip, type ClipId } from '../content/content';
import { playClip, preload } from './sound';

/**
 * Plays a narration clip by id. Returns how long it lasts so callers can
 * sequence what follows, even if the clip has not finished loading (or audio
 * is off): the game must keep its timing either way.
 */
export function say(id: ClipId, delay = 0): number {
  if (!hasClip(id)) return 0;
  playClip(clipUrl(id), delay);
  return clipSeconds(id);
}

// Clips are trimmed tight at both ends, so any breath between them has to be
// put back here. One rule for the whole game, by what is about to be said:
const isCue = (id: ClipId): boolean => id.startsWith('prompts/');
const BEFORE_ANSWER = 0.38; // prompt, then the letter or word it is about: set the answer apart
const BEFORE_PROMPT = 0.45; // a letter or word, then a new sentence
const BETWEEN_PROMPTS = 0.28;

export interface Line {
  /** Seconds from now until the last clip starts. */
  lastAt: number;
  /** Seconds from now until the line is over. */
  end: number;
}

/** Says clips one after another with a natural pause between them. Missing clips are skipped. */
export function sayLine(ids: ClipId[], delay = 0): Line {
  let prev: ClipId | null = null;
  let lastAt = delay;
  let end = delay;
  for (const id of ids) {
    if (!hasClip(id)) continue;
    if (prev) end += !isCue(id) ? BEFORE_ANSWER : isCue(prev) ? BETWEEN_PROMPTS : BEFORE_PROMPT;
    lastAt = end;
    end += say(id, end);
    prev = id;
  }
  return { lastAt, end };
}

export function preloadClips(ids: ClipId[]): void {
  void preload(ids.filter(hasClip).map(clipUrl));
}
