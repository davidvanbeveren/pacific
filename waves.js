// Shared wave math: the same wave field is evaluated in JS (boat bobbing,
// fish splashes) and in GLSL (water displacement + shading), generated from
// one set of constants so they can never drift apart.

export const COLORS = {
  skyTop: '#1f80dd',
  horizon: '#d8f0fb',
  deep: '#0f6fc8',
  shallow: '#4bb0e8',
};

const RAW = [
  { dir: [1.0, 0.25], amp: 0.20, len: 21.0, speed: 1.05 },
  { dir: [-0.6, 1.0], amp: 0.14, len: 12.0, speed: 1.45 },
  { dir: [0.35, -1.0], amp: 0.09, len: 6.6, speed: 1.95 },
  { dir: [1.0, -0.7], amp: 0.05, len: 3.4, speed: 2.5 },
];

// High-frequency ripples used only for shading normals, not displacement.
const DETAIL = [
  { dir: [0.8, 0.6], amp: 0.030, len: 1.9, speed: 3.1 },
  { dir: [-0.45, 0.9], amp: 0.022, len: 1.15, speed: 3.8 },
];

const norm = (d) => {
  const l = Math.hypot(d[0], d[1]);
  return [d[0] / l, d[1] / l];
};
const prep = (w) => ({ ...w, dir: norm(w.dir), k: (2 * Math.PI) / w.len });

export const WAVES = RAW.map(prep);
const DET = DETAIL.map(prep);

export function waveHeight(x, z, t) {
  let h = 0;
  for (const w of WAVES) {
    h += w.amp * Math.sin((w.dir[0] * x + w.dir[1] * z) * w.k + t * w.speed);
  }
  return h;
}

const f = (n) => n.toFixed(6);
const heightTerms = WAVES.map(
  (w) => `  h += ${f(w.amp)} * sin(dot(p, vec2(${f(w.dir[0])}, ${f(w.dir[1])})) * ${f(w.k)} + t * ${f(w.speed)});`
).join('\n');
const gradTerms = [...WAVES, ...DET].map(
  (w) => `  g += vec2(${f(w.dir[0])}, ${f(w.dir[1])}) * (${f(w.amp * w.k)} * cos(dot(p, vec2(${f(w.dir[0])}, ${f(w.dir[1])})) * ${f(w.k)} + t * ${f(w.speed)}));`
).join('\n');

export const WAVE_GLSL = `
float waveHeight(vec2 p, float t) {
  float h = 0.0;
${heightTerms}
  return h;
}
vec2 waveGrad(vec2 p, float t) {
  vec2 g = vec2(0.0);
${gradTerms}
  return g;
}
`;
