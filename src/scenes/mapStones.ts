import * as THREE from 'three';
import { C } from '../gfx/palette';
import { TAG } from '../gfx/glsl';
import { lathe } from '../gfx/geo';
import { toonMaterial, type ToonMaterial } from '../gfx/materials';
import { Creature } from '../cast/creature';
import { Spring } from '../cast/spring';
import type { Rescue } from '../cast/species';
import type { LayoutMode } from '../stage/framing';
import { tickGeo } from './chartMarks';
import type { LetterTile } from './letterTile';
import type { Place } from './places';

// The stepping stones of an area map. The current one glows, locked ones are
// greyed, and a finished one is pale and wears a tick.

export interface MapNode {
  id: string;
  state: 'done' | 'current' | 'locked';
  /** What the stone shows: the letter it teaches, or an example word. Empty for the checkpoint. */
  label: string;
  /** The label is an irregular word, all of it learned by heart: the stop for "the". */
  byHeart?: boolean;
  /** The creature found here, if this stone gives one. */
  rescue: Rescue | null;
  boss: boolean;
}

export interface Spot {
  node: MapNode;
  group: THREE.Group;
  mat: ToonMaterial;
  ring: THREE.Mesh | null;
  /** The tick seal of a finished stone. */
  mark: THREE.Mesh | null;
  tile: LetterTile | null;
  creature: Creature | null;
  wobble: Spring;
}

const TINT = { done: '#efe2c8', current: C.parchment, locked: '#9a938e' };

/** One stone per node, added to the scene. Whoever was woken at `fresh` a moment ago still stands by its stone. */
export function buildSpots(nodes: MapNode[], fresh: string | null, scene: THREE.Scene): Spot[] {
  const stoneGeo = lathe([[0.62, 0], [0.6, 0.14], [0.5, 0.22], [0.3, 0.24], [0, 0.24]], '#ffffff', 32, 20); // bottom to top, or it faces inward
  const ringGeo = lathe([[0.9, 0], [0.86, 0.05], [0.6, 0.06], [0, 0.06]], C.glow, 32, 12);
  const tick = tickGeo();
  const tickMat = toonMaterial({ tag: TAG.tile, flag: -0.92 });
  return nodes.map((node) => {
    const group = new THREE.Group();
    const mat = toonMaterial({ tag: TAG.prop, tint: TINT[node.state], flag: node.state === 'locked' ? 0 : -0.7 });
    const stone = new THREE.Mesh(stoneGeo, mat);
    const big = node.boss ? 1.5 : 1;
    stone.scale.set(big, 1, big);
    group.add(stone);
    let ring: THREE.Mesh | null = null;
    let mark: THREE.Mesh | null = null;
    if (node.state === 'current') {
      ring = new THREE.Mesh(ringGeo, toonMaterial({ tag: TAG.tile, unlit: 1, flag: 0.3 }));
      ring.scale.set(big, 1, big);
      group.add(ring);
    } else if (node.state === 'done') {
      // Propped up on the stone's near edge, facing whoever is looking.
      mark = new THREE.Mesh(tick, tickMat);
      mark.position.set(0, 0.36, 0.34 * big);
      mark.rotation.x = 1.0;
      mark.scale.setScalar(0.8 * big);
      group.add(mark);
    }
    scene.add(group);
    const creature = node.id === fresh && node.rescue ? new Creature(node.rescue) : null;
    if (creature) scene.add(creature.root);
    return { node, group, mat, ring, mark, tile: null, creature, wobble: new Spring(0) };
  });
}

/** Where lesson stone `i` of `n` nodes lies along the place's path. */
export function stoneAt(place: Place, mode: LayoutMode, i: number, n: number): [number, number] {
  if (mode === 'tall') return [place.tallX[i % place.tallX.length], 3.3 - i * (6.6 / (n - 1))];
  return [-4.6 + i * (9.2 / (n - 1)), place.wideZ[i % place.wideZ.length]];
}
