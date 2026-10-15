import * as THREE from 'three';
import { C } from '../gfx/palette';
import { buildIsland, buildWater, islandHeight } from '../gfx/ground';
import { buildSky } from '../gfx/sky';
import { ellipsoid, place } from '../gfx/geo';
import { pushBlob } from '../gfx/uniforms';
import { sfx } from '../audio/sound';
import { Creature } from '../cast/creature';
import { Companion } from '../cast/companion';
import { Spring } from '../cast/spring';
import type { BigOne } from '../game/areas';
import type { Framing, LayoutMode } from '../stage/framing';
import type { Touchable } from '../stage/touch';
import type { Diorama, StageContext } from './diorama';
import { LetterTile } from './letterTile';
import { PROP_MAT, buildFarIsles, buildTile } from './props';
import { SEAL_RADIUS } from './chartMarks';
import { buildSpots, stoneAt, type MapNode, type Spot } from './mapStones';
import type { Place } from './places';
import type { Blocker } from './detour';
import { Ship } from './ship';
import { Raft } from './raft';
import { Blockade } from './blockade';
import { MapCut } from './mapCut';

// One area of an island: a short path of stepping stones leading to the ship
// moored off the far shore. The current stone glows and locked ones are
// visible but greyed, so the child can see what is coming. Whoever has been
// woken waits aboard. The big one who lives here keeps to one side (asleep,
// watching, pacing: see game/areas.ts) until the last of them is aboard and the
// companion sets off to join them; then it bounds
// over and takes the plank away (blockade.ts, mapCut.ts) and its stone
// appears: nobody leaves until it has been won over.

export type { MapNode } from './mapStones';

export interface AreaMapPlan {
  nodes: MapNode[];
  /** Which island this is. */
  place: Place;
  /** The big one who lives here, and gets in the way at the end. */
  big: BigOne;
  /** A node finished a moment ago: its creature greets you. */
  fresh: string | null;
  /** True once the creatures have gone home: the stones stay, the camp is empty. */
  campEmpty: boolean;
  /** Set when the sleeper has just been won over: it lays the plank back, everyone boards, then this is called. */
  sailed?: () => void;
  onNode(id: string): void;
}

export function createAreaMap(plan: AreaMapPlan): Diorama {
  const scene = new THREE.Scene();
  const where = plan.place;
  const palette = where.palette;
  const y = (x: number, z: number) => islandHeight(where.shape, x, z);
  const prop = PROP_MAT();
  scene.add(buildSky(palette), buildWater(palette, where.shape), buildIsland(where.shape));
  scene.add(buildFarIsles(palette.water, where.far));

  const scenery = where.scenery().map((s) => ({ ...s, mesh: new THREE.Mesh(s.geo, prop) }));
  for (const s of scenery) scene.add(s.mesh);
  const pebbleGeo = place(ellipsoid(0.13, 0.06, 0.11, C.path, 10), [0, 0.03, 0]);
  const spots = buildSpots(plan.nodes, plan.campEmpty ? null : plan.fresh, scene);

  // The raft is there for as long as there is someone big still to take home.
  const ship = new Ship(plan.campEmpty ? null : new Raft());
  scene.add(ship.root, ship.plank);
  if (ship.raft) scene.add(ship.raft.root, ship.raft.rope);
  if (!plan.campEmpty) {
    for (const node of plan.nodes) {
      if (!node.rescue || node.state !== 'done' || node.id === plan.fresh) continue;
      const rider = new Creature(node.rescue);
      scene.add(rider.root);
      ship.seat(rider);
    }
  }
  const newcomer = spots.find((s) => s.creature) ?? null;
  const boss = spots.find((s) => s.node.boss) ?? null;
  const lastOne = boss?.node.state === 'current' && !!plan.fresh;
  const little = plan.nodes.filter((n) => !n.boss);
  const woken = little.filter((n) => n.state === 'done').length / Math.max(1, little.length);
  const sleeper = new Blockade(plan.big, plan.campEmpty ? 'gone' : boss?.node.state === 'locked' || lastOne ? 'beside' : 'across', !plan.sailed, woken);
  scene.add(sleeper.root);
  /** The sleeper's stone is only there while the sleeper is, or has been, in the way. */
  const stoneOut = () => boss?.node.state === 'done' || sleeper.inTheWay;
  const pop = new Spring(stoneOut() ? 1 : 0);

  const pebbles = Array.from({ length: (spots.length - 1) * 3 }, () => {
    const m = new THREE.Mesh(pebbleGeo, prop);
    scene.add(m);
    return m;
  });

  const companion = new Companion();
  companion.groundY = y;
  scene.add(companion.root);

  let mode: LayoutMode = 'wide';
  let t = 0;
  let greeted = false;
  let boarded = false;
  let peeked = false;
  const current = spots.find((s) => s.node.state === 'current') ?? null;
  const target = new THREE.Vector3();

  /** Everything on the island a creature on foot has to go round. */
  const inTheWay = (): Blocker[] => {
    const at = (o: THREE.Object3D, r: number, dz = 0): Blocker => ({ x: o.position.x, z: o.position.z + dz, r });
    const out = scenery.map((s) => at(s.mesh, s.r > 0.9 ? 0.45 : s.r + 0.2)); // a tree is only its trunk
    for (const s of spots) if (!s.node.boss || stoneOut()) out.push(at(s.group, s.node.boss ? 1.2 : 0.8));
    out.push(sleeper.blocker, at(companion.root, 0.45));
    return out;
  };

  const position = (i: number): [number, number] => {
    if (spots[i].node.boss) return [sleeper.stone.x, sleeper.stone.z];
    return stoneAt(where, mode, i, spots.length);
  };

  /** Where the companion stands beside a stone, and what it points at there. */
  const beside = (s: Spot): THREE.Vector3 => {
    const p = s.group.position;
    target.set(p.x, p.y + 0.3, p.z);
    return new THREE.Vector3(p.x + (p.x > 0 ? -1 : 1) * 0.95, 0, p.z + 0.35);
  };

  /** Tell the companion where to be for the moment the map is in. */
  const direct = () => {
    const w = companion.want;
    if (current) {
      w.at.copy(beside(current));
      w.face = target;
      w.pose = 'point';
    } else {
      w.at.set(0, 0, 2.2);
      w.pose = 'settled';
    }
  };

  const cut = new MapCut({
    companion,
    sleeper,
    ship,
    ground: y,
    // Where nothing stands between it and the camera: in front of the last stone, or on its outer side
    // on a tall screen, where the next stone's letter tile is in front.
    waitAt() {
      const p = newcomer!.group.position;
      return mode === 'tall' ? new THREE.Vector3(p.x + (p.x > 0 ? 1 : -1) * 0.95, 0, p.z + 0.35) : new THREE.Vector3(p.x, 0, p.z + 0.95);
    },
    stoneSide: () => beside(boss!),
    blockers: inTheWay,
    over() {
      direct();
      companion.nudge();
    },
    sailed: () => plan.sailed?.(),
  }, lastOne && newcomer ? 'plank' : plan.sailed && boss ? 'friends' : null);

  const touchables: Touchable[] = spots.map((s) => ({
    id: `node:${s.node.id}`,
    object: s.group,
    offset: new THREE.Vector3(0, 0.35, 0),
    radius: 0.8,
    onTap: () => {
      if (s.node.boss && !stoneOut()) return;
      s.wobble.kick(5);
      if (s.node.state === 'locked') {
        // Not yet: the stone wobbles and the companion calls you back to the glowing one.
        sfx.oops();
        companion.nudge();
        companion.act('greet');
      } else {
        sfx.pop();
        plan.onNode(s.node.id);
      }
    },
  }));

  return {
    name: 'map',
    palette,
    scene,
    touchables,
    get reframing() {
      return cut.reframing;
    },
    framing(m: LayoutMode): Framing {
      return cut.frame(m === 'tall'
        ? { center: new THREE.Vector3(0, 0.7, -0.2), width: 4.4, height: 7.4, elevation: 32, fov: 34 }
        : { center: new THREE.Vector3(0, 0.9, -0.2), width: 11.6, height: 5.4, elevation: 20 });
    },
    layout(m) {
      mode = m;
      for (const s of scenery) {
        const [x, z] = s[m];
        s.mesh.position.set(x, y(x, z) - 0.04, z);
      }
      ship.moor(m === 'tall' ? 0.5 : 0.1, m === 'tall' ? -11.6 : -10.6, m === 'tall' ? -0.75 : -0.4, y);
      sleeper.moor(ship.shore, m, y, where.bigSide);
      spots.forEach((s, i) => {
        const [x, z] = position(i);
        s.group.position.set(x, y(x, z) - 0.02, z);
        s.tile?.snap(new THREE.Vector3(x, y(x, z - 0.5) + 0.1, z - 0.5));
        s.tile?.lean_back(m === 'tall' ? -0.45 : -0.25);
        if (s.creature && !(boarded && s === newcomer)) {
          s.creature.groundY = y;
          // Whoever stands by a stone stands on its inner side, so nothing falls off a narrow screen.
          const inward = x > 0 ? -1 : 1;
          s.creature.place(x + inward * 0.85, z + 0.15, inward * 0.3);
        }
        if (i > 0) {
          const [px, pz] = position(i - 1);
          for (let k = 0; k < 3; k++) {
            const f = (k + 1) / 4;
            const bx = px + (x - px) * f + Math.sin((i * 3 + k) * 2.4) * 0.12;
            const bz = pz + (z - pz) * f + Math.cos((i * 3 + k) * 1.7) * 0.12;
            pebbles[(i - 1) * 3 + k].position.set(bx, y(bx, bz), bz);
          }
        }
      });
      cut.pose();
      if (!cut.playing) direct();
      companion.place(companion.want.at.x, companion.want.at.z);
    },
    enter(ctx: StageContext) {
      sleeper.enter(ctx.glyphs);
      for (const s of spots) {
        if (!s.node.label) continue;
        s.tile = new LetterTile(s.node.label, ctx.glyphs, s.node.label.length > 1 ? 0.5 : 0.58, false, buildTile(s.node.byHeart));
        s.tile.dim = s.node.state === 'locked';
        s.tile.done = s.node.state === 'done';
        // The seal is drawn in the scene and the letter over it, so from low down the letter would show through.
        if (s.mark) s.tile.behind(s.mark, SEAL_RADIUS * s.mark.scale.x);
        scene.add(s.tile.root);
      }
    },
    update(dt, camera) {
      t += dt;
      for (const s of scenery) pushBlob(s.mesh.position.x, s.mesh.position.z, s.r, 1.4);
      if (boss) {
        boss.group.scale.setScalar(Math.max(0.001, pop.step(stoneOut() ? 1 : 0, 170, 13, dt)));
        boss.group.visible = pop.x > 0.02;
      }
      for (const s of spots) {
        if (s.group.visible) pushBlob(s.group.position.x, s.group.position.z, s.node.boss ? 0.95 : 0.66, 1.1);
        s.group.rotation.z = s.wobble.step(0, 150, 9, dt) * 0.04;
        if (s.ring) s.ring.scale.setScalar((s.node.boss ? 1.5 : 1) * (1 + 0.05 * Math.sin(t * 3.2)));
        s.tile?.update(dt);
        if (s.creature && !(boarded && s === newcomer)) {
          s.creature.lookTarget = camera.position;
          s.creature.update(dt);
        }
      }
      // The one just woken says hello from its stone, then jumps aboard.
      if (newcomer && !boarded && t > 1.7) {
        boarded = true;
        ship.board(newcomer.creature!, y, inTheWay());
      }
      if (newcomer && boarded && !peeked && t > 2.3) {
        peeked = true;
        sleeper.peek(newcomer.creature!.root.position);
      }
      ship.update(dt * cut.pace, camera);
      cut.update(dt, boarded && ship.settled);
      sleeper.update(dt * cut.pace, camera);

      if (plan.fresh && !greeted && t > 0.7) {
        greeted = true;
        const s = spots.find((x) => x.node.id === plan.fresh);
        s?.creature?.react();
        sfx.sparkle();
      }
      companion.viewer.copy(camera.position);
      companion.update(dt);
    },
  };
}
