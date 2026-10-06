import * as THREE from 'three';
import { C } from './palette';

// Faces are painted in the fragment shader on the surface of the head, not
// modelled: outlines ring geometric eyes and they read as spectacles.

export interface FaceLook {
  /** Centre of the head in the mesh's object space. */
  origin: [number, number, number];
  /** Eye centre (yaw, pitch) in radians, mirrored in x, then eye half-size. */
  eye: [number, number, number, number];
  /** Pupil half-size, then how far it may travel. */
  pupil: [number, number, number, number];
  /** Mouth: pitch, half-width. */
  mouth: [number, number];
  /** Blush: yaw, pitch, radius. */
  blush: [number, number, number];
}

export function faceUniforms(look: FaceLook) {
  return {
    uFaceOrigin: { value: new THREE.Vector3(...look.origin) },
    uEye: { value: new THREE.Vector4(...look.eye) },
    uPupil: { value: new THREE.Vector4(...look.pupil) },
    /** look x, look y, lid (1 open, 0.05 blink, negative = happy arcs), unused */
    uLook: { value: new THREE.Vector4(0, 0, 1, 0) },
    /** pitch, half-width, curve (positive smile), unused */
    uMouth: { value: new THREE.Vector4(look.mouth[0], look.mouth[1], 0.03, 0) },
    /** yaw, pitch, radius, amount */
    uBlush: { value: new THREE.Vector4(look.blush[0], look.blush[1], look.blush[2], 0.5) },
    uInk: { value: new THREE.Color(C.faceInk) },
    uWhite: { value: new THREE.Color(C.eyeWhite) },
    uBlushCol: { value: new THREE.Color(C.blush) },
  };
}

export type FaceUniforms = ReturnType<typeof faceUniforms>;

export const FACE_GLSL = /* glsl */ `
uniform vec3 uFaceOrigin, uInk, uWhite, uBlushCol;
uniform vec4 uEye, uPupil, uLook, uMouth, uBlush;

float inside(float d, float aa) { return 1.0 - smoothstep(-aa, aa, d); }

void paintFace(inout vec3 base, inout float flag, inout float unlit) {
  vec3 dir = normalize(vObj - uFaceOrigin);
  if (dir.z < 0.05) return;
  vec2 p = vec2(atan(dir.x, dir.z), asin(clamp(dir.y, -1.0, 1.0)));
  // From the direction, not from p: atan wraps at the back. Keep edges within about half a pixel.
  float aa = max(length(fwidth(dir)), 1e-4) * 0.6;
  float lw = max(0.016, aa * 2.2);

  vec2 bq = vec2(abs(p.x) - uBlush.x, p.y - uBlush.y) * vec2(0.8, 1.3);
  base = mix(base, uBlushCol, inside(length(bq) - uBlush.z, aa * 3.0) * uBlush.w);

  float side = p.x < 0.0 ? -1.0 : 1.0;
  vec2 q = vec2(p.x - side * uEye.x, p.y - uEye.y);
  float de = (length(q / uEye.zw) - 1.0) * min(uEye.z, uEye.w);
  float lid = uLook.z;

  if (lid < 0.0) {
    // Happy: the upper arc of each eye, drawn as an ink line.
    float arc = abs(de + lw) - lw * 0.6;
    base = mix(base, uInk, inside(arc, aa) * step(-uEye.w * 0.1, q.y));
  } else {
    float lidY = (lid * 2.0 - 1.0) * uEye.w;
    float open = inside(q.y - lidY, aa);
    float inEye = inside(de, aa) * open;
    vec3 eyeCol = uWhite;
    // Both pupils share one look direction; offsetting each inward looks cross-eyed.
    vec2 pq = q - uLook.xy * uPupil.zw;
    float dp = (length(pq / uPupil.xy) - 1.0) * min(uPupil.x, uPupil.y);
    eyeCol = mix(eyeCol, uInk, inside(dp, aa));
    vec2 hq = pq - vec2(-0.32, 0.36) * uPupil.xy;
    eyeCol = mix(eyeCol, uWhite, inside(length(hq) - uPupil.x * 0.3, aa));
    base = mix(base, eyeCol, inEye);
    if (inEye > 0.5) { flag = -0.95; unlit = 0.8; }
    float ring = inside(abs(de) - lw * 0.5, aa) * inside(q.y - lidY - lw, aa);
    float lidLine = inside(abs(q.y - lidY) - lw * 0.5, aa) * inside(de, aa) * step(lid, 0.97);
    base = mix(base, uInk, max(ring, lidLine));
  }

  float mx = p.x / uMouth.y;
  float my = uMouth.x - uMouth.z * (1.0 - mx * mx);
  float dm = max(abs(p.y - my) - lw * 0.55, (abs(mx) - 1.0) * uMouth.y);
  base = mix(base, uInk, inside(dm, aa));
}
`;
