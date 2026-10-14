import * as THREE from 'three';
import { TAG } from '../gfx/glsl';
import { toonMaterial, type ToonMaterial } from '../gfx/materials';
import { creatureGeo } from './creatureParts';
import type { Rescue } from './species';

// The meshes a creature is put together from. How it moves is cast/creature.ts.

export interface Rig {
  body: THREE.Group;
  head: THREE.Group;
  ears: THREE.Group[];
  headMat: ToonMaterial;
  bodyMat: ToonMaterial;
  headY: number;
  earLean: number;
}

/** Build the body, head and ears of `who` and hang them under `root`. */
export function buildRig(who: Rescue, root: THREE.Group): Rig {
  const geo = creatureGeo(who.species, who.coat);
  const body = new THREE.Group();
  const head = new THREE.Group();
  const ears: THREE.Group[] = [];
  // Creatures pop against the graded world: they keep their own colour through
  // the grade and their shade bands are lifted so a white belly stays white.
  const look = { tag: TAG.creature, flag: -1, unlit: 0.35 };
  const bodyMat = toonMaterial(look);
  body.add(new THREE.Mesh(geo.body, bodyMat));
  const headMat = toonMaterial({ ...look, face: geo.face });
  head.add(new THREE.Mesh(geo.head, headMat));
  head.position.set(0, geo.headY, 0.03);
  if (geo.ear) {
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * geo.earPivot.x, geo.earPivot.y, geo.earPivot.z);
      pivot.rotation.z = -side * geo.earLean;
      pivot.add(new THREE.Mesh(geo.ear, bodyMat));
      head.add(pivot);
      ears.push(pivot);
    }
  }
  body.add(head);
  root.add(body);
  return { body, head, ears, headMat, bodyMat, headY: geo.headY, earLean: geo.earLean };
}
