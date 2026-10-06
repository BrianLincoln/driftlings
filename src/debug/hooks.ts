import type { Stage } from '../stage/stage';
import type { Quality } from '../gfx/post';

// Debug hooks for the screenshot loop and scripted play. Not for players.

export interface DebugHooks {
  ready: boolean;
  goto(name: string): Promise<void>;
  /** Pause the real-time loop and advance by hand at a fixed dt. */
  step(dt: number, frames?: number): void;
  pause(on: boolean): void;
  quality(q: Quality): void;
  targets(): Array<{ id: string; x: number; y: number; r: number }>;
  tap(id: string): boolean;
  info(): Record<string, unknown>;
}

declare global {
  interface Window {
    __dl: DebugHooks;
  }
}

export function installHooks(stage: Stage, goto: (name: string, instant?: boolean) => Promise<void>): DebugHooks {
  const hooks: DebugHooks = {
    ready: false,
    goto: (name) => goto(name, true),
    step(dt, frames = 1) {
      stage.paused = true;
      for (let i = 0; i < frames; i++) stage.step(dt);
    },
    pause(on) {
      stage.paused = on;
    },
    quality: (q) => stage.setQuality(q),
    targets: () => stage.targets(),
    tap(id) {
      const t = stage.targets().find((x) => x.id === id);
      return !!t && stage.tapAt(t.x, t.y) === id;
    },
    info: () => ({
      scene: stage.scene?.name,
      layout: stage.layoutMode,
      quality: stage.governor.quality,
      frames: stage.frames,
      dpr: window.devicePixelRatio,
      size: [window.innerWidth, window.innerHeight],
    }),
  };
  window.__dl = hooks;
  return hooks;
}
