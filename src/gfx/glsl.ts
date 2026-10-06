// Shared GLSL chunks. Every scene shader lights through toonLight and writes
// the G-buffer through writeG, so the post chain can treat all surfaces alike.

/** Category tags stored in the normal target's alpha. 0 is sky. */
export const TAG = { sky: 0, ground: 1.0, prop: 0.5, creature: 0.62, tile: 0.8 } as const;

export const TOON = /* glsl */ `
uniform vec3 uLightDir, uLightCol, uMidCol, uShadeCol;
uniform float uBand1, uBand2, uTime;

vec3 toonLight(vec3 n) {
  float d = dot(n, uLightDir);
  return d > uBand1 ? uLightCol : (d > uBand2 ? uMidCol : uShadeCol);
}
`;

// gColor.a carries a flag in -1..1, stored as 0.5 + 0.5 * flag:
//   positive = emissive strength (feeds bloom; 0.5 or more also skips the grade)
//   negative = how much of its own colour an accent keeps through the grade
export const WRITE_G = /* glsl */ `
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gND;

void writeG(vec3 col, float flag, vec3 nWorld, float tag) {
  gColor = vec4(col, 0.5 + 0.5 * clamp(flag, -1.0, 1.0));
  vec3 nv = normalize((viewMatrix * vec4(nWorld, 0.0)).xyz);
  gND = vec4(nv * 0.5 + 0.5, tag);
}
`;

export const COMMON_VERT = /* glsl */ `
out vec3 vN;
out vec3 vObj;
out vec3 vCol;
out vec3 vWorld;

void main() {
  vObj = position;
  vCol = color;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  // normalMatrix is view space; multiply by the transposed view rotation to get world.
  vN = normalize((vec4(normalize(normalMatrix * normal), 0.0) * viewMatrix).xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
