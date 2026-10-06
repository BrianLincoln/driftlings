import * as THREE from 'three';
import { PostChain, type Quality } from '../gfx/post';
import { U, applyLightBands, beginBlobs, endBlobs } from '../gfx/uniforms';
import { unlockAudio } from '../audio/sound';
import type { Diorama } from '../scenes/diorama';
import { applyFraming, layoutModeFor, type Insets, type LayoutMode } from './framing';
import { GlyphLayer } from './glyphs';
import { QualityGovernor, renderScale } from './quality';
import { pick, projectTargets } from './touch';

const MAX_DT = 1 / 20;

/** Owns the renderer, the camera, the frame loop, resize, and taps. */
export class Stage {
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200); // narrow: flat, storybook perspective
  readonly glyphs: GlyphLayer;
  readonly governor = new QualityGovernor();
  private renderer: THREE.WebGLRenderer;
  private post: PostChain;
  private current: Diorama | null = null;
  private mode: LayoutMode = 'wide';
  private cssW = 1;
  private cssH = 1;
  private last = 0;
  paused = false;
  frames = 0;

  constructor(canvas: HTMLCanvasElement, glyphRoot: HTMLElement, private veil: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    this.post = new PostChain(this.renderer);
    this.glyphs = new GlyphLayer(glyphRoot);

    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', (e) => {
      unlockAudio();
      this.tapAt(e.clientX, e.clientY);
    });
    this.resize();
    requestAnimationFrame((t) => this.loop(t));
  }

  get scene(): Diorama | null {
    return this.current;
  }

  get layoutMode(): LayoutMode {
    return this.mode;
  }

  setQuality(q: Quality, lock = true): void {
    this.governor.quality = q;
    this.governor.locked = lock;
    this.resize();
  }

  /** Swap scenes behind a soft veil so nothing ever flashes or pops. */
  async show(next: Diorama, instant = false): Promise<void> {
    if (!instant && this.current) {
      this.veil.classList.add('on');
      await new Promise((r) => setTimeout(r, 260));
    }
    this.glyphs.clear();
    this.current = next;
    applyLightBands(next.palette);
    this.post.setPalette(next.palette);
    this.veil.style.background = next.palette.skyHorizon;
    next.enter({ glyphs: this.glyphs });
    this.resize();
    // Draw once while still veiled so shaders compile out of sight.
    this.step(0);
    this.veil.classList.remove('on');
  }

  /** Screen-space targets, for tests and the debug overlay. */
  targets() {
    return this.current ? projectTargets(this.current.touchables, this.camera, this.cssW, this.cssH) : [];
  }

  tapAt(x: number, y: number): string | null {
    const s = this.current;
    if (!s) return null;
    const id = pick(this.targets(), x, y);
    if (id) s.touchables.find((t) => t.id === id)?.onTap();
    return id;
  }

  private insets(): Insets {
    // Room for the top bar, plus notches and home indicators.
    const cs = getComputedStyle(document.documentElement);
    const px = (name: string) => parseFloat(cs.getPropertyValue(name)) || 0;
    return {
      top: (px('--sat') + 58) / this.cssH,
      bottom: (px('--sab') + 10) / this.cssH,
      left: (px('--sal') + 8) / this.cssW,
      right: (px('--sar') + 8) / this.cssW,
    };
  }

  resize(): void {
    this.cssW = Math.max(1, window.innerWidth);
    this.cssH = Math.max(1, window.innerHeight);
    const scale = renderScale(window.devicePixelRatio || 1, this.cssW * this.cssH, this.governor.quality);
    this.renderer.setPixelRatio(scale);
    this.renderer.setSize(this.cssW, this.cssH, false);
    const w = Math.round(this.cssW * scale);
    const h = Math.round(this.cssH * scale);
    this.post.quality = this.governor.quality;
    this.post.setSize(w, h, scale);
    const aspect = this.cssW / this.cssH;
    this.mode = layoutModeFor(aspect);
    document.body.dataset.layout = this.mode;
    const s = this.current;
    if (!s) return;
    s.layout(this.mode);
    applyFraming(this.camera, s.framing(this.mode), aspect, this.insets());
    s.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (m?.uniforms?.uAspect) m.uniforms.uAspect.value = aspect;
    });
  }

  /** Advance and draw one frame. Exposed so tests can step at a fixed dt. */
  step(dt: number): void {
    const s = this.current;
    if (!s) return;
    U.uTime.value += dt;
    beginBlobs();
    s.update(dt, this.camera);
    endBlobs();
    this.post.render(s.scene, this.camera);
    this.glyphs.update(this.camera, this.cssW, this.cssH);
    this.frames++;
  }

  private loop(now: number): void {
    requestAnimationFrame((t) => this.loop(t));
    const real = this.last ? (now - this.last) / 1000 : 0;
    this.last = now;
    if (this.paused || document.hidden) return;
    if (this.governor.frame(real)) this.resize();
    this.step(Math.min(real, MAX_DT));
  }
}
