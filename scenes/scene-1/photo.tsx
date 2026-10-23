"use client";

import { useEffect, useRef } from "react";
import { developRank, loadImage, printTexture, type PrintTexture } from "./dither";
import { createMorph, drawMorph, MORPH_SCALE, type Morph } from "./particles";
import type { Scheduler } from "@/core/scheduler";
import { photoFrame } from "./timeline";
import { useFrame } from "@/hooks/use-frame";

interface Props {
  scheduler: Scheduler;
  slides: string[];
  columns: number;
  rows: number;
  box: { left: number; top: number; width: number; height: number };
}

const LEVELS = 32;

interface Prepared {
  images: HTMLImageElement[];
  textures: PrintTexture[];
  masks: Map<number, HTMLCanvasElement>;
  scratch: HTMLCanvasElement;
  morphs: Map<string, Morph | null>;
}

export function Photo({ scheduler, slides, columns, rows, box }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const prepared = useRef<Prepared | null>(null);
  const drawn = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    prepared.current = null;
    drawn.current = null;
    (async () => {
      const images = await Promise.all(slides.map(loadImage));
      const textures = images.map((image) => printTexture(image, columns, rows));
      if (cancelled || textures.some((texture) => !texture)) return;
      const ready = textures as PrintTexture[];
      prepared.current = { images, textures: ready, masks: new Map(), scratch: document.createElement("canvas"), morphs: new Map() };
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

    const still = (index: number, develop: number) => {
      const level = Math.round(develop * LEVELS);
      const key = `${index}:${level}`;
      if (drawn.current === key) return;
      drawn.current = key;
      const { width, height } = element;
      context.setTransform(1, 0, 0, 1, 0, 0);
      if (level === 0) {
        context.imageSmoothingEnabled = false;
        context.drawImage(ready.textures[index].canvas, 0, 0, width, height);
        return;
      }
      const image = ready.images[index];
      const fit = Math.max(width / image.width, height / image.height);
      context.imageSmoothingEnabled = true;
      context.drawImage(image, (width - image.width * fit) / 2, (height - image.height * fit) / 2, image.width * fit, image.height * fit);
      if (level === LEVELS) return;
      let mask = ready.masks.get(level);
      if (!mask) {
        mask = document.createElement("canvas");
        mask.width = columns;
        mask.height = rows;
        const mc = mask.getContext("2d")!;
        const pixels = mc.createImageData(columns, rows);
        for (let y = 0; y < rows; y++)
          for (let x = 0; x < columns; x++)
            pixels.data[(y * columns + x) * 4 + 3] = developRank(x, y) < (1 - level / LEVELS) * 64 ? 255 : 0;
        mc.putImageData(pixels, 0, 0);
        ready.masks.set(level, mask);
      }
      const { scratch } = ready;
      if (scratch.width !== width || scratch.height !== height) {
        scratch.width = width;
        scratch.height = height;
      }
      const sc = scratch.getContext("2d")!;
      sc.imageSmoothingEnabled = false;
      sc.globalCompositeOperation = "source-over";
      sc.clearRect(0, 0, width, height);
      sc.drawImage(ready.textures[index].canvas, 0, 0, width, height);
      sc.globalCompositeOperation = "destination-in";
      sc.drawImage(mask, 0, 0, width, height);
      context.drawImage(scratch, 0, 0);
    };

    const morphOf = (from: number, to: number) => {
      const key = `${from}:${to}`;
      if (!ready.morphs.has(key)) ready.morphs.set(key, createMorph(ready.textures[from], ready.textures[to], from));
      return ready.morphs.get(key) ?? null;
    };
    if (frame.kind === "still") {
      morphOf(frame.index, (frame.index + 1) % slides.length);
      return still(frame.index, frame.develop);
    }
    const morph = morphOf(frame.from, frame.to);
    if (!morph) return still(frame.progress < 0.5 ? frame.from : frame.to, 0);
    drawn.current = null;
    drawMorph(context, morph, frame.progress);
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
