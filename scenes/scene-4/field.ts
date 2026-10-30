import { G, Grid } from "./grid";
import type { Beat, Trace } from "./heart";
import { clamp, easeInOut, hash, lerp, random, smoothstep } from "./math";

export type View = { width: number; height: number; t: number };

const TAU = Math.PI * 2;
const DUST = [G("."), G("·"), G("`"), G(",")];
const MIND = [G("m"), G("i"), G("n"), G("d"), G("#"), G("%"), G("@"), G("&"), G("8")];
const FINE = [G("."), G("·"), G(","), G("`"), G("'"), G("·"), G(":")];

export type Speck = { x: number; y: number; cut: number; lum: number; glyph: number; rate: number; phase: number };

export function layoutDust(grid: Grid) {
  const dust: Speck[] = [];
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const h = hash(x, y, 11);
      if (h > 0.045) continue;
      dust.push({
        x,
        y,
        cut: h / 0.045,
        lum: 0.06 + 0.14 * hash(x, y, 13),
        glyph: DUST[(hash(x, y, 14) * DUST.length) | 0],
        rate: 0.2 + hash(x, y, 12) * 0.8,
        phase: hash(x, y, 15) * 100,
      });
    }
  }
  return dust;
}

export function drawDust(grid: Grid, dust: Speck[], view: View, density: number) {
  for (const speck of dust) {
    if (speck.cut > density) continue;
    const twinkle = 0.35 + 0.65 * Math.sin(view.t * speck.rate + speck.phase) ** 2;
    grid.put(speck.x, speck.y, speck.glyph, speck.lum * twinkle);
  }
}

export function drawPulse(grid: Grid, view: View, beats: Beat[], weight: number, squash: number) {
  if (weight <= 0.01) return;
  const { cols, rows, cw, ch } = grid;
  const cx = view.width / 2;
  const cy = view.height / 2;
  const radius = Math.hypot(view.width, view.height) / 2;
  const last = beats.length ? view.t - beats[beats.length - 1].at : 10;
  const flash = Math.exp(-last * 5);
  for (let y = 0; y < rows; y++) {
    const py = ((y + 0.5) * ch - cy) * squash;
    for (let x = 0; x < cols; x++) {
      const px = (x + 0.5) * cw - cx;
      const d = Math.sqrt(px * px + py * py) / radius;
      let v = 0.55 * Math.exp(-((d / 0.04) ** 2)) * (0.55 + 0.45 * flash);
      for (let b = 0; b < beats.length; b++) {
        const beat = beats[b];
        for (let k = 0; k < 2; k++) {
          const age = view.t - beat.at - k * 0.26;
          if (age <= 0 || age > 2.4) continue;
          const offset = (d - age * 0.58) / (0.016 + age * 0.03);
          if (offset > 3 || offset < -3) continue;
          v += (k ? 0.5 : 1) * beat.amp * Math.exp(-offset * offset) * (1 - age / 2.4) ** 2;
        }
      }
      if (v < 0.04) continue;
      if (v > 1) v = 1;
      grid.put(x, y, grid.rampGlyph(v), (0.22 + 0.78 * v) * weight);
    }
  }
}

export function drawTrace(grid: Grid, trace: Trace, view: View, weight: number, contraction: number) {
  const { cols, rows } = grid;
  const { values, written } = trace;
  if (weight <= 0.01 || values.length !== cols) return;
  const base = Math.floor(rows / 2) + 0.5;
  const amplitude = Math.min(rows * 0.2, 12);
  const half = cols / 2;
  const visible = half * (1 - contraction);
  const head = Math.floor(trace.head);
  const gap = Math.max(3, Math.round(cols * 0.025));
  const hidden = (c: number) => {
    const ahead = (c - head + cols) % cols;
    return (ahead > 0 && ahead <= gap) || written[c] < -50;
  };

  for (let c = 0; c < cols; c++) {
    if (Math.abs(c + 0.5 - half) > visible + 0.5 || hidden(c)) continue;
    const age = view.t - written[c];
    const lum = (0.3 + 0.7 * Math.exp(-age / 1.5)) * weight;
    const y1 = base - values[c] * amplitude;
    const y2 = c + 1 < cols && !hidden(c + 1) ? base - values[c + 1] * amplitude : y1;
    const dy = y2 - y1;
    if (Math.abs(dy) < 0.75) {
      const row = Math.floor(y1);
      const f = y1 - row;
      grid.put(c, row, f < 0.3 ? G("¯") : f < 0.7 ? G("-") : G("_"), lum);
    } else {
      const glyph = Math.abs(dy) >= 2.2 ? G("|") : dy < 0 ? G("/") : G("\\");
      for (let r = Math.floor(Math.min(y1, y2)); r <= Math.floor(Math.max(y1, y2)); r++) grid.put(c, r, glyph, lum);
    }
  }
  if (contraction < 0.02 && !hidden(head)) {
    grid.put(head, Math.floor(base - values[head] * amplitude), G("•"), weight);
  }
  if (contraction > 0.9) grid.put(Math.floor(half), Math.floor(base), G("•"), weight);
}

export type Orbit = {
  cx: number;
  cy: number;
  rx: number[];
  ry: number[];
  level: number[];
  points: number[];
  nodes: { ring: number; angle: number; delay: number }[];
};

export const RING_LEVELS = [0.16, 0.37, 0.58, 0.79, 1];

export function layoutOrbit(width: number, height: number, cw: number, whisperNodes: { ring: number; angle: number }[]): Orbit {
  const rx = RING_LEVELS.map((level) => width * 0.46 * level);
  const ry = RING_LEVELS.map((level) => height * 0.3 * level);
  const points = rx.map((a, i) => {
    const b = ry[i];
    const perimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    return Math.max(12, Math.round(perimeter / (cw * 1.25)));
  });
  const rand = random(23);
  const nodes: Orbit["nodes"] = [];
  RING_LEVELS.forEach((_, ring) => {
    for (let i = 0; i < 3 + ring * 3; i++) nodes.push({ ring, angle: rand() * TAU, delay: rand() });
  });
  for (const node of whisperNodes) nodes.push({ ring: node.ring, angle: (node.angle / 360) * TAU, delay: 0 });

  return { cx: width / 2, cy: height / 2, rx, ry, level: RING_LEVELS, points, nodes };
}

export const orbitPoint = (orbit: Orbit, ring: number, angle: number) => ({
  x: orbit.cx + orbit.rx[ring] * Math.cos(angle),
  y: orbit.cy + orbit.ry[ring] * Math.sin(angle),
});

export const waveAt = (progress: number) => smoothstep(0.3, 0.74, progress) * 1.1;
const ringDrawn = (progress: number, ring: number) => smoothstep(0.18 + 0.035 * ring, 0.28 + 0.035 * ring, progress);

export function drawOrbits(grid: Grid, view: View, orbit: Orbit, progress: number, scatter: number, weight: number) {
  if (weight <= 0.01 || scatter >= 1) return;
  const { cw, ch } = grid;
  const fade = (1 - scatter) * weight;
  const wave = waveAt(progress);

  const place = (x: number, y: number, seed: number, glyph: number, lum: number) => {
    if (scatter > 0) {
      const dx = x - orbit.cx;
      const dy = y - orbit.cy;
      const len = Math.hypot(dx, dy) || 1;
      const push = scatter ** 1.4 * (40 + 170 * hash(seed, 3));
      x += (dx / len) * push;
      y += (dy / len) * push * 0.6 - scatter * 70 * hash(seed, 4);
    }
    grid.put(x / cw, y / ch, glyph, lum);
  };

  place(orbit.cx, orbit.cy, 1, G("•"), lerp(0.95, 0.4, smoothstep(0.3, 0.5, progress)) * fade);

  orbit.rx.forEach((rx, ring) => {
    const drawn = ringDrawn(progress, ring);
    if (drawn <= 0) return;
    const n = orbit.points[ring];
    const spin = view.t * 0.018 * (ring % 2 ? 1 : -1);
    for (let i = 0; i < n * drawn; i++) {
      const angle = (i / n) * TAU + spin;
      place(orbit.cx + rx * Math.cos(angle), orbit.cy + orbit.ry[ring] * Math.sin(angle), ring * 997 + i, i % 2 ? G("·") : G("."), (0.26 + 0.1 * hash(ring, i, 7)) * fade);
    }
  });

  if (wave > 0.01 && wave < 1.08) {
    const rx = wave * orbit.rx[4];
    const ry = wave * orbit.ry[4];
    const n = Math.max(10, Math.round((TAU * Math.sqrt((rx * rx + ry * ry) / 2)) / (cw * 1.3)));
    const lum = 0.5 * (1 - smoothstep(0.92, 1.08, wave)) * fade;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * TAU;
      place(orbit.cx + rx * Math.cos(angle), orbit.cy + ry * Math.sin(angle), 5000 + i, G("·"), lum);
    }
  }

  orbit.nodes.forEach((node, i) => {
    if (node.angle / TAU > ringDrawn(progress, node.ring)) return;
    const { x, y } = orbitPoint(orbit, node.ring, node.angle);
    const since = wave - (orbit.level[node.ring] + node.delay * 0.05);
    let glyph = G("o");
    let lum = 0.3;
    if (since >= 0) {
      if (since < 0.03) [glyph, lum] = [G("@"), 1];
      else if (since < 0.08) [glyph, lum] = [G("*"), 0.9];
      else lum = 0.72;
    }
    place(x, y, 9000 + i, glyph, lum * fade);
  });
}

type Mote = { ox: number; oy: number; sx: number; sy: number; vx: number; vy: number; phase: number; bright: number; delay: number; tx: number; ty: number };
export type Trait = { rect: { left: number; top: number; right: number; bottom: number }; start: number; span: number; colour: boolean; motes: Mote[] };

export function layoutTraits(
  rects: { left: number; top: number; right: number; bottom: number }[],
  colour: boolean[],
  width: number,
  height: number,
  targets: { x: number; y: number }[],
) {
  const rand = random(31);
  const count = rects.length;

  const order = Array.from({ length: count - 1 }, (_, i) => i).sort(() => rand() - 0.5);
  return rects.map((rect, i): Trait => {
    const isTitle = i === count - 1;
    const area = (rect.right - rect.left) * (rect.bottom - rect.top);
    const n = Math.round(clamp(area / 30, 80, isTitle ? 700 : 360));
    const midX = (rect.left + rect.right) / 2;
    const midY = (rect.top + rect.bottom) / 2;
    const motes = Array.from({ length: n }, (): Mote => {
      const target = targets.length ? targets[(rand() * targets.length) | 0] : { x: width / 2, y: height / 2 };
      const ox = lerp(rect.left, rect.right, rand());
      const oy = lerp(rect.top, rect.bottom, rand());
      return {
        ox,
        oy,
        sx: (ox - midX) * 0.8,
        sy: (oy - midY) * 2.4,
        vx: (0.2 + 0.55 * rand()) * width * 0.42,
        vy: (rand() - 0.5) * height * 0.22,
        phase: rand() * TAU,
        bright: rand(),
        delay: rand() * 0.25,
        tx: target.x,
        ty: target.y,
      };
    });
    const start = isTitle ? 0.74 : 0.36 + (order.indexOf(i) / Math.max(1, count - 2)) * 0.32;
    return { rect, start, span: isTitle ? 0.07 : 0.1, colour: colour[i], motes };
  });
}

export const dissolveOf = (trait: Trait, progress: number, hold: number) =>
  smoothstep(trait.start, trait.start + trait.span, progress) * (1 - hold);

function motePosition(mote: Mote, tt: number, view: View) {
  const drift = tt;
  return {
    x: mote.ox + mote.sx * Math.sqrt(tt) + mote.vx * tt ** 1.4 + Math.sin(tt * 3 + mote.phase) * 18 * tt + Math.sin(view.t * 0.3 + mote.phase) * 6 * drift,
    y: mote.oy + mote.sy * Math.sqrt(tt) + mote.vy * tt - 40 * tt * tt + Math.cos(tt * 2.5 + mote.phase) * 10 * tt + Math.cos(view.t * 0.25 + mote.phase) * 4 * drift,
  };
}

export function drawMotes(grid: Grid, view: View, traits: Trait[], progress: number, holds: ArrayLike<number>, gather: number, weight: number) {
  if (weight <= 0.01) return;
  const { cw, ch } = grid;
  traits.forEach((trait, i) => {
    const dissolve = dissolveOf(trait, progress, holds[i] ?? 0);
    if (dissolve <= 0.002) return;
    const tint = trait.colour && (holds[i] ?? 0) > 0.02 ? 1 : 0;
    for (const mote of trait.motes) {
      const tt = clamp(dissolve * 1.25 - mote.delay);
      if (tt <= 0) continue;
      let { x, y } = motePosition(mote, tt, view);
      let lum = smoothstep(0, 0.05, tt) * (1 - 0.8 * smoothstep(0.1, 0.85, tt)) * (0.55 + 0.45 * mote.bright);
      let glyph = tt < 0.22 && mote.bright > 0.55 ? grid.rampGlyph(0.25 + 0.3 * mote.bright) : FINE[(mote.bright * FINE.length) | 0];
      if (gather > 0) {
        const c = easeInOut(clamp((gather - 0.02 - mote.delay * 0.6) / 0.26));
        if (c >= 1) continue;
        const arc = Math.sin(c * Math.PI) * 0.12;
        const nx = lerp(x, mote.tx, c) + (mote.ty - y) * arc;
        const ny = lerp(y, mote.ty, c) - (mote.tx - x) * arc;
        x = nx;
        y = ny;
        lum = lerp(lum, 0.85, c);
        if (c > 0.05) glyph = c > 0.6 ? G("*") : G("·");
      }
      grid.put(x / cw, y / ch, glyph, lum * weight, tint);
    }
  });
}

type MindCell = { x: number; y: number; v: number; glyph: number; h: number; rate: number };
export type Mind = { cells: MindCell[]; size: number; cy: number };

export function layoutMind(grid: Grid, width: number, height: number, frame: number): Mind {
  const { cols, rows, cw, ch } = grid;
  const size = Math.min(frame * (frame < 700 ? 0.36 : 0.2), height * 0.32);
  const cy = height * 0.42;
  const sx = 4;
  const sy = 8;
  if (!cols || !rows) return { cells: [], size, cy };
  const canvas = document.createElement("canvas");
  canvas.width = cols * sx;
  canvas.height = rows * sy;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.scale(sx / cw, sy / ch);
  context.font = `500 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#fff";
  context.fillText(".mind", width / 2, cy + size * 0.36);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;

  const cover = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0;
      for (let j = 0; j < sy; j++) {
        const row = ((y * sy + j) * canvas.width + x * sx) * 4 + 3;
        for (let k = 0; k < sx; k++) sum += data[row + k * 4];
      }
      cover[y * cols + x] = sum / (255 * sx * sy);
    }
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= cols || y >= rows ? 0 : cover[y * cols + x]);

  const cells: MindCell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = at(x, y);
      if (v < 0.1) continue;

      const gx = (at(x + 1, y) - at(x - 1, y)) / cw;
      const gy = (at(x, y + 1) - at(x, y - 1)) / ch;
      let glyph = -1;
      if (v < 0.72 && Math.hypot(gx * cw, gy * ch) > 0.25) {
        if (Math.abs(gx) > 2 * Math.abs(gy)) glyph = G("|");
        else if (Math.abs(gy) > 2 * Math.abs(gx)) glyph = gy > 0 ? G("_") : G("¯");
        else glyph = gx * gy > 0 ? G("/") : G("\\");
      } else if (v < 0.45) glyph = grid.rampGlyph(v);
      const h = hash(x, y, 41);
      cells.push({ x, y, v, glyph, h, rate: 0.15 + h * 0.65 });
    }
  }
  return { cells, size, cy };
}

export function drawMind(grid: Grid, view: View, mind: Mind, progress: number) {
  if (progress <= 0) return;
  for (const cell of mind.cells) {
    const reveal = smoothstep(0.1 + 0.3 * cell.h, 0.18 + 0.3 * cell.h, progress);
    if (reveal <= 0) continue;
    let glyph = cell.glyph;
    if (glyph < 0) {
      const step = Math.floor(view.t * cell.rate + cell.h * 40);
      glyph = MIND[(hash(step, cell.x, cell.y) * MIND.length) | 0];
    }
    const flicker = 0.86 + 0.14 * Math.sin(view.t * 1.7 + cell.h * 60);
    grid.put(cell.x, cell.y, glyph, (0.45 + 0.55 * cell.v) * reveal * flicker);
  }
}
