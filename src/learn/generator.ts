import type { BlendItem, Content, MeetItem, PickLetterItem } from './items';
import type { SkillState } from './model';
import { shuffle, weighted, type Rng } from './rng';
import { blend, gpc, graphemeOf, shapeOf, type SkillId } from './skills';

// Builds items from what the child knows and what audio exists. Two rules it
// never breaks: an item only asks about taught skills, and an item is only
// generated if every clip it needs exists.

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

export function pickLetterItem(target: string, ctx: GenContext, nChoices = 3): PickLetterItem | null {
  if (!ctx.known.has(gpc(target)) || !ctx.content.hasSound(target)) return null;
  const taught = [...ctx.known].map(graphemeOf).filter((g): g is string => !!g && g !== target);
  let pool = [...new Set([...taught, ...ctx.foils.filter((g) => g !== target)])];
  if (pool.length === 0) return null;
  const confused = ctx.confusions.get(target);
  const wrong: string[] = [];
  while (wrong.length < nChoices - 1 && pool.length > 0) {
    // Letters the child has mixed up with this one before are the most useful wrong choices.
    const pick = weighted(pool, (g) => 1 + 3 * (confused?.get(g) ?? 0), ctx.rng);
    wrong.push(pick);
    pool = pool.filter((g) => g !== pick);
  }
  return {
    kind: 'pick-letter',
    key: key('pick', target),
    target,
    choices: shuffle([target, ...wrong], ctx.rng),
    skills: [gpc(target)],
  };
}

/** Words the child can sound out: every letter taught and heard, and the word's shape taught. */
export function decodableWords(ctx: GenContext): Array<{ text: string; graphemes: string[] }> {
  return ctx.content.words.filter(
    (w) =>
      ctx.known.has(blend(shapeOf(w.graphemes))) &&
      w.graphemes.every((g) => ctx.known.has(gpc(g)) && ctx.content.hasSound(g)),
  );
}

export function blendItem(word: string, ctx: GenContext, nChoices = 3): BlendItem | null {
  const words = decodableWords(ctx);
  const w = words.find((x) => x.text === word);
  if (!w) return null;
  let pool = words.filter((x) => x.text !== word);
  if (pool.length === 0) return null; // nothing to choose between: the check would prove nothing
  const others: string[] = [];
  const letters = new Set(w.graphemes);
  while (others.length < nChoices - 1 && pool.length > 0) {
    // Near neighbours (shared letters, similar length) make the check mean something.
    const pick = weighted(
      pool,
      (x) => 1 + 2 * x.graphemes.filter((g) => letters.has(g)).length + (x.graphemes.length === w.graphemes.length ? 2 : 0),
      ctx.rng,
    );
    others.push(pick.text);
    pool = pool.filter((x) => x.text !== pick.text);
  }
  return {
    kind: 'blend',
    key: key('blend', word),
    word,
    graphemes: w.graphemes,
    choices: shuffle([word, ...others], ctx.rng),
    skills: [blend(shapeOf(w.graphemes))],
    supports: w.graphemes.map(gpc),
  };
}
