"use client";

import { useEffect, useRef } from "react";
import { loadImage, printTexture, type PrintTexture } from "@/core/dither";
import { buildPool, drawMorph, MORPH_SCALE, particlePaths, type ParticlePool } from "@/core/particles";
import type { Scheduler } from "@/core/scheduler";
import { photoFrame } from "@/core/timeline";
import { useFrame } from "./use-frame";

interface Props {
  scheduler: Scheduler;
  slides: string[];
  /** Dot grid for the photograph: columns × rows cells. */
  columns: number;
  rows: number;
  /** CSS box of the photograph within the screen, in pixels. */
  box: { left: number; top: number; width: number; height: number };
}

interface Prepared {
  textures: PrintTexture[];
  pool: ParticlePool | null;
  paths: Map<number, Float32Array>;
}

/** The slides as blue print dots, morphing from one to the next on the shared clock. */
export function Photo({ scheduler, slides, columns, rows, box }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const prepared = useRef<Prepared | null>(null);
  const drawn = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    prepared.current = null;
    drawn.current = null;
    (async () => {
      const images = await Promise.all(slides.map(loadImage));
      const textures = images.map((image) => printTexture(image, columns, rows));
      if (cancelled || textures.some((texture) => !texture)) return;
      const ready = textures as PrintTexture[];
      prepared.current = { textures: ready, pool: null, paths: new Map() };
      const pool = await buildPool(ready, () => cancelled);
      if (!cancelled && prepared.current) prepared.current.pool = pool;
    })();
    return () => {
      cancelled = true;
    };
  }, [slides, columns, rows]);

  useFrame(() => {
    const element = canvas.current;
    const ready = prepared.current;
    const context = element?.getContext("2d");
    if (!element || !ready || !context) return;
    const frame = photoFrame(scheduler.now(), slides.length);

    const still = (index: number) => {
      if (drawn.current === index) return;
      drawn.current = index;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.imageSmoothingEnabled = false;
      context.drawImage(ready.textures[index].canvas, 0, 0, element.width, element.height);
    };

    if (frame.kind === "still") return still(frame.index);
    if (!ready.pool) return still(frame.progress < 0.5 ? frame.from : frame.to);
    let paths = ready.paths.get(frame.from);
    if (!paths) {
      paths = particlePaths(ready.pool, frame.from, frame.to);
      ready.paths.set(frame.from, paths);
    }
    drawn.current = null;
    drawMorph(context, ready.pool, paths, frame.progress);
  });

  return (
    <canvas
      ref={canvas}
      width={columns * MORPH_SCALE}
      height={rows * MORPH_SCALE}
      style={{ position: "absolute", imageRendering: "pixelated", pointerEvents: "none", ...box }}
    />
  );
}
