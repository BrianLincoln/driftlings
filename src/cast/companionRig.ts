import * as THREE from 'three';
import { TAG } from '../gfx/glsl';
import { capsule, ellipsoid, lathe, place } from '../gfx/geo';
import { C } from '../gfx/palette';
import { toonMaterial, type ToonMaterial } from '../gfx/materials';

// The meshes the companion is put together from. How it moves is cast/companion.ts.

/** The basket it carries: how high its rim is off the ground, and how far out from the middle it still catches. */
export const BASKET = { rim: 0.74, reach: 0.4, radius: 0.33 };

export interface CompanionRig {
  arms: THREE.Group[];
  feet: THREE.Mesh[];
  basket: THREE.Mesh;
  mat: ToonMaterial;
}

/** Build the companion into `root`: its `body` group, the feet and the basket. */
export function buildCompanion(root: THREE.Group, body: THREE.Group): CompanionRig {
  const arms: THREE.Group[] = [];
  const feet: THREE.Mesh[] = [];
  // The owner's own companion from the reference game: a pebble-round body,
  // big painted eyes, two stubby arms, two feet and a glowing spot on its chest.
  const warm = '#f4b650';
  const geo = place(ellipsoid(0.23, 0.235, 0.22, (p, n) => (n.z > 0.5 && p.y < -0.42 ? '#fff1c4' : warm), 44), [0, 0.22, 0]);
  // Self-lit and exempt from the grade: it stays warm in any palette.
  const mat = toonMaterial({
    tag: TAG.creature,
    unlit: 0.5,
    flag: 0.5,
    face: {
      origin: [0, 0.22, 0],
      eye: [0.36, 0.2, 0.22, 0.27],
      pupil: [0.085, 0.115, 0.13, 0.11],
      mouth: [-0.2, 0.07],
      blush: [0.7, -0.08, 0.12],
    },
  });
  body.add(new THREE.Mesh(geo, mat));
  const armMat = toonMaterial({ tag: TAG.creature, unlit: 0.55, flag: 0.5 });
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.215, 0.17, 0.03);
    pivot.add(new THREE.Mesh(place(capsule(0.042, 0.07, '#f3b458'), [0, -0.06, 0]), armMat));
    body.add(pivot);
    arms.push(pivot);
  }
  // The feet are their own, under the body and not part of it: they step while it rocks along above them.
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(ellipsoid(0.07, 0.04, 0.09, '#eda653'), armMat);
    foot.position.set(side * 0.09, 0, 0.06);
    root.add(foot);
    feet.push(foot);
  }
  // Wider than it is: there is no missing with a basket this size. Solid, so it needs no inside faces.
  const r = BASKET.radius;
  const basket = new THREE.Mesh(
    lathe([[0, 0], [r * 0.62, 0], [r * 0.9, 0.13], [r, 0.25], [r * 0.9, 0.25], [r * 0.8, 0.17], [0, 0.15]], (_p, n) => (n.y > 0.35 ? C.basketDark : C.basket), 28, 30),
    toonMaterial({ tag: TAG.prop }),
  );
  basket.position.y = BASKET.rim - 0.25 - 0.04;
  basket.visible = false;
  root.add(body, basket);
  return { arms, feet, basket, mat };
}
