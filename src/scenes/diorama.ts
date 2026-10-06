import * as THREE from 'three';
import type { ScenePalette } from '../gfx/palette';
import type { Framing, LayoutMode } from '../stage/framing';
import type { GlyphLayer } from '../stage/glyphs';
import type { Touchable } from '../stage/touch';

export interface StageContext {
  glyphs: GlyphLayer;
  camera: THREE.PerspectiveCamera;
  /** Current viewport size in CSS pixels. */
  size(): { width: number; height: number };
}

/** A small staged scene shown with a fixed camera. */
export interface Diorama {
  readonly name: string;
  readonly palette: ScenePalette;
  readonly scene: THREE.Scene;
  readonly touchables: Touchable[];
  /** If set, the scene is wider than the screen and a sideways drag pans it this far each way. */
  readonly panRange?: (mode: LayoutMode) => number;
  /** True while the stage box itself is moving: the stage re-aims the camera every frame. */
  readonly reframing?: boolean;
  /** The stage box for this viewport shape (see stage/framing.ts). */
  framing(mode: LayoutMode): Framing;
  /** Move actors for a tall or wide viewport. Called before framing is applied. */
  layout(mode: LayoutMode): void;
  /** Called when the scene becomes current. Create glyphs here. */
  enter(ctx: StageContext): void;
  update(dt: number, camera: THREE.PerspectiveCamera): void;
  /** Raw pointer positions in CSS pixels, for simple drags. Taps still arrive through touchables. */
  pointer?(phase: 'down' | 'move' | 'up', x: number, y: number): void;
  /** Called when the scene stops being current. */
  exit?(): void;
}
