// Two audio buses: "music" is the looping MP3 track; "sound effects" are
// the synthesized surf, seagull cries, and soft chord pad. startAudio() is
// idempotent and must be called from a user gesture (autoplay policy).

let ctx = null;
let sfxBus = null;
let musicEl = null;
let sfxMuted = false;
let musicMuted = false;

export function toggleMusic() {
  musicMuted = !musicMuted;
  if (musicEl) musicEl.muted = musicMuted;
  return musicMuted;
}

export function toggleSfx() {
  sfxMuted = !sfxMuted;
  if (sfxBus) sfxBus.gain.value = sfxMuted ? 0 : 0.5;
  return sfxMuted;
}

// a cute little ascending sparkle for collecting a treasure chest
export function playCollect() {
  if (!ctx || !sfxBus) return;
  const now = ctx.currentTime;
  const NOTES = [
    [1046.5, 0],
    [1318.5, 0.09],
    [1568.0, 0.18],
    [2093.0, 0.27],
  ];
  for (const [f, at] of NOTES) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now + at);
    g.gain.linearRampToValueAtTime(0.4, now + at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + at + 0.45);
    o.connect(g);
    g.connect(sfxBus);
    o.start(now + at);
    o.stop(now + at + 0.5);
  }
}

export function startAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    if (musicEl && musicEl.paused) musicEl.play().catch(() => {});
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();

  // music: the looping track
  musicEl = new Audio('./music.mp3');
  musicEl.loop = true;
  musicEl.volume = 0.45;
  musicEl.muted = musicMuted;
  musicEl.play().catch(() => {});

  const master = ctx.createGain();
  master.gain.value = sfxMuted ? 0 : 0.5;
  master.connect(ctx.destination);
  sfxBus = master;

  // --- surf: looping brownish noise through a lowpass, with slow swells
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 520;
  lp.Q.value = 0.4;
  const surfGain = ctx.createGain();
  surfGain.gain.value = 0.25;
  noise.connect(lp);
  lp.connect(surfGain);
  surfGain.connect(master);
  noise.start();
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.09;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.12;
  lfo.connect(lfoGain);
  lfoGain.connect(surfGain.gain);
  lfo.start();
  const lfo2 = ctx.createOscillator();
  lfo2.frequency.value = 0.23;
  const lfo2Gain = ctx.createGain();
  lfo2Gain.gain.value = 0.06;
  lfo2.connect(lfo2Gain);
  lfo2Gain.connect(surfGain.gain);
  lfo2.start();

  // --- soft pad: slow detuned-triangle chords, gently crossfading
  const padGain = ctx.createGain();
  padGain.gain.value = 0.05;
  const padLp = ctx.createBiquadFilter();
  padLp.type = 'lowpass';
  padLp.frequency.value = 900;
  padGain.connect(padLp);
  padLp.connect(master);
  const CHORDS = [
    [261.63, 329.63, 392.0, 493.88], // Cmaj7
    [220.0, 261.63, 329.63, 392.0], // Am7
    [174.61, 220.0, 261.63, 329.63], // Fmaj7
    [196.0, 246.94, 293.66, 392.0], // G
  ];
  let chordIdx = 0;
  function playChord() {
    const now = ctx.currentTime;
    const freqs = CHORDS[chordIdx % CHORDS.length];
    chordIdx++;
    for (const f of freqs) {
      for (const det of [-2, 2]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.5 / freqs.length, now + 3.5);
        g.gain.setValueAtTime(0.5 / freqs.length, now + 6.5);
        g.gain.linearRampToValueAtTime(0, now + 10);
        o.connect(g);
        g.connect(padGain);
        o.start(now);
        o.stop(now + 10.2);
      }
    }
    setTimeout(playChord, 8000);
  }
  playChord();

  // --- seagulls: rise-fall cries in little flocks, panned around
  function gullCry(when, pan) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 2.5;
    const g = ctx.createGain();
    o.frequency.setValueAtTime(1150, when);
    o.frequency.linearRampToValueAtTime(1550, when + 0.12);
    o.frequency.linearRampToValueAtTime(900, when + 0.55);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.09, when + 0.06);
    g.gain.setValueAtTime(0.07, when + 0.35);
    g.gain.linearRampToValueAtTime(0, when + 0.6);
    o.connect(bp);
    let tail = bp;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      bp.connect(p);
      tail = p;
    }
    tail.connect(g);
    g.connect(master);
    o.start(when);
    o.stop(when + 0.65);
  }
  function gullFlock() {
    const now = ctx.currentTime;
    const cries = 1 + Math.floor(Math.random() * 3);
    const pan = (Math.random() * 2 - 1) * 0.8;
    for (let i = 0; i < cries; i++) {
      gullCry(now + i * (0.5 + Math.random() * 0.4), pan);
    }
    setTimeout(gullFlock, 7000 + Math.random() * 14000);
  }
  setTimeout(gullFlock, 2500);
}
