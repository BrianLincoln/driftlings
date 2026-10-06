import * as THREE from 'three';
import { U, MAX_BLOBS } from './uniforms';
import { TAG, TOON, WRITE_G, COMMON_VERT } from './glsl';
import { C, type ScenePalette } from './palette';
import { paint } from './geo';

export interface IslandShape {
  radius: number;
  /** Height of the mound at the centre. */
  rise: number;
  /** Width of the sand rim. */
  sand: number;
  seed: number;
}

export function shoreRadius(s: IslandShape, angle: number): number {
  return s.radius * (1 + 0.06 * Math.sin(angle * 3 + s.seed) + 0.035 * Math.sin(angle * 7 + s.seed * 2.3));
}

export function islandHeight(s: IslandShape, x: number, z: number): number {
  const r = Math.hypot(x, z) / shoreRadius(s, Math.atan2(x, z));
  if (r >= 1) return -0.35;
  const t = 1 - r * r;
  return s.rise * t * t + 0.22 * Math.min(1, (1 - r) * 6) - 0.22;
}

/** A small island: a disc with a gentle mound, grass in the middle, a sand rim. */
export function buildIsland(s: IslandShape): THREE.Mesh {
  const rings = 26;
  const segs = 72;
  // A ring grid rather than a fan, so the mound is smooth.
  const grid = new THREE.RingGeometry(0.001, 1.08, segs, rings);
  grid.rotateX(-Math.PI / 2);
  const pos = grid.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const a = Math.atan2(x, z);
    const k = shoreRadius(s, a);
    pos.setXYZ(i, x * k, islandHeight(s, x * k, z * k), z * k);
  }
  grid.computeVertexNormals();
  const geo = paint(grid, '#ffffff');
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexColors: true,
    uniforms: {
      ...U,
      uGrass: { value: new THREE.Color(C.grass) },
      uGrassDark: { value: new THREE.Color(C.grassDark) },
      uSand: { value: new THREE.Color(C.sand) },
      uShape: { value: new THREE.Vector3(s.radius, s.seed, 1 - s.sand / s.radius) },
    },
    vertexShader: COMMON_VERT,
    fragmentShader: /* glsl */ `
in vec3 vN;
in vec3 vCol;
in vec3 vWorld;
uniform vec4 uBlobs[${MAX_BLOBS}];
uniform vec3 uGrass, uGrassDark, uSand, uShape;
${TOON}
${WRITE_G}

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Small hand-drawn dashes so flat ground does not look empty.
float marks(vec2 p) {
  vec2 cell = floor(p * 1.3);
  vec2 f = fract(p * 1.3) - 0.5;
  float h = hash21(cell);
  if (h < 0.45) return 0.0;
  vec2 c = (vec2(hash21(cell + 3.1), hash21(cell + 7.7)) - 0.5) * 0.5;
  float ang = (h - 0.7) * 1.2;
  vec2 d = f - c;
  d = vec2(d.x * cos(ang) - d.y * sin(ang), d.x * sin(ang) + d.y * cos(ang));
  return step(abs(d.x), 0.16) * step(abs(d.y + d.x * d.x * 1.6), 0.022);
}

void main() {
  vec3 n = normalize(vN);
  float a = atan(vWorld.x, vWorld.z);
  float shore = uShape.x * (1.0 + 0.06 * sin(a * 3.0 + uShape.y) + 0.035 * sin(a * 7.0 + uShape.y * 2.3));
  float r = length(vWorld.xz) / shore + 0.018 * sin(a * 9.0 + uShape.y);
  // Flat, hard-edged zones: sand rim, grass, and a darker patch in the middle.
  vec3 base = r > uShape.z ? uSand : (r < 0.42 + 0.05 * sin(a * 4.0) ? uGrassDark : uGrass);
  base *= vCol * (1.0 - 0.13 * marks(vWorld.xz));
  vec2 sd = normalize(-uLightDir.xz);
  float shadow = 0.0;
  for (int i = 0; i < ${MAX_BLOBS}; i++) {
    vec4 b = uBlobs[i];
    if (b.z <= 0.0) continue;
    vec2 d = vWorld.xz - b.xy;
    float along = dot(d, sd) - b.z * (b.w - 1.0);
    float across = dot(d, vec2(-sd.y, sd.x));
    shadow = max(shadow, step(length(vec2(along / (b.z * b.w), across / b.z)), 1.0));
  }
  // Shadows land in the shade band: the same tone as the dark side of a hill.
  vec3 light = shadow > 0.5 ? uShadeCol : toonLight(n);
  writeG(base * light, 0.0, n, ${TAG.ground.toFixed(2)});
}
`,
  });
  return new THREE.Mesh(geo, mat);
}

export function buildWater(p: ScenePalette, s: IslandShape): THREE.Mesh {
  const geo = new THREE.CircleGeometry(160, 48);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -0.22, 0);
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      ...U,
      uWater: { value: new THREE.Color(p.water) },
      uFoam: { value: new THREE.Color(p.foam) },
      uShore: { value: new THREE.Vector2(s.radius, s.seed) },
    },
    vertexShader: /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: /* glsl */ `
in vec3 vWorld;
uniform vec3 uWater, uFoam;
uniform vec2 uShore;
${TOON}
${WRITE_G}
void main() {
  float a = atan(vWorld.x, vWorld.z);
  float shore = uShore.x * (1.0 + 0.06 * sin(a * 3.0 + uShore.y) + 0.035 * sin(a * 7.0 + uShore.y * 2.3));
  float d = length(vWorld.xz) - shore;
  float wob = 0.07 * sin(a * 11.0 + uTime * 0.7) + 0.05 * sin(a * 5.0 - uTime * 0.45);
  // Two flat foam bands that breathe in and out from the shore.
  float t = 0.5 + 0.5 * sin(uTime * 0.6);
  float f1 = step(d + wob, 0.16 + 0.1 * t);
  float ring = d + wob - (0.55 + 0.35 * t);
  float f2 = step(abs(ring), 0.045);
  vec3 col = mix(uWater, uFoam, max(f1, f2 * 0.8));
  // A lighter shelf near the island.
  col = mix(col, mix(uWater, uFoam, 0.22), step(d, 1.5) * (1.0 - max(f1, f2)));
  writeG(col, -0.55, vec3(0.0, 1.0, 0.0), ${TAG.ground.toFixed(2)});
}`,
  });
  return new THREE.Mesh(geo, mat);
}
