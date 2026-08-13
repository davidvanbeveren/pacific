import * as THREE from 'three';
import { waveHeight, COLORS } from './waves.js';
import { emojiTexture } from './sky.js';
import { ISLANDS } from './islands.js';

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 19) % 2147483647;
    return (s & 0xffff) / 0xffff;
  };
}

// Kelp: ribbon blades rooted below the surface with their tips poking out,
// swaying in a shared shader. Per-blade phase is derived from world position
// so one material serves every blade.
export function makeKelp() {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.5, 1, 1, 8);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uHorizon: { value: new THREE.Color(COLORS.horizon) },
    },
    vertexShader: `
      uniform float uTime;
      varying float vH;
      varying vec3 vWorld;
      void main() {
        vH = uv.y;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec2 base = vec2(modelMatrix[3].x, modelMatrix[3].z);
        float ph = base.x * 0.83 + base.y * 1.19;
        float sway = sin(uTime * 1.2 + ph) * 0.55 + sin(uTime * 2.1 + ph * 1.7) * 0.18;
        vec2 dir = normalize(vec2(sin(ph * 2.3), cos(ph * 1.4)));
        wp.xz += dir * sway * vH * vH;
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uHorizon;
      varying float vH;
      varying vec3 vWorld;
      void main() {
        vec3 col = mix(vec3(0.08, 0.35, 0.18), vec3(0.30, 0.75, 0.38), vH);
        // fade into the same haze the water uses so distant kelp doesn't
        // draw saturated green on the washed-out horizon
        float hz = smoothstep(340.0, 610.0, distance(vWorld.xz, cameraPosition.xz));
        col = mix(col, uHorizon, hz);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const rnd = rng(31);
  // kelp grows only around the islands, following each footprint
  const patches = [];
  for (const isl of ISLANDS) {
    for (let c = 0; c < 4; c++) {
      const a = rnd() * Math.PI * 2;
      const d = isl.r * 1.15 + 10 + rnd() * 25;
      patches.push([isl.x + Math.cos(a) * d * isl.sx, isl.z + Math.sin(a) * d * isl.sz]);
    }
  }

  for (const [px, pz] of patches) {
    const blades = 6 + Math.floor(rnd() * 5);
    for (let b = 0; b < blades; b++) {
      const m = new THREE.Mesh(geo, mat);
      const a = rnd() * Math.PI * 2;
      const d = rnd() * 6;
      m.position.set(px + Math.cos(a) * d, -2.6, pz + Math.sin(a) * d);
      m.scale.set(0.8 + rnd() * 0.7, 3.4 + rnd() * 1.8, 1);
      m.rotation.y = rnd() * Math.PI;
      group.add(m);
    }
  }
  return {
    group,
    update(t) {
      mat.uniforms.uTime.value = t;
    },
  };
}

// Lily pads riding the waves, some carrying frogs that hop between pads.
export function makeLilies() {
  const group = new THREE.Group();
  const rnd = rng(97);
  const padGeo = new THREE.CircleGeometry(1, 26, 0.25, Math.PI * 1.8);
  const padMat = new THREE.MeshLambertMaterial({ color: 0x3da45c, side: THREE.DoubleSide });
  const frogTex = emojiTexture('🐸', 256);
  const lotusTex = emojiTexture('🌸', 256);
  const CLUSTERS = [[120, -70], [-140, -260], [520, -180], [-540, -350]];
  const pads = [];
  const frogs = [];

  for (const [cx, cz] of CLUSTERS) {
    const clusterPads = [];
    const n = 6 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(padGeo, padMat);
      const a = rnd() * Math.PI * 2;
      const d = rnd() * 9;
      const s = 0.8 + rnd() * 0.9;
      m.rotation.order = 'YXZ';
      m.rotation.y = rnd() * Math.PI * 2;
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d);
      m.scale.set(s, s, 1);
      group.add(m);
      const rec = { m, x: m.position.x, z: m.position.z };
      pads.push(rec);
      clusterPads.push(rec);
    }

    const lotusPad = clusterPads[0];
    const lotus = new THREE.Sprite(new THREE.SpriteMaterial({ map: lotusTex, transparent: true }));
    lotus.scale.set(1.1, 1.1, 1);
    group.add(lotus);
    lotusPad.deco = lotus;

    for (let f = 0; f < 2 && clusterPads.length > f + 1; f++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: frogTex, transparent: true }));
      spr.scale.set(1.3, 1.3, 1);
      group.add(spr);
      frogs.push({
        spr,
        pad: clusterPads[f + 1],
        cluster: clusterPads,
        state: 'sit',
        t: 0,
        next: 4 + rnd() * 8,
        from: null,
        to: null,
      });
    }
  }

  return {
    group,
    update(dt, t) {
      for (const p of pads) {
        p.m.position.y = waveHeight(p.x, p.z, t) + 0.05;
        if (p.deco) p.deco.position.set(p.x, p.m.position.y + 0.5, p.z);
      }
      for (const fr of frogs) {
        fr.t += dt;
        if (fr.state === 'sit') {
          fr.spr.position.set(fr.pad.x, fr.pad.m.position.y + 0.55, fr.pad.z);
          if (fr.t > fr.next) {
            const others = fr.cluster.filter((p) => p !== fr.pad && !p.deco);
            fr.from = fr.pad;
            fr.to = others[Math.floor(Math.random() * others.length)] || fr.pad;
            fr.state = 'hop';
            fr.t = 0;
          }
        } else {
          const u = Math.min(1, fr.t / 0.55);
          const x = fr.from.x + (fr.to.x - fr.from.x) * u;
          const z = fr.from.z + (fr.to.z - fr.from.z) * u;
          const y0 = fr.from.m.position.y;
          const y = y0 + (fr.to.m.position.y - y0) * u + Math.sin(Math.PI * u) * 1.3;
          fr.spr.position.set(x, y + 0.55, z);
          if (u >= 1) {
            fr.pad = fr.to;
            fr.state = 'sit';
            fr.t = 0;
            fr.next = 4 + Math.random() * 9;
          }
        }
      }
    },
  };
}
