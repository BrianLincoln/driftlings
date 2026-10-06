import * as THREE from 'three';
import type { ScenePalette } from './palette';

// Enough for a full menagerie. If this grows further, move to a shadow mask texture.
export const MAX_BLOBS = 64;

/** One shared uniform block, spread into every scene material. */
export const U = {
  uLightDir: { value: new THREE.Vector3(0.45, 0.8, 0.4).normalize() },
  uLightCol: { value: new THREE.Color() },
  uMidCol: { value: new THREE.Color() },
  uShadeCol: { value: new THREE.Color() },
  uBand1: { value: 0.22 },
  uBand2: { value: -0.12 },
  uTime: { value: 0 },
  /** Ground shadow blobs: x, z, radius, stretch along the light. */
  uBlobs: { value: Array.from({ length: MAX_BLOBS }, () => new THREE.Vector4(0, 0, 0, 1)) },
};

export function applyLightBands(p: ScenePalette): void {
  U.uLightCol.value.set(p.light);
  U.uMidCol.value.set(p.mid);
  U.uShadeCol.value.set(p.shade);
}

let blobCursor = 0;

export function beginBlobs(): void {
  blobCursor = 0;
}

/** Register a soft-edged-free shadow disc on the ground for this frame. */
export function pushBlob(x: number, z: number, radius: number, stretch = 1): void {
  if (blobCursor >= MAX_BLOBS) return;
  U.uBlobs.value[blobCursor++].set(x, z, radius, stretch);
}

export function endBlobs(): void {
  for (let i = blobCursor; i < MAX_BLOBS; i++) U.uBlobs.value[i].set(0, 0, 0, 1);
}
