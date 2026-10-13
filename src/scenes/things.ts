import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Spring } from '../cast/spring';
import { C } from '../gfx/palette';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../gfx/geo';

// Everyday things a word can be about, small enough to stand in a row on the grass. Each is one
// merged mesh about half a tile high, standing on its own origin and turned to show its best side
// to the clearing's camera. A word can only be shown as one and several if it has a recipe here.

const [RED, BLUE, GREEN, , PINK] = C.cards;
/** A ladybird's shell, as half-widths, and where its spots are, as directions out from its middle. */
const SHELL = [0.24, 0.15, 0.27] as const;
const SPOTS = [[0.55, 0.6, 0.35], [-0.55, 0.6, 0.35], [0.5, 0.7, -0.4], [-0.5, 0.7, -0.4], [0.75, 0.45, -0.05], [-0.75, 0.45, -0.05]].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
/** A round black spot lying flat on the shell, out along `d`. */
function spot(d: THREE.Vector3, r: number): THREE.BufferGeometry {
  const [a, b, c] = SHELL;
  const out = new THREE.Vector3(d.x / a, d.y / b, d.z / c).normalize();
  return ellipsoid(r, r * 0.2, r, C.faceInk, 14).applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(d.x * a, 0.15 + d.y * b, d.z * c),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), out),
    new THREE.Vector3(1, 1, 1),
  ));
}
/** A flat green triangle, standing on its base and facing forward: a hill as a map draws one. */
function hill(w: number, h: number): THREE.BufferGeometry {
  const shape = new THREE.Shape().moveTo(-w / 2, 0).lineTo(w / 2, 0).lineTo(0, h).closePath();
  return paint(new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false }), GREEN);
}
/** A kitten's eye, flat on to +z, in the manner of the game's own creatures: a white, a big soft pupil, one glint. */
function catEye(r: number): THREE.BufferGeometry {
  return merge(
    ellipsoid(r, r * 1.15, r * 0.3, C.eyeWhite, 20),
    place(ellipsoid(r * 0.7, r * 0.84, r * 0.2, C.faceInk, 18), [0, -r * 0.08, r * 0.2]),
    place(ellipsoid(r * 0.26, r * 0.26, r * 0.1, C.eyeWhite, 10), [r * 0.24, r * 0.3, r * 0.36]),
  );
}
/** An eye that looks alive: dark, with a glint up and to one side. */
const eye = (x: number, y: number, z: number, r: number) => [
  place(ellipsoid(r, r * 1.2, r * 0.5, C.faceInk, 14), [x, y, z]),
  place(ellipsoid(r * 0.42, r * 0.42, r * 0.2, C.eyeWhite, 10), [x + r * 0.3, y + r * 0.42, z + r * 0.42]),
];
const box = (w: number, h: number, d: number, colour: string, r = 0.03) => paint(new RoundedBoxGeometry(w, h, d, 3, r), colour);

const RECIPES: Record<string, () => THREE.BufferGeometry> = {
  // A mug: straight sides, a rounded lip, a handle, something dark in it.
  cup: () => merge(
    place(paint(new THREE.CylinderGeometry(0.19, 0.175, 0.4, 36), BLUE), [0, 0.2, 0]),
    place(paint(new THREE.TorusGeometry(0.178, 0.016, 8, 36), BLUE), [0, 0.4, 0], [Math.PI / 2, 0, 0]),
    place(ellipsoid(0.165, 0.012, 0.165, C.trunk, 20), [0, 0.4, 0]),
    place(paint(new THREE.TorusGeometry(0.11, 0.032, 10, 20, Math.PI), BLUE), [0.18, 0.2, 0], [0, 0, -Math.PI / 2]),
  ),
  // A cooking pot with its lid on and a handle each side.
  pot: () => merge(
    lathe([[0.001, 0], [0.26, 0.01], [0.3, 0.18], [0.29, 0.34]], RED),
    place(ellipsoid(0.3, 0.09, 0.3, RED, 20), [0, 0.35, 0]),
    place(ellipsoid(0.06, 0.05, 0.06, C.ink, 12), [0, 0.46, 0]),
    place(capsule(0.035, 0.1, C.ink), [0.33, 0.26, 0], [Math.PI / 2, 0, 0]),
    place(capsule(0.035, 0.1, C.ink), [-0.33, 0.26, 0], [Math.PI / 2, 0, 0]),
  ),
  // A bed seen from the side: headboard, pillow, blanket.
  bed: () => merge(
    place(box(0.86, 0.12, 0.46, C.trunk), [0, 0.14, 0]),
    place(box(0.8, 0.12, 0.42, C.flower, 0.05), [0, 0.25, 0]),
    place(box(0.5, 0.14, 0.45, GREEN, 0.05), [0.16, 0.26, 0]),
    place(ellipsoid(0.12, 0.06, 0.16, C.flower, 14), [-0.26, 0.34, 0]),
    place(box(0.08, 0.5, 0.48, C.trunk), [-0.43, 0.25, 0]),
    place(box(0.08, 0.3, 0.48, C.trunk), [0.43, 0.15, 0]),
  ),
  // A kitten sitting up, facing us: a head bigger than its body, a white face in orange, great green eyes.
  cat: () => merge(
    place(ellipsoid(0.15, 0.17, 0.14, C.amber), [0, 0.17, 0]),
    place(ellipsoid(0.085, 0.11, 0.05, C.flower, 14), [0, 0.17, 0.11]),
    place(ellipsoid(0.24, 0.2, 0.2, C.amber, 36), [0, 0.5, 0.03]),
    ...[-1, 1].flatMap((k) => [
      place(paint(new THREE.ConeGeometry(0.1, 0.19, 14), C.amber), [k * 0.15, 0.7, 0.02], [0, 0, -k * 0.3]),
      place(paint(new THREE.ConeGeometry(0.06, 0.13, 12), PINK), [k * 0.148, 0.69, 0.055], [0, 0, -k * 0.3]),
      place(catEye(0.058), [k * 0.1, 0.5, 0.205], [0, k * 0.22, 0]),
      // Two soft white puffs for a muzzle: the line between them is its smile.
      place(ellipsoid(0.048, 0.04, 0.04, C.flower, 14), [k * 0.04, 0.425, 0.2]),
      place(ellipsoid(0.05, 0.035, 0.06, C.flower, 10), [k * 0.065, 0.03, 0.1]),
    ]),
    place(ellipsoid(0.022, 0.016, 0.014, PINK, 10), [0, 0.455, 0.236]),
    // A thick tail with a white tip, curling up beside it.
    place(capsule(0.045, 0.2, C.amber), [0.19, 0.12, -0.03], [0, 0, -0.9]),
    place(ellipsoid(0.05, 0.05, 0.05, C.flower, 12), [0.29, 0.2, -0.03]),
  ).scale(0.92, 0.92, 0.92),
  // A bat for hitting a ball, leaning, with the ball beside it.
  bat: () => merge(
    place(
      lathe([[0.001, 0], [0.04, 0.005], [0.028, 0.03], [0.028, 0.25], [0.05, 0.46], [0.062, 0.68], [0.05, 0.75], [0.001, 0.76]], (p) => (p.y < 0.22 ? C.trunk : C.cutWood)),
      [0.12, 0, 0], [0, 0, 0.5],
    ),
    place(ellipsoid(0.08, 0.08, 0.08, C.flower, 14), [0.16, 0.08, 0.1]),
  ),
  // A map held up to be read: hills, a dotted way across, a cross where the treasure is.
  map: () => place(
    merge(
      box(0.62, 0.46, 0.02, C.parchment, 0.008),
      place(capsule(0.03, 0.44, C.parchmentEdge), [-0.31, 0, 0]),
      place(capsule(0.03, 0.44, C.parchmentEdge), [0.31, 0, 0]),
      ...[[-0.2, 0.03, 1], [-0.1, 0.03, 0.7]].map(([x, y, k]) => place(hill(0.15 * k, 0.13 * k), [x, y, 0.01])),
      ...[[-0.21, -0.13], [-0.12, -0.08], [-0.03, -0.07], [0.05, -0.02], [0.1, 0.05]].map(([x, y]) => place(ellipsoid(0.02, 0.02, 0.006, C.ink, 10), [x, y, 0.012])),
      place(box(0.15, 0.036, 0.008, RED, 0.003), [0.18, 0.11, 0.014], [0, 0, 0.785]),
      place(box(0.15, 0.036, 0.008, RED, 0.003), [0.18, 0.11, 0.014], [0, 0, -0.785]),
    ),
    [0, 0.27, 0], [-0.4, 0, 0],
  ),
  // A dog sitting up, facing us: ears that hang, a pale muzzle, its tongue out.
  dog: () => merge(
    place(ellipsoid(0.18, 0.2, 0.17, C.basket), [0, 0.2, 0]),
    place(ellipsoid(0.15, 0.14, 0.14, C.basket), [0, 0.48, 0.04]),
    place(ellipsoid(0.085, 0.065, 0.09, C.cutWood, 14), [0, 0.44, 0.16]),
    place(ellipsoid(0.03, 0.022, 0.02, C.faceInk, 8), [0, 0.47, 0.245]),
    place(ellipsoid(0.025, 0.035, 0.012, C.blush, 8), [0, 0.385, 0.22]),
    ...[-1, 1].flatMap((k) => [
      place(ellipsoid(0.05, 0.12, 0.04, C.trunk, 12), [k * 0.165, 0.45, 0.03], [0, 0, k * 0.2]),
      ...eye(k * 0.062, 0.53, 0.165, 0.03),
      place(ellipsoid(0.06, 0.04, 0.07, C.cutWood, 10), [k * 0.08, 0.035, 0.115]),
    ]),
    place(capsule(0.028, 0.14, C.basket), [-0.19, 0.24, -0.08], [0, 0, 0.6]),
  ),
  // A pig, side on and turned a little our way: snout, ears, a curl of a tail.
  pig: () => place(
    merge(
      place(ellipsoid(0.26, 0.19, 0.18, C.blush), [0, 0.25, 0]),
      place(ellipsoid(0.15, 0.14, 0.14, C.blush), [0.26, 0.31, 0]),
      place(ellipsoid(0.05, 0.06, 0.07, PINK, 12), [0.4, 0.29, 0]),
      place(paint(new THREE.TorusGeometry(0.04, 0.015, 8, 14), PINK), [-0.28, 0.32, 0]),
      ...[-1, 1].flatMap((k) => [
        place(ellipsoid(0.012, 0.016, 0.012, C.faceInk, 6), [0.445, 0.29, k * 0.028]),
        place(ellipsoid(0.02, 0.025, 0.015, C.faceInk, 8), [0.35, 0.37, k * 0.09]),
        place(paint(new THREE.ConeGeometry(0.05, 0.1, 10), PINK), [0.22, 0.45, k * 0.09], [k * 0.3, 0, -0.3]),
        place(capsule(0.04, 0.07, C.blush), [0.14, 0.07, k * 0.09]),
        place(capsule(0.04, 0.07, C.blush), [-0.14, 0.07, k * 0.09]),
      ]),
    ),
    [0, 0, 0], [0, -0.75, 0],
  ),
  // A ladybird, tipped up to show its spots.
  bug: () => place(
    merge(
      place(ellipsoid(...SHELL, RED), [0, 0.15, 0]),
      place(ellipsoid(0.014, SHELL[1] + 0.006, SHELL[2] + 0.006, C.faceInk, 20), [0, 0.15, 0]),
      ...SPOTS.map((d) => spot(d, 0.052)),
      place(ellipsoid(0.12, 0.1, 0.1, C.faceInk, 14), [0, 0.12, 0.25]),
      ...[-1, 1].flatMap((k) => [
        place(ellipsoid(0.03, 0.03, 0.02, C.eyeWhite, 8), [k * 0.06, 0.16, 0.33]),
        place(capsule(0.012, 0.1, C.faceInk), [k * 0.06, 0.25, 0.3], [0, 0, -k * 0.35]),
        // Legs start well under the shell, so each one is joined on.
        ...[-0.12, 0.02, 0.16].map((z) => place(capsule(0.016, 0.16, C.faceInk), [k * 0.21, 0.05, z], [0, 0, k * 1.2])),
      ]),
    ),
    [0, 0.07, 0], [0.45, 0, 0],
  ),
};

export const THING_NAMES = Object.keys(RECIPES);

const built = new Map<string, THREE.BufferGeometry>();

/** One thing standing on the ground. It pops in where it is put and pops out when told to go. */
export class Thing {
  readonly root: THREE.Mesh;
  private pop = new Spring(0);
  private size = 1;
  gone = false;

  constructor(name: string, material: THREE.Material) {
    const recipe = RECIPES[name];
    if (!recipe) throw new Error(`no drawing for "${name}"`);
    let geo = built.get(name);
    if (!geo) built.set(name, (geo = recipe()));
    this.root = new THREE.Mesh(geo, material);
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
