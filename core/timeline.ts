// Pure functions from show time to what a screen must draw.

export const MARQUEE_SPEED = 96; // world units per second

export function marqueeOffset(time: number, cycleWidth: number) {
  return (time * MARQUEE_SPEED) % cycleWidth;
}

export const PHOTO_TIMING = { hold: 9, travel: 2.4, settle: 0.65 } as const;
const PHOTO_CYCLE = PHOTO_TIMING.hold + PHOTO_TIMING.travel + PHOTO_TIMING.settle;

export type PhotoFrame =
  | { kind: "still"; index: number }
  | { kind: "morph"; from: number; to: number; progress: number };

/** Hold a slide, morph into the next as dots, then show it until the cycle ends. */
export function photoFrame(time: number, count: number): PhotoFrame {
  const slot = Math.floor(time / PHOTO_CYCLE);
  const elapsed = time - slot * PHOTO_CYCLE;
  const index = slot % count;
  const next = (index + 1) % count;
  const { hold, travel } = PHOTO_TIMING;
  if (elapsed < hold) return { kind: "still", index };
  if (elapsed < hold + travel) return { kind: "morph", from: index, to: next, progress: (elapsed - hold) / travel };
  return { kind: "still", index: next };
}
