import type { Attempt } from './events';
import type { SkillId } from './skills';

// The skill model. Deliberately simple and explainable: a parent should be
// able to follow why something is called shaky or due.
//
// Each skill keeps a STRENGTH (a running average of how well recent responses
// went) and a REVIEW INTERVAL (how long we trust it without checking again).
// The interval grows only when the child succeeds unaided AFTER a real gap,
// so ten right answers in one sitting do not count as long-term memory.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const TUNING = {
  /** Weight of the newest response in the strength average. */
  alpha: 0.3,
  /** Smaller weight for skills that merely supported a correct answer. */
  supportAlpha: 0.1,
  firstInterval: 4 * HOUR,
  growth: 2.5,
  maxInterval: 60 * DAY,
  minInterval: 10 * MIN,
  /** A response slower than this many times the child's own median is "slow". */
  slowFactor: 2.2,
  secureStrength: 0.8,
  secureSeen: 4,
  shakyStrength: 0.55,
  shakySeen: 3,
};

export interface SkillState {
  id: SkillId;
  /** Direct responses seen (support credit does not count). */
  seen: number;
  /** 0..1. */
  strength: number;
  intervalMs: number;
  lastAt: number;
  dueAt: number;
}

export type Status = 'new' | 'learning' | 'shaky' | 'secure';

export function emptyState(id: SkillId): SkillState {
  return { id, seen: 0, strength: 0, intervalMs: 0, lastAt: 0, dueAt: 0 };
}

/**
 * How good was one response, 0..1?
 * 1 unaided, first try, at the child's usual speed; 0.8 if slow;
 * 0.4 if right only after help or an earlier wrong try; 0 if wrong.
 */
export function quality(a: Pick<Attempt, 'correct' | 'try' | 'helped' | 'ms'>, medianMs: number | null): number {
  if (!a.correct) return 0;
  if (a.helped || a.try > 1) return 0.4;
  if (medianMs !== null && a.ms > medianMs * TUNING.slowFactor) return 0.8;
  return 1;
}

export function applyOutcome(s: SkillState, q: number, at: number): SkillState {
  const elapsed = s.lastAt ? at - s.lastAt : Infinity;
  const strength = s.seen === 0 ? q * 0.6 : s.strength + TUNING.alpha * (q - s.strength);
  let intervalMs = s.intervalMs;
  if (q >= 0.8) {
    if (intervalMs === 0) intervalMs = TUNING.firstInterval;
    else if (elapsed >= intervalMs * 0.5) intervalMs = Math.min(TUNING.maxInterval, intervalMs * TUNING.growth);
  } else if (q > 0) {
    intervalMs = Math.max(TUNING.minInterval, intervalMs * 0.7);
  } else {
    intervalMs = Math.max(TUNING.minInterval, intervalMs * 0.3);
  }
  return { id: s.id, seen: s.seen + 1, strength, intervalMs, lastAt: at, dueAt: at + intervalMs };
}

function applySupport(s: SkillState): SkillState {
  return { ...s, strength: s.strength + TUNING.supportAlpha * (1 - s.strength) };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const v = [...values].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** The child's own usual speed per exercise, from clean first-try answers. Needs five to count. */
export function speedBaselines(attempts: readonly Attempt[]): Map<string, number> {
  const by = new Map<string, number[]>();
  for (const a of attempts) {
    if (!a.correct || a.try !== 1 || a.helped) continue;
    let list = by.get(a.exercise);
    if (!list) by.set(a.exercise, (list = []));
    list.push(a.ms);
  }
  const out = new Map<string, number>();
  for (const [ex, list] of by) if (list.length >= 5) out.set(ex, median(list)!);
  return out;
}

export function foldSkills(attempts: readonly Attempt[]): Map<SkillId, SkillState> {
  const baselines = speedBaselines(attempts);
  const states = new Map<SkillId, SkillState>();
  const get = (id: SkillId) => states.get(id) ?? emptyState(id);
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) {
    const q = quality(a, baselines.get(a.exercise) ?? null);
    for (const id of a.skills) states.set(id, applyOutcome(get(id), q, a.at));
    if (a.correct) for (const id of a.supports) states.set(id, applySupport(get(id)));
  }
  return states;
}

export function statusOf(s: SkillState | undefined): Status {
  if (!s || s.seen === 0) return 'new';
  if (s.seen >= TUNING.shakySeen && s.strength < TUNING.shakyStrength) return 'shaky';
  if (s.seen >= TUNING.secureSeen && s.strength >= TUNING.secureStrength) return 'secure';
  return 'learning';
}

export function isDue(s: SkillState | undefined, now: number): boolean {
  return !!s && s.seen > 0 && now >= s.dueAt;
}

/** What the child tends to answer instead: target -> wrong answer -> count. Drives distractor choice. */
export function confusions(attempts: readonly Attempt[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const a of attempts) {
    if (a.correct || !a.answer) continue;
    let m = out.get(a.target);
    if (!m) out.set(a.target, (m = new Map()));
    m.set(a.answer, (m.get(a.answer) ?? 0) + 1);
  }
  return out;
}
