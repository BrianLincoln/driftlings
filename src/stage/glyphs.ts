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
  /**
   * A flat disc in the scene (lying in its own XZ plane) that can come between this glyph and
   * the viewer. The DOM cannot be depth-tested, so the glyph is cut away where the disc shows.
   */
  cover: { at: THREE.Object3D; radius: number } | null;
  mask: string;
}

const v = new THREE.Vector3();
const up = new THREE.Vector3();
const c = new THREE.Vector3();
const side = new THREE.Vector3();
const normal = new THREE.Vector3();

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
    const g: Glyph = { el, anchor, worldHeight, scaleX: 1, scaleY: 1, tilt: 0, fontPx: 0, opacity: 1, cover: null, mask: '' };
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
      const mask = g.cover ? hole(g.cover, g, cam, x, y, cssW, cssH) : '';
      if (mask !== g.mask) {
        g.mask = mask;
        g.el.style.setProperty('-webkit-mask-image', mask || 'none');
        g.el.style.setProperty('mask-image', mask || 'none');
      }
      g.el.style.transform =
        `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%) ` +
        `rotate(${g.tilt.toFixed(4)}rad) scale(${g.scaleX.toFixed(4)}, ${g.scaleY.toFixed(4)})`;
    }
  }
}

/** The mask that cuts the cover's outline out of a glyph centred at (x, y), in the glyph's own unscaled pixels. */
function hole(cover: NonNullable<Glyph['cover']>, g: Glyph, cam: THREE.PerspectiveCamera, x: number, y: number, cssW: number, cssH: number): string {
  cover.at.getWorldPosition(c);
  side.setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(cover.radius).add(c).project(cam);
  // Seen at a slant the disc is an ellipse, squashed along the way it faces.
  normal.setFromMatrixColumn(cover.at.matrixWorld, 1).normalize();
  const facing = Math.abs(normal.dot(v.copy(cam.position).sub(c).normalize()));
  c.project(cam);
  // A little over, so the letter stops short of the ink line round the disc.
  const rx = Math.abs(side.x - c.x) * 0.5 * cssW * 1.06 + 1.5;
  const ry = rx * Math.max(0.05, facing);
  const dx = ((c.x * 0.5 + 0.5) * cssW - x) / g.scaleX;
  const dy = ((-c.y * 0.5 + 0.5) * cssH - y) / g.scaleY;
  return `radial-gradient(ellipse ${(rx / g.scaleX).toFixed(1)}px ${(ry / g.scaleY).toFixed(1)}px at calc(50% + ${dx.toFixed(1)}px) calc(50% + ${dy.toFixed(1)}px), transparent 97%, #000 100%)`;
}
