import { clamp, smooth } from "./math";
import { palette, rgb } from "./palette";
import type { PrintTexture } from "./dither";

const SPRING_SECONDS = 1.5;
export const MORPH_SCALE = 4;
const MAX_DELAY = 0.4;
const BUCKET = 8;

const INK = rgb(palette.blue);


function motionCriticalSpring(seconds: number, visualDuration: number) {
  const frequency = (2 * Math.PI) / (visualDuration * 1.2);
  return 1 - Math.exp(-frequency * seconds) * (1 + frequency * seconds);
}

const springTable = Float64Array.from({ length: 1025 }, (_, index) => {
  const t = index / 1024;
  const spring = motionCriticalSpring(t * SPRING_SECONDS, 1);
  return spring + (1 - spring) * smooth((t - 0.85) / 0.15);
});

function springEase(t: number) {
  const position = clamp(t) * 1024;
  const index = Math.min(1023, Math.floor(position));
  return springTable[index] + (springTable[index + 1] - springTable[index]) * (position - index);
}

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

class Grid {
  private cells: number[][];
  private across: number;
  private down: number;
  size = 0;

  constructor(private columns: number, rows: number) {
    this.across = Math.ceil(columns / BUCKET);
    this.down = Math.ceil(rows / BUCKET);
    this.cells = Array.from({ length: this.across * this.down }, () => []);
  }

  private bucket(id: number) {
    const x = Math.floor((id % this.columns) / BUCKET);
    const y = Math.floor(Math.floor(id / this.columns) / BUCKET);
    return this.cells[y * this.across + x];
  }

  add(id: number) {
    this.bucket(id).push(id);
    this.size++;
  }

  remove(id: number) {
    const cell = this.bucket(id);
    const at = cell.indexOf(id);
    cell[at] = cell[cell.length - 1];
    cell.pop();
    this.size--;
  }

  nearest(id: number) {
    if (!this.size) return -1;
    const x = id % this.columns;
    const y = Math.floor(id / this.columns);
    const bx = Math.floor(x / BUCKET);
    const by = Math.floor(y / BUCKET);
    let best = -1;
    let bestDistance = Infinity;
    const scan = (gx: number, gy: number) => {
      if (gx < 0 || gy < 0 || gx >= this.across || gy >= this.down) return;
      for (const other of this.cells[gy * this.across + gx]) {
        const dx = (other % this.columns) - x;
        const dy = Math.floor(other / this.columns) - y;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = other;
        }
      }
    };
    for (let r = 0; r <= Math.max(this.across, this.down); r++) {
      if (best >= 0 && (r - 1) * BUCKET > Math.sqrt(bestDistance)) break;
      if (r === 0) scan(bx, by);
      else {
        for (let g = -r; g <= r; g++) {
          scan(bx + g, by - r);
          scan(bx + g, by + r);
          if (Math.abs(g) !== r) {
            scan(bx - r, by + g);
            scan(bx + r, by + g);
          }
        }
      }
    }
    return best;
  }
}

export interface Morph {
  columns: number;
  rows: number;
  stay: HTMLCanvasElement;
  paths: Float32Array;
}

function pair(leaving: number[], arriving: number[], columns: number, rows: number, seed: number) {
  const free = new Grid(columns, rows);
  const all = new Grid(columns, rows);
  leaving.forEach((id) => (free.add(id), all.add(id)));
  const random_ = random(seed);
  const order = arriving.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random_() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const from: number[] = [];
  const to: number[] = [];
  const claimed = new Set<number>();
  for (const cell of order) {
    const source = free.size ? free.nearest(cell) : all.nearest(cell);
    if (free.size) {
      free.remove(source);
      claimed.add(source);
    }
    from.push(source);
    to.push(cell);
  }
  if (claimed.size < leaving.length) {
    const targets = new Grid(columns, rows);
    arriving.forEach((id) => targets.add(id));
    for (const source of leaving) {
      if (claimed.has(source)) continue;
      from.push(source);
      to.push(targets.nearest(source));
    }
  }
  return { from, to };
}

export function createMorph(a: PrintTexture, b: PrintTexture, seed: number): Morph | null {
  const { columns, rows } = a;
  const shared: number[] = [];
  const leaving: number[] = [];
  const arriving: number[] = [];
  for (let id = 0; id < columns * rows; id++) {
    if (a.dots[id] && b.dots[id]) shared.push(id);
    else if (a.dots[id]) leaving.push(id);
    else if (b.dots[id]) arriving.push(id);
  }
  if (!leaving.length && !arriving.length) return null;

  const stay = document.createElement("canvas");
  stay.width = columns;
  stay.height = rows;
  const context = stay.getContext("2d");
  if (!context) return null;
  const pixels = context.createImageData(columns, rows);
  for (const id of shared) pixels.data.set([INK[0], INK[1], INK[2], 255], id * 4);
  context.putImageData(pixels, 0, 0);

  const sources = leaving.length ? leaving : shared;
  const targets = arriving.length ? arriving : shared;
  if (!sources.length || !targets.length) return null;
  const { from, to } = pair(sources, targets, columns, rows, seed);
  const count = from.length;
  const dice = random(seed * 7919 + 1);
  const paths = new Float32Array(count * 10);
  for (let i = 0; i < count; i++) {
    const at = i * 10;
    const x = from[i] % columns;
    const y = Math.floor(from[i] / columns);
    const dx = (to[i] % columns) - x;
    const dy = Math.floor(to[i] / columns) - y;
    const length = Math.hypot(dx, dy) || 1;
    const delay = MAX_DELAY * dice();
    const duration = (1 - delay) * (0.6 + 0.4 * dice());
    const bow = (0.5 * Math.sin((x / columns) * 5.1 + (y / rows) * 3.3 + seed * 1.7) + 0.5 * (dice() * 2 - 1)) * 0.3 * length;
    const nx = -dy / length;
    const ny = dx / length;
    paths[at] = x;
    paths[at + 1] = y;
    paths[at + 2] = dx;
    paths[at + 3] = dy;
    paths[at + 4] = clamp(x + dx / 3 + nx * bow, 0, columns - 1);
    paths[at + 5] = clamp(y + dy / 3 + ny * bow, 0, rows - 1);
    paths[at + 6] = clamp(x + (dx * 2) / 3 + nx * bow, 0, columns - 1);
    paths[at + 7] = clamp(y + (dy * 2) / 3 + ny * bow, 0, rows - 1);
    paths[at + 8] = delay;
    paths[at + 9] = duration;
  }
  return { columns, rows, stay, paths };
}

export function drawMorph(context: CanvasRenderingContext2D, morph: Morph, fraction: number) {
  const { columns, rows, stay, paths } = morph;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = palette.paper;
  context.fillRect(0, 0, columns * MORPH_SCALE, rows * MORPH_SCALE);
  context.imageSmoothingEnabled = false;
  context.drawImage(stay, 0, 0, columns * MORPH_SCALE, rows * MORPH_SCALE);
  context.setTransform(MORPH_SCALE, 0, 0, MORPH_SCALE, 0, 0);
  context.fillStyle = palette.blue;
  for (let i = 0; i < paths.length; i += 10) {
    const progress = springEase((fraction - paths[i + 8]) / paths[i + 9]);
    const remaining = 1 - progress;
    const start = remaining * remaining * remaining;
    const departure = 3 * remaining * remaining * progress;
    const arrival = 3 * remaining * progress * progress;
    const end = progress * progress * progress;
    context.fillRect(
      start * paths[i] + departure * paths[i + 4] + arrival * paths[i + 6] + end * (paths[i] + paths[i + 2]),
      start * paths[i + 1] + departure * paths[i + 5] + arrival * paths[i + 7] + end * (paths[i + 1] + paths[i + 3]),
      1,
      1,
    );
  }
}
