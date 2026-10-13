import { blendItem, decodableWords, manyItem, pickLetterItem, readableWords, type GenContext } from './generator';
import type { BlendItem, Item, ManyItem, PickLetterItem, Round, Word } from './items';
import { isDue, statusOf, type SkillState } from './model';
import { shuffle, weighted } from './rng';
import { blend, gpc, shapeOf, type SkillId } from './skills';

// What the scheduler makes its rounds from: how many of each thing, how much a skill needs attention,
// and the runs of items (letters to pick, words to build, endings to ask about) that lessons, checkpoints and practice share.

export const SIZES = {
  lessonPicks: 6,
  /** Picks when the new letter is the only one there is: every question has the same answer. */
  soloPicks: 3,
  /** Share of a letter lesson's picks spent on the new letter. */
  newShare: 0.6,
  /** How many of the new letter to catch as they fall. */
  lessonCatches: 4,
  lessonBlends: 2,
  blendLessonBlends: 4,
  blendLessonPicks: 4,
  checkpointPicks: 8,
  checkpointBlends: 3,
  practicePicks: 5,
  practiceBlends: 2,
  /** In a lesson about an ending: how many things are shown going from one to several, and how many are then asked about. */
  manyShows: 3,
  manyAsks: 4,
  manyLessonPicks: 3,
  checkpointMany: 2,
  practiceMany: 3,
  /** Picking an irregular word out by ear: in the lesson that teaches one, and when one has gone shaky or is due. */
  heartFinds: 3,
  reviewFinds: 2,
  /** Irregular words taught before the child's game had them, met at the top of a later lesson: this many at a time. */
  catchUps: 2,
  /** Phrases or sentences read in silence at the end of a lesson, and at a checkpoint. */
  lessonReads: 2,
  checkpointReads: 2,
  /** Steps in a word chain: this many where the words link up that far, and never fewer than the least. A lesson on new word shapes takes a shorter one of its own shapes. */
  chainSteps: 4,
  chainLeast: 3,
  shapeChainLeast: 2,
};

/** How much a skill needs attention right now. */
export function need(s: SkillState | undefined, now: number): number {
  const status = statusOf(s);
  if (status === 'shaky') return 3;
  if (isDue(s, now)) return 2;
  if (status === 'new') return 1.5;
  if (status === 'secure') return 0.4;
  return 1;
}

export function nonNull<T>(xs: Array<T | null>): T[] {
  return xs.filter((x): x is T => x !== null);
}

/**
 * Avoid the same answer three times running, where the pool allows.
 * `first`, when given, is the answer the round must open with.
 */
export function spread<T extends { target?: string; word?: string }>(items: T[], ctx: GenContext, first?: string): T[] {
  const out = shuffle(items, ctx.rng);
  const k = (t: T) => t.target ?? t.word;
  const lead = first === undefined ? -1 : out.findIndex((t) => k(t) === first);
  if (lead > 0) out.unshift(...out.splice(lead, 1));
  for (let i = 2; i < out.length; i++) {
    if (k(out[i]) === k(out[i - 1]) && k(out[i]) === k(out[i - 2])) {
      const j = out.findIndex((t, n) => n > i && k(t) !== k(out[i]));
      if (j > 0) [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}

export function picks(n: number, pool: string[], ctx: GenContext, now: number): PickLetterItem[] {
  if (pool.length === 0) return [];
  return nonNull(
    Array.from({ length: n }, () =>
      pickLetterItem(weighted(pool, (g) => need(ctx.states.get(gpc(g)), now), ctx.rng), ctx)),
  );
}

/**
 * Words to build. A word whose shape has not been taught yet is only sounded
 * out and heard; letter lessons use these from the start (`early`), so words
 * being made of letters is familiar long before anything is asked.
 *
 * `only` keeps the round to some of the words.
 * `intro` is the lesson that teaches the shapes, where the watcher first
 * jumbles the letters. It goes through the word list in order (the list starts
 * with the simplest), so it always opens on the same word, and the child is
 * shown how on the first word of each shape. No shape takes more than its
 * share of the round while another has a word left. Anywhere else the child is
 * shown how on the first word unless that word shape is already going well.
 */
export function blends(n: number, ctx: GenContext, now: number, opts: { favour?: readonly string[]; intro?: boolean; early?: boolean; only?: (w: Word) => boolean } = {}): BlendItem[] {
  let pool = (opts.early ? readableWords(ctx) : decodableWords(ctx)).filter(opts.only ?? (() => true));
  const out: BlendItem[] = [];
  const shown = new Set<SkillId>();
  const favoured = (x: { graphemes: string[] }) => x.graphemes.filter((g) => opts.favour?.includes(g));
  const shapeOfWord = (x: { graphemes: string[] }) => blend(shapeOf(x.graphemes));
  const share = Math.ceil(n / Math.max(1, new Set(pool.map(shapeOfWord)).size));
  const room = (xs: Word[]) => xs.find((x) => out.filter((i) => i.skills[0] === shapeOfWord(x)).length < share);
  while (out.length < n && pool.length > 0) {
    // Words with a favoured letter come first, and one with a favoured letter no word has used yet before those:
    // however long the word list gets, a new letter is seen in a word, and a checkpoint's words go round its letters.
    const used = new Set(out.flatMap((i) => i.graphemes));
    const unseen = pool.filter((x) => favoured(x).some((g) => !used.has(g)));
    const any = unseen.length ? unseen : pool.filter((x) => favoured(x).length > 0);
    const from = any.length ? any : pool;
    const w = opts.intro ? room(from) ?? room(pool) ?? from[0] : weighted(from, (x) => need(ctx.states.get(shapeOfWord(x)), now), ctx.rng);
    pool = pool.filter((x) => x.text !== w.text); // each word once per round
    const shape = shapeOfWord(w);
    const status = statusOf(ctx.states.get(shape));
    const guide = opts.intro ? !shown.has(shape) : out.length === 0 && (status === 'new' || status === 'shaky');
    const item = blendItem(w.text, ctx, !ctx.known.has(shape) ? 'read' : guide ? 'guided' : 'free');
    if (!item) continue;
    shown.add(shape);
    out.push(item);
  }
  return out;
}

/** "Which word is ...": the word for one or the word for several, turn about, going round the things given. */
export function manyAsks(n: number, pool: ReadonlyArray<{ base: string }>, ctx: GenContext): ManyItem[] {
  const things = shuffle([...pool], ctx.rng);
  const first = ctx.rng() < 0.5 ? 0 : 1;
  return things.length ? nonNull(Array.from({ length: n }, (_, i) => manyItem(things[i % things.length].base, ctx, 'ask', (i + first) % 2 === 0))) : [];
}

export const round = (items: Item[]): Round[] => (items.length ? [{ exercise: items[0].kind, items }] : []);
