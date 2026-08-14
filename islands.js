import * as THREE from 'three';
import { emojiTexture } from './sky.js';

// Each island: center, base radius r, axis-aligned elongation (sx/sz), and
// optional lobes — smaller mounds inside the footprint — so every island
// has its own silhouette. rMax is the conservative circular footprint other
// modules use for spawn margins.
export const ISLANDS = [
  {
    x: 384, z: -256, r: 55, sx: 1.0, sz: 1.0,
    lobes: [{ dx: 0.55, dz: 0.35, r: 0.5, grass: true }],
    title: 'about',
    text: 'pacific charitable fund supports thoughtful, high-impact work to end factory farming and other forms of animal exploitation, creating a better world for animals, people, and the planet.',
  },
  {
    x: -496, z: -384, r: 70, sx: 1.45, sz: 0.75,
    lobes: [],
    title: 'values',
    text: 'animals first, impact driven, and open to what works. we look for ideas that can create efficient, scalable, and long-lasting progress toward ending animal exploitation.',
  },
  {
    x: 120, z: -704, r: 45, sx: 0.8, sz: 1.35,
    lobes: [{ dx: -0.3, dz: 0.55, r: 0.45, grass: false }],
    title: 'team',
    text: "we're a small team of animal advocates bringing together experience in research, philanthropy, technology, and advocacy, all working toward a world free from animal exploitation.",
  },
  {
    x: -304, z: 496, r: 60, sx: 1.2, sz: 0.95,
    lobes: [{ dx: 0.5, dz: -0.4, r: 0.55, grass: true }],
    title: 'projects',
    text: 'we support many paths toward ending animal exploitation — from grassroots activism, investigations, legal advocacy, and policy reform to research, technology, alternative proteins, journalism, and movement building.',
  },
  {
    x: 680, z: 304, r: 50, sx: 1.0, sz: 1.1,
    lobes: [
      { dx: -0.55, dz: -0.35, r: 0.42, grass: true },
      { dx: 0.5, dz: 0.45, r: 0.38, grass: false },
    ],
    title: 'contact',
    text: "we don't accept unsolicited emails at this time, but we appreciate your interest",
  },
];

// world-space palm positions, filled by makeIslands(); monkeys and other
// residents use these to climb and perch
export const PALMS = [];

function domesFor(isl) {
  const d = [];
  d.push({ x: isl.x, z: isl.z, rx: isl.r * 1.15 * isl.sx, rz: isl.r * 1.15 * isl.sz, h: isl.r * 0.2, y0: -isl.r * 0.02, mat: 'sand' });
  d.push({ x: isl.x, z: isl.z, rx: isl.r * 0.68 * isl.sx, rz: isl.r * 0.68 * isl.sz, h: isl.r * 0.26, y0: isl.r * 0.06, mat: 'grass' });
  for (const lb of isl.lobes) {
    const lr = lb.r * isl.r;
    const lx = isl.x + lb.dx * isl.r;
    const lz = isl.z + lb.dz * isl.r;
    d.push({ x: lx, z: lz, rx: lr * 1.2, rz: lr * 1.2, h: lr * 0.28, y0: -lr * 0.02, mat: 'sand' });
    if (lb.grass) d.push({ x: lx, z: lz, rx: lr * 0.66, rz: lr * 0.66, h: lr * 0.34, y0: lr * 0.06, mat: 'grass' });
  }
  return d;
}

for (const isl of ISLANDS) {
  isl.rMax = isl.r * Math.max(isl.sx, isl.sz);
  isl.domes = domesFor(isl);
}

// Terrain height at a world position: the tallest dome surface there, or
// -Infinity in open water.
export function islandHeight(x, z) {
  let best = -Infinity;
  for (const isl of ISLANDS) {
    const dx0 = x - isl.x;
    const dz0 = z - isl.z;
    if (dx0 * dx0 + dz0 * dz0 > (isl.rMax * 1.6) ** 2) continue;
    for (const dm of isl.domes) {
      const u = (x - dm.x) / dm.rx;
      const w = (z - dm.z) / dm.rz;
      const q = u * u + w * w;
      if (q < 1) {
        const y = dm.y0 + dm.h * Math.sqrt(1 - q);
        if (y > best) best = y;
      }
    }
  }
  return best;
}

// a white flag with the fund's logo, planted on the "about" island and
// waving in the wind (traveling-wave vertex shader, hinged at the pole)
export function makeFlag() {
  const group = new THREE.Group();
  const isl = ISLANDS[0];
  // plant the pole on the sand near the island's edge, on the side that
  // faces the spawn point so arriving sailors see it first
  const toSpawn = Math.atan2(-isl.x, -isl.z) - 0.35; // nudged left as seen arriving from spawn
  const d = isl.r * 0.9;
  const px = isl.x + Math.sin(toSpawn) * d;
  const pz = isl.z + Math.cos(toSpawn) * d;
  const baseY = Math.max(islandHeight(px, pz), 0);
  const poleH = 18;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, poleH, 10),
    new THREE.MeshLambertMaterial({ color: 0xf4f4f4 })
  );
  pole.position.set(px, baseY + poleH / 2, pz);
  group.add(pole);
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xf7dd8c })
  );
  knob.position.set(px, baseY + poleH + 0.3, pz);
  group.add(knob);

  // white cloth with the logo drawn once the image loads
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 640;
  const x2 = c.getContext('2d');
  x2.fillStyle = '#ffffff';
  x2.fillRect(0, 0, 1024, 640);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const img = new Image();
  img.onload = () => {
    const m = 70;
    const s = Math.min((c.width - m * 2) / img.width, (c.height - m * 2) / img.height);
    const w = img.width * s;
    const h = img.height * s;
    x2.drawImage(img, (c.width - w) / 2 - 54, (c.height - h) / 2, w, h);
    tex.needsUpdate = true;
  };
  img.src = './flag-logo.png';

  const geo = new THREE.PlaneGeometry(11, 6.5, 24, 12);
  geo.translate(5.5, 0, 0); // hinge the cloth at the pole edge
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uMap: { value: tex } },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float w = uv.x; // 0 at the pole, 1 at the free end
        p.z += (sin(uv.x * 6.0 - uTime * 3.2) * 0.7 + sin(uv.x * 11.0 - uTime * 5.1) * 0.25) * w;
        p.y += sin(uv.x * 4.0 - uTime * 2.4) * 0.22 * w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec2 vUv;
      void main() {
        // flip U on the back face so the logo never reads mirrored
        vec2 uv2 = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
        gl_FragColor = texture2D(uMap, uv2);
        #include <colorspace_fragment>
      }
    `,
  });
  const flag = new THREE.Mesh(geo, mat);
  flag.position.set(px, baseY + poleH - 3.6, pz);
  flag.rotation.y = 2.5;
  group.add(flag);
  return {
    group,
    update(t) {
      mat.uniforms.uTime.value = t;
    },
  };
}

function speckleTexture(base, layers, strokes) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, 256, 256);
  for (const [color, count, rmin, rmax] of layers) {
    x.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const r = rmin + Math.random() * (rmax - rmin);
      x.beginPath();
      x.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2);
      x.fill();
    }
  }
  if (strokes) {
    x.strokeStyle = strokes;
    x.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      const sx = Math.random() * 256;
      const sy = Math.random() * 256;
      x.beginPath();
      x.moveTo(sx, sy);
      x.lineTo(sx + (Math.random() - 0.5) * 3, sy - 3 - Math.random() * 4);
      x.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeIslands() {
  const group = new THREE.Group();
  const sandTex = speckleTexture('#ecd9a4', [
    ['#dcc48d', 500, 0.7, 1.6],
    ['#f8eec9', 350, 0.6, 1.4],
    ['#c9b075', 160, 0.5, 1.1],
  ]);
  sandTex.repeat.set(6, 3);
  const grassTex = speckleTexture(
    '#57b56a',
    [
      ['#4aa35d', 260, 1.5, 3.2],
      ['#68c87c', 220, 1.2, 2.8],
      ['#3f9251', 120, 1.0, 2.0],
    ],
    '#3c8f4e'
  );
  grassTex.repeat.set(5, 3);
  const sandMat = new THREE.MeshLambertMaterial({ map: sandTex });
  const grassMat = new THREE.MeshLambertMaterial({ map: grassTex });
  const palmTex = emojiTexture('🌴', 512);
  // a different flower species per island
  const flowerTexes = ['🌺', '🌷', '🌻', '🌼', '🌸'].map((f) => emojiTexture(f, 256));
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807 + 19) % 2147483647;
    return (seed & 0xffff) / 0xffff;
  };

  ISLANDS.forEach((isl, ii) => {
    const flowerTex = flowerTexes[ii % flowerTexes.length];
    for (const dm of isl.domes) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14), dm.mat === 'sand' ? sandMat : grassMat);
      mesh.scale.set(dm.rx, dm.h, dm.rz);
      mesh.position.set(dm.x, dm.y0, dm.z);
      group.add(mesh);
    }
    const grassDomes = isl.domes.filter((d) => d.mat === 'grass');
    // floating section label above the island, frosted like the sky text;
    // fog disabled so it stays readable from far away (it's signage)
    if (isl.title) {
      const lc = document.createElement('canvas');
      lc.width = 1024;
      lc.height = 256;
      const lx = lc.getContext('2d');
      lx.textAlign = 'center';
      lx.textBaseline = 'middle';
      if ('letterSpacing' in lx) lx.letterSpacing = '4px';
      lx.font = '800 170px "Helvetica Neue", Helvetica, Arial, sans-serif';
      const lg = lx.createLinearGradient(0, 30, 0, 226);
      lg.addColorStop(0, 'rgba(243,252,255,0.96)');
      lg.addColorStop(1, 'rgba(185,227,247,0.9)');
      lx.fillStyle = lg;
      lx.fillText(isl.title, 512, 132);
      const ltex = new THREE.CanvasTexture(lc);
      ltex.colorSpace = THREE.SRGBColorSpace;
      ltex.anisotropy = 4;
      const lspr = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: ltex, transparent: true, depthWrite: false, fog: false })
      );
      const lw = Math.max(55, isl.r * 1.15);
      lspr.position.set(isl.x, isl.r * 0.9 + 12, isl.z);
      lspr.scale.set(lw, lw / 4, 1);
      group.add(lspr);
    }

    grassDomes.forEach((gd, gi) => {
      const palms = gi === 0 ? 2 + Math.floor(rnd() * 2) : 1;
      for (let p = 0; p < palms; p++) {
        const a = rnd() * Math.PI * 2;
        const fr = rnd() * 0.45;
        const px = gd.x + Math.cos(a) * gd.rx * fr;
        const pz = gd.z + Math.sin(a) * gd.rz * fr;
        const s = isl.r * (0.4 + rnd() * 0.25);
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: palmTex, transparent: true }));
        spr.position.set(px, islandHeight(px, pz) + s * 0.22, pz);
        spr.scale.set(s, s, 1);
        group.add(spr);
        PALMS.push({ x: px, z: pz, top: spr.position.y + s * 0.3, isl });
      }
      const fa = rnd() * Math.PI * 2;
      const fx = gd.x + Math.cos(fa) * gd.rx * 0.5;
      const fz = gd.z + Math.sin(fa) * gd.rz * 0.5;
      const fs = isl.r * 0.12;
      const flower = new THREE.Sprite(new THREE.SpriteMaterial({ map: flowerTex, transparent: true }));
      flower.position.set(fx, islandHeight(fx, fz) + fs * 0.18, fz);
      flower.scale.set(fs, fs, 1);
      group.add(flower);
    });
  });
  return group;
}
