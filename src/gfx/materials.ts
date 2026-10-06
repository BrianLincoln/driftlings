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
  doubleSided?: boolean;
}

export type ToonMaterial = THREE.ShaderMaterial & {
  uniforms: {
    uTint: { value: THREE.Color };
    uFlag: { value: number };
    uUnlit: { value: number };
    /** The "touch this now" signal: breathing warm rim plus a passing shimmer. */
    uGlint: { value: number };
  } & Partial<FaceUniforms>;
};

const FRAG = (face: boolean) => /* glsl */ `
in vec3 vN;
in vec3 vObj;
in vec3 vCol;
in vec3 vWorld;
uniform vec3 uTint;
uniform float uFlag, uUnlit, uGlint, uTag;
${TOON}
${WRITE_G}
${face ? FACE_GLSL : ''}

void main() {
  vec3 n = normalize(vN);
  vec3 base = vCol * uTint;
  float flag = uFlag;
  float unlit = uUnlit;
  ${face ? 'paintFace(base, flag, unlit);' : ''}
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
      uTag: { value: o.tag ?? TAG.prop },
      ...(o.face ? faceUniforms(o.face) : {}),
    },
    vertexShader: COMMON_VERT,
    fragmentShader: FRAG(!!o.face),
  }) as ToonMaterial;
}
