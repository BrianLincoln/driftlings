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
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.5, 700); // narrow: flat, storybook perspective
  readonly glyphs: GlyphLayer;
  readonly governor = new QualityGovernor();
  private renderer: THREE.WebGLRenderer;
  private post: PostChain;
  private current: Diorama | null = null;
  private mode: LayoutMode = 'wide';
  private cssW = 1;
  private cssH = 1;
  private last = 0;
  private pan = 0;
  private panGoal = 0;
  private panVel = 0;
  private drag: { id: number; x: number; y: number; lastX: number; moved: boolean } | null = null;
  private held: number | null = null;
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
    this.bindPointer(canvas);
    this.resize();
    requestAnimationFrame((t) => this.loop(t));
  }

  // Tap, or drag sideways to pan a wide scene. Nothing else.
  private bindPointer(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', (e) => {
      unlockAudio();
      const range = this.panLimit();
      if (range <= 0) {
        this.tapAt(e.clientX, e.clientY); // nothing to pan: respond on touch-down
        canvas.setPointerCapture(e.pointerId);
        this.held = e.pointerId;
        this.current?.pointer?.('down', e.clientX, e.clientY);
        return;
      }
      canvas.setPointerCapture(e.pointerId);
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, moved: false };
      this.panVel = 0;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.held === e.pointerId) this.current?.pointer?.('move', e.clientX, e.clientY);
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) d.moved = true;
      if (d.moved) {
        const dx = (e.clientX - d.lastX) * this.worldPerPx();
        this.panGoal = THREE.MathUtils.clamp(this.panGoal - dx, -this.panLimit(), this.panLimit());
        this.panVel = -dx;
      }
      d.lastX = e.clientX;
    });
    const end = (e: PointerEvent) => {
      if (this.held === e.pointerId) {
        this.held = null;
        this.current?.pointer?.('up', e.clientX, e.clientY);
      }
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (!d.moved && e.type === 'pointerup') this.tapAt(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  private panLimit(): number {
    return this.current?.panRange?.(this.mode) ?? 0;
  }

  /** World units across the stage box per CSS pixel, at the box's depth. */
  private worldPerPx(): number {
    const s = this.current;
    if (!s) return 0;
    const d = this.camera.position.distanceTo(s.framing(this.mode).center);
    return (2 * d * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / this.cssH;
  }

  /** Aim the camera for the current scene, layout and pan. */
  private frame(): void {
    const s = this.current;
    if (!s) return;
    const aspect = this.cssW / this.cssH;
    const f = s.framing(this.mode);
    f.center = f.center.clone();
    f.center.x += this.pan;
    applyFraming(this.camera, f, aspect, this.insets());
    // Where the horizon falls on screen, for the sky backdrop.
    const horizon = 0.5 + 0.5 * (Math.tan(THREE.MathUtils.degToRad(f.elevation)) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    s.scene.traverse((o) => {
      const u = ((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms;
      if (u?.uAspect) u.uAspect.value = aspect;
      if (u?.uHorizon) u.uHorizon.value = horizon;
    });
  }

  panTo(x: number): void {
    this.pan = this.panGoal = THREE.MathUtils.clamp(x, -this.panLimit(), this.panLimit());
    this.frame();
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
    this.current?.exit?.();
    this.glyphs.clear();
    this.current = next;
    this.pan = this.panGoal = this.panVel = 0;
    applyLightBands(next.palette);
    this.post.setPalette(next.palette);
    this.veil.style.background = next.palette.skyHorizon;
    next.enter({ glyphs: this.glyphs, camera: this.camera, size: () => ({ width: this.cssW, height: this.cssH }) });
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
    this.mode = layoutModeFor(this.cssW / this.cssH);
    document.body.dataset.layout = this.mode;
    const s = this.current;
    if (!s) return;
    s.layout(this.mode);
    this.panGoal = THREE.MathUtils.clamp(this.panGoal, -this.panLimit(), this.panLimit());
    this.frame();
  }

  /** Advance and draw one frame. Exposed so tests can step at a fixed dt. */
  step(dt: number): void {
    const s = this.current;
    if (!s) return;
    U.uTime.value += dt;
    if (!this.drag && Math.abs(this.panVel) > 1e-4) {
      // A flick carries on a little, then settles.
      this.panGoal = THREE.MathUtils.clamp(this.panGoal + this.panVel, -this.panLimit(), this.panLimit());
      this.panVel *= Math.exp(-6 * dt);
    }
    if (Math.abs(this.panGoal - this.pan) > 1e-4) {
      this.pan += (this.panGoal - this.pan) * (1 - Math.exp(-18 * dt));
      this.frame();
    }
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
