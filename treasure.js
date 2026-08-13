import * as THREE from 'three';
import { waveHeight } from './waves.js';
import { emojiTexture } from './sky.js';

// one haiku per chest, in chest order
export const HAIKUS = [
  'soft eyes in the field\nshe only asks for morning\nlet her keep her calf',
  'the ocean forgives\nevery net we leave behind\nlet the shoals run free',
  'green shoots on my plate\nno shadow behind this meal\nonly rain and sun',
  'a hen learns the sky\nfirst time past the open door\nwings remember why',
  'little pig, big heart\nmud and clover, nothing more\npeace is this simple',
  'the pasture at dusk\ncows asleep beneath the stars\nno truck comes at dawn',
  'seeds become supper\nthe whole world fits in a bowl\nkindness fits there too',
  'fish glint like coins, free\nthe sea keeps its own treasure\nwe take only light',
  'milk belongs to spring\nto the calf beside her now\nwe can drink the rain',
  'one plate at a time\nthe tide of us is turning\nwaves made of choices',
];

// scattered across open water, roughly along routes between the islands
const SPOTS = [
  [120, -60], [-150, -180], [300, -420], [-90, -520], [-380, -120],
  [60, 260], [-420, 260], [420, 60], [180, -240], [-250, -650],
];

export class Treasure {
  constructor(scene) {
    this.scene = scene;
    this.tex = emojiTexture('🧰', 256);
    this.count = 0;
    this.chests = SPOTS.map(([x, z], i) => {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true }));
      spr.scale.set(3, 3, 1);
      spr.position.set(x, 0, z);
      scene.add(spr);
      return { spr, x, z, i, taken: false };
    });
  }

  update(dt, t, bx, bz, onCollect) {
    for (const c of this.chests) {
      if (c.taken) continue;
      c.spr.position.y = waveHeight(c.x, c.z, t) + 1.0 + Math.sin(t * 1.3 + c.i) * 0.25;
      c.spr.material.rotation = Math.sin(t * 0.9 + c.i * 2) * 0.12;
      if (Math.hypot(bx - c.x, bz - c.z) < 7) {
        c.taken = true;
        this.count++;
        this.scene.remove(c.spr);
        c.spr.material.dispose();
        onCollect(c.i, this.count);
      }
    }
  }
}
