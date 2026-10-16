// Tiny synthesized sound effects (WebAudio, no files).
let ac = null;

export function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ac = new AC();
  }
  if (ac && ac.state === "suspended") ac.resume();
  return ac;
}

export function getAudio() {
  return ac;
}

function tone(freq, dur, type = "square", vol = 0.08, slide = 0) {
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  turn: () => tone(880, 0.04, "square", 0.025),
  eat: () => { tone(660, 0.08, "square", 0.06, 400); setTimeout(() => tone(1320, 0.1, "triangle", 0.05), 60); },
  die: () => { tone(220, 0.6, "sawtooth", 0.09, -190); tone(110, 0.8, "square", 0.05, -80); },
  select: () => tone(520, 0.12, "triangle", 0.07, 300),
  hover: () => tone(1200, 0.03, "sine", 0.03),
};
