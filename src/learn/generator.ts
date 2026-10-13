import type { BlendItem, BlendStage, CatchItem, Content, HeartItem, ManyItem, MeetItem, PickLetterItem, ReadWord, Word } from './items';
import { confusionKey, type SkillState } from './model';
import { shuffle, weighted, type Rng } from './rng';
import { answersFor, blend, gpc, graphemeOf, heart, second, shapeOf, suffix, type SkillId } from './skills';

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
export const key = (kind: string, what: string) => `${kind}:${what}:${++serial}`;

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

/** Up to `n` letters to set beside the target: taught ones and foils, never the target itself or a letter that says the same sound. */
function wrongLetters(target: string, n: number, ctx: GenContext): string[] {
  const taught = [...ctx.known].map(graphemeOf).filter((g): g is string => !!g && !answersFor(target, g));
  let pool = [...new Set([...taught, ...ctx.foils.filter((g) => !answersFor(target, g))])];
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

/** The letter is asked for by name and says its sound when caught, so it needs both clips. Two letters that make one sound have no name to ask by. */
export function catchItem(target: string, ctx: GenContext, count = 4, nOthers = 2): CatchItem | null {
  if (target.length > 1 || !ctx.known.has(gpc(target)) || !ctx.content.hasSound(target) || !ctx.content.hasName(target)) return null;
  const others = wrongLetters(target, nOthers, ctx);
  if (others.length === 0) return null;
  return { kind: 'catch', key: key('catch', target), target, others, count, skills: [], supports: [gpc(target)] };
}

/** True where a letter of the word says something other than its usual sound. */
export const oddAt = (w: Word, i: number): boolean => !!w.sounds && w.sounds[i] !== w.graphemes[i];

/** Words the child can sound out letter by letter: every letter taught and heard, and its second sound taught where it makes that. */
export function readableWords(ctx: GenContext): Word[] {
  return ctx.content.words.filter((w) => w.graphemes.every((g, i) =>
    ctx.known.has(gpc(g)) && ctx.content.hasSound(w.sounds?.[i] ?? g) && (!oddAt(w, i) || ctx.known.has(second(g)))));
}

/** Words the child can be asked to build: readable, and the word's shape taught. */
export function decodableWords(ctx: GenContext): Word[] {
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
    sounds: w.sounds ?? w.graphemes,
    stage,
    skills: [blend(shapeOf(w.graphemes))],
    supports: w.graphemes.flatMap((g, i) => (oddAt(w, i) ? [gpc(g), second(g)] : [gpc(g)])),
  };
}

/** Things whose word can take its s: the ending taught, and s's second sound too where the s says that. */
export function manyWords(ctx: GenContext): Content['many'][number][] {
  if (!ctx.known.has(suffix('s'))) return [];
  return ctx.content.many.filter((m) =>
    ctx.content.hasSound(m.sound) && (m.sound === 's' || ctx.known.has(second('s'))) && (m.graphemes ?? [...m.base]).every((g) => ctx.known.has(gpc(g))));
}

/** `plural` is which of the two words is said when asking. Showing asks nothing, so it is evidence of nothing. */
export function manyItem(base: string, ctx: GenContext, stage: ManyItem['stage'], plural = true): ManyItem | null {
  const m = manyWords(ctx).find((x) => x.base === base);
  if (!m) return null;
  const ask = stage === 'ask';
  return {
    kind: 'many',
    key: key('many', base),
    base,
    graphemes: m.graphemes ?? [...base],
    sound: m.sound,
    stage,
    target: plural || !ask ? `${base}s` : base,
    skills: ask ? [suffix('s')] : [],
    supports: ask && m.sound !== 's' ? [second('s')] : [],
  };
}

// ---------------------------------------------------------------------------
// Irregular words. (Words nobody says are in reads.ts.)
// ---------------------------------------------------------------------------

/**
 * Which tiles of a word are learned by heart: every one that does not say what the child has been taught.
 * Worked out, never listed, so a word loses its hearts by itself as the lessons catch up with it.
 */
export function byHeart(w: Word, ctx: GenContext): boolean[] {
  return w.graphemes.map((g, i) => !ctx.known.has(gpc(g)) || (oddAt(w, i) && !ctx.known.has(second(g))));
}

/** Irregular words the child has been taught and that can be heard. */
export function heartWords(ctx: GenContext): Word[] {
  return ctx.content.hearts.filter((w) => ctx.known.has(heart(w.text)));
}

export const onTiles = (w: Word, ctx: GenContext): ReadWord => ({ text: w.text, graphemes: w.graphemes, sounds: w.sounds ?? w.graphemes, byHeart: byHeart(w, ctx) });
export const behaving = (w: Word, ctx: GenContext): SkillId[] => w.graphemes.filter((_, i) => !byHeart(w, ctx)[i]).map(gpc);

export function heartMeet(word: string, ctx: GenContext, first = false): HeartItem | null {
  const w = heartWords(ctx).find((x) => x.text === word);
  if (!w) return null;
  return { kind: 'heart', key: key('heart', word), word, ...onTiles(w, ctx), stage: 'meet', first, choices: [], skills: [], supports: [] };
}

/**
 * Hear the word, pick it from three. The others are real words the child can read, and other irregular
 * words from `among`: never a misspelling. Ones of the same length, sharing a letter, or picked wrongly before come first.
 */
export function heartFind(word: string, ctx: GenContext, among: readonly string[] = []): HeartItem | null {
  const w = heartWords(ctx).find((x) => x.text === word);
  if (!w) return null;
  let pool = [...heartWords(ctx).filter((x) => among.includes(x.text)), ...readableWords(ctx)].filter((x) => x.text !== word);
  const confused = ctx.confusions.get(confusionKey('heart', word));
  const others: Word[] = [];
  while (others.length < 2 && pool.length > 0) {
    const pick = weighted(pool, (x) =>
      1 + (x.text.length === word.length ? 1 : 0) + ([...x.text].some((c) => word.includes(c)) ? 1 : 0) + 3 * (confused?.get(x.text) ?? 0), ctx.rng);
    others.push(pick);
    pool = pool.filter((x) => x.text !== pick.text);
  }
  if (others.length < 2) return null;
  return {
    kind: 'heart', key: key('find', word), word, ...onTiles(w, ctx), stage: 'find', first: false,
    choices: shuffle([w, ...others], ctx.rng).map((x) => onTiles(x, ctx)),
    skills: [heart(word)], supports: behaving(w, ctx),
  };
}

/** Spell an irregular word: sound it out, hear it, and put it back together. One tile is nothing to put back. */
export function heartBuild(word: string, ctx: GenContext, stage: 'guided' | 'free'): BlendItem | null {
  const w = heartWords(ctx).find((x) => x.text === word);
  if (!w || w.graphemes.length < 2) return null;
  return { kind: 'blend', key: key('build', word), word, graphemes: w.graphemes, sounds: w.sounds ?? w.graphemes, stage, byHeart: byHeart(w, ctx), skills: [heart(word)], supports: behaving(w, ctx) };
}
