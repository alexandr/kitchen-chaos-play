// Synthesised sound effects (WebAudio, no samples) and a light kitchen music loop.
let ctx = null, master = null, musicTimer = null;
export function unlockAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); } catch { return; }
  }
  if (ctx.state === 'suspended') ctx.resume();
}
function tone(freq, dur, type = 'square', vol = 0.2, slide = 0, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.2, hp = 1000, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = b;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
export const sfx = {
  pick: () => tone(520, 0.06, 'triangle', 0.15, 200),
  drop: () => tone(300, 0.07, 'triangle', 0.15, -100),
  chop: () => noise(0.05, 0.18, 2500),
  chopped: () => { tone(700, 0.06, 'square', 0.08); tone(950, 0.08, 'square', 0.08, 0, 0.06); },
  plop: () => tone(180, 0.12, 'sine', 0.3, -80),
  cooked: () => { tone(880, 0.1, 'triangle', 0.15); tone(1320, 0.15, 'triangle', 0.15, 0, 0.1); },
  burnt: () => { noise(0.4, 0.25, 300); tone(150, 0.4, 'sawtooth', 0.15, -60); },
  fire: () => noise(0.5, 0.2, 400),
  pour: () => tone(400, 0.2, 'sine', 0.2, -200),
  served: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.12, 'triangle', 0.18, 0, i * 0.07)); },
  wrong: () => tone(160, 0.3, 'sawtooth', 0.15),
  expired: () => { tone(330, 0.15, 'square', 0.12); tone(220, 0.25, 'square', 0.12, 0, 0.15); },
  order: () => { tone(1046, 0.08, 'sine', 0.15); tone(1318, 0.1, 'sine', 0.15, 0, 0.08); },
  trash: () => noise(0.15, 0.15, 800),
  throw: () => noise(0.12, 0.12, 3000),
  dash: () => noise(0.1, 0.1, 1500),
  washed: () => tone(1200, 0.08, 'sine', 0.12, 300),
  plate: () => tone(1500, 0.05, 'triangle', 0.1),
  go: () => { tone(523, 0.15, 'square', 0.15); tone(784, 0.3, 'square', 0.15, 0, 0.15); },
  timeup: () => { [880, 660, 440].forEach((f, i) => tone(f, 0.25, 'square', 0.15, 0, i * 0.22)); },
  tick: () => tone(1000, 0.03, 'square', 0.06),
  warn: () => tone(1400, 0.06, 'square', 0.07),
};

// a cheerful 8-bar loop (bass + chords + melody), scheduled in small chunks
export function music(on) {
  if (!ctx) return;
  clearInterval(musicTimer); musicTimer = null;
  if (!on) return;
  const bpm = 132, beat = 60 / bpm;
  const roots = [261.6, 220, 174.6, 196], mel = [0, 4, 7, 9, 7, 4, 2, 4, 0, 2, 4, 7, 9, 12, 9, 7];
  let step = 0, next = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    while (next < ctx.currentTime + 0.4) {
      const bar = Math.floor(step / 8) % 4, r = roots[bar], when = next - ctx.currentTime;
      if (step % 2 === 0) tone(r / 2, beat * 0.9, 'triangle', 0.09, 0, when);
      if (step % 4 === 2) { tone(r, beat * 0.4, 'square', 0.025, 0, when); tone(r * 1.26, beat * 0.4, 'square', 0.025, 0, when); }
      if (step % 2 === 0 || step % 8 === 5) tone(r * 2 * Math.pow(2, mel[step % 16] / 12), beat * 0.45, 'square', 0.03, 0, when);
      next += beat / 2; step++;
    }
  }, 100);
}
