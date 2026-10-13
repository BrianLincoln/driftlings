import * as THREE from 'three';
import { Spring } from '../../cast/spring';
import { TAG } from '../../gfx/glsl';
import { toonMaterial } from '../../gfx/materials';
import { cat, dog, bug } from './animals';
import { OLD } from './old';
import type { Drawing, Eyes } from './parts';

// Everyday things a word can be about, small enough to stand in a row on the grass. Each is one
// merged mesh about half a tile high, standing on its own origin and turned to show its best side
// to the clearing's camera. A word can only be shown as a thing if it has a recipe here.
// docs/things.md has the rules a drawing follows.

let EYES: Eyes = 'dots';
/** For the comparison sheet only. */
export function setEyes(e: Eyes): void {
  EYES = e;
  built.clear();
}

const RECIPES: Record<string, () => Drawing | THREE.BufferGeometry> = {
  ...OLD,
  cat: () => cat(EYES),
  dog: () => dog(EYES),
  bug: () => bug(EYES),
};

export const THING_NAMES = Object.keys(RECIPES);

/** Things keep most of their own colour through the scene's grade: bright toys on a muted island. */
const LOOK = { tag: TAG.prop, flag: -0.7 };
const plain = toonMaterial(LOOK);
const built = new Map<string, { drawing: Drawing; material: THREE.Material }>();

function build(name: string) {
  const recipe = RECIPES[name];
  if (!recipe) throw new Error(`no drawing for "${name}"`);
  const made = recipe();
  const drawing = made instanceof THREE.BufferGeometry ? { geo: made } : made;
  return { drawing, material: drawing.face ? toonMaterial({ ...LOOK, face: drawing.face }) : plain };
}

/** One thing standing on the ground. It pops in where it is put and pops out when told to go. */
export class Thing {
  readonly root: THREE.Mesh;
  private pop = new Spring(0);
  private size = 1;
  gone = false;

  constructor(name: string) {
    let made = built.get(name);
    if (!made) built.set(name, (made = build(name)));
    this.root = new THREE.Mesh(made.drawing.geo, made.material);
    const [tilt, yaw] = made.drawing.turn ?? [0, 0];
    this.root.rotation.set(tilt, yaw, 0);
    this.root.scale.setScalar(0.001);
  }

  hop(): void {
    this.pop.kick(4);
  }

  vanish(): void {
    this.size = 0;
  }

  update(dt: number): void {
    const s = this.pop.step(this.size, 160, 15, dt);
    this.root.scale.setScalar(Math.max(0.001, s));
    if (this.size === 0 && s < 0.03) this.gone = true;
  }
}
