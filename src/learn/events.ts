import type { SkillId } from './skills';

// The log is the source of truth. Skill state, progress and the parent view
// are all recomputed from it, so the model can change without a migration and
// syncing two devices is a union of events by id.

/** One response from the child. A second try at the same item is a second attempt. */
export interface Attempt {
  type: 'attempt';
  id: string;
  /** Epoch milliseconds. */
  at: number;
  node: string;
  exercise: string;
  /** Skills this response is direct evidence for. */
  skills: SkillId[];
  /** Skills it used along the way: credited a little on success, never blamed. */
  supports: SkillId[];
  /** What was asked and what was answered, e.g. target 'm', answer 's'. */
  target: string;
  answer: string;
  correct: boolean;
  /** 1 for the first response to an item, 2 for the next, and so on. */
  try: number;
  /** True if the companion had already pointed out the answer. */
  helped: boolean;
  /** Time from the question being fully posed to this response. */
  ms: number;
}

export interface NodeDone {
  type: 'node-done';
  id: string;
  at: number;
  node: string;
}

/** The child has seen these rescued creatures arrive on the home island. */
export interface Welcomed {
  type: 'welcomed';
  id: string;
  at: number;
  count: number;
}

export type LogEvent = Attempt | NodeDone | Welcomed;

export type AttemptDraft = Omit<Attempt, 'type' | 'id' | 'at' | 'node'>;

export const attemptsOf = (events: readonly LogEvent[]): Attempt[] =>
  events.filter((e): e is Attempt => e.type === 'attempt');

export function doneNodes(events: readonly LogEvent[]): Set<string> {
  return new Set(events.filter((e): e is NodeDone => e.type === 'node-done').map((e) => e.node));
}
