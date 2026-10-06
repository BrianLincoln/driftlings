import type { Item, ItemKind } from '../learn/items';
import { blendExercise } from './blend';
import type { ExerciseModule } from './contract';
import { meet } from './meet';
import { pickLetter } from './pickLetter';

// The catalogue. Adding an exercise is one line here.
const MODULES = [meet, pickLetter, blendExercise] as ExerciseModule[];

export const EXERCISES = new Map<ItemKind, ExerciseModule<Item>>(MODULES.map((m) => [m.kind, m]));
