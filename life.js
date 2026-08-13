import * as THREE from 'three';
import { waveHeight } from './waves.js';
import { emojiTexture } from './sky.js';
import { ISLANDS, islandHeight, PALMS } from './islands.js';

function clearOfIslands(x, z, margin = 5) {
  for (const isl of ISLANDS) {
    if (Math.hypot((x - isl.x) / isl.sx, (z - isl.z) / isl.sz) < isl.r * 1.15 + margin) return false;
  }
  return true;
}

// Jumping species: weight controls how often each is picked; dolphins are
// bigger, rarer, and arc farther.
const SPECIES = [
  { char: '🐟', w: 4, size: [2.0, 3.2], apex: [2.4, 4.6], range: [5, 10], dist: [15, 45] },
  { char: '🐠', w: 2, size: [1.8, 2.6], apex: [2.0, 3.6], range: [4, 8], dist: [12, 40] },
  { char: '🐡', w: 1, size: [2.0, 2.8], apex: [1.8, 3.0], range: [3, 6], dist: [12, 35] },
  { char: '🐬', w: 2, size: [4.5, 6.0], apex: [4.5, 7.5], range: [12, 20], dist: [25, 70] },
];

const pick = ([a, b]) => a + Math.random() * (b - a);

export class SeaLife {
  constructor(scene) {
    this.scene = scene;
    // three.js sprites ignore negative scale (the shader takes length() of
    // the matrix columns), so mirroring needs a pre-flipped texture
    this.species = SPECIES.map((s) => ({
      ...s,
      tex: emojiTexture(s.char, 256),
      texFlipped: emojiTexture(s.char, 256, true),
    }));
    this.totalW = SPECIES.reduce((a, s) => a + s.w, 0);
    this.jumps = [];
    this.ripples = [];
    this.next = 2.0;
    this.rippleGeo = new THREE.RingGeometry(0.75, 1.0, 40);

    // turtles patrol the island beaches (on the sand, not in the water)
    this.turtles = [];
    const turtleTex = emojiTexture('🐢', 256);
    ISLANDS.forEach((isl, i) => {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: turtleTex, transparent: true }));
      const sc = Math.max(2.2, isl.r * 0.05);
      spr.scale.set(sc, sc, 1);
      scene.add(spr);
      this.turtles.push({
        spr,
        isl,
        sc,
        a: Math.random() * Math.PI * 2,
        speed: (0.015 + Math.random() * 0.02) * (i % 2 ? 1 : -1),
      });
    });

    // crabs scuttle out to eat blueberries that land on an island
    this.crabTex = emojiTexture('🦀', 256);
    this.crabs = [];

    this.whaleTex = emojiTexture('🐳', 512);
    this.whale = null;
    this.whaleNext = 12 + Math.random() * 15;

    // doves gliding across the sky now and then
    this.birdTex = emojiTexture('🕊️', 256);
    this.birdTexFlipped = emojiTexture('🕊️', 256, true);
    this.birds = [];
    this.birdNext = 6 + Math.random() * 8;

    // blueberries the player tosses (E); floating ones attract sea life
    this.berryTex = emojiTexture('🫐', 128);
    this.berries = [];

    // monkeys on the "about" island — hop around, climb the palms
    this.monkeyTex = emojiTexture('🐒', 256);
    this.monkeys = [];
    const mIsl = ISLANDS[0];
    for (let i = 0; i < 3; i++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.monkeyTex, transparent: true }));
      spr.scale.set(2.4, 2.4, 1);
      const a = Math.random() * Math.PI * 2;
      const x = mIsl.x + Math.cos(a) * mIsl.r * 0.4 * mIsl.sx;
      const z = mIsl.z + Math.sin(a) * mIsl.r * 0.4 * mIsl.sz;
      spr.position.set(x, Math.max(islandHeight(x, z), 0) + 1.0, z);
      scene.add(spr);
      this.monkeys.push({ spr, isl: mIsl, x, z, state: 'sit', t: 0, next: 1 + Math.random() * 3 });
    }

    // island residents: wild critters plus the farm friends the fund is
    // all about — cows, chickens, and pigs spread across the islands
    this.residents = [];
    const RES = [
      { i: 1, char: '🦩', count: 2, sc: 3.2 },
      { i: 2, char: '🦜', count: 1, sc: 2.0, palm: true },
      { i: 3, char: '🐇', count: 2, sc: 2.0 },
      { i: 4, char: '🦋', count: 2, sc: 1.6, air: true },
      { i: 1, char: '🐄', count: 2, sc: 3.0 },
      { i: 4, char: '🐄', count: 1, sc: 3.0 },
      { i: 0, char: '🐓', count: 2, sc: 2.2 },
      { i: 2, char: '🐓', count: 3, sc: 2.2 },
      { i: 0, char: '🐥', count: 2, sc: 1.3 },
      { i: 2, char: '🐥', count: 3, sc: 1.3 },
      { i: 3, char: '🐖', count: 2, sc: 2.6 },
      { i: 4, char: '🐖', count: 1, sc: 2.6 },
    ];
    for (const cfg of RES) {
      const isl = ISLANDS[cfg.i];
      const tex = emojiTexture(cfg.char, 256);
      for (let k = 0; k < cfg.count; k++) {
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        spr.scale.set(cfg.sc, cfg.sc, 1);
        scene.add(spr);
        if (cfg.palm) {
          const palms = PALMS.filter((p) => p.isl === isl);
          const p = palms[k % Math.max(1, palms.length)];
          spr.position.set(p ? p.x : isl.x, p ? p.top : isl.r * 0.35, p ? p.z : isl.z);
          this.residents.push({ spr, mode: 'palm', baseY: spr.position.y, phase: Math.random() * 6 });
        } else {
          this.residents.push({
            spr,
            mode: cfg.air ? 'air' : 'ground',
            isl,
            a: Math.random() * Math.PI * 2,
            R: cfg.air ? 0.5 : 0.3 + Math.random() * 0.25,
            speed: (cfg.air ? 0.25 : 0.04 + Math.random() * 0.03) * (k % 2 ? 1 : -1),
            sc: cfg.sc,
            phase: Math.random() * 6,
          });
        }
      }
    }
  }

  throwBerries(x, z, dx, dz) {
    // one berry, straight where the player aimed; never spawn under terrain
    const y0 = Math.max(3.2, islandHeight(x, z) + 0.6);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.berryTex, transparent: true, depthWrite: false }));
    spr.scale.set(0.8, 0.8, 1);
    spr.position.set(x, y0, z);
    this.scene.add(spr);
    const sp = 12;
    this.berries.push({
      spr,
      x,
      z,
      y: y0,
      vx: dx * sp,
      vz: dz * sp,
      vy: 5.5,
      flying: true,
      life: 30,
    });
  }

  spawnCrab(b) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.crabTex, transparent: true }));
    spr.scale.set(1.6, 1.6, 1);
    this.scene.add(spr);
    const a = Math.random() * Math.PI * 2;
    let x = b.x + Math.sin(a) * 7;
    let z = b.z + Math.cos(a) * 7;
    // start on land — try the other side, else pop out beside the berry
    if (islandHeight(x, z) <= 0.05) {
      x = b.x - Math.sin(a) * 7;
      z = b.z - Math.cos(a) * 7;
    }
    if (islandHeight(x, z) <= 0.05) {
      x = b.x;
      z = b.z;
    }
    spr.position.set(x, Math.max(islandHeight(x, z), 0) + 0.55, z);
    this.crabs.push({ spr, x, z, berry: b, state: 'approach', t: 0, lx: 0, lz: 0 });
  }

  // a fish leaps across the berry the moment it splashes down, snatching
  // it as it passes overhead
  spawnForBerry(b) {
    const sp = this.pickSpecies();
    const d = 5 + Math.random() * 3;
    const a = Math.random() * Math.PI * 2;
    const sx = b.x + Math.sin(a) * d;
    const sz = b.z + Math.cos(a) * d;
    const tx = (b.x - sx) / d;
    const tz = (b.z - sz) / d;
    const range = d * 2;
    if (!clearOfIslands(sx, sz) || !clearOfIslands(sx + tx * range, sz + tz * range)) return;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: sp.tex, transparent: true, depthWrite: false }));
    const size = pick(sp.size);
    spr.scale.set(size, size, 1);
    spr.position.set(sx, -0.6, sz); // below the surface until the arc starts
    this.scene.add(spr);
    this.jumps.push({
      spr,
      sp,
      size,
      sx,
      sz,
      tx,
      tz,
      range,
      dur: 1.1 + Math.random() * 0.3,
      t: 0,
      apex: 2.6 + Math.random() * 1.4,
      eat: b,
    });
    this.addRipple(sx, sz);
  }

  spawnFlock(bx, bz) {
    const az = Math.random() * Math.PI * 2;
    const across = az + Math.PI + (Math.random() - 0.5) * 0.9;
    const R = 170;
    const sx = bx + Math.sin(az) * R;
    const sz = bz + Math.cos(az) * R;
    const ex = bx + Math.sin(across) * R;
    const ez = bz + Math.cos(across) * R;
    const dur = 20 + Math.random() * 10;
    const vx = (ex - sx) / dur;
    const vz = (ez - sz) / dur;
    const count = 1 + Math.floor(Math.random() * 3);
    const y0 = 38 + Math.random() * 45;
    for (let i = 0; i < count; i++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.birdTex, transparent: true, depthWrite: false }));
      const sc = 4.5 + Math.random() * 1.5;
      spr.scale.set(sc, sc, 1);
      this.scene.add(spr);
      this.birds.push({
        spr,
        x: sx + (Math.random() - 0.5) * 22,
        z: sz + (Math.random() - 0.5) * 22,
        y0: y0 + (Math.random() - 0.5) * 10,
        vx,
        vz,
        t: 0,
        dur,
        phase: Math.random() * Math.PI * 2,
        sc,
      });
    }
  }

  pickSpecies() {
    let r = Math.random() * this.totalW;
    for (const s of this.species) {
      r -= s.w;
      if (r <= 0) return s;
    }
    return this.species[0];
  }

  spawn(bx, bz, lookYaw) {
    const sp = this.pickSpecies();
    const floaters = this.berries.filter((b) => !b.flying);
    let sx;
    let sz;
    let tx;
    let tz;
    let range;
    if (floaters.length && Math.random() < 0.7) {
      // leap right across a floating blueberry to snatch it
      const b = floaters[Math.floor(Math.random() * floaters.length)];
      const d = 4 + Math.random() * 5;
      const a = Math.random() * Math.PI * 2;
      sx = b.x + Math.sin(a) * d;
      sz = b.z + Math.cos(a) * d;
      const l = Math.hypot(b.x - sx, b.z - sz) || 1;
      tx = (b.x - sx) / l;
      tz = (b.z - sz) / l;
      range = d * 2;
    } else {
      // bias spawns toward where the player is looking so jumps get seen
      const o = (Math.random() - 0.5) * 1.6;
      const dist = pick(sp.dist);
      sx = bx - Math.sin(lookYaw + o) * dist;
      sz = bz - Math.cos(lookYaw + o) * dist;
      const ta = Math.random() * Math.PI * 2;
      tx = Math.sin(ta);
      tz = Math.cos(ta);
      range = pick(sp.range);
    }
    // never leap out of a beach — skip this spawn, the timer will retry
    if (!clearOfIslands(sx, sz) || !clearOfIslands(sx + tx * range, sz + tz * range)) return;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: sp.tex, transparent: true, depthWrite: false }));
    this.scene.add(spr);
    this.jumps.push({
      spr,
      sp,
      size: pick(sp.size),
      sx,
      sz,
      tx,
      tz,
      range,
      dur: 1.25 + Math.random() * 0.5,
      t: 0,
      apex: pick(sp.apex),
    });
    this.addRipple(sx, sz);
  }

  addRipple(x, z, scale = 1, opacity = 0.65) {
    const m = new THREE.Mesh(
      this.rippleGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0, z);
    this.scene.add(m);
    this.ripples.push({ m, t: 0, base: scale, opacity });
  }

  update(dt, t, bx, bz, lookYaw) {
    // floating blueberries draw a crowd: more jumps, much more often
    const attract = this.berries.some((b) => !b.flying);
    this.next -= dt;
    if (this.next <= 0) {
      if (this.jumps.length < (attract ? 6 : 3)) this.spawn(bx, bz, lookYaw);
      this.next = attract ? 0.9 + Math.random() * 1.2 : 2.5 + Math.random() * 3.5;
    }

    for (let i = this.jumps.length - 1; i >= 0; i--) {
      const j = this.jumps[i];
      j.t += dt;
      const u = j.t / j.dur;
      if (u >= 1) {
        this.addRipple(j.spr.position.x, j.spr.position.z);
        // snatch a floating blueberry near the landing spot
        for (let k = this.berries.length - 1; k >= 0; k--) {
          const b = this.berries[k];
          if (!b.flying && Math.hypot(b.x - j.spr.position.x, b.z - j.spr.position.z) < 3) {
            this.scene.remove(b.spr);
            b.spr.material.dispose();
            this.berries.splice(k, 1);
            break;
          }
        }
        this.scene.remove(j.spr);
        j.spr.material.dispose();
        this.jumps.splice(i, 1);
        continue;
      }
      const x = j.sx + j.tx * j.range * u;
      const z = j.sz + j.tz * j.range * u;
      const y = waveHeight(x, z, t) - 0.4 + j.apex * 4 * u * (1 - u);
      j.spr.position.set(x, y, z);

      // snatch the targeted berry while arcing right over it
      if (j.eat && u >= 0.5) {
        const k = this.berries.indexOf(j.eat);
        if (k !== -1) {
          this.scene.remove(j.eat.spr);
          j.eat.spr.material.dispose();
          this.berries.splice(k, 1);
        }
        j.eat = null;
      }

      // screen-space travel direction decides the mirror; the Apple glyphs
      // face left, so swap in the flipped texture when moving screen-right
      const s = j.tx * Math.cos(lookYaw) - j.tz * Math.sin(lookYaw);
      const sgn = s >= 0 ? 1 : -1;
      const vy = (j.apex * 4 * (1 - 2 * u)) / j.dur;
      const ang = Math.atan2(vy, j.range / j.dur + 0.001);
      j.spr.material.rotation = sgn * ang;
      j.spr.material.map = sgn > 0 ? j.sp.texFlipped : j.sp.tex;
      j.spr.scale.set(j.size, j.size, 1);
    }

    for (const tu of this.turtles) {
      tu.a += dt * tu.speed;
      const isl = tu.isl;
      const x = isl.x + Math.cos(tu.a) * isl.r * 0.78 * isl.sx;
      const z = isl.z + Math.sin(tu.a) * isl.r * 0.78 * isl.sz;
      tu.spr.position.set(x, Math.max(islandHeight(x, z), 0) + tu.sc * 0.32, z);
    }

    // crabs: scuttle to the berry, eat it, wander off
    for (let i = this.crabs.length - 1; i >= 0; i--) {
      const cr = this.crabs[i];
      cr.t += dt;
      if (cr.state === 'approach') {
        const dx = cr.berry.x - cr.x;
        const dz = cr.berry.z - cr.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.9) {
          cr.state = 'eat';
          cr.t = 0;
          const k = this.berries.indexOf(cr.berry);
          if (k !== -1) {
            this.scene.remove(cr.berry.spr);
            cr.berry.spr.material.dispose();
            this.berries.splice(k, 1);
          }
        } else {
          cr.x += (dx / d) * 2.2 * dt;
          cr.z += (dz / d) * 2.2 * dt;
        }
      } else if (cr.state === 'eat') {
        if (cr.t > 1.2) {
          cr.state = 'leave';
          cr.t = 0;
          // wander off in a direction that keeps the crab on land
          let la = Math.random() * Math.PI * 2;
          for (let tries = 0; tries < 8; tries++) {
            const a2 = Math.random() * Math.PI * 2;
            if (islandHeight(cr.x + Math.sin(a2) * 9, cr.z + Math.cos(a2) * 9) > 0.05) {
              la = a2;
              break;
            }
          }
          cr.lx = Math.sin(la);
          cr.lz = Math.cos(la);
        }
      } else {
        // halt at the shoreline rather than scuttling onto the sea
        if (islandHeight(cr.x + cr.lx * 2.2 * dt, cr.z + cr.lz * 2.2 * dt) > 0.05) {
          cr.x += cr.lx * 2.2 * dt;
          cr.z += cr.lz * 2.2 * dt;
        }
        if (cr.t > 3) cr.spr.material.opacity = Math.max(0, 1 - (cr.t - 3));
        if (cr.t > 4) {
          this.scene.remove(cr.spr);
          cr.spr.material.dispose();
          this.crabs.splice(i, 1);
          continue;
        }
      }
      const wob = cr.state === 'eat' ? Math.abs(Math.sin(cr.t * 9)) * 0.15 : 0;
      cr.spr.position.set(cr.x, Math.max(islandHeight(cr.x, cr.z), waveHeight(cr.x, cr.z, t)) + 0.55 + wob, cr.z);
    }

    this.whaleNext -= dt;
    if (!this.whale && this.whaleNext <= 0) {
      let wx = 0;
      let wz = 0;
      let found = false;
      for (let tries = 0; tries < 8 && !found; tries++) {
        const a = Math.random() * Math.PI * 2;
        const d = 220 + Math.random() * 220;
        wx = bx + Math.sin(a) * d;
        wz = bz + Math.cos(a) * d;
        found = clearOfIslands(wx, wz, 25);
      }
      if (found) {
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.whaleTex, transparent: true }));
        spr.scale.set(26, 26, 1);
        this.scene.add(spr);
        this.whale = { spr, x: wx, z: wz, t: 0, dur: 7 };
      } else {
        this.whaleNext = 5;
      }
    }
    if (this.whale) {
      const w = this.whale;
      w.t += dt;
      const u = w.t / w.dur;
      if (u >= 1) {
        this.scene.remove(w.spr);
        w.spr.material.dispose();
        this.whale = null;
        this.whaleNext = 20 + Math.random() * 25;
      } else {
        w.spr.position.set(w.x, -10 + Math.sin(Math.PI * u) * 19, w.z);
      }
    }

    // monkeys: sit, hop between grass spots, sometimes climb a palm
    for (const m of this.monkeys) {
      m.t += dt;
      const isl = m.isl;
      if (m.state === 'sit') {
        m.spr.position.set(m.x, Math.max(islandHeight(m.x, m.z), 0) + 1.0 + Math.sin(t * 2 + m.next) * 0.06, m.z);
        if (m.t > m.next) {
          m.t = 0;
          const palms = PALMS.filter((p) => p.isl === isl);
          if (palms.length && Math.random() < 0.35) {
            m.palm = palms[Math.floor(Math.random() * palms.length)];
            m.tx = m.palm.x + 1.0;
            m.tz = m.palm.z;
            m.thenClimb = true;
          } else {
            const a = Math.random() * Math.PI * 2;
            m.tx = isl.x + Math.cos(a) * isl.r * 0.45 * isl.sx;
            m.tz = isl.z + Math.sin(a) * isl.r * 0.45 * isl.sz;
            m.thenClimb = false;
          }
          m.x0 = m.x;
          m.z0 = m.z;
          m.dur = 0.55 + Math.random() * 0.2;
          m.state = 'hop';
        }
      } else if (m.state === 'hop') {
        const u = Math.min(1, m.t / m.dur);
        m.x = m.x0 + (m.tx - m.x0) * u;
        m.z = m.z0 + (m.tz - m.z0) * u;
        const gy = Math.max(islandHeight(m.x, m.z), 0) + 1.0;
        m.spr.position.set(m.x, gy + Math.sin(Math.PI * u) * 1.6, m.z);
        if (u >= 1) {
          m.t = 0;
          if (m.thenClimb) {
            m.state = 'climbUp';
            m.cy0 = gy;
          } else {
            m.state = 'sit';
            m.next = 1 + Math.random() * 3;
          }
        }
      } else if (m.state === 'climbUp') {
        const u = Math.min(1, m.t / 1.3);
        m.spr.position.set(m.palm.x + 1.0, m.cy0 + (m.palm.top - m.cy0) * u, m.palm.z);
        if (u >= 1) {
          m.t = 0;
          m.state = 'sitTop';
          m.next = 2 + Math.random() * 3;
        }
      } else if (m.state === 'sitTop') {
        m.spr.position.set(m.palm.x + 1.0, m.palm.top + Math.sin(t * 2.5) * 0.15, m.palm.z);
        if (m.t > m.next) {
          m.t = 0;
          m.state = 'climbDown';
        }
      } else if (m.state === 'climbDown') {
        const u = Math.min(1, m.t / 1.1);
        const gy = Math.max(islandHeight(m.palm.x + 1.0, m.palm.z), 0) + 1.0;
        m.spr.position.set(m.palm.x + 1.0, m.palm.top + (gy - m.palm.top) * u, m.palm.z);
        if (u >= 1) {
          m.t = 0;
          m.x = m.palm.x + 1.0;
          m.z = m.palm.z;
          m.state = 'sit';
          m.next = 1 + Math.random() * 2;
        }
      }
    }

    // island residents: flamingos and rabbits wander, the parrot perches,
    // butterflies flutter
    for (const r of this.residents) {
      if (r.mode === 'palm') {
        r.spr.position.y = r.baseY + Math.sin(t * 1.8 + r.phase) * 0.12;
      } else {
        r.a += dt * r.speed;
        const x = r.isl.x + Math.cos(r.a) * r.isl.r * r.R * r.isl.sx;
        const z = r.isl.z + Math.sin(r.a) * r.isl.r * r.R * r.isl.sz;
        const gy = Math.max(islandHeight(x, z), 0);
        const y = r.mode === 'air' ? gy + 3 + Math.sin(t * 3 + r.phase) * 1.2 : gy + r.sc * 0.3;
        r.spr.position.set(x, y, z);
      }
    }

    // blueberries: fly in an arc, splash down, float on the waves, fade out
    for (let i = this.berries.length - 1; i >= 0; i--) {
      const b = this.berries[i];
      if (b.flying) {
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        b.y += b.vy * dt;
        b.vy -= 12 * dt;
        const wh = waveHeight(b.x, b.z, t);
        const ih = islandHeight(b.x, b.z);
        const landY = Math.max(wh + 0.12, ih + 0.3);
        if (b.vy <= 0 && b.y <= landY) {
          b.y = landY;
          b.flying = false;
          if (ih > 0.05) {
            // landed on an island — a crab comes for it
            b.onLand = true;
            this.spawnCrab(b);
          } else {
            this.addRipple(b.x, b.z, 0.5, 0.5);
            this.spawnForBerry(b);
          }
        }
      } else if (!b.onLand) {
        b.y = waveHeight(b.x, b.z, t) + 0.12;
      }
      b.life -= dt;
      b.spr.position.set(b.x, b.y, b.z);
      if (b.life < 2) b.spr.material.opacity = Math.max(0, b.life / 2);
      if (b.life <= 0) {
        this.scene.remove(b.spr);
        b.spr.material.dispose();
        this.berries.splice(i, 1);
      }
    }

    this.birdNext -= dt;
    if (this.birdNext <= 0) {
      if (this.birds.length < 6) this.spawnFlock(bx, bz);
      this.birdNext = 14 + Math.random() * 16;
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.t += dt;
      if (b.t >= b.dur) {
        this.scene.remove(b.spr);
        b.spr.material.dispose();
        this.birds.splice(i, 1);
        continue;
      }
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.spr.position.set(b.x, b.y0 + Math.sin(t * 2.1 + b.phase) * 1.6, b.z);
      // the dove glyph faces left; flip when flying screen-right
      const sgn = b.vx * Math.cos(lookYaw) - b.vz * Math.sin(lookYaw) >= 0 ? 1 : -1;
      b.spr.material.map = sgn > 0 ? this.birdTexFlipped : this.birdTex;
    }

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.t += dt;
      const u = rp.t / 1.1;
      if (u >= 1) {
        this.scene.remove(rp.m);
        rp.m.material.dispose();
        this.ripples.splice(i, 1);
        continue;
      }
      const sc = (1 + u * 4) * rp.base;
      rp.m.scale.set(sc, sc, 1);
      rp.m.material.opacity = rp.opacity * (1 - u);
      rp.m.position.y = waveHeight(rp.m.position.x, rp.m.position.z, t) + 0.05;
    }
  }
}
