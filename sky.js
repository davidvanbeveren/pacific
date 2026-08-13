import * as THREE from 'three';
import { COLORS } from './waves.js';

export function emojiTexture(char, size = 512, flip = false) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  if (flip) {
    x.translate(size, 0);
    x.scale(-1, 1);
  }
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `${Math.round(size * 0.78)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  x.fillText(char, size / 2, size / 2 + size * 0.05);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSky() {
  const geo = new THREE.SphereGeometry(2600, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(COLORS.skyTop) },
      uHorizon: { value: new THREE.Color(COLORS.horizon) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      varying vec3 vDir;
      void main() {
        float h = clamp(normalize(vDir).y, 0.0, 1.0);
        float m = pow(smoothstep(0.0, 0.6, h), 0.8);
        gl_FragColor = vec4(mix(uHorizon, uTop, m), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  return mesh;
}

export function makeSun(pos) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const cx = S / 2;
  const cy = S / 2;

  // big warm halo — bright and wide so the sun glows far outward
  let g = x.createRadialGradient(cx, cy, 0, cx, cy, 512);
  g.addColorStop(0, 'rgba(255,248,210,1)');
  g.addColorStop(0.2, 'rgba(255,241,180,0.85)');
  g.addColorStop(0.5, 'rgba(255,237,170,0.45)');
  g.addColorStop(0.8, 'rgba(255,236,168,0.16)');
  g.addColorStop(1, 'rgba(255,236,168,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);

  // sharp triangular rays, alternating long/short, with a gap off the disc;
  // the bottom five are omitted per the logo design
  x.save();
  x.translate(cx, cy);
  x.fillStyle = '#fdf2c0'; // flat, same cream as the logo
  const N = 16;
  for (let i = 0; i < N; i++) {
    if (i >= 6 && i <= 10) continue; // bottom five spikes removed
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    const long = i % 2 === 0;
    const len = long ? 400 : 300;
    const hw = long ? 24 : 19;
    x.save();
    x.rotate(a);
    x.beginPath();
    x.moveTo(190, -hw);
    x.lineTo(len, 0);
    x.lineTo(190, hw);
    x.closePath();
    x.fill();
    x.restore();
  }
  x.restore();

  // middle shape: the supplied four-segment peace mark. Build the hard
  // mask (circle minus peace lines), then blur + threshold the alpha to
  // round every corner like the logo's soft organic shapes.
  const seg = document.createElement('canvas');
  seg.width = seg.height = S;
  const sx2 = seg.getContext('2d');
  const R = 150;
  sx2.fillStyle = '#ffffff';
  sx2.beginPath();
  sx2.arc(cx, cy, R, 0, Math.PI * 2);
  sx2.fill();
  sx2.globalCompositeOperation = 'destination-out';
  sx2.lineCap = 'round';
  sx2.lineWidth = 38;
  sx2.beginPath();
  sx2.moveTo(cx, cy - R - 14);
  sx2.lineTo(cx, cy + R + 14);
  sx2.stroke();
  const dd = (R + 14) * Math.SQRT1_2;
  sx2.beginPath();
  sx2.moveTo(cx, cy);
  sx2.lineTo(cx - dd, cy + dd);
  sx2.stroke();
  sx2.beginPath();
  sx2.moveTo(cx, cy);
  sx2.lineTo(cx + dd, cy + dd);
  sx2.stroke();
  sx2.globalCompositeOperation = 'source-over';
  const soft = document.createElement('canvas');
  soft.width = soft.height = S;
  const s3 = soft.getContext('2d');
  s3.filter = 'blur(12px)';
  s3.drawImage(seg, 0, 0);
  s3.filter = 'none';
  const img = s3.getImageData(0, 0, S, S);
  const dpx = img.data;
  for (let i = 3; i < dpx.length; i += 4) dpx[i] = dpx[i] > 140 ? 255 : 0;
  s3.putImageData(img, 0, 0);
  s3.globalCompositeOperation = 'source-in';
  s3.fillStyle = '#fdf2c0'; // flat cream-yellow, like the logo art
  s3.fillRect(0, 0, S, S);
  // deep-gold backing behind the logo so the peace gaps read as a darker
  // warm glow (never blue sky), matching the logo art
  g = x.createRadialGradient(cx, cy, 0, cx, cy, 150);
  g.addColorStop(0, '#f3d084');
  g.addColorStop(0.8, '#f6d890');
  g.addColorStop(0.94, 'rgba(246,216,144,0.7)');
  g.addColorStop(1, 'rgba(246,216,144,0)');
  x.fillStyle = g;
  x.beginPath();
  x.arc(cx, cy, 150, 0, Math.PI * 2);
  x.fill();
  x.save();
  x.shadowColor = 'rgba(255,240,170,0.95)';
  x.shadowBlur = 40;
  x.filter = 'blur(1px)';
  x.drawImage(soft, 0, 0);
  x.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  spr.position.copy(pos);
  spr.scale.set(480, 480, 1);
  return spr;
}

export function makePacificText() {
  const W = 2048;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  if ('letterSpacing' in x) x.letterSpacing = '8px';
  x.font = '900 300px "Helvetica Neue", Helvetica, Arial, sans-serif';
  const g = x.createLinearGradient(0, H / 2 - 150, 0, H / 2 + 150);
  g.addColorStop(0, 'rgba(243,252,255,0.96)');
  g.addColorStop(1, 'rgba(185,227,247,0.90)');
  x.fillStyle = g;
  x.fillText('PACIFIC', W / 2, H / 2 + 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(620, (620 * H) / W), mat);
  mesh.position.set(0, 195, -720);
  mesh.lookAt(0, 8, 0);
  return mesh;
}

export function makeEmojiRow() {
  const group = new THREE.Group();
  const chars = ['🐮', '🐷', '🐔', '🐟', '🦐'];
  const sprites = [];
  chars.forEach((ch, i) => {
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: emojiTexture(ch, 512), transparent: true, depthWrite: false })
    );
    spr.position.set((i - 2) * 66, 74, -480);
    spr.scale.set(54, 54, 1);
    spr.userData = { baseY: 74, phase: i * 1.3 };
    group.add(spr);
    sprites.push(spr);
  });
  return {
    group,
    update(t) {
      for (const s of sprites) {
        s.position.y = s.userData.baseY + Math.sin(t * 0.6 + s.userData.phase) * 2.2;
      }
    },
  };
}

function cloudTexture(seed) {
  const W = 640;
  const H = 320;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  let s = seed;
  const rnd = () => {
    s = (s * 16807 + 19) % 2147483647;
    return (s & 0xffff) / 0xffff;
  };
  const baseY = H * 0.66;
  // soft-edged lobe: solid white center feathering out — overlapping these
  // builds the cumulus mass with a naturally soft silhouette
  const lobe = (px, py, r) => {
    const g = x.createRadialGradient(px, py, r * 0.2, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.72, 'rgba(255,255,255,0.97)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
  };
  // main lobes, biggest in the middle
  const bigs = [];
  const n = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const bell = 1 - Math.abs((2 * i) / (n - 1) - 1);
    const px = W * 0.18 + W * 0.64 * (i / (n - 1)) + (rnd() - 0.5) * 34;
    const r = 44 + rnd() * 26 + 64 * bell;
    const py = baseY - r * (0.55 + rnd() * 0.25);
    bigs.push({ px, py, r });
    lobe(px, py, r);
  }
  // detail bumps riding the upper rim of each big lobe — always attached
  for (const b of bigs) {
    const bumps = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < bumps; i++) {
      const a = Math.PI * (1.15 + rnd() * 0.7); // upper arc
      const rr = b.r * (0.3 + rnd() * 0.25);
      lobe(b.px + Math.cos(a) * b.r * 0.8, b.py + Math.sin(a) * b.r * 0.8, rr);
    }
  }
  // filler along the flat-ish bottom
  const fills = n + 3;
  for (let i = 0; i < fills; i++) {
    const px = W * 0.16 + W * 0.68 * (i / (fills - 1));
    lobe(px, baseY - 20 - rnd() * 12, 28 + rnd() * 20);
  }
  // soft blue shading on the underside, clipped to the cloud
  x.globalCompositeOperation = 'source-atop';
  const sh = x.createLinearGradient(0, baseY - 100, 0, baseY + 14);
  sh.addColorStop(0, 'rgba(185,212,236,0)');
  sh.addColorStop(0.75, 'rgba(176,206,233,0.28)');
  sh.addColorStop(1, 'rgba(168,201,230,0.5)');
  x.fillStyle = sh;
  x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeClouds() {
  const group = new THREE.Group();
  const mats = [1, 2, 3, 4, 5, 6].map(
    (s) => new THREE.SpriteMaterial({ map: cloudTexture(s * 7919), transparent: true, depthWrite: false, opacity: 0.97 })
  );
  const items = [];
  const add = (bx, by, bz, sc, m) => {
    const spr = new THREE.Sprite(mats[m % mats.length]);
    spr.position.set(bx, by, bz);
    spr.scale.set(sc, sc * 0.5, 1);
    group.add(spr);
    items.push({ spr, r: Math.hypot(bx, bz), a: Math.atan2(bx, bz), y: by });
  };
  const BIG = [
    [-740, 310, -800, 320], [-760, 170, -520, 260], [-820, 130, -880, 230], [-980, 260, -180, 300],
    [720, 330, -780, 340], [790, 160, -560, 250], [840, 120, -900, 220], [1000, 240, -140, 290],
    [-620, 240, 620, 300], [640, 260, 660, 310], [60, 320, 980, 330], [-140, 150, 1050, 260],
  ];
  BIG.forEach((b, i) => add(b[0], b[1], b[2], b[3], i));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.13;
    const r = 1500 + (i % 3) * 160;
    add(Math.sin(a) * r, 18 + (i % 3) * 10, Math.cos(a) * r, 90 + (i % 4) * 26, i);
  }
  return {
    group,
    // gentle azimuthal sway so clouds feel alive but never migrate into
    // the center of the composition
    update(t) {
      for (const it of items) {
        const a = it.a + Math.sin(t * 0.06 + it.a * 3.0) * 0.05;
        it.spr.position.x = Math.sin(a) * it.r;
        it.spr.position.z = Math.cos(a) * it.r;
      }
    },
  };
}
