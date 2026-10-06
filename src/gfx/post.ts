import * as THREE from 'three';
import type { ScenePalette } from './palette';

// Scene -> G-buffer (colour+flag, normal+tag, depth) -> bloom -> composite
// (grade, outlines, bloom) -> FXAA to the screen.
//
// Unlike the reference project, every target is 8-bit and depth is a standard
// depth texture, so nothing here needs a float render-target extension.

export type Quality = 'high' | 'low';

const FS_VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function pass(fragmentShader: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
    uniforms,
    vertexShader: FS_VERT,
    fragmentShader,
  });
}

const EXTRACT = /* glsl */ `
in vec2 vUv;
uniform sampler2D tColor;
out vec4 o;
void main() {
  vec4 c = texture(tColor, vUv);
  o = vec4(c.rgb * max(c.a * 2.0 - 1.0, 0.0), 1.0);
}`;

const BLUR = /* glsl */ `
in vec2 vUv;
uniform sampler2D tIn;
uniform vec2 uStep;
out vec4 o;
void main() {
  vec3 c = texture(tIn, vUv).rgb * 0.227;
  c += (texture(tIn, vUv + uStep * 1.0).rgb + texture(tIn, vUv - uStep * 1.0).rgb) * 0.195;
  c += (texture(tIn, vUv + uStep * 2.0).rgb + texture(tIn, vUv - uStep * 2.0).rgb) * 0.122;
  c += (texture(tIn, vUv + uStep * 3.0).rgb + texture(tIn, vUv - uStep * 3.0).rgb) * 0.054;
  c += (texture(tIn, vUv + uStep * 4.0).rgb + texture(tIn, vUv - uStep * 4.0).rgb) * 0.016;
  o = vec4(c, 1.0);
}`;

const COMPOSITE = /* glsl */ `
in vec2 vUv;
uniform sampler2D tColor, tND, tDepth, tBloom;
uniform vec2 uTexel;
uniform float uNear, uFar, uOutlineWidth, uDepthThr, uNormalThr, uTintAmt, uLift, uBloom;
uniform vec3 uOutlineCol, uTint, uWash;
out vec4 o;

float lin(vec2 uv) {
  float ndc = texture(tDepth, uv).r * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - ndc * (uFar - uNear));
}

void main() {
  vec4 cc = texture(tColor, vUv);
  vec3 col = cc.rgb;
  float flag = cc.a * 2.0 - 1.0;

  // Grade: keep luminance, swap chroma toward the scene tint. Accents opt out.
  if (flag < 0.48) {
    float keep = clamp(-flag, 0.0, 1.0);
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    float tl = dot(uTint, vec3(0.299, 0.587, 0.114));
    col = mix(col, uTint * (l / max(tl, 1e-3)), uTintAmt * (1.0 - keep));
    col = mix(col, uWash, uLift * (1.0 - keep * 0.7));
  }

  // Outlines. Laplacian of inverse depth: zero on any plane, positive only
  // where this pixel is in front of its neighbours.
  vec2 off = uTexel * uOutlineWidth;
  float d = lin(vUv);
  float dl = lin(vUv - vec2(off.x, 0.0)), dr = lin(vUv + vec2(off.x, 0.0));
  float du = lin(vUv + vec2(0.0, off.y)), db = lin(vUv - vec2(0.0, off.y));
  float ex = 2.0 - d / dl - d / dr, ey = 2.0 - d / du - d / db;
  float de = max(ex, ey);
  float depthEdge = smoothstep(uDepthThr, uDepthThr * 1.8, de);

  vec4 nd = texture(tND, vUv);
  vec3 n = nd.xyz * 2.0 - 1.0;
  float ne = 0.0;
  float te = 0.0;
  if (nd.a > 0.0) {
    vec4 a = texture(tND, vUv - vec2(off.x, 0.0)), b = texture(tND, vUv + vec2(off.x, 0.0));
    vec4 c = texture(tND, vUv + vec2(0.0, off.y)), e = texture(tND, vUv - vec2(0.0, off.y));
    ne = max(max(1.0 - dot(n, a.xyz * 2.0 - 1.0), 1.0 - dot(n, b.xyz * 2.0 - 1.0)),
             max(1.0 - dot(n, c.xyz * 2.0 - 1.0), 1.0 - dot(n, e.xyz * 2.0 - 1.0)));
    // A change of category is always a line (a tile standing on the ground).
    te = max(max(abs(nd.a - a.a), abs(nd.a - b.a)), max(abs(nd.a - c.a), abs(nd.a - e.a)));
    ne = max(ne, step(0.05, te) * step(min(min(a.a, b.a), min(c.a, e.a)), nd.a + 0.01) * 2.0);
  }
  float normalEdge = smoothstep(uNormalThr, uNormalThr + 0.15, ne) * step(-0.002, min(ex, ey)); // only on the nearer side
  // Far layers are flat tones without ink.
  float fade = 1.0 - smoothstep(35.0, 55.0, d);
  float edge = max(depthEdge, normalEdge) * fade;
  vec3 lineCol = uOutlineCol;
  // A crease inside one creature (neck, arm against body) is a soft line in
  // its own colour. Ink is kept for the silhouette, or necks read as collars.
  if (abs(nd.a - 0.62) < 0.02 && te < 0.05) {
    edge *= 0.5;
    lineCol = mix(col * 0.62, uOutlineCol, 0.2);
  }
  col = mix(col, lineCol, edge);

  col += texture(tBloom, vUv).rgb * uBloom;
  o = vec4(col, 1.0);
}`;

// Compact FXAA (the widely used "simple" variant).
const FXAA = /* glsl */ `
in vec2 vUv;
uniform sampler2D tIn;
uniform vec2 uTexel;
out vec4 o;
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec3 m = texture(tIn, vUv).rgb;
  float lNW = luma(texture(tIn, vUv + vec2(-1.0, -1.0) * uTexel).rgb);
  float lNE = luma(texture(tIn, vUv + vec2(1.0, -1.0) * uTexel).rgb);
  float lSW = luma(texture(tIn, vUv + vec2(-1.0, 1.0) * uTexel).rgb);
  float lSE = luma(texture(tIn, vUv + vec2(1.0, 1.0) * uTexel).rgb);
  float lM = luma(m);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), -8.0, 8.0) * uTexel;
  vec3 a = 0.5 * (texture(tIn, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture(tIn, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture(tIn, vUv + dir * -0.5).rgb + texture(tIn, vUv + dir * 0.5).rgb);
  float lB = luma(b);
  o = vec4((lB < lMin || lB > lMax) ? a : b, 1.0);
}`;

export class PostChain {
  private gbuf: THREE.WebGLRenderTarget;
  private comp: THREE.WebGLRenderTarget;
  private bloomA: THREE.WebGLRenderTarget;
  private bloomB: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private fsScene = new THREE.Scene();
  private fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private extract: THREE.ShaderMaterial;
  private blur: THREE.ShaderMaterial;
  private composite: THREE.ShaderMaterial;
  private fxaa: THREE.ShaderMaterial;
  private black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  quality: Quality = 'high';

  constructor(private renderer: THREE.WebGLRenderer) {
    const rt = (linear: boolean) =>
      new THREE.WebGLRenderTarget(4, 4, {
        type: THREE.UnsignedByteType,
        minFilter: linear ? THREE.LinearFilter : THREE.NearestFilter,
        magFilter: linear ? THREE.LinearFilter : THREE.NearestFilter,
        depthBuffer: false,
      });
    this.gbuf = new THREE.WebGLRenderTarget(4, 4, {
      count: 2,
      type: THREE.UnsignedByteType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(4, 4, THREE.UnsignedIntType),
    });
    this.comp = rt(true);
    this.bloomA = rt(true);
    this.bloomB = rt(true);
    this.black.needsUpdate = true;

    this.extract = pass(EXTRACT, { tColor: { value: this.gbuf.textures[0] } });
    this.blur = pass(BLUR, { tIn: { value: null }, uStep: { value: new THREE.Vector2() } });
    this.composite = pass(COMPOSITE, {
      tColor: { value: this.gbuf.textures[0] },
      tND: { value: this.gbuf.textures[1] },
      tDepth: { value: this.gbuf.depthTexture },
      tBloom: { value: this.bloomA.texture },
      uTexel: { value: new THREE.Vector2() },
      uNear: { value: 0.5 },
      uFar: { value: 200 },
      uOutlineWidth: { value: 1.4 },
      uDepthThr: { value: 0.012 },
      uNormalThr: { value: 0.42 },
      uOutlineCol: { value: new THREE.Color() },
      uTint: { value: new THREE.Color() },
      uWash: { value: new THREE.Color() },
      uTintAmt: { value: 0 },
      uLift: { value: 0 },
      uBloom: { value: 0.55 },
    });
    this.fxaa = pass(FXAA, { tIn: { value: this.comp.texture }, uTexel: { value: new THREE.Vector2() } });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(geo, this.composite);
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);
  }

  setPalette(p: ScenePalette): void {
    const u = this.composite.uniforms;
    u.uOutlineCol.value.set(p.outline);
    u.uTint.value.set(p.tint);
    u.uWash.value.set(p.wash);
    u.uTintAmt.value = p.tintAmt;
    u.uLift.value = p.lift;
  }

  /** Size in render pixels. Outline width follows the pixel ratio so line weight is constant on screen. */
  setSize(w: number, h: number, pixelsPerCssPx: number): void {
    this.gbuf.setSize(w, h);
    this.comp.setSize(w, h);
    const bw = Math.max(2, w >> 1);
    const bh = Math.max(2, h >> 1);
    this.bloomA.setSize(bw, bh);
    this.bloomB.setSize(bw, bh);
    this.composite.uniforms.uTexel.value.set(1 / w, 1 / h);
    // Whole pixels only: fractional offsets on nearest-filtered targets give dotted lines.
    this.composite.uniforms.uOutlineWidth.value = Math.max(1, Math.round(1.5 * pixelsPerCssPx));
    this.fxaa.uniforms.uTexel.value.set(1 / w, 1 / h);
  }

  private draw(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null): void {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.fsCam);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    const r = this.renderer;
    const cu = this.composite.uniforms;
    cu.uNear.value = camera.near;
    cu.uFar.value = camera.far;

    r.setRenderTarget(this.gbuf);
    r.clear();
    r.render(scene, camera);

    if (this.quality === 'high') {
      this.draw(this.extract, this.bloomA);
      for (let i = 0; i < 2; i++) {
        this.blur.uniforms.tIn.value = this.bloomA.texture;
        this.blur.uniforms.uStep.value.set(1.3 / this.bloomA.width, 0);
        this.draw(this.blur, this.bloomB);
        this.blur.uniforms.tIn.value = this.bloomB.texture;
        this.blur.uniforms.uStep.value.set(0, 1.3 / this.bloomA.height);
        this.draw(this.blur, this.bloomA);
      }
      cu.tBloom.value = this.bloomA.texture;
    } else {
      cu.tBloom.value = this.black;
    }

    this.draw(this.composite, this.comp);
    this.draw(this.fxaa, null);
  }
}
