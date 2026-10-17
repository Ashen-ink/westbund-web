import { palette } from "./palette";
import type { PrintTexture } from "./dither";

/*
 * ParticleSaga — Canvas adaptation of ParticlePool.setTarget,
 * nextIndexForPool and VertexSort.leftToRight. Upstream:
 * https://github.com/blakecarroll/particle-saga/tree/933986b4188bf758201f5ab27c3f74b1ce1878de
 *
 * The MIT License (MIT)
 * Copyright (c) 2014 Blake Carroll
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Adaptations: enumerate every ink cell instead of randomly sampling pixels;
 * use seeded ordering within columns; add bounded cubic flow curves, spatial
 * staggering and Motion spring timing. The fixed pool covers the densest slide.
 * Several particles share an ink cell, separating/rejoining during the next
 * morph. No shared cells are locked and no count difference is faded in or out.
 */

/*
 * Motion: critically damped resolver, specialised to origin 0, target 1,
 * zero initial velocity and visualDuration 1s (bounce 0). Source:
 * https://github.com/motiondivision/motion/blob/2d27b041114f5f1cffc1f6d3ad522929ce0cc41f/packages/motion-dom/src/animation/generators/spring.ts
 *
 * The MIT License (MIT)
 * Copyright (c) 2024 Motion (https://motion.dev) B.V.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const TIMING = { travel: 2.4, stagger: 0.16, visualDuration: 1 };
/** Canvas pixels per dot while morphing. */
export const MORPH_SCALE = 4;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (amount: number) => {
  const t = clamp(amount);
  return t * t * (3 - 2 * t);
};

function motionCriticalSpring(seconds: number, visualDuration: number) {
  const frequency = (2 * Math.PI) / (visualDuration * 1.2);
  return 1 - Math.exp(-frequency * seconds) * (1 + frequency * seconds);
}

const springTable = Float64Array.from({ length: 1025 }, (_, index) => {
  const t = index / 1024;
  const seconds = t * TIMING.travel * (1 - TIMING.stagger);
  const spring = motionCriticalSpring(seconds, TIMING.visualDuration);
  // The native spring approaches 1 asymptotically. Resolve only the final
  // sub-pixel remainder smoothly, without a snap when the still takes over.
  const finish = smooth((t - 0.85) / 0.15);
  return spring + (1 - spring) * finish;
});

function springEase(t: number) {
  // One sampled spring is shared across the pool instead of evaluating an
  // exponential per dot per frame.
  const position = clamp(t) * 1024;
  const index = Math.min(1023, Math.floor(position));
  return springTable[index] + (springTable[index + 1] - springTable[index]) * (position - index);
}

/** Ink cells in left-to-right order, so the image stays spread across its width. */
function particleTarget(texture: PrintTexture, seed: number): Uint32Array {
  const { columns, rows, dots } = texture;
  const rank = (id: number) => {
    let n = (id ^ Math.imul(seed + 1, 0x9e3779b9)) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
    n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
    return (n ^ (n >>> 15)) >>> 0;
  };
  const order: number[] = [];
  for (let x = 0; x < columns; x++) {
    const column: number[] = [];
    for (let y = 0; y < rows; y++) {
      const id = y * columns + x;
      if (dots[id]) column.push(id);
    }
    column.sort((a, b) => rank(a) - rank(b) || a - b);
    order.push(...column);
  }
  return Uint32Array.from(order);
}

export interface ParticlePool {
  columns: number;
  rows: number;
  /** Ink cells of each texture, in pool order. */
  targets: Uint32Array[];
  /** Fixed particle count: the densest slide. */
  count: number;
}

/** Prepare all textures once; yields between slides so frames keep flowing. */
export async function buildPool(textures: PrintTexture[], isCancelled: () => boolean): Promise<ParticlePool | null> {
  const { columns, rows } = textures[0];
  const targets: Uint32Array[] = [];
  for (let i = 0; i < textures.length; i++) {
    targets.push(particleTarget(textures[i], i));
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (isCancelled()) return null;
  }
  if (targets.some((target) => !target.length)) return null;
  return { columns, rows, targets, count: Math.max(...targets.map((target) => target.length)) };
}

/** Per particle: start xy, delta xy, two bezier controls xy, stagger delay (9 floats). */
export function particlePaths(pool: ParticlePool, from: number, to: number): Float32Array {
  const { columns, rows, count } = pool;
  const source = pool.targets[from];
  const destination = pool.targets[to];
  const paths = new Float32Array(count * 9);
  const flow = (x: number, y: number): [number, number] => {
    const wave = Math.sin((y / rows) * Math.PI * 1.6 + (x / columns) * 1.2);
    // A broad shared current bends neighbouring paths together. Its reach is
    // tied to image size, so long journeys still visibly curve.
    return [columns * (0.12 + 0.035 * wave), rows * (-0.1 + 0.16 * wave)];
  };
  for (let i = 0; i < count; i++) {
    // ParticleSaga's nextIndexForPool: even coverage, including when a target
    // has fewer vertices than the pool. Every ink cell is retained.
    const a = source[Math.floor((i * source.length) / count)];
    const b = destination[Math.floor((i * destination.length) / count)];
    const at = i * 9;
    const x = a % columns;
    const y = Math.floor(a / columns);
    const dx = (b % columns) - x;
    const dy = Math.floor(b / columns) - y;
    const startFlow = flow(x, y);
    const endFlow = flow(x + dx, y + dy);
    paths[at] = x;
    paths[at + 1] = y;
    paths[at + 2] = dx;
    paths[at + 3] = dy;
    // Two controls give departure and arrival their own tangents; all four
    // points stay in the image, bounding the whole Bezier curve.
    paths[at + 4] = clamp(x + dx / 3 + startFlow[0], 0, columns - 1);
    paths[at + 5] = clamp(y + dy / 3 + startFlow[1], 0, rows - 1);
    paths[at + 6] = clamp(x + (dx * 2) / 3 + endFlow[0], 0, columns - 1);
    paths[at + 7] = clamp(y + (dy * 2) / 3 + endFlow[1], 0, rows - 1);
    // The wave follows the source image's layout, not pool order: nearby dots
    // leave together, other regions follow before they settle.
    paths[at + 8] = TIMING.stagger * (0.5 + 0.5 * Math.sin((x / columns) * 4 + (y / rows) * 2));
  }
  return paths;
}

export function drawMorph(
  context: CanvasRenderingContext2D,
  pool: ParticlePool,
  paths: Float32Array,
  fraction: number,
) {
  const { columns, rows } = pool;
  context.setTransform(MORPH_SCALE, 0, 0, MORPH_SCALE, 0, 0);
  context.fillStyle = palette.paper;
  context.fillRect(0, 0, columns, rows);
  context.fillStyle = palette.blue;
  for (let i = 0; i < paths.length; i += 9) {
    const t = clamp((fraction - paths[i + 8]) / (1 - TIMING.stagger));
    const progress = springEase(t);
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
