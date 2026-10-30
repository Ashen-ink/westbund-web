import { lerp, hash, random, smoothstep } from "./math";
import { RATE, local, starts } from "./story";

export type Beat = { at: number; pvc: boolean; amp: number };
const FLATLINE = 0.68;
const SWEEP = 4.2;

const bump = (x: number, width: number) => Math.exp(-0.5 * (x / width) ** 2);

function waveform(tau: number, pvc: boolean) {
  if (tau < -0.1 || tau > 0.9) return 0;
  if (pvc) return 0.95 * bump(tau - 0.16, 0.03) - 0.55 * bump(tau - 0.25, 0.045) - 0.12 * bump(tau - 0.45, 0.07);
  return (
    0.11 * bump(tau - 0.06, 0.022) -
    0.1 * bump(tau - 0.155, 0.009) +
    bump(tau - 0.175, 0.011) -
    0.28 * bump(tau - 0.198, 0.011) +
    0.26 * bump(tau - 0.38, 0.045)
  );
}

function heartState(body: number) {
  if (body >= FLATLINE) return null;
  const decline = smoothstep(0.3, 0.66, body);
  return { rate: lerp(66, 36, decline), amp: lerp(1, 0.5, decline), pvc: decline * 0.5, irregular: lerp(0.04, 0.4, decline) };
}

export const BEATS: Beat[] = (() => {
  const beats: Beat[] = [];
  const rand = random(7);
  let next = 0.5;
  while (next * RATE < starts.told) {
    const state = heartState(local("body", next * RATE));
    if (!state) {
      next += 0.45;
      continue;
    }
    const beat = { at: next, pvc: rand() < state.pvc, amp: state.amp * (0.9 + 0.1 * rand()) };
    beats.push(beat);
    next += (60 / state.rate) * (1 + (rand() - 0.5) * state.irregular) * (beat.pvc ? 1.45 : 1);
  }
  return beats;
})();

export function recent(t: number, span = 4) {
  return BEATS.filter((beat) => beat.at <= t && t - beat.at <= span);
}

export function sample(t: number) {
  let value = 0;
  for (const beat of BEATS) {
    const tau = t - beat.at;
    if (tau < -0.1) break;
    if (tau <= 0.9) value += waveform(tau, beat.pvc) * beat.amp;
  }
  return value;
}

export class Trace {
  values = new Float32Array(0);
  written = new Float32Array(0);
  head = 0;

  update(t: number, cols: number) {
    if (this.values.length !== cols) {
      this.values = new Float32Array(cols);
      this.written = new Float32Array(cols);
    }
    if (!cols) return;
    const speed = cols / SWEEP;
    const front = Math.floor(t * speed);
    this.head = front % cols;
    for (let c = 0; c < cols; c++) {
      const step = front - ((front - c + cols) % cols);
      if (step < 1) {
        this.written[c] = -100;
        continue;
      }
      const at = step / speed;
      this.written[c] = at;
      this.values[c] = sample(at) + (hash(step, 5) - 0.5) * 0.025;
    }
  }
}
