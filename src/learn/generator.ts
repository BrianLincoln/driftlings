import type { BlendItem, BlendStage, CatchItem, Content, MeetItem, PickLetterItem } from './items';
import type { SkillState } from './model';
import { shuffle, weighted, type Rng } from './rng';
import { blend, gpc, graphemeOf, shapeOf, soundsLike, type SkillId } from './skills';

// Builds items from what the child knows and what audio exists. Two rules it
// never breaks: an item only asks about taught skills, and an item is only
// generated if every clip it needs exists. (A word that is only sounded out
// and heard asks nothing, so it needs its letters taught but not its shape.)

export interface GenContext {
  /** Skills the child has been taught (including the lesson in progress). */
  known: ReadonlySet<SkillId>;
  /**
   * Letters that may appear as wrong choices before they are taught, so the
   * very first lessons have something to choose between. Never asked about.
   */
  foils: readonly string[];
  content: Content;
  states: ReadonlyMap<SkillId, SkillState>;
  confusions: ReadonlyMap<string, ReadonlyMap<string, number>>;
  rng: Rng;
}

let serial = 0;
const key = (kind: string, what: string) => `${kind}:${what}:${++serial}`;

/** Taught letters that can actually be asked about (their sound clip exists). */
export function askableGraphemes(ctx: GenContext): string[] {
  const out: string[] = [];
  for (const id of ctx.known) {
    const g = graphemeOf(id);
    if (g && ctx.content.hasSound(g)) out.push(g);
  }
  return out;
}

export function meetItem(grapheme: string, ctx: GenContext): MeetItem | null {
  if (!ctx.known.has(gpc(grapheme)) || !ctx.content.hasSound(grapheme)) return null;
  return { kind: 'meet', key: key('meet', grapheme), grapheme };
}

/** Up to `n` letters to set beside the target: taught ones and foils, never the target itself or a letter that sounds the same. */
function wrongLetters(target: string, n: number, ctx: GenContext): string[] {
  const taught = [...ctx.known].map(graphemeOf).filter((g): g is string => !!g && !soundsLike(g, target));
  let pool = [...new Set([...taught, ...ctx.foils.filter((g) => !soundsLike(g, target))])];
  const confused = ctx.confusions.get(target);
  const wrong: string[] = [];
  while (wrong.length < n && pool.length > 0) {
    // Letters the child has mixed up with this one before are the most useful wrong choices.
    const pick = weighted(pool, (g) => 1 + 3 * (confused?.get(g) ?? 0), ctx.rng);
    wrong.push(pick);
    pool = pool.filter((g) => g !== pick);
  }
  return wrong;
}

export function pickLetterItem(target: string, ctx: GenContext, nChoices = 3): PickLetterItem | null {
  if (!ctx.known.has(gpc(target)) || !ctx.content.hasSound(target)) return null;
  const wrong = wrongLetters(target, nChoices - 1, ctx);
  if (wrong.length === 0) return null;
  return {
    kind: 'pick-letter',
    key: key('pick', target),
    target,
    choices: shuffle([target, ...wrong], ctx.rng),
    skills: [gpc(target)],
  };
}

/** The letter is asked for by name and says its sound when caught, so it needs both clips. */
export function catchItem(target: string, ctx: GenContext, count = 4, nOthers = 2): CatchItem | null {
  if (!ctx.known.has(gpc(target)) || !ctx.content.hasSound(target) || !ctx.content.hasName(target)) return null;
  const others = wrongLetters(target, nOthers, ctx);
  if (others.length === 0) return null;
  return { kind: 'catch', key: key('catch', target), target, others, count, skills: [], supports: [gpc(target)] };
}

/** Words the child can sound out letter by letter: every letter taught and heard. */
export function readableWords(ctx: GenContext): Array<{ text: string; graphemes: string[] }> {
  return ctx.content.words.filter((w) => w.graphemes.every((g) => ctx.known.has(gpc(g)) && ctx.content.hasSound(g)));
}

/** Words the child can be asked to build: readable, and the word's shape taught. */
export function decodableWords(ctx: GenContext): Array<{ text: string; graphemes: string[] }> {
  return readableWords(ctx).filter((w) => ctx.known.has(blend(shapeOf(w.graphemes))));
}

/** A word of a shape not yet taught can only be read, never rebuilt. */
export function blendItem(word: string, ctx: GenContext, stage: BlendStage = 'free'): BlendItem | null {
  const w = (stage === 'read' ? readableWords(ctx) : decodableWords(ctx)).find((x) => x.text === word);
  if (!w) return null;
  return {
    kind: 'blend',
    key: key('blend', word),
    word,
    graphemes: w.graphemes,
    stage,
    skills: [blend(shapeOf(w.graphemes))],
    supports: w.graphemes.map(gpc),
  };
}
