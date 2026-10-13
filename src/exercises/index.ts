import type { Item, ItemKind } from '../learn/items';
import { blendExercise } from './blend';
import { catchLetters } from './catchLetters';
import type { ExerciseModule } from './contract';
import { heartExercise } from './heart';
import { meet } from './meet';
import { oneAndMany } from './oneAndMany';
import { pickLetter } from './pickLetter';
import { readExercise } from './read';

// The catalogue. Adding an exercise is one line here.
const MODULES = [meet, pickLetter, catchLetters, blendExercise, oneAndMany, heartExercise, readExercise] as ExerciseModule[];

export const EXERCISES = new Map<ItemKind, ExerciseModule<Item>>(MODULES.map((m) => [m.kind, m]));
