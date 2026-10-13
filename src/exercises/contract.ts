import type * as THREE from 'three';
import type { Line } from '../audio/narrate';
import type { ClipId } from '../content/content';
import type { Companion } from '../cast/companion';
import type { AttemptDraft } from '../learn/events';
import type { Item } from '../learn/items';
import type { LetterTile } from '../scenes/letterTile';
import type { Thing } from '../scenes/things';
import type { LayoutMode } from '../stage/framing';
import type { Touchable } from '../stage/touch';

// THE EXERCISE CONTRACT
//
// An exercise is one self-contained module. It is handed items and a kit to
// stage them with; it reports each response and says when it is done. It knows
// nothing about islands, areas, bosses, scheduling or rewards.
//
// Adding an exercise: write one module that satisfies ExerciseModule, add its
// item type to learn/items.ts, and add one line to exercises/index.ts.

/** What the host lends an exercise to stage its items. */
export interface ExerciseKit {
  readonly mode: LayoutMode;
  readonly companion: Companion;
  /** Make a letter tile (or an icon tile). The kit animates and disposes of it. */
  tile(text: string, scale?: number, icon?: boolean): LetterTile;
  /** A letter on a coloured card instead of a stone tile. `hue` picks the colour; any whole number will do. */
  card(text: string, hue: number, scale?: number): LetterTile;
  /** An everyday thing to stand on the grass, by its word ("cup"). The exercise places it; the kit animates and disposes of it. */
  thing(name: string): Thing;
  /** A place in the front row of tiles, or in the nearer row of options. */
  spot(row: 'tiles' | 'options', index: number, count: number): THREE.Vector3;
  /** Where the companion stands when it is not at a tile. */
  sideSpot(): THREE.Vector3;
  /** Where the companion stands to point at a tile. */
  besideSpot(tile: LetterTile): THREE.Vector3;
  /** Horizontal screen position of a tile, in CSS pixels. For drags. */
  screenX(tile: LetterTile): number;
  /** The other way: how far across the clearing a screen position is, on the ground at depth `z`. */
  aim(xPx: number, z: number): number;
  /** How high the top edge of the view is, at depth `z`. Anything above it is out of sight. */
  ceiling(z: number): number;
  /** Play a narration clip; returns its length in seconds. */
  say(clip: ClipId, delay?: number): number;
  /** Say several clips in a row, with the pauses speech needs between them. */
  line(clips: ClipId[], delay?: number): Line;
  /** Stop the narrator now, mid-clip if need be: the child has moved on from what was being said. */
  hush(): void;
  /** Something good happened. The host decides what that looks like. */
  cheer(): void;
  /** A small acknowledgement, for steps that are not answers. */
  nod(): void;
  /** Whoever is watching makes mischief. Returns the seconds until it lands, and until it is out of the way again. */
  trouble(): { lands: number; clear: number };
}

export interface ExerciseHooks {
  /** Report one response from the child. */
  attempt(a: AttemptDraft): void;
  /** One item is finished (drives the progress pips). */
  itemDone(): void;
  /** All items are finished. The host disposes of the run. */
  finished(): void;
}

export interface ExerciseRun {
  /** Everything tappable right now. Read every frame. */
  touchables(): Touchable[];
  update(dt: number): void;
  /** The viewport changed shape: put things back in their spots. */
  layout(): void;
  pointer?(phase: 'down' | 'move' | 'up', x: number, y: number): void;
  /** For scripted play: the ids to tap next, or where on the ground to hold the pointer. */
  debug?(): { tap?: string[]; steer?: [x: number, z: number]; waiting?: boolean };
  dispose(): void;
}

export interface ExerciseModule<I extends Item = Item> {
  readonly kind: I['kind'];
  /** Clips these items will need, so they can be loaded before the scene opens. */
  clips(items: I[]): ClipId[];
  start(items: I[], kit: ExerciseKit, hooks: ExerciseHooks): ExerciseRun;
}
