import { smooth } from "./math";

const MARQUEE_SPEED = 96;

export function marqueeOffset(time: number, cycleWidth: number) {
  return (time * MARQUEE_SPEED) % cycleWidth;
}

const PHOTO_TIMING = { reveal: 0.6, hold: 6, dissolve: 0.4, travel: 1.6 } as const;
const PHOTO_CYCLE = PHOTO_TIMING.reveal + PHOTO_TIMING.hold + PHOTO_TIMING.dissolve + PHOTO_TIMING.travel;


type PhotoFrame =
  | { kind: "still"; index: number; develop: number }
  | { kind: "morph"; from: number; to: number; progress: number };

export function photoFrame(time: number, count: number): PhotoFrame {
  const slot = Math.floor(time / PHOTO_CYCLE);
  const index = slot % count;
  const { reveal, hold, dissolve, travel } = PHOTO_TIMING;
  let elapsed = time - slot * PHOTO_CYCLE;
  if (elapsed < reveal) return { kind: "still", index, develop: smooth(elapsed / reveal) };
  elapsed -= reveal;
  if (elapsed < hold) return { kind: "still", index, develop: 1 };
  elapsed -= hold;
  if (elapsed < dissolve) return { kind: "still", index, develop: 1 - smooth(elapsed / dissolve) };
  elapsed -= dissolve;
  return { kind: "morph", from: index, to: (index + 1) % count, progress: elapsed / travel };
}
