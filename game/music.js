// "Grid Runner" — a synthwave loop composed in code with WebAudio.
// A minor, 112 BPM, 4-bar progression Am – F – C – G.
// Menu: pads and a soft octave bass. Play: adds drums, arpeggio and a lead
// that gets busier as the snake speeds up. Game over: muffled pad only.
import { getAudio } from "./audio.js";

const BPM = 112;
const STEP = 60 / BPM / 4; // one 16th note
const CHORDS = [
  { bass: 33, notes: [57, 60, 64] }, // Am
  { bass: 29, notes: [53, 57, 60] }, // F
  { bass: 36, notes: [55, 60, 64] }, // C
  { bass: 31, notes: [55, 59, 62] }, // G
];
// Lead melody: [step in 4 bars (0..63), midi note, length in steps]
const LEAD = [
  [0, 76, 3], [4, 74, 2], [6, 72, 2], [8, 71, 4], [12, 72, 4],
  [16, 72, 3], [20, 69, 2], [22, 72, 2], [24, 77, 6], [30, 76, 2],
  [32, 76, 3], [36, 79, 2], [38, 76, 2], [40, 72, 4], [44, 74, 4],
  [48, 74, 3], [52, 71, 2], [54, 74, 2], [56, 79, 4], [60, 78, 2], [62, 74, 2],
];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

let ac, bus, delay, noise, timer = null;
let mode = "menu", intensity = 0, muted = false;
let step = 0, nextTime = 0;

function setup() {
  ac = getAudio();
  bus = ac.createGain();
  bus.gain.value = muted ? 0 : 0.5;
  const comp = ac.createDynamicsCompressor();
  bus.connect(comp).connect(ac.destination);
  // Feedback echo for arp and lead.
  delay = ac.createDelay(1);
  delay.delayTime.value = STEP * 3;
  const fb = ac.createGain();
  fb.gain.value = 0.35;
  const dl = ac.createBiquadFilter();
  dl.frequency.value = 2500;
  delay.connect(dl).connect(fb).connect(delay);
  dl.connect(bus);
  noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function voice(t, freq, dur, { type = "sawtooth", vol = 0.1, cutoff = 2000, attack = 0.005, release = 0.1, detune = 0, echo = false, q = 1 } = {}) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = cutoff;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(f).connect(g).connect(bus);
  if (echo) g.connect(delay);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hit(t, { freq = 8000, type = "highpass", vol = 0.05, dur = 0.05 } = {}) {
  const s = ac.createBufferSource();
  s.buffer = noise;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

function kick(t) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + 0.32);
}

function schedule(s, t) {
  const bar = Math.floor(s / 16) % 4, inBar = s % 16;
  const chord = CHORDS[bar];
  const playing = mode === "play";

  // Pad: a chord at the start of each bar.
  if (inBar === 0) {
    const cutoff = mode === "over" ? 500 : playing ? 1400 : 900;
    for (const n of chord.notes)
      for (const det of [-9, 9])
        voice(t, hz(n), STEP * 16, { vol: 0.022, cutoff, attack: 0.4, release: 0.6, detune: det });
  }

  if (mode === "over") return;

  // Octave bass on 8th notes.
  if (inBar % 2 === 0) {
    const n = chord.bass + (inBar % 4 === 2 ? 12 : 0);
    voice(t, hz(n), STEP * 1.8, { vol: playing ? 0.11 : 0.07, cutoff: playing ? 700 + intensity * 900 : 450, q: 6, release: 0.06 });
  }

  if (!playing) return;

  // Drums.
  if (inBar % 4 === 0) kick(t);
  if (inBar === 4 || inBar === 12) hit(t, { freq: 1800, type: "bandpass", vol: 0.16, dur: 0.18 });
  if (inBar % 2 === 1 || intensity > 0.5) hit(t, { vol: inBar % 2 ? 0.05 : 0.025, dur: 0.04 });

  // Arpeggio on 16ths, an octave up, rising with intensity.
  const n = chord.notes[ARP[inBar % 8]] + 12 + (intensity > 0.6 && inBar >= 8 ? 12 : 0);
  voice(t, hz(n), STEP * 0.9, { type: "square", vol: 0.018, cutoff: 1800 + intensity * 2500, release: 0.05, echo: true });

  // Lead melody joins once the run heats up.
  if (intensity > 0.25) {
    const pos = s % 64;
    for (const [at, note, len] of LEAD)
      if (at === pos) {
        voice(t, hz(note), STEP * len, { vol: 0.035, cutoff: 3000, attack: 0.02, release: 0.15, detune: 6, echo: true });
        voice(t, hz(note), STEP * len, { type: "triangle", vol: 0.03, cutoff: 4000, attack: 0.02, release: 0.15, detune: -6 });
      }
  }
}

function pump() {
  if (!ac) return;
  while (nextTime < ac.currentTime + 0.2) {
    schedule(step, nextTime);
    step++;
    nextTime += STEP;
  }
}

export const music = {
  // Call after a user gesture has unlocked the AudioContext.
  start() {
    if (timer || !getAudio()) return;
    setup();
    step = 0;
    nextTime = ac.currentTime + 0.1;
    timer = setInterval(pump, 40);
  },
  setMode(m) {
    mode = m;
  },
  // 0..1, how heated the run is (driven by speed).
  setIntensity(v) {
    intensity = Math.max(0, Math.min(1, v));
  },
  toggleMute() {
    muted = !muted;
    if (bus) bus.gain.setTargetAtTime(muted ? 0 : 0.5, ac.currentTime, 0.05);
    return muted;
  },
  stop() {
    clearInterval(timer);
    timer = null;
  },
};
