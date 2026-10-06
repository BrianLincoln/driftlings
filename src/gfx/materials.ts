import * as THREE from 'three';
import { U } from './uniforms';
import { COMMON_VERT, TAG, TOON, WRITE_G } from './glsl';
import { FACE_GLSL, faceUniforms, type FaceLook, type FaceUniforms } from './face';

export interface ToonOptions {
  /** G-buffer flag: positive emissive, negative "keep my colour through the grade". */
  flag?: number;
  tag?: number;
  /** 0 = fully banded lighting, 1 = self-lit flat colour. */
  unlit?: number;
  tint?: THREE.ColorRepresentation;
  face?: FaceLook;
  /** Planked wood: board seams and grain drawn over the vertex colour. Boards run along x. */
  wood?: boolean;
  doubleSided?: boolean;
}

export type ToonMaterial = THREE.ShaderMaterial & {
  uniforms: {
    uTint: { value: THREE.Color };
    uFlag: { value: number };
    uUnlit: { value: number };
    /** The "touch this now" signal: breathing warm rim plus a passing shimmer. */
    uGlint: { value: number };
    /**
     * Dormancy, for creatures far from home. x: world height of the colour line;
     * y: how dormant it is above the line; z: below it; w: a flash of brightness.
     */
    uDorm: { value: THREE.Vector4 };
  } & Partial<FaceUniforms>;
};

// Boards run along object x. On a side they stack in y; on a deck they lie side
// by side in z. Each board gets its own tone, a few grain streaks, and a dark
// seam that never thins below a pixel and a half.
const WOOD_GLSL = /* glsl */ `
float woodHash(float n) { return fract(sin(n * 127.1 + 31.7) * 43758.5453); }

void paintWood(inout vec3 base) {
  // Which way the surface faces on the object itself, so the boards stay put however it is turned or carried.
  vec3 n = normalize(cross(dFdx(vObj), dFdy(vObj)));
  float across = (abs(n.y) > 0.7 ? vObj.z : vObj.y) / 0.115;
  float row = floor(across);
  float f = fract(across);
  float along = vObj.x / 0.95 + woodHash(row) * 7.0;
  float board = floor(along);
  float g = fract(along);
  float id = row * 13.0 + board * 5.0;
  base *= 0.88 + 0.24 * woodHash(id);

  float aa = fwidth(across);
  float lane = floor(f * 4.0);
  float h = woodHash(id + lane * 1.7);
  float mid = 0.18 + 0.64 * woodHash(id + lane * 3.3);
  float streak = step(0.4, h) * step(abs(fract(f * 4.0) - 0.5), 0.1) * step(abs(g - mid), 0.1 + 0.22 * h);
  base = mix(base, base * 0.7, streak * (1.0 - smoothstep(0.12, 0.3, aa)));

  float seam = 1.0 - smoothstep(0.0, max(0.05, aa * 1.5), min(f, 1.0 - f));
  float butt = 1.0 - smoothstep(0.0, max(0.008, fwidth(along) * 1.5), min(g, 1.0 - g));
  base = mix(base, base * 0.42, max(seam, butt) * 0.85);
}
`;

const FRAG = (face: boolean, wood: boolean) => /* glsl */ `
in vec3 vN;
in vec3 vObj;
in vec3 vCol;
in vec3 vWorld;
uniform vec3 uTint;
uniform float uFlag, uUnlit, uGlint, uTag;
uniform vec4 uDorm;
${TOON}
${WRITE_G}
${face ? FACE_GLSL : ''}
${wood ? WOOD_GLSL : ''}

void main() {
  vec3 n = normalize(vN);
  vec3 base = vCol * uTint;
  float flag = uFlag;
  float unlit = uUnlit;
  ${face ? 'paintFace(base, flag, unlit);' : ''}
  ${wood ? 'paintWood(base);' : ''}
  vec3 col = mix(base * toonLight(n), base, unlit);

  if (uGlint > 0.0) {
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = 1.0 - abs(dot(n, v));
    float rim = step(0.72, fres) * (0.55 + 0.45 * sin(uTime * 2.4));
    float sweep = fract((vWorld.x + vWorld.z) * 0.22 + vWorld.y * 0.3 - uTime * 0.32);
    float shimmer = step(0.955, sweep) * step(sweep, 0.975);
    float g = clamp(max(rim, shimmer) * uGlint, 0.0, 1.0);
    col = mix(col, vec3(1.0, 0.94, 0.72), g * 0.5);
    flag = mix(flag, 0.2, g);
  }
  if (uDorm.y + uDorm.z + uDorm.w > 0.0) {
    // Colour drains to a grey-blue that keeps the shading, and gives up its place above the grade.
    float above = step(uDorm.x, vWorld.y);
    float d = mix(uDorm.z, uDorm.y, above);
    float lum = dot(col, vec3(0.3, 0.55, 0.15));
    col = mix(col, mix(vec3(0.3, 0.36, 0.5), vec3(0.66, 0.72, 0.82), lum), d);
    flag = mix(flag, 0.0, d);
    // The rising edge: a paler band of its own colour.
    float edge = (1.0 - above) * step(uDorm.x - 0.035, vWorld.y) * uDorm.y * (1.0 - uDorm.z);
    col = mix(col, col * 1.1 + 0.14, edge);
    col += uDorm.w * 0.3;
  }
  writeG(col, flag, n, uTag);
}
`;

export function toonMaterial(o: ToonOptions = {}): ToonMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexColors: true,
    side: o.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: {
      ...U,
      uTint: { value: new THREE.Color(o.tint ?? '#ffffff') },
      uFlag: { value: o.flag ?? 0 },
      uUnlit: { value: o.unlit ?? 0 },
      uGlint: { value: 0 },
      uDorm: { value: new THREE.Vector4(0, 0, 0, 0) },
      uTag: { value: o.tag ?? TAG.prop },
      ...(o.face ? faceUniforms(o.face) : {}),
    },
    vertexShader: COMMON_VERT,
    fragmentShader: FRAG(!!o.face, !!o.wood),
  }) as ToonMaterial;
}
