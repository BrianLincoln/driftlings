import * as THREE from 'three';
import { PALETTES } from '../gfx/palette';
import { buildIsland, buildWater, islandHeight } from '../gfx/ground';
import { buildSky } from '../gfx/sky';
import { pushBlob } from '../gfx/uniforms';
import { sfx } from '../audio/sound';
import { Creature } from '../cast/creature';
import { Companion } from '../cast/companion';
import type { Rescue } from '../cast/species';
import type { Framing, LayoutMode } from '../stage/framing';
import type { Diorama } from './diorama';
import { SIZE } from './blockade';
import { bound } from './detour';
import { Dust } from './dust';
import { HOME_SHAPE } from './homeIsland';
import { PROP_MAT, buildFarIsles, bushGeo, rockGeo, treeGeo } from './props';
import { Raft } from './raft';
import { BOW, Ship } from './ship';

// Coming home, seen from the beach. The ship comes in out of the distance
// almost straight at us and draws up alongside, its whole side filling the
// view. The companion jumps down onto the sand, and after it, one by one,
// everyone who is home to stay; they hurry past us up the island. Then, if
// someone big came too, a cut along the shore to the raft astern: one great
// bound, and it is home as well.

export interface LandfallPlan {
  /** The little ones on deck. */
  crew: Rescue[];
  /** True if they are home to stay and get off; otherwise they wait aboard to go back out. */
  ashore: boolean;
  /** Someone on the raft, if anyone. It gets off too. */
  big: Rescue | null;
  /** Everyone who is getting off is off. A tap gets there sooner. */
  done(): void;
}

const y = (x: number, z: number) => islandHeight(HOME_SHAPE, x, z);
/** Where the ship ends up, off the far shore, and the way it is heading when it gets there. */
const BERTH = new THREE.Vector3(0.5, 0, -HOME_SHAPE.radius - 3.5);
const YAW = -0.34;
const AHEAD = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW));
/** Seconds it takes to come in, and from how far off. */
const COME_IN = 2.7;
const FROM = 19;
/** When the first of them jumps down, and how long after each the next goes. */
const FIRST_OFF = COME_IN + 0.35;
const NEXT_OFF = 0.36;
/** Where the big one comes down. */
const BIG_LANDS = new THREE.Vector3(-3.0, 0, -8.7);

/** What stands at the edges of the picture, as [x, z, kind]. */
const DRESSING: Array<[number, number, 'tree' | 'bush' | 'rock']> = [
  [9.6, -6.0, 'tree'], [11.2, -3.6, 'tree'], [7.0, -8.6, 'bush'], [-6.6, -9.3, 'rock'], [8.4, -4.6, 'bush'], [-1.2, -6.2, 'bush'],
];

/** Someone getting off: when it goes, where it comes down, and where it hurries off to after. */
interface Leaver {
  who: Creature | Companion;
  at: number;
  land: THREE.Vector3;
  then: THREE.Vector3;
  state: 'aboard' | 'air' | 'off';
}

export function createLandfall(plan: LandfallPlan): Diorama {
  const scene = new THREE.Scene();
  const palette = PALETTES.goldenNoon;
  scene.add(buildSky(palette), buildWater(palette, HOME_SHAPE), buildIsland(HOME_SHAPE));
  scene.add(buildFarIsles(palette.water, [[-34, -80, 3], [20, -110, 8], [58, -72, 14], [-70, -95, 19]]));
  const prop = PROP_MAT();
  const shadows: Array<[number, number, number, number]> = [];
  DRESSING.forEach(([x, z, kind], i) => {
    const m = new THREE.Mesh(kind === 'tree' ? treeGeo(11 + i * 12) : kind === 'bush' ? bushGeo(40 + i * 7) : rockGeo(60 + i, 0.4), prop);
    m.position.set(x, y(x, z) - 0.04, z);
    scene.add(m);
    shadows.push([x, z, kind === 'tree' ? 0.95 : 0.5, kind === 'tree' ? 1.5 : 1.15]);
  });
  const dust = new Dust(16);
  scene.add(dust.root);

  const ship = new Ship(plan.big ? new Raft() : null);
  scene.add(ship.root);
  if (ship.raft) scene.add(ship.raft.root, ship.raft.rope);
  const come = (t: number, settle: boolean) => {
    const k = Math.min(1, t / COME_IN);
    const off = FROM * (1 - k) * (1 - k);
    ship.place(BERTH.x - AHEAD.x * off, BERTH.z - AHEAD.z * off, YAW, settle);
  };
  come(0, true);

  const leavers: Leaver[] = [];
  const spot = (i: number, n: number, z: number) => new THREE.Vector3(1.2 + (i - (n - 1) / 2) * 0.85, 0, z + (i % 2) * 0.5);
  const companion = new Companion();
  companion.quiet = true;
  scene.add(companion.root);
  const n = plan.ashore ? plan.crew.length : 0;
  leavers.push({ who: companion, at: FIRST_OFF, land: new THREE.Vector3(3.4, 0, -9.0), then: new THREE.Vector3(4.2, 0, -5.2), state: 'aboard' });
  const little = plan.crew.map((who, i) => {
    const c = new Creature(who);
    scene.add(c.root);
    ship.seat(c);
    if (plan.ashore) leavers.push({ who: c, at: FIRST_OFF + 0.5 + i * NEXT_OFF, land: spot(i, n, -9.4), then: spot(i, n, -3.5).multiplyScalar(1.6).setZ(-3.5), state: 'aboard' });
    return c;
  });
  let big: Creature | null = null;
  if (plan.big) {
    big = new Creature(plan.big);
    big.root.scale.multiplyScalar(SIZE);
    scene.add(big.root);
    ship.seat(big, 'raft');
  }
  /** When the picture cuts to the raft, when the big one goes, and when it is all over. */
  const cutAt = FIRST_OFF + 0.5 + n * NEXT_OFF + 1.5;
  const bigAt = cutAt + 0.6;
  let bigState: Leaver['state'] = 'aboard';
  let landed = 0;
  const endAt = () => (big ? (bigState === 'off' ? landed + 1.3 : Infinity) : cutAt);

  let t = 0;
  let told = false;
  let docked = false;
  const finish = () => {
    if (told) return;
    told = true;
    plan.done();
  };

  return {
    name: 'landfall',
    palette,
    scene,
    touchables: [],
    reframing: true,
    framing(m: LayoutMode): Framing {
      if (big && t >= cutAt) {
        // Along the shore from the other side: the raft, the water, and the sand it is making for.
        const center = new THREE.Vector3(-3.6, 1.7, -11.6);
        return m === 'tall' ? { center, width: 8.6, height: 7.0, elevation: 16, azimuth: -52, fov: 34 } : { center, width: 10.5, height: 6.2, elevation: 11, azimuth: -38 };
      }
      // From up the beach and off to the bow side, so the ship comes in toward us and ends up side on.
      return m === 'tall'
        ? { center: new THREE.Vector3(1.6, 1.5, -11.2), width: 5.4, height: 7.2, elevation: 14, azimuth: 44, fov: 34 }
        : { center: new THREE.Vector3(1.3, 1.9, -12.0), width: 9.0, height: 5.6, elevation: 8, azimuth: 26 };
    },
    layout() {},
    enter() {},
    pointer(phase) {
      if (phase === 'down' && t > 0.5) finish();
    },
    update(dt, camera) {
      t += dt;
      for (const [x, z, r, stretch] of shadows) pushBlob(x, z, r, stretch);
      dust.update(dt);
      come(t, false);
      ship.update(dt, camera);
      if (!docked && t >= COME_IN) {
        docked = true;
        ship.cheer();
        sfx.cheer();
      }

      for (const l of leavers) {
        const p = l.who.root.position;
        const isCompanion = l.who === companion;
        if (l.state === 'aboard' && t >= l.at) {
          // Over the side: one bound from the deck down to the sand.
          l.state = 'air';
          l.land.y = y(l.land.x, l.land.z);
          l.who.groundY = bound(p, l.land, 0.9);
          if (isCompanion) companion.want.at.copy(l.land);
          else {
            const c = l.who as Creature;
            ship.leave(c);
            c.pace = 3;
            c.hopTo(l.land.x, l.land.z);
          }
          sfx.hop();
        } else if (l.state === 'air' && Math.hypot(p.x - l.land.x, p.z - l.land.z) < 0.25) {
          l.state = 'off';
          l.who.groundY = y;
          if (isCompanion) {
            companion.want.at.copy(l.then);
            companion.act('celebrate');
          } else {
            const c = l.who as Creature;
            c.pace = 2;
            c.hopTo(l.then.x, l.then.z);
          }
        }
      }
      if (leavers[0].state === 'aboard') {
        // Until it goes, the companion rides at the bow.
        const bow = ship.deck(BOW);
        const deck = bow.y;
        companion.groundY = () => deck;
        companion.root.position.x = bow.x;
        companion.root.position.z = bow.z;
        companion.want.at.set(bow.x, 0, bow.z);
      }
      companion.viewer.copy(camera.position);
      companion.update(dt);
      for (const l of leavers) {
        if (l.who === companion || l.state === 'aboard') continue;
        (l.who as Creature).lookTarget = camera.position;
        (l.who as Creature).update(dt);
      }

      if (big) {
        const p = big.root.position;
        if (bigState === 'aboard' && t >= bigAt) {
          bigState = 'air';
          BIG_LANDS.y = y(BIG_LANDS.x, BIG_LANDS.z);
          ship.leave(big);
          big.groundY = bound(p, BIG_LANDS, 2.6);
          big.pace = 3.4;
          big.hopTo(BIG_LANDS.x, BIG_LANDS.z);
          sfx.whoosh();
        } else if (bigState === 'air' && Math.hypot(p.x - BIG_LANDS.x, p.z - BIG_LANDS.z) < 0.25) {
          bigState = 'off';
          landed = t;
          big.groundY = y;
          big.pace = 1;
          big.nod();
          sfx.thud();
          dust.burst(p, 14, 0.9, 1.1);
          for (const c of little) if (!plan.ashore) c.react();
        }
        if (bigState !== 'aboard') {
          big.lookTarget = camera.position;
          big.update(dt);
        }
      }
      if (t > endAt()) finish();
    },
  };
}
