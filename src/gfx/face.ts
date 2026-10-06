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

// Half a pixel of a distance field, measured along its own gradient: the edge
// stays one pixel soft however far away or turned the head is.
float edgeAA(float d, float cap) { return clamp(0.5 * length(vec2(dFdx(d), dFdy(d))), 1e-5, cap); }

// First-order distance to an ellipse, so an outline keeps one weight all the way round.
float ellipse(vec2 q, vec2 r) {
  float k = length(q / r);
  return (k - 1.0) * k / max(length(q / (r * r)), 1e-6);
}

// Half-width of an ink line: its painted weight, but never under 1.6 pixels.
float inkHalf(float aa) { return max(0.008, aa * 1.6); }

void paintFace(inout vec3 base, inout float flag, inout float unlit) {
  vec3 dir = normalize(vObj - uFaceOrigin);
  // No early return for the back of the head: derivatives are undefined in the pixels
  // beside one, and that edge showed as a dotted ink line. Nothing is painted there anyway.
  vec2 p = vec2(atan(dir.x, dir.z), asin(clamp(dir.y, -1.0, 1.0)));
  // From the direction, not from p: atan wraps at the back.
  float cap = clamp(length(fwidth(dir)), 1e-4, 0.05);

  vec2 bq = vec2(abs(p.x) - uBlush.x, p.y - uBlush.y) * vec2(0.8, 1.3);
  base = mix(base, uBlushCol, inside(length(bq) - uBlush.z, cap * 1.8) * uBlush.w);

  float side = p.x < 0.0 ? -1.0 : 1.0;
  vec2 q = vec2(p.x - side * uEye.x, p.y - uEye.y);
  float de = ellipse(q, uEye.zw);
  float aE = edgeAA(de, cap);
  float hw = inkHalf(aE);
  float lid = uLook.z;

  if (lid < 0.0) {
    // Happy: the upper arc of each eye, drawn as an ink line.
    float arc = abs(de + hw * 2.0) - hw * 1.2;
    base = mix(base, uInk, inside(arc, aE) * step(-uEye.w * 0.1, q.y));
  } else {
    float lidY = (lid * 2.0 - 1.0) * uEye.w;
    float aY = edgeAA(q.y, cap);
    float hwY = inkHalf(aY);
    float open = inside(q.y - lidY, aY);
    float inEye = inside(de, aE) * open;
    vec3 eyeCol = uWhite;
    // Both pupils share one look direction; offsetting each inward looks cross-eyed.
    vec2 pq = q - uLook.xy * uPupil.zw;
    float dp = ellipse(pq, uPupil.xy);
    eyeCol = mix(eyeCol, uInk, inside(dp, edgeAA(dp, cap)));
    float dh = length(pq - vec2(-0.32, 0.36) * uPupil.xy) - uPupil.x * 0.3;
    eyeCol = mix(eyeCol, uWhite, inside(dh, edgeAA(dh, cap)));
    base = mix(base, eyeCol, inEye);
    float ring = inside(abs(de) - hw, aE) * inside(q.y - lidY - hwY * 2.0, aY);
    float lidLine = inside(abs(q.y - lidY) - hwY, aY) * inside(de, aE) * step(lid, 0.97);
    float ink = max(ring, lidLine);
    base = mix(base, uInk, ink);
    // The outline is lit and graded with the eye it rings, or it goes two-tone.
    if (max(inEye, ink) > 0.5) { flag = -0.95; unlit = 0.8; }
  }

  float mx = p.x / uMouth.y;
  float my = uMouth.x - uMouth.z * (1.0 - mx * mx);
  float dy = p.y - my;
  float aM = edgeAA(dy, cap);
  float dm = max(abs(dy) - inkHalf(aM) * 1.1, (abs(mx) - 1.0) * uMouth.y);
  base = mix(base, uInk, inside(dm, aM));
}
`;
