// Writes audio-inbox/WANTED.md: the fewest clips that complete the lessons ahead, in the order
// the game reaches them. The owner generates each one, listens, and drops it in the folder named.
//
// What a lesson needs depends on what it teaches:
//   a grapheme       its sound, its letter name (single letters only), and its keyword words; one of two letters (qu)
//                    has no name, and the line that introduces it instead
//   blending words   enough buildable words made only of graphemes taught so far
//   new word shapes  the same, of the shapes the lesson teaches and with its letter in them (r in "trip", l in "flag" and
//                    "milk"): the lesson's words are shared evenly between its shapes, as the scheduler shares them.
//                    `why` says what the words are for when it is something else: a letter whose keywords cannot
//                    both be built (queen, zoo) still wants two words to be seen in
//   an irregular word its word, the sound of each of its tiles (src/content/hearts.json), and the lines that introduce it.
//                    A capital for a tile's sound is the letter saying its name: that is the clip of the letter's name
//   a sentence       the little words it begins with that are sounded out, not learned by heart (it, is)
//   reading alone     the lines that say what to do; the words themselves are the drawn things' and already wanted elsewhere
//   word chains      the lines that say what to do; its words are ones the lessons build, already wanted elsewhere
//   an ending        the lines that explain it, and for each thing shown as one and several
//                    (src/content/endings.json) its word with the s; for s saying /z/, two short words where it does too

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const manifest = existsSync('src/content/audio-manifest.json') ? json('src/content/audio-manifest.json') : {};
const keywords = json('src/content/keywords.json');
const endings = json('src/content/endings.json');
const hearts = json('src/content/hearts.json');
const spelled = Object.values(json('src/content/words.json')).filter(Array.isArray).flat();
const has = (id) => id in manifest;

// The lessons in order, a step past what the curriculum lists so recording can run ahead of building.
// A string is a grapheme; { blend: n } is a lesson that needs n buildable words, of `shapes` (vc and cvc unless given)
// (each its share, or any mix of them with `mix`) and with the letter `having` (or one of them) in them if given; { ending: 's' | 'z' } is an s on the end, saying that;
// { heart: word } is an irregular word; { read: true } is where words are first read with nobody saying them;
// { sentence: [words] } is where a sentence can first begin with those (LEADS in src/learn/reads.ts).
// { chain: true } is where word chains begin: the lesson after the first on blending, when there are words enough to link.
const STEPS = [
  ['Island 1', ['a', 'm', 's', 't', { blend: 4 }]],
  ['Island 2', ['p', { chain: true }, { heart: 'the' }, 'f', { heart: 'a' }, 'i', { heart: 'I' }, 'n']],
  ['Island 3', ['o', 'd', { heart: 'said' }, 'c', { read: true }]],
  ['Island 4', ['u', { heart: 'to' }, 'g', { heart: 'do' }, 'b', { heart: 'of' }, 'e']],
  ['Island 5', [{ ending: 's' }, { ending: 'z' }, 'k', { heart: 'see' }, { sentence: ['it', 'is'] }, 'h', { heart: 'he' }, 'r', { heart: 'be' }, { blend: 4, shapes: ['ccvc'], having: 'r' }, 'l', { heart: 'me' }, { blend: 4, shapes: ['ccvc', 'cvcc'], having: 'l' }]],
  ['Island 6', [
    'w', { heart: 'from' }, 'j', { heart: 'was' }, 'y', { heart: 'are' }, 'x', { heart: 'you' },
    'qu', { blend: 2, shapes: ['cvc', 'ccvc', 'cvcc'], mix: true, having: 'qu', why: 'a word with qu in it: only sounded out and heard, so any shape' },
    'v', { heart: 'what' },
    'z', { heart: 'have' }, { blend: 2, having: 'z', why: 'a word with z in it' },
    { blend: 2, shapes: ['ccvc', 'cvcc'], having: ['w', 'j', 'y', 'x', 'qu', 'v', 'z'], why: 'two consonants together, with one of the last letters of the alphabet' },
  ]],
];

// A word is cut into graphemes the way src/learn/skills.ts cuts it: the two-letter graphemes the lessons teach
// are one each, the longest that fits first, and a dot in the list forces a cut.
const MULTI = STEPS.flatMap(([, steps]) => steps).filter((s) => typeof s === 'string' && s.length > 1).sort((a, b) => b.length - a.length);
const split = (spelling) => spelling.split('.').flatMap((part) => {
  const out = [];
  for (let i = 0; i < part.length; i += out[out.length - 1].length) out.push(MULTI.find((m) => part.startsWith(m, i)) ?? part[i]);
  return out;
});
const words = spelled.map((s) => ({ text: s.replaceAll('.', ''), graphemes: split(s) }));
const VOWELS = 'aeiou';
const shapeOf = (w) => w.graphemes.map((g) => (VOWELS.includes(g[0]) ? 'v' : 'c')).join('');

const lines = [
  '# Audio wanted',
  '',
  'Generated by `npm run audio:wanted`: only what a lesson ahead is missing, nearest lesson first.',
  'Drop each clip in `audio-inbox/` under the folder and file name shown (any audio format), then run `npm run audio`.',
  'A keyword word only has to begin with the sound (x: end with it) and be said cleanly; if one will not',
  'come out right, swap it for another in `src/content/keywords.json`.',
  '',
];
let total = 0;
const asked = new Set();
const taught = new Set();
for (const [title, steps] of STEPS) {
  const want = [];
  for (const step of steps) {
    if (typeof step === 'string') {
      taught.add(step);
      if (!has(`letters/${step}-sound`)) want.push(`\`letters/${step}-sound\` : the sound of "${step}" alone, no trailing "uh"`);
      if (step.length > 1 && !has('prompts/together-these-letters-make-the-sound')) want.push('`prompts/together-these-letters-make-the-sound` : "Together, these letters make the sound" (said before the sound of two letters on one tile: qu, and later sh, ch, th)');
      if (step.length === 1 && !has(`letters/${step}-name`)) want.push(`\`letters/${step}-name\` : the name of the letter "${step}"`);
      for (const w of keywords[step] ?? []) if (!has(`words/${w}`)) want.push(`\`words/${w}\` : "${w}" (keyword for ${step})`);
    } else if (step.heart) {
      const w = step.heart;
      const said = { the: 'as "thuh", not "thee"', a: 'as "uh", not "ay"', to: 'as "too", not "tuh"', of: 'as "uv"', are: 'as in "we are"', was: 'as "wuz"', what: 'as "wut"' }[w];
      const how = { oo: 'the long "oo" of "to", "do" and "you"', ar: 'the "ar" of "are" and "car"', th: 'the buzzing "th" of "the"' };
      const clip = w.toLowerCase();
      if (!has(`words/${clip}`)) want.push(`\`words/${clip}\` : "${w}"${said ? `, said ${said}` : ''} (learned by heart)`);
      for (const snd of hearts.words[w].sounds) {
        // A capital is a letter saying its name, which the letter's own lesson already asks for.
        const id = /^[A-Z]$/.test(snd) ? `letters/${snd.toLowerCase()}-name` : `letters/${snd}-sound`;
        if (!has(id)) want.push(`\`${id}\` : ${id.endsWith('-name') ? `the name of the letter "${snd.toLowerCase()}"` : `${how[snd] ?? `the sound of "${snd}"`}, alone, no trailing "uh"`}`);
      }
      for (const [name, text] of [['this-word-is', 'This word is'], ['learn-this-part-by-heart', 'This part, we learn by heart.']]) if (!has(`prompts/${name}`)) want.push(`\`prompts/${name}\` : "${text}"`);
    } else if (step.chain) {
      // The names are CHAIN_PROMPTS in src/learn/chains.ts: no chain is offered until all three exist.
      for (const [name, text] of [
        ['change-one-letter-to-make', 'Change one letter to make ... (the word follows: leave it hanging)'],
        ['what-word-is-it-now', 'What word is it now?'],
        ['tap-to-hear-tap-again-to-choose', 'Tap one to hear it. Tap it again to choose it.'],
      ]) if (!has(`prompts/${name}`)) want.push(`\`prompts/${name}\` : "${text}" (word chains)`);
    } else if (step.sentence) {
      for (const w of step.sentence) if (!has(`words/${w}`)) want.push(`\`words/${w}\` : "${w}" (a sentence begins with it)`);
    } else if (step.read) {
      for (const [name, text] of [['your-turn-read-it', 'Your turn. Read it.'], ['tap-what-it-says', 'Tap what it says.']]) if (!has(`prompts/${name}`)) want.push(`\`prompts/${name}\` : "${text}"`);
    } else if (step.ending) {
      const z = step.ending === 'z';
      const prompts = z
        ? [['sometimes-s-makes-the-sound', 'Sometimes, S makes the sound']]
        : [['add-s-means-more-than-one', 'When we add S to the end of a word, it means more than one.'], ['one', 'One'], ['lots-of', 'Lots of'], ['which-word-is', 'Which word is']];
      for (const [name, text] of prompts) if (!has(`prompts/${name}`)) want.push(`\`prompts/${name}\` : "${text}"`);
      if (z && !has('letters/z-sound')) want.push('`letters/z-sound` : the sound of "z" alone, no trailing "uh"');
      for (const base of endings.many[step.ending]) {
        for (const w of [base, `${base}s`]) if (!has(`words/${w}`)) want.push(`\`words/${w}\` : "${w}" (one ${base}, lots of ${base}s)`);
      }
      if (z) {
        const ok = endings.sSaysZ.filter((w) => split(w).every((g) => taught.has(g)));
        const short = 2 - ok.filter((w) => has(`words/${w}`)).length;
        for (const w of ok.filter((w) => !has(`words/${w}`)).slice(0, Math.max(0, short))) want.push(`\`words/${w}\` : "${w}" (s says /z/)`);
      }
    } else {
      const shapes = step.shapes ?? ['vc', 'cvc'];
      // With one shape or the old two, any mix will do; new shapes each get their share of the lesson.
      for (const group of step.shapes && !step.mix ? shapes.map((s) => [s]) : [shapes]) {
        const having = [step.having ?? []].flat();
        const ok = words.filter((w) => group.includes(shapeOf(w)) && w.graphemes.every((g) => taught.has(g)) && (!having.length || w.graphemes.some((g) => having.includes(g)))).map((w) => w.text);
        const short = Math.ceil((step.blend * group.length) / shapes.length) - ok.filter((w) => has(`words/${w}`)).length;
        const why = step.why ?? (step.having ? `a word to build: ${step.having} beside another consonant` : 'a word to build');
        for (const w of ok.filter((w) => !has(`words/${w}`)).slice(0, Math.max(0, short))) want.push(`\`words/${w}\` : "${w}" (${why})`);
      }
    }
  }
  // A line two lessons share is asked for once, at the first.
  const fresh = want.filter((l) => !asked.has(l) && asked.add(l));
  lines.push(`## ${title}`, '', ...(fresh.length ? fresh.map((l) => `- [ ] ${l}`) : ['Complete.']), '');
  total += fresh.length;
}
for (const f of ['letters', 'words', 'prompts', 'sfx']) mkdirSync(`audio-inbox/${f}`, { recursive: true });
writeFileSync('audio-inbox/WANTED.md', lines.join('\n'));
console.log(`${total} clips wanted; see audio-inbox/WANTED.md`);
