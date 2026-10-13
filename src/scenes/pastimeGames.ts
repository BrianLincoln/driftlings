import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { C } from '../gfx/palette';
import { ellipsoid, paint } from '../gfx/geo';
import { pushBlob } from '../gfx/uniforms';
import { ease } from '../cast/spring';
import { lay, mound, yawTo, type Guest, type Pastime, type Site } from './pastime';
import { FLOWER_MAT, PROP_MAT, bushGeo, flowersGeo, rockGeo } from './props';

// The lively pastimes: a ball to throw, a seesaw, and two ways of going round after one another.

const reach = new THREE.Vector3();
/** Where a ball is when someone has it: out in front of its belly, in its arms. */
function arms(g: Guest, r: number, out: THREE.Vector3): THREE.Vector3 {
  const size = g.c.root.scale.y;
  const yaw = g.c.root.rotation.y;
  const front = 0.3 * size + r;
  return out.copy(g.c.root.position).add(reach.set(Math.sin(yaw) * front, g.c.height * size * 0.4, Math.cos(yaw) * front));
}

/**
 * A ball going round a ring of them. Whoever catches it hugs it to its belly, turns to whoever it picks next, and
 * throws from there. One alone throws it up and catches it.
 */
export function catchGame(s: Site): Pastime {
  const { at, local, root, shadows } = lay(s);
  const R = 0.17;
  const spots = [0, 1, 2, 3].map((i) => local(Math.sin(0.5 + i * 1.57) * 1.5, Math.cos(0.5 + i * 1.57) * 1.2));
  const ball = new THREE.Mesh(ellipsoid(R, R, R, C.cards[s.n % C.cards.length], 16), PROP_MAT());
  ball.position.copy(at).y += R;
  root.add(ball);
  const hands = new THREE.Vector3();
  /** Who has it, who it is for next, and how long until it is thrown. */
  let holder = -1;
  let next = -1;
  let held = 0;
  let flight: { from: THREE.Vector3; to: number; k: number } | null = null;
  const pass = (to: number) => void (flight = { from: ball.position.clone(), to, k: 0 });
  return {
    at, root, shadows, room: spots.length, stay: [10, 22], reach: 2.1,
    spot: (i) => spots[i],
    begin() {},
    end() {},
    update(dt, here) {
      const playing = here.flatMap((g, i) => (g ? [i] : []));
      const catcher = flight && here[flight.to];
      if (flight && catcher) {
        const k = (flight.k = Math.min(1, flight.k + dt / 0.8));
        // Thrown to oneself it goes well up; to someone else, in a low arc.
        ball.position.lerpVectors(flight.from, arms(catcher, R, hands), k).y += Math.sin(k * Math.PI) * (flight.to === holder ? 1.1 : 0.7);
        if (k >= 1) {
          holder = flight.to;
          const others = playing.filter((i) => i !== holder);
          next = others.length ? others[Math.floor(Math.random() * others.length)] : holder;
          held = 0.7 + Math.random() * 0.8;
          flight = null;
          catcher.c.nod(true);
        }
      } else if (!playing.length) {
        // Nobody about: it lies where it fell.
        flight = null;
        holder = -1;
        ball.position.y = Math.max(s.y(ball.position.x, ball.position.z) + R, ball.position.y - 3 * dt);
      } else if (flight || !here[holder]) {
        // Whoever had it, or was to have it, has gone: it goes to someone who is still here.
        pass(playing[0]);
      } else {
        arms(here[holder]!, R, ball.position);
        if ((held -= dt) <= 0) pass(here[next] ? next : holder);
      }
      here.forEach((g, i) => {
        if (!g) return;
        // The one with the ball looks at whoever it is for; everyone else keeps their eyes on the ball.
        const to = i === holder && !flight ? (here[next] && next !== i ? spots[next] : at) : ball.position;
        g.c.lookTarget = i === holder && !flight && here[next] && next !== i ? here[next]!.eye : ball.position;
        if (Math.hypot(to.x - g.c.root.position.x, to.z - g.c.root.position.z) > 0.5) g.c.turnTo(yawTo(g.c.root.position, to));
      });
      pushBlob(ball.position.x, ball.position.z, 0.13);
    },
  };
}

/** A plank over a stone. One on it sits at the low end and waits; two go up and down. */
export function seesaw(s: Site): Pastime {
  const { at, local, root, shadows } = lay(s);
  const HALF = 1.15;
  const UP = 0.36;
  const TILT = 0.27;
  const frame = new THREE.Group();
  frame.position.copy(at);
  const plank = new THREE.Mesh(paint(new RoundedBoxGeometry(HALF * 2 + 0.36, 0.08, 0.46, 3, 0.03), C.cutWood), PROP_MAT());
  plank.position.y = UP;
  frame.add(new THREE.Mesh(rockGeo(70 + s.n, 0.34), PROP_MAT()), plank);
  root.add(frame);
  shadows.push([at.x, at.z, 0.6, 2.2]);
  const spots = [local(-HALF, 0), local(HALF, 0)];
  let tilt = TILT;
  let t = 0;
  let rising = true;
  /** The plank's own height under each end, over the ground there. */
  const ends = spots.map((spot, i) => mound(spot, 0.6, () => at.y - spot.y + UP + 0.04 + (i ? 1 : -1) * HALF * Math.sin(tilt)));
  return {
    at, root, shadows, room: 2, stay: [10, 20], reach: 2.0,
    spot: (i) => spots[i],
    rise: (i) => ends[i],
    begin({ c }, i) {
      c.turnTo(yawTo(spots[i], at));
      c.nod(true);
    },
    end() {},
    update(dt, [a, b]) {
      t += dt;
      // A positive tilt is the right-hand end up: so with only the left-hand one aboard, and with nobody, as it was left.
      const want = a && b ? TILT * Math.sin(t * 2.6) : a ? TILT : b ? -TILT : Math.sign(tilt) * TILT;
      tilt = ease(tilt, want, 8, dt);
      plank.rotation.z = tilt;
      if (a && b && Math.cos(t * 2.6) > 0 !== rising) {
        // The one who has just touched down kicks off again.
        rising = !rising;
        (rising ? b : a).c.nod(true);
      }
      if (a) a.c.lookTarget = b?.eye ?? null;
      if (b) b.c.lookTarget = a?.eye ?? null;
    },
  };
}

/**
 * Round and round after one another along a loop. `path` gives the loop as [right, nearer] of the middle for
 * 0 to 1 round it; `length` is about how long it is, and `gap` how far apart they keep.
 */
function procession(room: number, path: (k: number) => [number, number], length: number, gap: number, watch: THREE.Vector3 | null, base: ReturnType<typeof lay>): Pastime {
  const { at, local, root, shadows } = base;
  const SPEED = 0.9;
  const on = (k: number) => local(...path(k - Math.floor(k)));
  let head = 0;
  let t = 0;
  return {
    at, root, shadows, room, stay: [12, 26], reach: 2.0,
    spot: (i) => on(head - (i * gap) / length),
    begin() {},
    end({ c }) {
      c.halt();
    },
    update(dt, here) {
      head += (SPEED * dt) / length;
      const hop = (t += dt) > 5;
      if (hop) t = 0;
      here.forEach((g, i) => {
        if (!g) return;
        // Each has a mark that moves along the loop; it makes for a spot a little ahead of that, faster the further it has fallen behind.
        const k = head - (i * gap) / length;
        const mark = on(k);
        const goal = on(k + 0.6 / length);
        const p = g.c.root.position;
        g.c.hopTo(goal.x, goal.z);
        g.c.pace = THREE.MathUtils.clamp(0.4 + 0.55 * Math.hypot(mark.x - p.x, mark.z - p.z), 0.4, 1.8);
        g.c.lookTarget = watch ?? here[i - 1]?.eye ?? null;
        if (hop) g.c.nod(true);
      });
    },
  };
}

/** A ring of them going round a bush with flowers at its foot. */
export function round(s: Site): Pastime {
  const base = lay(s);
  const { at, root, shadows } = base;
  const bush = new THREE.Mesh(bushGeo(31 + s.n * 3), PROP_MAT());
  bush.position.copy(at).y -= 0.04;
  root.add(bush);
  shadows.push([at.x, at.z, 0.55, 1.2]);
  const posy: Array<[number, number, number]> = Array.from({ length: 14 }, (_, i) => {
    const p = base.local(Math.sin(i * 0.45) * 0.72, Math.cos(i * 0.45) * 0.62);
    return [p.x, p.y, p.z];
  });
  root.add(new THREE.Mesh(flowersGeo(posy, 20 + s.n), FLOWER_MAT()));
  const R = 1.3;
  const watch = at.clone().setY(at.y + 0.45);
  return procession(5, (k) => [Math.sin(k * Math.PI * 2) * R, Math.cos(k * Math.PI * 2) * R * 0.9], Math.PI * 2 * R, (Math.PI * 2 * R) / 5, watch, base);
}

/** Follow my leader: a line of them on a long winding loop around a couple of bushes. */
export function parade(s: Site): Pastime {
  const base = lay(s);
  const { root, shadows } = base;
  for (const [u, v, seed] of [[-1.9, 0.1, 47], [1.7, -0.1, 54]]) {
    const p = base.local(u, v);
    const bush = new THREE.Mesh(bushGeo(seed + s.n), PROP_MAT());
    bush.position.copy(p).y -= 0.04;
    root.add(bush);
    shadows.push([p.x, p.z, 0.55, 1.2]);
  }
  const path = (k: number): [number, number] => {
    const a = k * Math.PI * 2;
    return [Math.cos(a) * 3.8, Math.sin(a) * 1.25 + Math.sin(a * 3) * 0.3];
  };
  return { ...procession(4, path, 18, 1.15, null, base), reach: 2.2 };
}
