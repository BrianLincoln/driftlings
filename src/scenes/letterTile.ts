import * as THREE from 'three';
import { Spring, ease, squash } from '../cast/spring';
import type { Glyph, GlyphLayer } from '../stage/glyphs';
import { buildTile, type Tile } from './props';

// A letter tile as exercises use it: the 3D slab, its DOM glyph, and the small
// set of states and reactions that every exercise shares.

export const SPEAKER_ICON =
  '<svg viewBox="0 0 28 28" style="width:1em;height:1em;display:block" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11h4l6-5v16l-6-5H5z" fill="currentColor"/><path d="M19 10.5c1.6 1.8 1.6 5.2 0 7"/><path d="M22 7.500c3.200 3.600 3.200 9.400 0 13"/></svg>';

export class LetterTile {
  readonly root: THREE.Group;
  readonly anchor: THREE.Object3D;
  private tile: Tile;
  private glyph: Glyph;
  private sq = new Spring(1);
  private lean = new Spring(0);
  private pop = new Spring(0);
  private popTarget = 1;
  private pulse = Math.random() * 6;
  /** Where the tile should be; it eases there. */
  readonly goal = new THREE.Vector3();
  active = false;
  done = false;
  dim = false;
  gone = false;

  constructor(readonly text: string, private glyphs: GlyphLayer, readonly scale = 1, icon = false) {
    this.tile = buildTile();
    this.root = this.tile.root;
    this.anchor = this.tile.anchor;
    this.glyph = glyphs.add(text, this.anchor, 0.74 * scale, icon);
    this.root.scale.setScalar(0.001);
  }

  /** Place immediately, with no glide. */
  snap(p: THREE.Vector3): void {
    this.goal.copy(p);
    this.root.position.copy(p);
  }

  press(strength = 1): void {
    this.sq.kick(-4.5 * strength);
    this.lean.kick((Math.random() - 0.5) * 3);
  }

  hop(): void {
    this.sq.kick(5);
  }

  /** A gentle "not that one". */
  shake(): void {
    this.lean.kick(9);
  }

  /** Shrink away. The tile can be disposed once `gone`. */
  vanish(): void {
    this.popTarget = 0;
  }

  lean_back(rad: number): void {
    this.tile.slab.rotation.x = rad;
  }

  get radius(): number {
    return 0.52 * this.scale;
  }

  update(dt: number): void {
    this.pulse += dt;
    this.root.position.x = ease(this.root.position.x, this.goal.x, 9, dt);
    this.root.position.y = ease(this.root.position.y, this.goal.y, 9, dt);
    this.root.position.z = ease(this.root.position.z, this.goal.z, 9, dt);
    const pop = Math.max(0.001, this.pop.step(this.popTarget, 170, this.popTarget ? 15 : 26, dt));
    if (this.popTarget === 0 && pop < 0.03) this.gone = true;
    this.root.scale.setScalar(pop * this.scale);
    const sy = this.sq.step(1, 220, 13, dt);
    squash(this.tile.slab, sy);
    this.tile.slab.rotation.z = this.lean.step(0, 140, 10, dt) * 0.05;
    this.tile.halo.visible = this.active && !this.dim;
    this.tile.halo.scale.setScalar(1 + 0.012 * Math.sin(this.pulse * 3.2));
    this.tile.mat.uniforms.uGlint.value = this.active && !this.dim ? 0.6 : 0;
    this.tile.mat.uniforms.uTint.value.setScalar(ease(this.tile.mat.uniforms.uTint.value.r, this.dim ? 0.72 : 1, 10, dt));
    const g = this.glyph;
    g.scaleY = sy * pop;
    g.scaleX = pop / Math.sqrt(Math.max(0.4, sy));
    g.tilt = -this.tile.slab.rotation.z;
    g.opacity = ease(g.opacity, this.dim ? 0.3 : 1, 10, dt);
    g.el.classList.toggle('done', this.done);
  }

  dispose(): void {
    this.glyphs.remove(this.glyph);
    this.root.removeFromParent();
  }
}
