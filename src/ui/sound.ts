/**
 * Sound effects synthesised with WebAudio (no audio files to license or load).
 * iOS only allows audio after a user gesture, so the context is created/resumed
 * on the first pointer or key event.
 */

export type SoundName = 'move' | 'capture' | 'check' | 'success' | 'error' | 'end';

let ctx: AudioContext | null = null;
let enabled = true;
let noise: AudioBuffer | null = null;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function play(name: SoundName): void {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.005;
  switch (name) {
    case 'move':
      knock(t, 1800, 0.35, 0.05);
      break;
    case 'capture':
      knock(t, 1100, 0.55, 0.08);
      knock(t + 0.045, 2200, 0.25, 0.04);
      break;
    case 'check':
      knock(t, 1500, 0.35, 0.05);
      tone(t + 0.02, 880, 0.12, 0.12, 'triangle');
      tone(t + 0.1, 1175, 0.12, 0.1, 'triangle');
      break;
    case 'success':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(t + i * 0.075, f, 0.14, 0.22, 'sine'));
      break;
    case 'error':
      tone(t, 220, 0.16, 0.14, 'square', 165);
      tone(t + 0.12, 174.6, 0.14, 0.18, 'square', 130);
      break;
    case 'end':
      [392, 523.25, 659.25].forEach((f, i) => tone(t + i * 0.12, f, 0.12, 0.35, 'triangle'));
      break;
  }
}

/** Short filtered noise burst: a piece landing on wood. */
function knock(t: number, freq: number, gain: number, dur: number): void {
  const c = ctx!;
  if (!noise) {
    noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.2), c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  }
  const src = c.createBufferSource();
  src.buffer = noise;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function tone(t: number, freq: number, gain: number, dur: number, type: OscillatorType, endFreq?: number): void {
  const c = ctx!;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(lp).connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Picks the sound for a played move. */
export function moveSound(m: { san: string; captured?: string }): SoundName {
  if (m.san.includes('+') || m.san.includes('#')) return 'check';
  return m.captured ? 'capture' : 'move';
}
