import * as THREE from 'three';
import { PALETTES } from '../gfx/palette';
import { buildIsland, buildWater, islandHeight } from '../gfx/ground';
import { buildSky } from '../gfx/sky';
import { pushBlob } from '../gfx/uniforms';
import { sfx } from '../audio/sound';
import { Creature } from '../cast/creature';
import { rescue, type Rescue } from '../cast/species';
import { Companion } from '../cast/companion';
import { ease } from '../cast/spring';
import type { Framing, LayoutMode } from '../stage/framing';
import type { Touchable } from '../stage/touch';
import type { Diorama, StageContext } from './diorama';
import { SIZE } from './blockade';
import { ashore, dressHome, type Blob } from './homeRing';
import { buildPastimes } from './pastimes';
import { HOME_BACK, HOME_SHAPE } from './places';
import { buildFarIsles } from './props';
import { Residents } from './residents';
import { Ship } from './ship';
import { Keys, groundUnder } from './steer';

// The home island: no teaching job. It starts empty and fills with the
// creatures the child has rescued, who spend the day going from one thing to
// another (residents.ts, pastimes.ts) and react when tapped. It is a big
// place, seen from well back and above, and the child goes about it as the
// companion: the arrow keys or W A S D, space to jump, or a tap where it should go (steer.ts),
// and the camera keeps it in the picture. The ship lies off the far shore, bow
// on, in a gap in the trees: whoever it has just brought home (landfall.ts
// shows them getting off) comes up from the sand in front of it, and whoever
// is still waiting to go back out stays on deck.

export interface HomePlan {
  /** Rescue numbers living here, in the order they came. */
  residents: number[];
  /** How many of them have been here before. The rest hop in from the shore now. */
  welcomed: number;
  onWelcomed(count: number): void;
  /** Little ones waiting on the ship's deck: woken, but their island is not finished with. */
  aboard: Rescue[];
  /** The big ones that live here. */
  big: Rescue[];
}

/** Where the ship lies. Like everything about the landing, it is given as it was on a smaller island (see HOME_BACK). */
const SHIP = { x: 2.8, z: -14.9 + HOME_BACK };
/** Where the companion is to begin with: up from the landing, with the ship ahead and most of the island around. */
const START: [number, number] = [1.2, -9.5];
/** Where the big ones settle: the first of them either side of the landing, the rest all over. */
const DENS: Array<[number, number]> = [
  [7.4, -18.2], [-5.6, -18.4], [13.4, -12.2], [-14.2, -14.4], [15.0, 0.6], [-16.0, -3.4], [-1.2, 1.4], [9.4, 15.0], [-9.6, 15.8], [1.0, 19.4],
];
/** How fast the companion goes, how near the water it will go, and how far ahead of it the camera looks. */
const SPEED = 5;
const BEACH = 0.9;
const AHEAD = 2.6;
/** How much nearer to us than the companion a tree can stand before it is in the way. */
const IN_THE_WAY = 1.6;
/** A shadow this wide or wider is a tree's: nothing to be jumped over. */
const TREE_SHADE = 0.9;
/** Shadows are drawn only for what stands this near the companion. */
const SHADOWS_WITHIN = 22;

export function createHomeIsland(plan: HomePlan): Diorama {
  const scene = new THREE.Scene();
  const palette = PALETTES.goldenNoon;
  const y = (x: number, z: number) => islandHeight(HOME_SHAPE, x, z);

  scene.add(buildSky(palette), buildWater(palette, HOME_SHAPE), buildIsland(HOME_SHAPE));
  scene.add(buildFarIsles(palette.water, [[-34, -80, 3], [20, -110, 8], [58, -72, 14], [-70, -95, 19], [-104, -62, 6], [98, -50, 11]]));

  const places = buildPastimes(y);
  const { shadows, standing } = dressHome(scene, y, [
    ...places.map((p): [number, number, number] => [p.at.x, p.at.z, p.reach]),
    ...DENS.map(([x, z]): [number, number, number] => [x, z, 1.7]),
    // The gap in the trees that the ship is seen through, the way up from it, and where the companion starts.
    [SHIP.x - 0.35, HOME_BACK - 8.2, 1.9],
    [SHIP.x - 0.4, HOME_BACK - 5.2, 2.6],
    [START[0], START[1], 2],
  ]);
  for (const p of places) {
    scene.add(p.root);
    shadows.push(...p.shadows);
    if (p.tall) standing.push(p.tall);
  }
  /** What the companion cannot walk through: whatever casts a shadow, about as wide as its trunk or its middle. */
  const solid = shadows.map(([x, z, r]) => [x, z, r * 0.55 + 0.2, r]);

  const ship = new Ship();
  ship.place(SHIP.x, SHIP.z, -Math.PI / 2);
  scene.add(ship.root);
  const waiting = plan.aboard.map((who) => new Creature(who));
  for (const c of waiting) {
    ship.seat(c);
    scene.add(c.root);
  }

  const companion = new Companion();
  companion.groundY = y;
  companion.speed = SPEED;
  companion.place(...START);
  companion.want.pose = 'settled';
  scene.add(companion.root);
  const guide = companion.root.position;
  /** What the camera is on: the companion, a moment ago. */
  const look = guide.clone();

  const viewer = new THREE.Vector3(0, 3, 0);
  const residents = new Residents(places, y, viewer, guide);
  const creatures: Creature[] = [];
  const arrivals: Array<{ c: Creature; at: number; x: number; z: number }> = [];
  plan.residents.forEach((who, i) => {
    const c = new Creature(rescue(who));
    scene.add(c.root);
    creatures.push(c);
    if (i < plan.welcomed) return residents.settle(c, i);
    // A new arrival, just off the ship: it waits on the sand in front of it, and they come up one after another.
    const n = i - plan.welcomed;
    residents.hold(c, SHIP.x - 1.6 + (n % 4) * 0.8, HOME_BACK - 8.9 + (n % 2) * 0.5);
    arrivals.push({ c, at: 0.8 + n * 0.55, x: SHIP.x - 2.8 + (n % 5) * 1.1, z: HOME_BACK - 4.4 + (n % 2) * 1.0 });
  });
  // The big ones. One that has only just come home stands on the sand with the rest, and is the last to come up.
  const fresh = plan.welcomed < plan.residents.length;
  plan.big.forEach((who, i) => {
    const c = new Creature(who);
    c.root.scale.multiplyScalar(SIZE);
    const den = DENS[i % DENS.length];
    scene.add(c.root);
    creatures.push(c);
    if (fresh && i === plan.big.length - 1) {
      residents.hold(c, SHIP.x + 2.4, HOME_BACK - 8.6, den);
      arrivals.push({ c, at: 1.4 + (plan.residents.length - plan.welcomed) * 0.55, x: den[0], z: den[1] });
    } else {
      residents.hold(c, den[0], den[1], den);
      residents.free(c, den[0], den[1]);
    }
  });
  let t = 0;
  let told = false;
  const sortedAt = new THREE.Vector3(Infinity, 0, 0);

  // A tap on someone is for them; a tap anywhere else is where the companion should go.
  let tapped = false;
  const touchables: Touchable[] = creatures.map((c, i) => ({
    id: `creature-${i}`,
    object: c.root,
    offset: new THREE.Vector3(0, 0.4 * c.root.scale.y, 0),
    radius: Math.max(0.4, 0.4 * c.root.scale.y), // a finger, not the creature: most of them are small
    onTap: () => {
      tapped = true;
      residents.tapped(c);
    },
  }));
  touchables.push({
    id: 'companion',
    object: companion.root,
    offset: new THREE.Vector3(0, 0.25, 0),
    radius: 0.35,
    onTap: () => {
      tapped = true;
      companion.act('celebrate');
    },
  });

  const keys = new Keys(() => companion.jump());
  let keyed = false;
  let ctx: StageContext | null = null;
  let finger = false;
  const goTo = (x: number, z: number) => {
    const [ax, az] = ashore(x, z, BEACH);
    companion.want.at.set(ax, 0, az);
  };

  const home: Diorama & { debugSteer(x: number, z: number): void } = {
    name: 'home',
    palette,
    scene,
    touchables,
    reframing: true,
    framing(mode: LayoutMode): Framing {
      const z = look.z - AHEAD;
      return mode === 'tall'
        ? { center: new THREE.Vector3(look.x, y(look.x, z) + 0.5, z), width: 7.5, height: 11.5, elevation: 27, fov: 40 }
        : { center: new THREE.Vector3(look.x, y(look.x, z) + 0.8, z), width: 16, height: 9, elevation: 20, fov: 44 };
    },
    layout() {},
    enter(stage) {
      ctx = stage;
      keys.listen();
    },
    exit() {
      keys.stop();
    },
    pointer(phase, px, py) {
      if (phase === 'up') finger = false;
      else if (phase === 'down') finger = !tapped;
      tapped = false;
      if (!finger || !ctx) return;
      const spot = groundUnder(ctx.camera, ctx.size(), px, py, y);
      if (spot) goTo(spot.x, spot.z);
    },
    /** For the scripts: put the companion somewhere at once, and the camera with it. */
    debugSteer(x: number, z: number) {
      companion.place(...ashore(x, z, BEACH));
      look.copy(guide);
    },
    update(dt, camera) {
      viewer.copy(camera.position);
      t += dt;
      for (const a of arrivals) {
        if (a.at > 0 && t >= a.at) {
          a.at = -1;
          residents.free(a.c, a.x, a.z);
          sfx.sparkle();
        }
      }
      ship.update(dt, camera);
      if (arrivals.length && !told && t > arrivals[arrivals.length - 1].at + 3 && arrivals.every((a) => a.at < 0)) {
        told = true;
        companion.act('celebrate');
        plan.onWelcomed(plan.residents.length);
      }

      // With a key down it keeps going that way; let go, and it stops where it is.
      const heading = keys.heading();
      if (heading) goTo(guide.x + heading[0] * 1.5, guide.z + heading[1] * 1.5);
      else if (keyed) goTo(guide.x, guide.z);
      keyed = !!heading;
      companion.viewer.copy(camera.position);
      companion.update(dt);
      for (const [x, z, r, shade] of solid) {
        const far = Math.hypot(guide.x - x, guide.z - z);
        // In the air it clears anything low; a tree is still a tree.
        if (far >= r || far < 1e-3 || (companion.airborne && shade < TREE_SHADE)) continue;
        // Up against something: it slides round, and gives up if what it is after is inside.
        guide.x = x + ((guide.x - x) / far) * r;
        guide.z = z + ((guide.z - z) / far) * r;
        if (Math.hypot(companion.want.at.x - x, companion.want.at.z - z) < r) companion.want.at.set(guide.x, 0, guide.z);
      }
      // A tree between the camera and the companion would hide it, and a bush almost under the camera would fill
      // the picture: they sink into the ground until the companion has gone by.
      const under = camera.position.z - 1.15 * (camera.position.y - look.y);
      for (const { m, size, tall, blob, shade } of standing) {
        const s = ease(m.scale.x, m.position.z < (tall ? guide.z + IN_THE_WAY : under) ? size : 0, 9, dt);
        m.visible = s > 0.02;
        m.scale.setScalar(Math.max(s, 0.001));
        blob[2] = m.visible ? (shade * s) / size : 0;
      }
      look.x = ease(look.x, guide.x, 5, dt);
      look.z = ease(look.z, guide.z, 5, dt);
      residents.update(dt);

      // Everyone has a shadow first; then whatever stands nearest the companion, for as many as there is room for.
      const off = (s: Blob) => Math.hypot(s[0] - look.x, s[1] - (look.z - AHEAD));
      if (sortedAt.distanceTo(look) > 1) {
        sortedAt.copy(look);
        shadows.sort((a, b) => off(a) - off(b));
      }
      for (const s of shadows) {
        if (off(s) > SHADOWS_WITHIN) break;
        pushBlob(...s);
      }
    },
  };
  return home;
}
