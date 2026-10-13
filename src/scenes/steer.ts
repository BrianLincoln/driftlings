import * as THREE from 'three';

// Getting the companion about the home island: the arrow keys or W A S D, or a
// tap (or a held finger) on the ground where it should go. Space is a jump.

const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

/** Which way the keys held down say to go, and `jump` called when space goes down. */
export class Keys {
  private held = new Set<string>();
  private down = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') {
      if (!e.repeat) this.jump();
      return e.preventDefault();
    }
    if (!KEYS[e.code]) return;
    this.held.add(e.code);
    e.preventDefault();
  };
  private up = (e: KeyboardEvent) => void this.held.delete(e.code);
  private drop = () => this.held.clear();

  constructor(private jump: () => void) {}

  listen(): void {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.drop);
  }

  stop(): void {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.drop);
    this.held.clear();
  }

  /** [x, z] of length one: +x is to the right, -z is away up the screen. Null with nothing held. */
  heading(): [number, number] | null {
    let x = 0;
    let z = 0;
    for (const code of this.held) {
      x += KEYS[code][0];
      z += KEYS[code][1];
    }
    const len = Math.hypot(x, z);
    return len ? [x / len, z / len] : null;
  }
}

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const level = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** The spot on the ground under a point on the screen (CSS pixels), or null if that is sky. */
export function groundUnder(camera: THREE.Camera, size: { width: number; height: number }, px: number, py: number, y: (x: number, z: number) => number): THREE.Vector3 | null {
  ray.setFromCamera(ndc.set((px / size.width) * 2 - 1, 1 - (py / size.height) * 2), camera);
  const hit = new THREE.Vector3();
  // The ground is nearly flat: meet a level plane, then again at the height the ground has there.
  for (let pass = 0, h = 0.3; pass < 3; pass++) {
    level.constant = -h;
    if (!ray.ray.intersectPlane(level, hit)) return null;
    h = y(hit.x, hit.z);
  }
  return hit;
}
