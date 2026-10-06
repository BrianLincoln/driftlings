import * as THREE from 'three';
import type { ScenePalette } from '../gfx/palette';
import type { Framing, LayoutMode } from '../stage/framing';
import type { GlyphLayer } from '../stage/glyphs';
import type { Touchable } from '../stage/touch';

/** A small staged scene shown with a fixed camera. */
export interface Diorama {
  readonly name: string;
  readonly palette: ScenePalette;
  readonly scene: THREE.Scene;
  readonly touchables: Touchable[];
  /** If set, the scene is wider than the screen and a sideways drag pans it this far each way. */
  readonly panRange?: (mode: LayoutMode) => number;
  /** The stage box for this viewport shape (see stage/framing.ts). */
  framing(mode: LayoutMode): Framing;
  /** Move actors for a tall or wide viewport. Called before framing is applied. */
  layout(mode: LayoutMode): void;
  /** Called when the scene becomes current. Create glyphs here. */
  enter(ctx: { glyphs: GlyphLayer }): void;
  update(dt: number, camera: THREE.PerspectiveCamera): void;
}
