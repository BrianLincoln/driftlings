import * as THREE from 'three';
import { C } from '../gfx/palette';
import { capsule, place } from '../gfx/geo';
import { lay, mound, yawTo, type Pastime, type Site } from './pastime';
import { PROP_MAT, rockGeo, treeGeo } from './props';

// The quiet pastimes: a nap, the sea to look at, a story, a rock to stand on.

/** A big tree set forward of the rest, and room in its shade to sleep. */
export function nap(s: Site): Pastime {
  const { at, local, root, shadows, inward } = lay(s);
  const tree = new THREE.Mesh(treeGeo(90 + s.n * 7), PROP_MAT());
  tree.position.copy(at).y -= 0.04;
  tree.scale.setScalar(1.3);
  root.add(tree);
  shadows.push([at.x, at.z, 1.25, 1.5]);
  const spots = [local(-1.0, 0.55), local(0.05, 1.05), local(1.0, 0.5)];
  return {
    at, root, shadows, room: spots.length, stay: [14, 30], reach: 1.9,
    tall: { m: tree, size: 1.3, tall: true, blob: shadows[0], shade: shadows[0][2] },
    spot: (i) => spots[i],
    begin({ c }) {
      c.sit();
      c.drowse = 0.12;
      c.lookTarget = null;
      c.turnTo(inward + (Math.random() - 0.5) * 1.4);
    },
    end({ c }) {
      c.drowse = null;
      c.stand();
    },
    update() {},
  };
}

/** Sat in a row on the sand where there is a gap in the trees, looking out to sea. */
export function shore(s: Site): Pastime {
  const { at, root, shadows, seaward } = lay(s);
  // They sit along the water's edge, whichever way that runs here: `u` along it, `v` back from it.
  const out = new THREE.Vector3(s.x, 0, s.z).normalize();
  const local = (u: number, v: number) => {
    const p = new THREE.Vector3(s.x - out.z * u - out.x * v, 0, s.z + out.x * u - out.z * v);
    return p.setY(s.y(p.x, p.z));
  };
  const stone = local(1.9, 0.5);
  const rock = new THREE.Mesh(rockGeo(74 + s.n, 0.36), PROP_MAT());
  rock.position.copy(stone).y -= 0.04;
  root.add(rock);
  shadows.push([stone.x, stone.z, 0.4, 1.2]);
  const far = out.clone().multiplyScalar(70).setY(1);
  const spots = [local(-1.1, 0), local(0, 0.3), local(1.05, -0.05)];
  return {
    at, root, shadows, room: spots.length, stay: [10, 22], reach: 2.6,
    spot: (i) => spots[i],
    begin({ c }) {
      c.sit();
      c.lookTarget = far;
      c.turnTo(seaward + (Math.random() - 0.5) * 0.5);
    },
    end: ({ c }) => c.stand(),
    update() {},
  };
}

/** One up on a log with something to tell, and the rest sat on the grass in front of it, listening. */
export function story(s: Site): Pastime {
  const { at, local, root, shadows, inward } = lay(s);
  const TOP = 0.42;
  const log = new THREE.Mesh(
    place(capsule(0.22, 1.5, (p) => (Math.abs(p.y) > 0.8 ? C.cutWood : C.trunk)), [0, 0.2, 0], [0, 0, Math.PI / 2]),
    PROP_MAT(),
  );
  log.position.copy(at);
  root.add(log);
  shadows.push([at.x, at.z, 0.5, 1.6]);
  const spots = [at, local(-0.9, 1.15), local(0, 1.45), local(0.9, 1.1)];
  const up = mound(at, 0.55, () => TOP);
  let t = 0;
  let turn = 0;
  return {
    at, root, shadows, room: spots.length, stay: [9, 20], reach: 1.9,
    spot: (i) => spots[i],
    rise: (i) => (i === 0 ? up : null),
    begin({ c }, i) {
      if (i > 0) c.sit();
    },
    end({ c }, i) {
      if (i > 0) c.stand();
    },
    update(dt, here) {
      const teller = here[0];
      // A bob for every few words, and a look at each of them in turn.
      if ((t += dt) > 1.3) {
        t = 0;
        turn++;
        teller?.c.nod(true);
      }
      const listening = here.slice(1).filter((g) => g !== null);
      if (teller) {
        teller.c.turnTo(inward);
        teller.c.lookTarget = listening.length ? listening[turn % listening.length].eye : null;
      }
      for (const g of listening) {
        g.c.turnTo(yawTo(g.c.root.position, at));
        g.c.lookTarget = teller?.eye ?? null;
      }
    },
  };
}

/** A great rock: one stands on top and looks all about, and whoever is waiting for a go looks up at it. */
export function lookout(s: Site): Pastime {
  const { at, local, root, shadows } = lay(s);
  const TOP = 0.86;
  const rock = new THREE.Mesh(rockGeo(80 + s.n, 1.0), PROP_MAT());
  rock.position.copy(at).y -= 0.06;
  rock.rotation.y = s.n;
  root.add(rock);
  shadows.push([at.x, at.z, 1.05, 1.3]);
  const spots = [at, local(-1.15, 1.2), local(1.0, 1.35)];
  const up = mound(at, 1.0, () => TOP);
  let t = 0;
  return {
    at, root, shadows, room: spots.length, stay: [8, 16], reach: 1.9,
    spot: (i) => spots[i],
    rise: (i) => (i === 0 ? up : null),
    begin() {},
    end() {},
    update(dt, here) {
      t += dt;
      const top = here[0];
      if (top) {
        // Away up the island, off to one side, then the other, and round to us.
        top.c.turnTo(Math.PI + Math.sin(t * 0.4) * 2.7);
        top.c.lookTarget = null;
      }
      for (const g of here.slice(1)) {
        if (!g) continue;
        g.c.turnTo(yawTo(g.c.root.position, at));
        g.c.lookTarget = top?.eye ?? null;
      }
    },
  };
}
