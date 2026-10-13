import * as THREE from 'three';
import { hush, say, sayLine } from '../audio/narrate';
import type { Companion } from '../cast/companion';
import type { Creature } from '../cast/creature';
import type { ExerciseKit } from '../exercises/contract';
import { C, type ScenePalette } from '../gfx/palette';
import { pushBlob } from '../gfx/uniforms';
import type { LayoutMode } from '../stage/framing';
import type { StageContext } from './diorama';
import type { Dust } from './dust';
import { LetterTile } from './letterTile';
import { TILE, buildCard, buildTile } from './props';
import { Crossing } from './stream';
import { Thing } from './things';

// What the exercise host lends an exercise (exercises/contract.ts): tiles, things and a stream to stage
// its items with, places in the clearing to put them, the narrator, and the reactions of whoever is there.
// The kit keeps what it hands out: it animates each thing and clears it away once it has gone.

export interface KitHost {
  scene: THREE.Scene;
  prop: THREE.Material;
  palette: ScenePalette;
  companion: Companion;
  guest: Creature;
  dust: Dust;
  /** The height of the clearing's ground. */
  ground(x: number, z: number): number;
  mode(): LayoutMode;
  ctx(): StageContext;
}

export function buildKit(host: KitHost): { kit: ExerciseKit; layout(mode: LayoutMode): void; update(dt: number): void } {
  const { scene, companion, guest, dust, ground: y } = host;
  const tiles: LetterTile[] = [];
  const things: Thing[] = [];
  const crossings: Crossing[] = [];
  const v = new THREE.Vector3();
  const lean = (mode: LayoutMode) => (mode === 'tall' ? -0.2 : -0.1);

  const stand = (t: LetterTile) => {
    t.lean_back(lean(host.mode()));
    scene.add(t.root);
    tiles.push(t);
    return t;
  };
  /** Where a spot on the ground, `x` across at depth `z`, falls on screen: -1 at the left edge, 1 at the right. */
  const across = (x: number, z: number) => v.set(x, y(x, z), z).project(host.ctx().camera).x;
  // On a stepping stone the companion stands on the stone.
  companion.groundY = (x, z) => y(x, z) + crossings.reduce((up, c) => Math.max(up, c.lift(x, z)), 0);

  const kit: ExerciseKit = {
    get mode() { return host.mode(); },
    companion,
    tile: (text, scale = 1, icon = false, heart = false) => stand(new LetterTile(text, host.ctx().glyphs, scale, icon, buildTile(heart))),
    card: (text, hue, scale = 1) => stand(new LetterTile(text, host.ctx().glyphs, scale, false, buildCard(C.cards[Math.abs(hue) % C.cards.length]))),
    thing(name) {
      const thing = new Thing(name, host.prop);
      scene.add(thing.root);
      things.push(thing);
      return thing;
    },
    crossing(stones) {
      const c = new Crossing(stones, host.prop, host.palette, y);
      c.layout(host.mode());
      scene.add(c.root);
      crossings.push(c);
      return c;
    },
    at: (x, z) => new THREE.Vector3(x, y(x, z), z),
    spot(row, index, count) {
      const mode = host.mode();
      const z = row === 'tiles' ? 1.2 : 2.75;
      const gap = row === 'tiles' ? Math.min(1.14, (mode === 'tall' ? 3.5 : 6) / count) : (mode === 'tall' ? 1.05 : 1.2);
      const x = (index - (count - 1) / 2) * gap;
      return new THREE.Vector3(x, y(x, z), z);
    },
    fit(count) {
      // A tile is 1.14 from the next at full size; the row may be as wide as the stage box less a margin.
      const room = host.mode() === 'tall' ? 3.6 : 6.4;
      return Math.min(1, room / (TILE.width + (count - 1) * 1.14));
    },
    sideSpot: () => (host.mode() === 'tall' ? new THREE.Vector3(-1.35, 0, 3.75) : new THREE.Vector3(-2.9, 0, 2.0)),
    besideSpot(tile) {
      const x = tile.goal.x;
      const tall = host.mode() === 'tall';
      // Low and to the left of the tile, clear of its letter.
      const reach = 0.5 * tile.scale;
      return new THREE.Vector3(tall ? x * 0.72 - reach * 0.9 : x - reach - 0.1, 0, tall ? 2.3 : 1.95);
    },
    screenX(tile) {
      tile.anchor.getWorldPosition(v).project(host.ctx().camera);
      return (v.x * 0.5 + 0.5) * host.ctx().size().width;
    },
    aim(xPx, z) {
      // The camera looks straight down the clearing, so across the screen is across the ground.
      const [a, b] = [across(-1, z), across(1, z)];
      return -1 + (2 * ((xPx / host.ctx().size().width) * 2 - 1 - a)) / (b - a);
    },
    ceiling(z) {
      const camera = host.ctx().camera;
      const o = camera.position;
      v.set(0, 1, 0.5).unproject(camera).sub(o);
      return o.y + (v.y * (z - o.z)) / v.z;
    },
    say,
    line: sayLine,
    hush,
    cheer() {
      guest.react();
      companion.act('celebrate');
    },
    nod: () => guest.nod(),
    trouble() {
      // Down off the rock, over the letters, round and round on top of them in a cloud of dust, and back up.
      const z = 2.0;
      let landed = false;
      const { lands, clear } = guest.whirl(new THREE.Vector3(0, y(0, z), z), () => {
        dust.burst(guest.root.position, landed ? 6 : 12, 0.3 * guest.root.scale.x);
        landed = true;
      });
      return { lands: lands + 0.15, clear };
    },
  };

  return {
    kit,
    layout(mode) {
      for (const t of tiles) t.lean_back(lean(mode));
      for (const c of crossings) c.layout(mode);
    },
    update(dt) {
      for (let i = tiles.length - 1; i >= 0; i--) {
        const t = tiles[i];
        t.update(dt);
        if (t.gone) {
          t.dispose();
          tiles.splice(i, 1);
        } else if (t.root.scale.x > 0.5) pushBlob(t.root.position.x, t.root.position.z, 0.5 * t.scale, 1.15);
      }
      for (let i = things.length - 1; i >= 0; i--) {
        const th = things[i];
        th.update(dt);
        if (th.gone) {
          scene.remove(th.root);
          things.splice(i, 1);
        } else if (th.root.scale.x > 0.5) pushBlob(th.root.position.x, th.root.position.z, 0.34, 1.1);
      }
      for (let i = crossings.length - 1; i >= 0; i--) {
        crossings[i].update(dt);
        if (crossings[i].gone) crossings.splice(i, 1)[0].dispose();
      }
    },
  };
}
