import * as THREE from 'three';
import { U } from './uniforms';
import { WRITE_G } from './glsl';
import type { ScenePalette } from './palette';

/**
 * A fullscreen backdrop: flat sky strips, a flat sun with two glow rings, and
 * drawn clouds. Everything is placed relative to the horizon line, which the
 * stage supplies (uHorizon), so the sky composes the same in any viewport.
 */
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
      uHorizonCol: { value: new THREE.Color(p.skyHorizon) },
      uCloud: { value: new THREE.Color(p.cloud) },
      uCloudShade: { value: new THREE.Color(p.cloudShade) },
      uSun: { value: new THREE.Color(p.sun) },
      uLine: { value: new THREE.Color(p.outline) },
      uAspect: { value: 1 },
      /** Screen height (0..1) of the horizon. */
      uHorizon: { value: 0.7 },
    },
    vertexShader: /* glsl */ `
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: /* glsl */ `
in vec2 vUv;
uniform vec3 uTop, uMid, uHorizonCol, uCloud, uCloudShade, uSun, uLine;
uniform float uTime, uAspect, uHorizon;
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
  // Height above the horizon, in units of screen height.
  float h = vUv.y - uHorizon;
  // Six flat strips from horizon to the top of the screen, however much sky shows.
  float e = clamp(floor(h / max(1.0 - uHorizon, 0.02) * 6.0) / 5.0, 0.0, 1.0);
  // Sizes follow the narrower dimension so a phone gets small clouds, not slabs.
  float k = min(1.0, uAspect * 1.5);
  vec3 col = e < 0.5 ? mix(uHorizonCol, uMid, e * 2.0) : mix(uMid, uTop, e * 2.0 - 1.0);
  vec2 uv = vec2((vUv.x - 0.5) * uAspect, h);

  // Sun: a flat disc with two hard rings of glow.
  float sd = length(uv - vec2(0.24 * min(uAspect, 1.4), 0.085 * k)) / k;
  col = mix(col, uSun, 0.25 * step(sd, 0.1));
  col = mix(col, uSun, 0.35 * step(sd, 0.072));
  col = mix(col, uSun, step(sd, 0.046));

  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float span = max(uAspect, 0.6) + 0.9;
    float x = mod(fi * 0.47 + 0.15 + uTime * 0.004 * (1.0 + fi * 0.3), span) - span * 0.5;
    float s = (0.8 + 0.5 * fract(fi * 0.37)) * k;
    vec2 c = vec2(x, (0.01 + 0.045 * mod(fi, 3.0) + 0.02 * fract(fi * 0.71)) * k);
    vec2 q = (uv - c) / s;
    float d = cloud(q, fi + 1.0) * s;
    if (d < 0.0) col = q.y < 0.022 ? uCloudShade : uCloud;
    col = mix(col, mix(uCloud, uLine, 0.5), step(abs(d), 0.0018 * max(k, 0.6)));
  }
  writeG(col, -1.0, vec3(0.0, 0.0, 1.0), 0.0);
}`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}
