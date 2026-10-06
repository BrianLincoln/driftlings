import * as THREE from 'three';

// Letters are the point of the game, so they never go through the 3D pipeline.
// Each glyph is a DOM element drawn by the browser at native resolution and
// pinned to a 3D anchor every frame. Render scale and quality tier cannot blur it.

export interface Glyph {
  el: HTMLElement;
  anchor: THREE.Object3D;
  /** Cap-to-descender height of the text in world units. */
  worldHeight: number;
  /** Extra scale and tilt, driven by the tile's springs so the letter moves with it. */
  scaleX: number;
  scaleY: number;
  tilt: number;
  fontPx: number;
  opacity: number;
}

const v = new THREE.Vector3();
const up = new THREE.Vector3();

export class GlyphLayer {
  private glyphs: Glyph[] = [];

  constructor(private root: HTMLElement) {}

  /** `html` is for icons (inline SVG sized in em); letters always go in as text. */
  add(text: string, anchor: THREE.Object3D, worldHeight: number, html = false): Glyph {
    const el = document.createElement('div');
    el.className = 'glyph';
    if (html) el.innerHTML = text;
    else el.textContent = text;
    this.root.appendChild(el);
    const g: Glyph = { el, anchor, worldHeight, scaleX: 1, scaleY: 1, tilt: 0, fontPx: 0, opacity: 1 };
    this.glyphs.push(g);
    return g;
  }

  remove(g: Glyph): void {
    g.el.remove();
    this.glyphs = this.glyphs.filter((x) => x !== g);
  }

  clear(): void {
    for (const g of this.glyphs) g.el.remove();
    this.glyphs = [];
  }

  /** Call after the camera is final for the frame, in the same animation frame as the render. */
  update(cam: THREE.PerspectiveCamera, cssW: number, cssH: number): void {
    up.setFromMatrixColumn(cam.matrixWorld, 1);
    for (const g of this.glyphs) {
      g.anchor.getWorldPosition(v);
      const top = v.clone().addScaledVector(up, g.worldHeight);
      v.project(cam);
      top.project(cam);
      const x = (v.x * 0.5 + 0.5) * cssW;
      const y = (-v.y * 0.5 + 0.5) * cssH;
      const px = Math.abs(top.y - v.y) * 0.5 * cssH;
      // Font size changes only on resize or camera moves; springs go through the transform.
      if (Math.abs(px - g.fontPx) > 0.25) {
        g.fontPx = px;
        g.el.style.fontSize = `${px.toFixed(2)}px`;
      }
      g.el.style.opacity = g.opacity.toFixed(2);
      g.el.style.transform =
        `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%) ` +
        `rotate(${g.tilt.toFixed(4)}rad) scale(${g.scaleX.toFixed(4)}, ${g.scaleY.toFixed(4)})`;
    }
  }
}
