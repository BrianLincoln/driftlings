# Heart words, then sentences: a proposal

Written 2026-10-13 as a proposal. The owner's answer the same day was to go with every recommendation
for now and give feedback after playing, so the questions in section 7 are settled as recommended until
then. Which word arrives at which UFLI lesson is in `docs/ufli.md` and is not repeated here.

## What is built

Slices one to three, and sentences that say which thing. Seventeen words, one to a lesson:

| Word | Tiles (what each says) | Heart at its lesson | Node | UFLI |
|---|---|---|---|---|
| the | th · e (/u/) | both | `i1a2-p` | 1 |
| a | a (/u/) | it | `i1a2-f` | 7 |
| I | I (its name) | it | `i1a2-i` | 1 to 4 |
| said | s · ai (/e/) · d | ai | `i1a3-d` | 13 |
| to | t · o (/oo/) | o | `i1a4-u` | 15 |
| do | d · o (/oo/) | o | `i1a4-g` | 15 |
| of | o (/u/) · f (/v/) | both | `i1a4-b` | 17 |
| see | s · ee (e's name) | ee | `i2a1-k` | 19 |
| he | h · e (its name) | e | `i2a1-h` | 23 |
| be | b · e | e | `i2a1-r` | 23 |
| me | m · e | e | `i2a1-l` | 23 |
| from | f · r · o (/u/) · m | o | `i2a2-w` | 25 |
| was | w · a (/u/) · s (/z/) | a | `i2a2-j` | 29 |
| are | are (/ar/), one tile | it | `i2a2-y` | 27 |
| you | y · ou (/oo/) | ou | `i2a2-x` | 31 |
| what | wh (/w/) · a (/u/) · t | wh, a | `i2a2-v` | 33 |
| have | h · a · ve (/v/) | ve | `i2a2-z` | 33 |

Decisions taken while the owner was away (2026-10-13), each easy to undo:

- **One word to a lesson, never before UFLI's lesson, and none in a lesson that is already long** (the two on an s
  at the end, the two on word shapes, the checkpoints). So see, be, me, from and are come one to three lessons
  after UFLI's, and `i2a2-qu` has none. A test holds all three rules (`src/game/hearts.test.ts`).
- **he, be, me are three lessons running, not one lesson of three.** Three words to meet, find and spell in one
  sitting is about two minutes on top of a letter lesson. The pattern is the same tile each time (e with a heart).
- **Starred words (irregular only for now): see, he, be, me, you and have are taught; look and book wait.** The
  six are among the commonest words there are and sentences need them. look and book would need a sound nothing
  else uses (the short oo) for two words no sentence here can use; they come with lesson 89 or when a slot is free.
- **"and" is still not here**: it is regular, belongs in `words.json`, and its shape (VCC) is one nothing teaches.
- **"I" is a capital on its tile**, the only one in the game, and it is all heart: that it looks like nothing the
  child has been taught is exactly what the heart says. Nothing else is capitalised and there are no full stops.
- **A letter saying its name is heard from the clip of the letter's name** (`letters/e-name` for the e of "he",
  `letters/i-name` for "I"): in `hearts.json` that is a capital in `sounds`. No new recordings for six words.
- **Two new sounds only**: `letters/oo-sound` (to, do, you) and `letters/ar-sound` ("are" is one sound, so one
  tile, and like "a" it is never spelled; a three-letter tile draws its letters smaller).
- **Hearts that go away.** Within the six islands: the s of "was" once s says /z/, and any tile whose letter the
  child had not reached (a child sees "said" with a heart on d only before d). Later: the e of he, be, me when a
  lesson teaches `second:e`. For see, what and have the tile's sound is written as another letter's (E, w, v), so
  when ee (85), wh (50) or ve is taught, change that entry of `sounds` to the grapheme itself and the heart goes.
- **Nobody is sent back.** No lesson was added: the words are on lessons that were there, so `late` and `settled`
  have nothing to do. A child past a word's lesson meets it at the top of their next lesson, two at a time in the
  order they are taught (`catchUps`); a child who has finished all six islands is up to fifteen words behind and
  catches up over the first eight lessons of the next island, each about a minute longer.

Sentences:

- **A sentence that says which thing is on** (`LEADS` in `src/learn/reads.ts`): "I see a cat", "I see the cat",
  "you see a cat", "it is a cat", "I have a cat". The second reading of a lesson or checkpoint is one, once the
  child has met the irregular words it begins with ("it is" needs none: from `i2a1-s-z`); the first is still a
  phrase. Three single things to choose between, near misses first, exactly as for a phrase, so there is no new art
  and no new line to record. It never has more than eight tiles (`sentenceTiles`), which is one line on a tall
  screen: that leaves out "it is the cat" and "you have a cat".
- What it shows and does not: the picture tells only the thing's word, as with "the cat". The words before it are
  read in use and get support credit; they are evidenced by `find` and by spelling.
- **A thing on or in another ("the bug is on the bed") is still off** (`SCENES` in `scheduler.ts`), for the reason
  below: it needs things that can be drawn small. "said", "to", "do", "of", "he", "be", "me", "from", "was", "are"
  and "what" are in no sentence yet: none makes a sentence a picture of single things can check.

Still true from slice one:

- **Nothing of a word appears in the game until its word clip and each of its sounds are recorded** (the generator
  never makes an item without its clips), and nothing at all until "the" or "a" is. `?unrecorded` shows all of it
  in silence meanwhile.
- **The scenes for a thing on another** are made by the generator and playable in `read`, but switched off.
  Looked at in both layouts, they are not good enough: a thing standing on another is as
  big as what it stands on and reaches up into the words, and on a tall screen a sentence's two lines hide
  each other (letters are DOM, so the nearer line's tiles cannot cover the further line's letters). They
  need things that can be drawn small, which belongs with the things work, and probably one plank per word.

Differences from what is written below:

- The heart round and the reading come at the end of a lesson, after the words to build, not after the catch.
- `read` ends every lesson and checkpoint from `i1a3-c` on, not only the lessons that teach a heart word.
- A wrong choice in `read` goes away (a thing cannot shake or dim yet) and says its word.
- "Tap what it says" is said at the start of each reading round, not once per child: an exercise does not
  know what a child has heard before.
- On a phone the three words of a `find` stand in one line and are small (a tile is about 40 px). Standing
  them one behind another was tried and the nearer hid the further.

## In one paragraph

Start with two words, **the** and **a**. A heart word stands on ordinary stone tiles, one tile per sound,
with a small coral heart on the top edge of each tile that does not say what the child has been taught.
A new exercise, `heart`, introduces a word (exposure) and then asks the child to pick it out by ear from
three words (scored). The existing `blend` exercise spells it. A second new exercise, `read`, shows a
phrase and later a sentence that nobody says, and the child taps the thing or the little scene it
describes; this is also the game's first "read a word nobody says" (gap 1 in `docs/ufli.md`). Six new
clips are needed. `src/learn` gains two item kinds and a few rules; the skill model is untouched.

## 1. Which words, where

### What counts as a heart word in the game

A word is a heart word while **at least one of its tiles says something the child has not been taught**.
That is worked out per tile from what the child knows, not listed by hand, so a word stops carrying
hearts by itself when the lessons catch up with it. This is UFLI's "irregular only for now", and it is
already how the game treats "is": the s is odd until `second:s` is taught, then it is an ordinary word.

So three of UFLI's early words need nothing from this proposal:

- **is, as** (and his, has): already `sSaysZ` words in `endings.json`, taught at `i2a1-s-z`.
- **and**: every letter is regular. It becomes an ordinary word once `blend:cvcc` is taught (the blends
  work going on now). Put it in `words.json` then.

### Slice one: build this first

| Word | Tiles (sound each says) | By heart today | Node | Why there |
|---|---|---|---|---|
| the | `th` (voiced th) · `e` (/u/) | both | `i1a2-p` | The first node after words exist. UFLI has it at lesson 1, but our lesson 1 is a child's first minute with one letter, and `i1a1-blend` is already full of one big idea. |
| a | `a` (/u/) | the one tile | `i1a2-f` | UFLI's own lesson for it. One word per node. |

Two words are enough for every phrase and sentence in section 4.

### Slice two: after slice one has been played by real children

| Word | Node | Note |
|---|---|---|
| I | `i1a2-i` | The letter saying its name. Needs the capitals decision first (question 6). |
| said | `i1a3-d` | `s` · `ai` · `d`: one heart, on the middle tile. |
| to | `i1a4-u` | |
| do | `i1a4-g` | UFLI teaches it with "to"; one new word per node here, so it moves one node on. |
| of | `i1a4-b` | Both tiles by heart (/u/, /v/). |

### Slice three: with island 6

see, he, be, me, from, look, book, are. They sit on `i2a1` nodes in UFLI's order. he, be and me are one
pattern (the e says its name) and should be met together as one. "from" waits for CCVC blends.

### Rules for attaching

- A node teaches at most one new heart word (a group that is one pattern counts as one).
- Never earlier than UFLI has it. Later is fine.
- Checkpoint nodes teach nothing, as now.
- Children who are already past a node: see "met before asked" in section 6. No saved progress changes.

## 2. How a heart word looks

**One tile per sound, not per letter.** "the" is two tiles, `th` and `e`; "said" is three, `s`, `ai`,
`d`. The `th` tile the child meets here is the same tile lesson 46 will teach. (Two letters on one tile
is already needed for `qu`.)

**A small heart sits on the top edge of every tile that is by heart**, like a bird on a fence: a little
toon-lit 3D heart, about a quarter of the tile's width, in one coral colour. The letter on that tile is
inked in the same coral instead of the usual ink. Tiles that behave are plain stone tiles with nothing
added.

Why this:

- It is a picture, not text, and it is the mark children using UFLI at school already see.
- Two cues, shape and colour, so it does not depend on colour vision.
- It is on top of the slab, so it does not fight the tile's existing states. The glow halo still goes
  round the slab and still means "touch this now"; `dim` and `done` behave as they do today (when a word
  is finished the letter goes green like any other and the heart stays).
- When the tile is tapped the heart gives one beat (a squash and release) as its sound plays. That is the
  only animation it has. It never pulses on its own, because pulsing is what the glow does.

**Colour.** A new named entry in `palette.ts`, `heart`, starting at the pennant's coral (`#dc6450`),
with the same kind of promise the glow has: *the heart colour means "this part is learned by heart" and
nothing else.* The pennant and the red letter card are close to it today; if that reads as a clash in
screenshots, the heart moves toward `blush`, not those.

**"the" has a heart on both tiles.** That is honest (neither part is taught) but a word that is all
hearts teaches less than "said", where one heart sits among plain tiles. It is the price of starting with
the most useful word. No special case is proposed.

Needs a look in `npm run shots` at both layouts before it is called done: the heart at small tile scales
(0.8 in a row of words), and a two-letter glyph on one tile.

## 3. Meeting and practising: the `heart` exercise

One module, `src/exercises/heart.ts`, with two stages in the same shape as `many` (show, then ask).

```ts
/** An irregular word: met, then picked out by ear. */
export interface HeartItem {
  kind: 'heart';
  key: string;
  word: string;
  /** One per tile: ['th', 'e']. */
  graphemes: string[];
  /** What each tile says here, as the letter that usually says it: ['th', 'u']. */
  sounds: string[];
  /** Which tiles carry a heart, worked out from what the child has been taught. */
  byHeart: boolean[];
  stage: 'meet' | 'find';
  /** find: the words to choose between, target included, in display order. */
  choices: string[];
  skills: SkillId[];   // find: [heart:the]. meet: []
  supports: SkillId[]; // find: gpc of each tile that is not by heart. meet: []
}
```

`clips(items)`: the three prompts below, and per item the word, each tile's sound, and each choice's word.

**meet (exposure, nothing scored, no attempt reported).**

1. The word's tiles stand in the row, hearts on. "This word is ... the."
2. The first tile lights. The child taps each tile in turn, as in `blend`; each says its sound *in this
   word*, and a heart tile's heart beats.
3. The tiles close up and the word is said again. The first time a child ever meets a heart word, the
   companion points at a heart and the narrator adds "This part, we learn by heart." Never again after.
4. A beat, `itemDone`, on to the questions.

It differs from `meet` for letters in one way: the child taps. Tapping through the sounds is the method
(map every sound, notice which one misbehaves), so it should not be something that is only watched.

**find (scored).**

Three whole words stand together, laid out as `many` lays out its two. "Which word is ... the?" the first
time, the word alone after that. The child taps any tile of a word.

- Right: tiles go `done` and hop, `kit.cheer()`.
- Wrong: that word shakes and dims and says what it is, then the question is asked again and the
  companion points at the right one (so the retry is `helped`). Same as `many`.
- Tapping the companion says the word again, as everywhere.
- Reported: `skills: [heart:<word>]`, `target`/`answer` the two words, `try`, `helped`, `ms` from the end
  of the question.

The other two words are real words the child can already read, plus other heart words once there are
some, weighted toward the same length and a shared letter, and toward whatever this child has picked
wrongly before. Never a misspelling: beginners should not be shown non-words as if they were words.

**Spelling: the existing `blend` exercise, not a new one.** A heart word of two or more tiles goes
through `blend` at its `guided` and `free` stages: tap the sounds, hear the word, the watcher jumbles it,
rebuild it. Two changes: `BlendItem` gets an optional `byHeart` so the tiles carry their hearts, and the
item's `skills` is `[heart:<word>]` instead of a word shape. Free is scored, as now. "a" is one tile and
is never built.

| | Scored | Evidence for |
|---|---|---|
| `heart` meet | no | nothing |
| `heart` find | yes | `heart:<word>` |
| `blend` on a heart word, guided | no | nothing |
| `blend` on a heart word, free | yes | `heart:<word>` |
| `read` (section 4) | yes | the word shapes; heart words get support credit only |

## 4. The first sentence exercise: `read`

**How a child shows they read it when nobody can hear: they tap what it says.** The words stand there
and nobody says them. Below, in the options row, stand three things, or three little scenes. Only one
matches.

```ts
/** What a phrase or sentence describes, as something that can be stood on the grass. */
export interface Picture {
  thing: string;                                   // 'bug'
  where?: { rel: 'on' | 'in'; thing: string };     // on the bed
}

/** Words nobody says: tap what they describe. */
export interface ReadItem {
  kind: 'read';
  key: string;
  /** In order. Each is drawn as its own run of tiles with a gap between words. */
  words: Array<{ text: string; graphemes: string[]; byHeart: boolean[] }>;
  target: Picture;
  /** Includes the target, in display order. Each other one differs from it in exactly one word. */
  choices: Picture[];
  skills: SkillId[];   // the shape of each word that tells the choices apart
  supports: SkillId[]; // heart words, second:s for "is", and the letters used
}
```

**Stage one, a phrase: "the cat".** Three things stand below (cat, cup, pot). This can open as soon as
`heart:the` is known and three drawn things are readable, which today is `i1a3-c` (map, cat, pot).

**Stage two, a sentence: "the bug is on the bed".** Three scenes stand below, each two things put
together by the exercise with `kit.thing`: the bug on the bed, the bat on the bed, the bug on the cup.
Opens at `i2a1-s-z`, where "is" is taught. "in" is used only with things that hold something (cup, pot).

How it plays:

1. The words appear. "Your turn. Read it." (first item of a round only; this clip already exists), then
   "Which one is it?" (first ever round only). Then silence.
2. Tapping a letter tile says its sound. That is sounding out, which is what we want, and it costs
   nothing.
3. Tapping the companion makes it read the words aloud. That is help: the attempt is reported `helped`,
   which the model already scores at 0.4.
4. The child taps a thing or a scene. `ms` runs from when the words finished appearing.
5. Right: the narrator reads it back word by word, each word's tiles hopping as it is said, the way a
   finger tracks print; the thing hops; `kit.cheer()`. Hearing it is the reward, not the question.
6. Wrong: that choice shakes and dims and its own word is said ("cup"). Two are left; no pointing. A
   second wrong tap leaves one, lit.

What makes it a test of reading and not of guessing:

- The other choices share letters with the answer where the drawings allow (bed, bat, bug; cat, cup;
  pig, pot), so the first letter is not enough.
- In a sentence each wrong scene is wrong by exactly one word, and which word varies, so every content
  word has to be read.
- Chance is one in three. The model averages over responses, so a lucky tap moves little; a word shape is
  not called secure on fewer than four.

What it does not show: that the child read "the". A picture cannot tell "the cat" from "cat". Heart words
are evidenced by `find` and by building; in `read` they get support credit and exposure in real use,
which is the point of teaching them.

Limits to know about before saying yes:

- **It can only say what can be drawn.** Nine things have drawings. Phrases are thin before `i1a4`.
  Six more nouns from island 2's letters would let phrases start at `i1a2-n`: pan, pin, fan, mat, man,
  tin. (The things session is adding drawings now; this list is a request to it, not part of this work.)
- **Width.** "the bug is on the bed" is 16 tiles and four gaps. On a tall screen that is two rows of
  small tiles. If it cannot be made readable inside the stage box in `tall`, sentences are capped at
  five words and the fallback is one plank per word with the whole word on it (a new `kit` piece).
- **Lower case, no full stop**, until question 6 is answered.

## 5. Audio to record

Six new clips for slice one, and two words the game is already missing.

| Clip | Say | Used |
|---|---|---|
| `words/the` | "the", as "thuh", not "thee" | meet, find, read-back |
| `words/a` | "a", as "uh", not "ay" | the same |
| `letters/th-sound` | the buzzing th of "the" on its own, held, no "uh" after | tapping the `th` tile |
| `prompts/this-word-is` | "This word is" | meet |
| `prompts/learn-this-part-by-heart` | "This part, we learn by heart." | meet, once per child |
| `prompts/which-one-is-it` | "Which one is it?" | read, once per child |
| `words/on` | "on" | read-back of a sentence (already missing) |
| `words/bug` | "bug" | already missing |

Reused as they are: `prompts/which-word-is`, `prompts/your-turn-read-it`, `letters/u-sound` (the vowel of
"the" and "a", see question 4), and every noun's word clip.

No sentence is recorded whole. A sentence is read back from its word clips, one word at a time.

Slice two would add five word clips (I, said, to, do, of) and one sound (the "eh" of said is
`letters/e-sound`, which exists; "oo" for to and do is new). Nothing else.

## 6. What changes in `src/learn` and around it

**`skills.ts`**: `heart(word)` and `heartOf(id)` helpers beside `gpc` and `graphemeOf`. The id type is
already there.

**`curriculum.ts`**: `heart('the')` added to `i1a2-p`'s `teaches`, `heart('a')` to `i1a2-f`'s. Nothing
else.

**Content**: a new `src/content/hearts.json`, each word with its tiles and what each says
(`"the": { "graphemes": ["th","e"], "sounds": ["th","u"] }`). `Content` gains `hearts` (words whose word
clip and sound clips all exist) and `drawable` (the nouns that have a drawing, which today can only be
read off `endings.json`'s `many` lists). Heart words stay out of `Content.words`, so ordinary blend
rounds never pick one by accident.

**`items.ts`**: `HeartItem`, `ReadItem`, `Picture`; `byHeart?` on `BlendItem`.

**`generator.ts`**

- `byHeart(word, ctx)`: a tile behaves if it says its usual sound and that letter is taught, or says its
  second sound and that is taught. Otherwise it carries a heart.
- `heartWords(ctx)`: known `heart:` skills that have their clips.
- `heartItem(word, ctx, stage)`, and `blendItem` learning to take a heart word.
- `readItem(ctx, stage)`: picks a target from the drawable, readable things; builds the wrong choices by
  the one-word rule; returns null if there are not three.
- The two rules it never breaks still hold: only taught skills are asked about, and nothing is generated
  without every clip it needs.

**`scheduler.ts`**

- **Lesson**: a node that teaches a heart word gets one more round after the catch round: meet the word,
  then three finds (two of the new word, one of an older heart word by need). About 45 seconds. Then, if
  three things can be read, a `read` round of two.
- **Met before asked**: a known heart word with no attempt on record is always met before anything asks
  about it or shows it in `read`, in whatever round that first comes up. This is what makes adding a word
  to a node a child has already finished safe: they meet it at the top of their next lesson (at most two
  such catch-up words per lesson), and no saved progress has to change. A shaky heart word is met again
  the same way.
- **Checkpoint**: one find for each heart word the area taught, and two reads.
- **Practice**: due or shaky `heart:` skills get finds; a `blend:` target may be practised with a `read`
  in place of one of the builds.
- **Gate**: `gate()` reads `areaSkills`, so a shaky heart word would start blocking the next area without
  anyone deciding it should. See question 5.
- New entries in `SIZES`: `heartFinds: 3`, `lessonReads: 2`, `checkpointReads: 2`.

**`model.ts`**: no change to scoring. One fix that this work forces: `confusions()` is keyed by the
target string alone, so a wrong pick for the *word* "a" would be counted as a confusion for the *letter*
a and start steering letter questions. Key it by exercise as well.

**Outside `src/learn`**: `exercises/heart.ts`, `exercises/read.ts` and two lines in the catalogue; the
heart on the tile (`props.ts`, `letterTile.ts`, a `byHeart` argument to `kit.tile`); the `heart` colour
and its glyph class; a rule for heart words in `scripts/audio-wanted.mjs`; `debug()` in both exercises so
`npm run play` can play them; tests for the generator rules and for hearts.json agreeing with the
curriculum.

**Suggested order of building**, each step shippable: (1) the tile look, checked in shots; (2) `heart`
with the, a; (3) `read` phrases; (4) `read` sentences; (5) slice two.

## 7. Questions for the owner

Each has a recommendation; "yes to all" is a workable answer.

1. **Start with only "the" and "a"?** Recommended: yes. They are the two that sentences need, and the
   tile look and both exercises get proven on two words before twenty depend on them.
2. **"the" at `i1a2-p`, not at lesson 1 where UFLI has it?** Recommended: yes. The alternative is
   `i1a1-blend`, which would put two new ideas in one lesson.
3. **The mark: a coral heart perched on the tile, and the letter in the same coral, with its own reserved
   palette colour?** Recommended: yes. The alternative that was considered and dropped is a different
   kind of tile for the odd part (a card among stones); cards already mean something else in `catch`.
4. **Use the short-u sound (`letters/u-sound`, already recorded) for the vowel in "the", "a", "of"?**
   Recommended: yes. Said alone and stressed, that is the vowel, and it saves recording an "uh" that is
   hard to get clean. The cost: the child hears u's sound from a tile before u is taught at `i1a4-u`.
   That is acceptable because the heart says exactly "this is not what the letter usually does".
5. **Should a shaky heart word be able to hold a child back from the next area?** Recommended: not yet.
   Leave `heart:` skills out of `gate()` until real children have played; a child stuck behind "the" on
   day two is a worse outcome than a child who is a little unsure of it.
6. **Capitals and full stops in sentences?** Recommended: lower case and no full stop for now, and hold
   "I" back until this is decided. A capital T is a letter shape the game has never shown. This is the
   same decision as item 8 in `docs/ufli.md` (capital letters), and it should be made once, there.
7. **Is "tap what it says" enough proof of reading, at one chance in three?** Recommended: yes, as the
   first step. The stricter version, where the child *makes* it true (taps the bug, then the bed), has
   far lower odds of a lucky answer and can be a later stage of the same exercise.
8. **Lessons get about a minute longer where a heart word is taught, and longer again with a `read`
   round.** Recommended: accept it for the two slice-one nodes and time them with `npm run play`; if a
   lesson passes what a five-year-old sits through, the `read` round moves to checkpoints and practice
   only.
9. **Six more drawings for island 2's nouns (pan, pin, fan, mat, man, tin), so phrases start two islands
   earlier?** Recommended: yes, but as part of the things work, not this.
