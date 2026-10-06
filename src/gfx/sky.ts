import * as THREE from 'three';
import { U } from './uniforms';
import { WRITE_G } from './glsl';
import type { ScenePalette } from './palette';

/** A fullscreen backdrop: flat sky strips and a few drawn clouds. Writes no depth. */
export function buildSky(p: ScenePalette): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: U.uTime,
      uTop: { value: new THREE.Color(p.skyTop) },
      uMid: { value: new THREE.Color(p.skyMid) },
      uHorizon: { value: new THREE.Color(p.skyHorizon) },
      uCloud: { value: new THREE.Color(p.cloud) },
      uCloudShade: { value: new THREE.Color(p.cloudShade) },
      uLine: { value: new THREE.Color(p.outline) },
      uAspect: { value: 1 },
    },
    vertexShader: /* glsl */ `
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: /* glsl */ `
in vec2 vUv;
uniform vec3 uTop, uMid, uHorizon, uCloud, uCloudShade, uLine;
uniform float uTime, uAspect;
${WRITE_G}

// A cloud is a union of circles cut by a flat bottom.
float cloud(vec2 p, float seed) {
  float d = 1e3;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float h = fract(sin(seed * 12.9 + fi * 4.7) * 43758.5);
    vec2 c = vec2((fi - 2.0) * 0.062, 0.018 + 0.03 * h * (1.0 - abs(fi - 2.0) * 0.3));
    d = min(d, length(p - c) - (0.05 + 0.03 * h) * (1.0 - abs(fi - 2.0) * 0.16));
  }
  return max(d, -p.y);
}

void main() {
  float e = floor(vUv.y * 7.0) / 6.0;
  vec3 col = e < 0.5 ? mix(uHorizon, uMid, e * 2.0) : mix(uMid, uTop, e * 2.0 - 2.0 + 1.0);
  vec2 uv = vec2((vUv.x - 0.5) * max(uAspect, 0.6), vUv.y);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float span = 2.2;
    float x = mod(fi * 0.61 + 0.2 + uTime * 0.004 * (1.0 + fi * 0.3), span) - span * 0.5;
    vec2 c = vec2(x, 0.66 + 0.085 * fi - 0.12 * step(1.5, fi) );
    float s = 0.8 + 0.25 * fract(fi * 0.37);
    float d = cloud((uv - c) / s, fi + 1.0) * s;
    if (d < 0.0) {
      col = (uv.y - c.y) / s < 0.02 ? uCloudShade : uCloud;
    }
    col = mix(col, mix(uCloud, uLine, 0.45), step(abs(d), 0.0016));
  }
  writeG(col, -1.0, vec3(0.0, 0.0, 1.0), 0.0);
}`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}
