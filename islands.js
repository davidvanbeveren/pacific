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
    text: 'the pacific charitable fund is a charity foundation directing money where the waves need it most — to farmed animals. we fund the people and projects working every day to make their lives better.',
  },
  {
    x: -496, z: -384, r: 70, sx: 1.45, sz: 0.75,
    lobes: [],
    title: 'values',
    text: 'compassion, transparency, and impact. every donation is a pebble dropped in the water — we make sure the ripples reach the animals who need them.',
  },
  {
    x: 120, z: -704, r: 45, sx: 0.8, sz: 1.35,
    lobes: [{ dx: -0.3, dz: 0.55, r: 0.45, grass: false }],
    title: 'team',
    text: "we're a small crew of grantmakers, researchers, and advocates who believe farmed animals deserve a peaceful world. one ocean, one mission.",
  },
  {
    x: -304, z: 496, r: 60, sx: 1.2, sz: 0.95,
    lobes: [{ dx: 0.5, dz: -0.4, r: 0.55, grass: true }],
    title: 'projects',
    text: 'we support sanctuaries, advocacy groups, and effective charities helping farmed animals — from rescue to research. explore who we fund, and why it matters.',
  },
  {
    x: 680, z: 304, r: 50, sx: 1.0, sz: 1.1,
    lobes: [
      { dx: -0.55, dz: -0.35, r: 0.42, grass: true },
      { dx: 0.5, dz: 0.45, r: 0.38, grass: false },
    ],
    title: 'contact',
    text: "want to donate, apply for funding, or just say hi? we'd love to hear from you — drop us a line and let's make waves for farmed animals together.",
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
