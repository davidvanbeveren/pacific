import * as THREE from 'three';

// Deck constants shared with main.js: y = deck floor height (boat-local),
// eye = eye height above the deck.
export const DECK = { y: -0.55, eye: 5.0 };

function plankTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#b98a5a';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    const y0 = i * 32;
    x.fillStyle = i % 2 ? '#b28352' : '#bf9160';
    x.fillRect(0, y0, 256, 32);
    x.fillStyle = 'rgba(90,55,25,0.55)';
    x.fillRect(0, y0, 256, 2);
    x.strokeStyle = 'rgba(120,80,40,0.25)';
    for (let g = 0; g < 5; g++) {
      const yy = y0 + 4 + Math.random() * 26;
      x.beginPath();
      x.moveTo(0, yy);
      x.bezierCurveTo(60, yy + 3, 180, yy - 3, 256, yy + 2);
      x.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function veganBenchTexture() {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#c59a6a';
  x.fillRect(0, 0, 640, 128);
  x.strokeStyle = 'rgba(120,80,40,0.3)';
  for (let g = 0; g < 8; g++) {
    const yy = 8 + g * 16;
    x.beginPath();
    x.moveTo(0, yy);
    x.bezierCurveTo(160, yy + 3, 480, yy - 3, 640, yy + 2);
    x.stroke();
  }
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = '900 78px "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';
  // carved: dark recess with a pale lower lip catching the light
  x.fillStyle = 'rgba(88,52,22,0.92)';
  x.fillText('GO VEGAN', 320, 62);
  x.strokeStyle = 'rgba(255,236,200,0.4)';
  x.lineWidth = 2;
  x.strokeText('GO VEGAN', 320, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeBoat() {
  const group = new THREE.Group();
  const wood = plankTexture();
  const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85, side: THREE.DoubleSide });

  const hull = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    woodMat
  );
  hull.scale.set(3.0, 1.7, 7.6);
  group.add(hull);

  const deckTex = plankTexture();
  deckTex.repeat.set(2, 5);
  const deck = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.9 })
  );
  deck.scale.set(2.75, 6.9, 1);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = DECK.y;
  group.add(deck);

  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 3.0, 0, Math.sin(a) * 7.6));
  }
  const rim = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.2, 10, true),
    new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.7 })
  );
  group.add(rim);

  const benchMat = new THREE.MeshStandardMaterial({ color: 0xc59a6a, roughness: 0.8 });
  const veganMat = new THREE.MeshStandardMaterial({ map: veganBenchTexture(), roughness: 0.8 });
  for (const z of [-2.6, 3.0]) {
    const halfw = 3.0 * Math.sqrt(Math.max(0, 1 - (z / 7.6) ** 2));
    const geo = new THREE.BoxGeometry(halfw * 2 - 0.5, 0.14, 1.0);
    // the forward board carries the etched "GO VEGAN" on its top face
    const bench =
      z < 0
        ? new THREE.Mesh(geo, [benchMat, benchMat, veganMat, benchMat, benchMat, benchMat])
        : new THREE.Mesh(geo, benchMat);
    bench.position.set(0, 0.12, z);
    group.add(bench);
  }

  return { group };
}
