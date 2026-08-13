import * as THREE from 'three';
import { WAVE_GLSL, COLORS } from './waves.js';
import { ISLANDS } from './islands.js';

export function makeWater(sunPos) {
  const geo = new THREE.PlaneGeometry(2000, 2000, 480, 480);
  // per island: center + inverse sand-edge radii, so the shader can tint
  // in the ellipse's own frame (d = 1 exactly at the beach edge)
  const islVec = [];
  for (let i = 0; i < 5; i++) {
    const s = ISLANDS[i];
    islVec.push(
      s
        ? new THREE.Vector4(s.x, s.z, 1 / (s.r * 1.15 * s.sx), 1 / (s.r * 1.15 * s.sz))
        : new THREE.Vector4(0, 0, 0, 0)
    );
  }
  const uniforms = {
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uSunDir: { value: sunPos.clone().normalize() },
    uDeep: { value: new THREE.Color(COLORS.deep) },
    uShallow: { value: new THREE.Color(COLORS.shallow) },
    uHorizon: { value: new THREE.Color(COLORS.horizon) },
    uBoat: { value: new THREE.Vector2(0, 0) },
    uHead: { value: new THREE.Vector2(1, 0) },
    uIslands: { value: islVec },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      ${WAVE_GLSL}
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y += waveHeight(wp.xz, uTime);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uCam;
      uniform vec3 uSunDir;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uHorizon;
      uniform vec2 uBoat;
      uniform vec2 uHead;
      uniform vec4 uIslands[5];
      varying vec3 vWorld;
      ${WAVE_GLSL}
      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      void main() {
        // clip water inside the hull (boat-local frame) so crests never
        // poke through the deck
        vec2 rel = vWorld.xz - uBoat;
        vec2 lp = vec2(rel.x * uHead.x - rel.y * uHead.y, rel.x * uHead.y + rel.y * uHead.x);
        vec2 be = lp / vec2(2.95, 7.5);
        if (dot(be, be) < 1.0) discard;
        vec2 grad = waveGrad(vWorld.xz, uTime);
        vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));
        vec3 V = normalize(uCam - vWorld);
        float ndv = max(dot(n, V), 0.0);
        float fres = pow(1.0 - ndv, 3.0);
        float dist = length(vWorld.xz - uCam.xz);

        vec3 col = mix(uDeep, uShallow, clamp(fres * 1.6, 0.0, 1.0));
        col = mix(col, uShallow, clamp(dist / 900.0, 0.0, 0.55));

        // slope-based shading so the ripple pattern reads at every distance
        float dif = clamp(dot(n, uSunDir), 0.0, 1.0);
        col *= 0.86 + 0.26 * dif;

        // crest lightening
        float h = waveHeight(vWorld.xz, uTime);
        col = mix(col, uShallow * 1.08, smoothstep(0.18, 0.5, h) * 0.35);

        // turquoise lagoons and pale shallows hugging each elliptical beach;
        // faded out with distance so far islands don't get a bright rim
        float dist0 = length(vWorld.xz - uCam.xz);
        float shoreVis = 1.0 - smoothstep(200.0, 480.0, dist0);
        for (int i = 0; i < 5; i++) {
          if (uIslands[i].z <= 0.0) continue;
          float d = length((vWorld.xz - uIslands[i].xy) * uIslands[i].zw);
          col = mix(col, vec3(0.45, 0.85, 0.78), smoothstep(1.55, 0.9, d) * 0.5 * shoreVis);
          col = mix(col, vec3(0.85, 0.93, 0.72), smoothstep(1.0, 0.82, d) * 0.55 * shoreVis);
        }

        // sun glitter path
        vec3 R = reflect(-V, n);
        float s = max(dot(R, uSunDir), 0.0);
        float sparkle = 0.5 + 0.9 * hash21(floor(vWorld.xz * 6.0) + floor(uTime * 4.0) * 0.37);
        float glit = pow(s, 320.0) * 2.0 * sparkle + pow(s, 48.0) * 0.10;
        col += vec3(1.0, 0.96, 0.78) * glit;

        // haze into the sky at the horizon — LINEAR with the same endpoints
        // as scene.fog so islands and water fade identically (no white band
        // under distant islands)
        float haze = clamp((dist - 400.0) / 550.0, 0.0, 1.0);
        col = mix(col, uHorizon, haze);

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
