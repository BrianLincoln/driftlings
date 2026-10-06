import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Code-built geometry helpers. Everything ends up non-indexed with position,
// normal and a flat vertex colour, so any parts can be merged into one mesh.

type Paint = THREE.ColorRepresentation | ((p: THREE.Vector3, n: THREE.Vector3) => THREE.ColorRepresentation);

const tmpC = new THREE.Color();
const tmpP = new THREE.Vector3();
const tmpN = new THREE.Vector3();

export function paint(src: THREE.BufferGeometry, color: Paint): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src;
  g.deleteAttribute('uv');
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    if (typeof color === 'function') {
      tmpP.fromBufferAttribute(pos, i);
      tmpN.fromBufferAttribute(nor, i);
      tmpC.set(color(tmpP, tmpN));
    } else tmpC.set(color);
    col[i * 3] = tmpC.r;
    col[i * 3 + 1] = tmpC.g;
    col[i * 3 + 2] = tmpC.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function ellipsoid(rx: number, ry: number, rz: number, color: Paint, seg = 28): THREE.BufferGeometry {
  // Paint on the unit sphere so colour functions see directions, then scale.
  const g = paint(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), color);
  g.scale(rx, ry, rz);
  fixNormalsAfterScale(g, rx, ry, rz);
  return g;
}

function fixNormalsAfterScale(g: THREE.BufferGeometry, sx: number, sy: number, sz: number): void {
  const nor = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < nor.count; i++) {
    tmpN.set(nor.getX(i) / sx, nor.getY(i) / sy, nor.getZ(i) / sz).normalize();
    nor.setXYZ(i, tmpN.x, tmpN.y, tmpN.z);
  }
}

/** A lathe through a smooth curve fitted to [radius, y] pairs. */
export function lathe(profile: Array<[number, number]>, color: Paint, seg = 40, steps = 28): THREE.BufferGeometry {
  const curve = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y)));
  const pts = curve.getPoints(steps).map((p) => new THREE.Vector2(Math.max(p.x, 0.0001), p.y));
  // Weld the seam and recompute normals, or the light band shows a stitch line down it.
  const raw = new THREE.LatheGeometry(pts, seg);
  raw.deleteAttribute('uv');
  raw.deleteAttribute('normal');
  const welded = mergeVertices(raw, 1e-4);
  welded.computeVertexNormals();
  return paint(welded, color);
}

export function capsule(radius: number, length: number, color: Paint): THREE.BufferGeometry {
  return paint(new THREE.CapsuleGeometry(radius, length, 8, 20), color);
}

export function place(
  g: THREE.BufferGeometry,
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(1, 1, 1),
  );
  return g.applyMatrix4(m);
}

export function merge(...parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('merge: incompatible geometries');
  g.computeBoundingSphere();
  return g;
}

/** Deterministic 0..1 hash, so built scenery is identical on every load. */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * A lumpy rounded blob that keeps the undisplaced sphere's normals, so only the
 * silhouette is lumpy and the light band stays one clean curve.
 */
export function puff(radius: number, color: Paint, seed: number, lump = 0.14, seg = 30): THREE.BufferGeometry {
  const g = paint(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), color);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const a = 3 + Math.floor(hash(seed) * 3);
  const b = 2 + Math.floor(hash(seed + 1) * 3);
  const ph = hash(seed + 2) * 6.28;
  for (let i = 0; i < pos.count; i++) {
    tmpP.fromBufferAttribute(pos, i);
    const yaw = Math.atan2(tmpP.x, tmpP.z);
    const k = 1 + lump * Math.abs(Math.sin(yaw * a * 0.5 + ph)) * Math.abs(Math.cos(tmpP.y * b + ph)) - lump * 0.5;
    const flat = tmpP.y < -0.45 ? 0.75 : 1; // flattened underside
    pos.setXYZ(i, tmpP.x * k * radius, tmpP.y * k * radius * flat, tmpP.z * k * radius);
  }
  return g;
}
