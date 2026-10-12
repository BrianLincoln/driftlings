import * as THREE from 'three';
import { TAG, TOON, WRITE_G } from '../gfx/glsl';
import { paint } from '../gfx/geo';
import { C } from '../gfx/palette';
import { U } from '../gfx/uniforms';

// The ship's pennant: a swallowtail streaming from the masthead. The cloth is a
// flat sheet; the vertex shader runs waves down it that grow toward the tail, and
// works out the normal to match so the light bands travel along the folds.

const LENGTH = 0.62;
const HOIST = 0.2;

const VERT = /* glsl */ `
out vec3 vN;
out vec3 vCol;
uniform float uTime;

// How far the cloth stands off its plane at a spot along (x) and up (y) it.
float wave(vec2 p) {
  float u = p.x / ${LENGTH.toFixed(2)};
  float t = uTime * 7.0;
  float ripple = sin(u * 9.0 - t) + 0.45 * sin(u * 17.0 - t * 1.6 + p.y * 9.0);
  return (0.012 + 0.06 * u) * ripple * smoothstep(0.0, 0.12, u);
}

void main() {
  vCol = color;
  vec3 p = position;
  float e = 0.01;
  float z = wave(p.xy);
  vec3 n = normalize(vec3(-(wave(p.xy + vec2(e, 0.0)) - z) / e, -(wave(p.xy + vec2(0.0, e)) - z) / e, 1.0));
  p.z = z;
  // The tail hangs a little and lifts on each gust, and the waves show from side on too.
  float u = p.x / ${LENGTH.toFixed(2)};
  p.y += u * u * (0.03 * sin(uTime * 2.3) - 0.05) + 0.03 * u * sin(u * 8.0 - uTime * 7.0);
  vN = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}
`;

const FRAG = /* glsl */ `
in vec3 vN;
in vec3 vCol;
${TOON}
${WRITE_G}

void main() {
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  writeG(mix(vCol * toonLight(n), vCol, 0.25), -0.45, n, ${TAG.prop.toFixed(2)});
}
`;

let geo: THREE.BufferGeometry | null = null;

function cloth(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(LENGTH, HOIST, 20, 4);
  g.translate(LENGTH / 2, 0, 0);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / LENGTH;
    const v = pos.getY(i) / (HOIST / 2); // -1 at the foot, 1 at the head
    pos.setY(i, pos.getY(i) * (1 - 0.45 * u));
    pos.setX(i, pos.getX(i) * (1 - 0.3 * (1 - Math.abs(v)) * u * u)); // the notch of the swallowtail
  }
  g.computeBoundingSphere();
  g.boundingSphere!.radius += 0.1;
  return paint(g, C.pennant);
}

/** The pennant, its hoist on the y axis and centred on the origin, streaming toward +x. */
export function pennant(): THREE.Mesh {
  geo ??= cloth();
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexColors: true,
    side: THREE.DoubleSide,
    uniforms: { ...U },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  return new THREE.Mesh(geo, mat);
}
