import * as THREE from 'three';
import { waveHeight, COLORS } from './waves.js';
import { makeWater } from './water.js';
import { makeSky, makeSun, makeClouds, makePacificText, makeEmojiRow } from './sky.js';
import { makeBoat, DECK } from './boat.js';
import { startAudio, toggleMusic, toggleSfx, playCollect } from './audio.js';
import { Treasure, HAIKUS } from './treasure.js';
import { makeIslands, ISLANDS } from './islands.js';
import { makeKelp, makeLilies } from './flora.js';
import { SeaLife } from './life.js';

const app = document.getElementById('app');
const stick = document.getElementById('stick');
const knob = document.getElementById('knob');
const menu = document.getElementById('menu');
const startBtn = document.getElementById('start');
const dot = document.getElementById('dot');
const escUI = document.getElementById('esc');
const pageEl = document.getElementById('page');
const pageTitle = document.getElementById('page-title');
const pageText = document.getElementById('page-text');
let pageIsl = null;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// fog endpoints MUST match the water shader's linear haze (400 → 950) so
// islands fade into the horizon at exactly the same rate as the sea
scene.fog = new THREE.Fog(new THREE.Color(COLORS.horizon), 400, 950);
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 6000);

const SUN_POS = new THREE.Vector3(0, 820, -1250);

scene.add(new THREE.HemisphereLight(0xcde9ff, 0x3f83b8, 1.15));
const sunLight = new THREE.DirectionalLight(0xfff1c0, 1.2);
sunLight.position.copy(SUN_POS);
scene.add(sunLight);

const water = makeWater(SUN_POS);
scene.add(water.mesh);

// Sky, sun, text, emojis, and clouds travel with the boat like real sky —
// the composition stays overhead wherever you sail. Islands stay put.
const celestial = new THREE.Group();
celestial.add(makeSky());
celestial.add(makeSun(SUN_POS));
const clouds = makeClouds();
celestial.add(clouds.group);
celestial.add(makePacificText());
const emojiRow = makeEmojiRow();
celestial.add(emojiRow.group);
celestial.traverse((o) => {
  if (o.material) o.material.fog = false;
});
scene.add(celestial);

scene.add(makeIslands());
const kelp = makeKelp();
scene.add(kelp.group);
const lilies = makeLilies();
scene.add(lilies.group);

const boat = makeBoat();
boat.group.rotation.order = 'YXZ';
scene.add(boat.group);

const life = new SeaLife(scene);
const treasure = new Treasure(scene);

// treasure UI: counter, the haiku note on collect, and the "3" book
const chestCount = document.getElementById('chest-count');
const noteEl = document.getElementById('note');
const noteText = document.getElementById('note-text');
const treasureEl = document.getElementById('treasure');
const treasureList = document.getElementById('treasure-list');
let noteTimer = null;

function showNote(haiku) {
  noteText.textContent = haiku;
  noteEl.classList.add('show');
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => noteEl.classList.remove('show'), 5000);
}

// minimap (north-up, whole world) + compass (needle = where north is
// relative to your current look direction)
const mapCtx = document.getElementById('minimap').getContext('2d');
const compCtx = document.getElementById('compass').getContext('2d');

function drawMap() {
  const S = 180;
  const C = S / 2;
  const scale = (C - 12) / 900;
  mapCtx.clearRect(0, 0, S, S);
  mapCtx.fillStyle = 'rgba(23,80,126,0.5)';
  mapCtx.font = '600 9px -apple-system, sans-serif';
  mapCtx.textAlign = 'center';
  mapCtx.textBaseline = 'middle';
  mapCtx.fillText('n', C, 8);
  mapCtx.fillText('s', C, S - 8);
  mapCtx.fillText('e', S - 8, C);
  mapCtx.fillText('w', 8, C);
  for (const isl of ISLANDS) {
    const mx = C + isl.x * scale;
    const my = C + isl.z * scale;
    const rx = Math.max(4.5, isl.r * 1.15 * isl.sx * scale);
    const rz = Math.max(4.5, isl.r * 1.15 * isl.sz * scale);
    mapCtx.fillStyle = '#ecd9a4';
    mapCtx.beginPath();
    mapCtx.ellipse(mx, my, rx, rz, 0, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.fillStyle = '#57b56a';
    mapCtx.beginPath();
    mapCtx.ellipse(mx, my, rx * 0.55, rz * 0.55, 0, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.fillStyle = 'rgba(20,80,126,0.85)';
    mapCtx.font = '600 8px -apple-system, sans-serif';
    mapCtx.fillText(isl.title, mx, my - rz - 5);
  }
  mapCtx.fillStyle = '#e6b53f';
  for (const c of treasure.chests) {
    if (c.taken) continue;
    mapCtx.beginPath();
    mapCtx.arc(C + c.x * scale, C + c.z * scale, 2, 0, Math.PI * 2);
    mapCtx.fill();
  }
  // boat arrow, pointing along its heading
  mapCtx.save();
  mapCtx.translate(C + bx * scale, C + bz * scale);
  mapCtx.rotate(-heading);
  mapCtx.fillStyle = '#ffffff';
  mapCtx.strokeStyle = 'rgba(23,80,126,0.9)';
  mapCtx.lineWidth = 1.2;
  mapCtx.beginPath();
  mapCtx.moveTo(0, -6);
  mapCtx.lineTo(4.2, 5);
  mapCtx.lineTo(-4.2, 5);
  mapCtx.closePath();
  mapCtx.fill();
  mapCtx.stroke();
  mapCtx.restore();
}

function drawCompass() {
  const S = 64;
  const C = S / 2;
  compCtx.clearRect(0, 0, S, S);
  compCtx.save();
  compCtx.translate(C, C);
  compCtx.rotate(heading + yaw);
  compCtx.fillStyle = '#e05a4e';
  compCtx.beginPath();
  compCtx.moveTo(0, -20);
  compCtx.lineTo(5, 0);
  compCtx.lineTo(-5, 0);
  compCtx.closePath();
  compCtx.fill();
  compCtx.fillStyle = 'rgba(255,255,255,0.95)';
  compCtx.beginPath();
  compCtx.moveTo(0, 20);
  compCtx.lineTo(5, 0);
  compCtx.lineTo(-5, 0);
  compCtx.closePath();
  compCtx.fill();
  compCtx.fillStyle = '#ffffff';
  compCtx.font = '700 9px -apple-system, sans-serif';
  compCtx.textAlign = 'center';
  compCtx.textBaseline = 'middle';
  compCtx.fillText('n', 0, -26);
  compCtx.restore();
}

function toggleTreasure(force) {
  const show = force !== undefined ? force : !treasureEl.classList.contains('show');
  if (show) {
    treasureList.innerHTML = treasure.chests
      .map((c) => {
        const found = c.taken;
        return `<div class="haiku${found ? '' : ' locked'}"><span class="hnum">${c.i + 1}</span><p>${
          found ? HAIKUS[c.i] : '🔒 not found yet — keep sailing'
        }</p></div>`;
      })
      .join('');
  }
  treasureEl.classList.toggle('show', show);
}

// Player rig: fixed spot on deck — you steer the boat rather than walking.
// Yaw on the rig, pitch on the camera; boat heading and rocking carry both.
const rig = new THREE.Group();
rig.position.set(0, DECK.y + DECK.eye, 2.0);
boat.group.add(rig);
rig.add(camera);
let yaw = 0;
let pitch = 0;

// boat state
let heading = 0;
let speed = 0;
let bx = 0;
let bz = 0;
let wakeT = 0;
let berryCd = 0;

function clampPitch(p) {
  return Math.max(-1.35, Math.min(1.35, p));
}

const isTouch = matchMedia('(pointer: coarse)').matches;

// start menu: game input is suspended while it's open; Start captures the
// mouse, Esc (or losing pointer lock) brings the menu back and frees it
let menuOpen = true;
dot.style.display = 'none';

function openMenu() {
  if (menuOpen) return;
  menuOpen = true;
  menu.classList.remove('gone');
  keys.clear();
  clearKeyUI();
  dot.style.display = 'none';
  toggleTreasure(false);
  noteEl.classList.remove('show');
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
}

function closeMenu() {
  menuOpen = false;
  menu.classList.add('gone');
  if (!isTouch) dot.style.display = 'block';
  tryLock();
  startAudio();
}

// on-screen keycap guide (bottom right); lights up with the pressed keys
const keysUI = document.getElementById('keys');
const keyEls = keysUI.querySelectorAll('.key');
const audioUI = document.getElementById('audioui');
if (isTouch) {
  keysUI.style.display = 'none';
  escUI.style.display = 'none';
  audioUI.style.display = 'none';
}
const KEY_ALIAS = {
  ArrowUp: 'KeyW',
  ArrowDown: 'KeyS',
  ArrowLeft: 'KeyA',
  ArrowRight: 'KeyD',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
};
function setKeyUI(code, on) {
  const k = KEY_ALIAS[code] || code;
  for (const el of keyEls) if (el.dataset.k === k) el.classList.toggle('active', on);
}
function clearKeyUI() {
  for (const el of keyEls) el.classList.remove('active');
}

// Capture the pointer (cursor disappears, infinite look) on any gesture;
// the browser releases it on Esc, and the next click/keypress re-captures.
function tryLock() {
  if (isTouch || document.pointerLockElement === renderer.domElement) return;
  try {
    const p = renderer.domElement.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch {}
}

const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (e.isTrusted) openMenu();
    return;
  }
  if (e.code === 'Digit1') {
    document.getElementById('mute-music').classList.toggle('muted', toggleMusic());
    return;
  }
  if (e.code === 'Digit2') {
    document.getElementById('mute-sfx').classList.toggle('muted', toggleSfx());
    return;
  }
  if (e.code === 'Digit3') {
    toggleTreasure();
    return;
  }
  if (menuOpen) {
    if (e.code === 'Enter' || e.code === 'Space') closeMenu();
    return;
  }
  keys.add(e.code);
  setKeyUI(e.code, true);
  if (e.code.startsWith('Arrow')) e.preventDefault();
  tryLock();
  startAudio();
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  setKeyUI(e.code, false);
});
// keyups are lost when focus leaves the window — drop held keys or the
// boat sails forever on return
window.addEventListener('blur', () => {
  keys.clear();
  clearKeyUI();
  curX = -1;
});
document.addEventListener('mouseleave', () => {
  curX = -1;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    keys.clear();
    clearKeyUI();
  }
});

let lookId = null;
let lastX = 0;
let lastY = 0;
// cursor position for the edge-turn fallback (embedded browsers can deny
// pointer lock entirely; -1 = cursor not over the window)
let curX = -1;
let curY = -1;
let joyId = null;
let joyBase = null;
const joy = { x: 0, y: 0 };

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (menuOpen) return;
  startAudio();
  if (e.pointerType === 'mouse') {
    if (e.button === 0) tryLock();
    return;
  }
  if (e.clientX < innerWidth * 0.45 && joyId === null) {
    joyId = e.pointerId;
    joyBase = [e.clientX, e.clientY];
    stick.style.display = 'block';
    stick.style.left = e.clientX - 55 + 'px';
    stick.style.top = e.clientY - 55 + 'px';
    knob.style.transform = 'translate(0px,0px)';
    return;
  }
  if (lookId === null) {
    lookId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
  }
});

window.addEventListener('pointermove', (e) => {
  if (menuOpen) return;
  if (e.pointerType === 'mouse') {
    // free-look: moving the mouse always steers the camera, no click needed
    yaw -= e.movementX * 0.0022;
    pitch = clampPitch(pitch - e.movementY * 0.0022);
    curX = e.clientX;
    curY = e.clientY;
    return;
  }
  if (e.pointerId === joyId) {
    let dx = e.clientX - joyBase[0];
    let dy = e.clientY - joyBase[1];
    const l = Math.hypot(dx, dy) || 1;
    const r = Math.min(l, 44);
    dx = (dx / l) * r;
    dy = (dy / l) * r;
    joy.x = dx / 44;
    joy.y = dy / 44;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    return;
  }
  if (e.pointerId === lookId) {
    yaw -= (e.clientX - lastX) * 0.0042;
    pitch = clampPitch(pitch - (e.clientY - lastY) * 0.0042);
    lastX = e.clientX;
    lastY = e.clientY;
  }
});

function endPointer(e) {
  if (e.pointerType === 'mouse') return;
  if (e.pointerId === joyId) {
    joyId = null;
    joy.x = joy.y = 0;
    stick.style.display = 'none';
  }
  if (e.pointerId === lookId) lookId = null;
}
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);

startBtn.addEventListener('click', closeMenu);

const creditsLink = document.getElementById('credits-link');
creditsLink.addEventListener('click', (e) => {
  e.preventDefault();
  creditsLink.style.display = 'none';
  document.getElementById('credits-text').hidden = false;
});

document.addEventListener('pointerlockchange', () => {
  // Lock losses (tab switch, focus flicker, etc.) must NEVER pop the menu
  // mid-sail — they only release the cursor. The menu opens exclusively on
  // a real Escape key. While pointer-locked the browser eats the Escape
  // keydown but still delivers the keyup, which the handler below catches.
  curX = -1;
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Escape' && e.isTrusted) openMenu();
});

function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.9 ? 88 : 72;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

const clock = new THREE.Clock();
let t = 0;
const camWorld = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;

  // edge-turn: when pointer lock is unavailable and the cursor rests near
  // a screen edge, keep rotating that way so full turns never need the
  // cursor to leave the window
  if (!menuOpen && !isTouch && document.pointerLockElement !== renderer.domElement && curX >= 0) {
    const EDGE = 80;
    const left = Math.max(0, 1 - curX / EDGE);
    const right = Math.max(0, 1 - (innerWidth - curX) / EDGE);
    yaw += (left - right) * dt * 2.4;
    const up = Math.max(0, 1 - curY / EDGE);
    const down = Math.max(0, 1 - (innerHeight - curY) / EDGE);
    pitch = clampPitch(pitch + (up - down) * dt * 1.3);
  }

  rig.rotation.y = yaw;
  camera.rotation.x = pitch;

  // sail the boat: W/S throttle, A/D steer (joystick: y throttle, x steer)
  const thrust =
    (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
    (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) -
    joy.y;
  const turn =
    (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
    (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) +
    joy.x;

  // Shift = speed boost; when released, ease back down to cruise speed
  const boost = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const vmax = boost ? 26 : 14;
  speed += thrust * (boost ? 14 : 8) * dt;
  speed = Math.max(-5, Math.min(26, speed));
  if (speed > vmax) speed += (vmax - speed) * Math.min(1, dt * 1.5);
  if (!thrust) {
    speed *= Math.exp(-dt * 0.7);
    if (Math.abs(speed) < 0.02) speed = 0;
  }
  heading -= turn * dt * (0.35 + 0.65 * Math.min(1, Math.abs(speed) / 8));

  const fx = -Math.sin(heading);
  const fz = -Math.cos(heading);
  bx += fx * speed * dt;
  bz += fz * speed * dt;

  // keep the boat off the sand: test every sand dome (main body AND lobes)
  // with a world-space margin that covers the bow's reach
  for (const isl of ISLANDS) {
    const ddx = bx - isl.x;
    const ddz = bz - isl.z;
    if (ddx * ddx + ddz * ddz > (isl.rMax * 1.6 + 40) ** 2) continue;
    for (const dm of isl.domes) {
      if (dm.mat !== 'sand') continue;
      const ex = dm.rx + 13;
      const ez = dm.rz + 13;
      const px = (bx - dm.x) / ex;
      const pz = (bz - dm.z) / ez;
      const q = Math.hypot(px, pz);
      if (q < 1) {
        const s = 1 / (q || 1e-6);
        bx = dm.x + px * s * ex;
        bz = dm.z + pz * s * ez;
        speed *= 0.25;
      }
    }
  }

  boat.group.position.x = bx;
  boat.group.position.z = bz;
  boat.group.rotation.y = heading;

  // boat rides the same wave field the shader displaces (samples taken in
  // the boat's own frame), plus a little bow lift and turn heel
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);
  const hF = waveHeight(bx + fx * 5, bz + fz * 5, t);
  const hB = waveHeight(bx - fx * 5, bz - fz * 5, t);
  const hR = waveHeight(bx + rx * 2.5, bz + rz * 2.5, t);
  const hL = waveHeight(bx - rx * 2.5, bz - rz * 2.5, t);
  const k = Math.min(1, dt * 2.0);
  boat.group.position.y += ((hF + hB + hL + hR) / 4 + 1.05 - boat.group.position.y) * k;
  const bowLift = Math.min(speed, 16) * 0.004;
  boat.group.rotation.x += (Math.atan2(hF - hB, 10) * 0.9 + bowLift - boat.group.rotation.x) * k;
  const heel = turn * Math.min(1, Math.abs(speed) / 14) * 0.05;
  boat.group.rotation.z += (Math.atan2(hR - hL, 5) * 0.6 + heel - boat.group.rotation.z) * k;

  // wake ripples off the stern while under way
  wakeT -= dt;
  if (Math.abs(speed) > 2 && wakeT <= 0) {
    life.addRipple(bx - fx * 7.8, bz - fz * 7.8, 0.8, 0.3);
    wakeT = 0.16;
  }

  // E tosses blueberries out ahead — sea life comes to eat them
  if (berryCd > 0) berryCd -= dt;
  if (keys.has('KeyE') && berryCd <= 0) {
    const ly = heading + yaw;
    life.throwBerries(bx - Math.sin(ly) * 8, bz - Math.cos(ly) * 8, -Math.sin(ly), -Math.cos(ly));
    berryCd = 0.5;
  }

  emojiRow.update(t);
  clouds.update(t);
  kelp.update(t);
  lilies.update(dt, t);

  celestial.position.x = bx;
  celestial.position.z = bz;
  water.mesh.position.x = bx;
  water.mesh.position.z = bz;

  camera.getWorldPosition(camWorld);
  water.uniforms.uTime.value = t;
  water.uniforms.uCam.value.copy(camWorld);
  water.uniforms.uBoat.value.set(bx, bz);
  water.uniforms.uHead.value.set(Math.cos(heading), Math.sin(heading));

  life.update(dt, t, bx, bz, heading + yaw);

  treasure.update(dt, t, bx, bz, (i, count) => {
    chestCount.textContent = count + '/10';
    showNote(HAIKUS[i]);
    playCollect();
  });

  drawMap();
  drawCompass();

  // island pages: when close to an island and aiming the dot at it, show
  // that island's section text
  let hovered = null;
  if (!menuOpen) {
    const lookW = heading + yaw;
    for (const isl of ISLANDS) {
      const dx = isl.x - bx;
      const dz = isl.z - bz;
      const dist = Math.hypot(dx, dz);
      if (dist > isl.rMax + 170) continue;
      let diff = Math.atan2(-dx, -dz) - lookW;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (Math.abs(diff) < Math.atan2(isl.rMax, dist) + 0.06) {
        hovered = isl;
        break;
      }
    }
  }
  if (hovered !== pageIsl) {
    pageIsl = hovered;
    if (hovered) {
      pageTitle.textContent = hovered.title;
      pageText.textContent = hovered.text;
      pageEl.classList.add('show');
    } else {
      pageEl.classList.remove('show');
    }
  }

  // dev/debug handle (harmless in production)
  if (window.__teleport) {
    bx = window.__teleport.x;
    bz = window.__teleport.z;
    if (typeof window.__teleport.h === 'number') heading = window.__teleport.h;
    window.__teleport = null;
  }
  window.__pacific = window.__pacific || {};
  Object.assign(window.__pacific, { bx, bz, heading, speed, birds: life.birds.length, t });
  window.__life = life;

  renderer.render(scene, camera);
});
