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

export function preloadClips(ids: ClipId[]): void {
  void preload(ids.filter(hasClip).map(clipUrl));
}
