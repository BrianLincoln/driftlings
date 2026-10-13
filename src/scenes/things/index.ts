import * as THREE from 'three';
import { Spring } from '../../cast/spring';
import { TAG } from '../../gfx/glsl';
import { toonMaterial } from '../../gfx/materials';
import { bug, cat, dog, pig } from './animals';
import { fan, fin, man, mat, pan, pin, tap, tin } from './batch1';
import { bat, bed, cup, map, pot } from './objects';
import { can, cap, cod, cot, dad, dot, mop, top } from './batch2';
import { part, type Drawing } from './parts';

// Everyday things a word can be about, small enough to stand in a row on the grass. Each is one
// merged mesh about half a tile high, standing on its own origin and turned to show its best side
// to the clearing's camera. A word can only be shown as a thing if it has a recipe here.
// docs/things.md has the rules a drawing follows, and how to look at one.

const RECIPES: Record<string, () => Drawing> = {
  cup, pot, bed, cat, bat, map, dog, pig, bug,
  mat, man, pan, fan, pin, tin, fin, tap,
  cap, cot, can, dot, top, mop, cod, dad,
};

export const THING_NAMES = Object.keys(RECIPES);

/**
 * Things keep most of their own colour through the scene's grade: bright toys on a muted island.
 * They are inked part by part (see `part` in parts.ts), not by the creases the outline pass finds.
 */
const LOOK = { tag: TAG.thing, flag: -0.7, parts: true };
const plain = toonMaterial(LOOK);
const built = new Map<string, { drawing: Drawing; material: THREE.Material; reach: number }>();

function build(name: string) {
  const recipe = RECIPES[name];
  if (!recipe) throw new Error(`no drawing for "${name}"`);
  const drawing = recipe();
  if (!drawing.geo.getAttribute('part')) part(0, drawing.geo);
  const k = drawing.scale ?? 1;
  drawing.geo.scale(k, k, k);
  // Stand it over its own middle, whatever was built off to one side: its shadow is put under its origin.
  drawing.geo.computeBoundingBox();
  const mid = drawing.geo.boundingBox!.getCenter(new THREE.Vector3());
  const half = drawing.geo.boundingBox!.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  drawing.geo.translate(-mid.x, 0, -mid.z);
  const reach = Math.max(0.2, (half.x + half.z) * 0.45);
  if (!drawing.face) return { drawing, material: plain, reach };
  const [ox, oy, oz] = drawing.face.origin;
  const material = toonMaterial({ ...LOOK, face: { ...drawing.face, origin: [ox * k - mid.x, oy * k, oz * k - mid.z] } });
  // Its head is turned away with the rest of it: the eyes come back round to whoever is looking, and up a little.
  material.uniforms.uLook!.value.set(THREE.MathUtils.clamp(-(drawing.turn?.[1] ?? 0) / 0.8, -1, 1), 0.3, 1, 0);
  return { drawing, material, reach };
}

/** One thing standing on the ground. It pops in where it is put and pops out when told to go. */
export class Thing {
  readonly root: THREE.Mesh;
  private pop = new Spring(0);
  private size = 1;
  gone = false;
  /** How far it reaches from its middle: the size of its shadow. */
  readonly reach: number;

  constructor(name: string) {
    let made = built.get(name);
    if (!made) built.set(name, (made = build(name)));
    this.root = new THREE.Mesh(made.drawing.geo, made.material);
    this.reach = made.reach;
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
