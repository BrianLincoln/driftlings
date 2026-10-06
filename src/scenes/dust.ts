import * as THREE from 'three';
import { TAG } from '../gfx/glsl';
import { puff } from '../gfx/geo';
import { toonMaterial } from '../gfx/materials';
import { C } from '../gfx/palette';

// Kicked-up dust: a small pool of lumpy sand-coloured puffs that fly outward
// from a spot on the ground, swell, and shrink away. Solid toon shapes like
// everything else, so the ink line draws them as little clouds. They keep
// their colour through the grade, or pale dust on pale grass does not read.

const LIFE = 0.7;

interface Puff {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  size: number;
}

export class Dust {
  readonly root = new THREE.Group();
  private puffs: Puff[] = [];
  private next = 0;

  constructor(count = 48) {
    const mat = toonMaterial({ tag: TAG.prop, flag: -1, unlit: 0.4 });
    const geos = [0, 1, 2].map((i) => puff(0.3, C.sand, 40 + i, 0.3, 12));
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geos[i % geos.length], mat);
      mesh.visible = false;
      this.root.add(mesh);
      this.puffs.push({ mesh, vel: new THREE.Vector3(), age: LIFE, size: 1 });
    }
  }

  /** Throw `count` puffs out in a ring `radius` wide around a point on the ground. */
  burst(at: THREE.Vector3, count: number, radius: number): void {
    const turn = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const p = this.puffs[this.next];
      this.next = (this.next + 1) % this.puffs.length;
      const a = turn + (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 1.6 + Math.random() * 1.4;
      p.mesh.position.set(at.x + Math.sin(a) * radius, at.y + 0.08, at.z + Math.cos(a) * radius);
      p.mesh.rotation.y = Math.random() * 6.28;
      p.vel.set(Math.sin(a) * speed, 0.7 + Math.random() * 0.9, Math.cos(a) * speed);
      p.age = 0;
      p.size = 0.8 + Math.random() * 0.9;
      p.mesh.visible = true;
    }
  }

  update(dt: number): void {
    for (const p of this.puffs) {
      if (p.age >= LIFE) continue;
      p.age += dt;
      const k = p.age / LIFE;
      if (k >= 1) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(Math.exp(-5 * dt));
      // Swell fast, then thin out.
      p.mesh.scale.setScalar(p.size * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8) + 0.001);
    }
  }
}
