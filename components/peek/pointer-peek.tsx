"use client";

import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { useEffect, useRef } from "react";
import { palette, rgb } from "@/core/palette";
import { createGPU, pixelRatio } from "./gpu";

gsap.registerPlugin(CustomEase);
const SWIFT = CustomEase.create("peek.swift", "0.16,1,0.3,1");
const SMOOTH = CustomEase.create("peek.smooth", "0.65,0,0.35,1");

const SEED_HALF = 7; // the picture opens from a 14px rounded seed at the pointer
const SEED_RADIUS = 3;
const MAX = 420;
const SHARE = 0.28; // of the viewport width
const RATIO = 2 / 3;
const GAP = 28; // from the pointer
const LAG = 0.18; // fraction of the distance closed per 60fps frame
const FPS = 60;

const INK = rgb(palette.blue).map((value) => value / 255);

/** Cover-fit transform for `uv = local * scale + offset`. */
function cover(image: HTMLImageElement, w: number, h: number) {
  const aspect = image.naturalWidth / image.naturalHeight;
  const box = w / h;
  return aspect > box
    ? [box / aspect, 1, (1 - box / aspect) / 2, 0]
    : [1, aspect / box, 0, (1 - aspect / box) / 2];
}

/**
 * A picture that develops from blue dots beside the pointer and trails it with a soft lag,
 * flipping to the other side near the viewport edges. Shows `src` while non-null; swap `src`
 * to change picture, set null to close. Pointer-only; renders on a fixed WebGPU canvas.
 */
export function PointerPeek({ src }: { src: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = useRef<string | null>(src);
  source.current = src;
  const wake = useRef<() => void>(() => {});

  useEffect(() => {
    wake.current();
  }, [src]);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !window.matchMedia("(pointer: fine)").matches) return;
    const abort = new AbortController();
    let teardown = () => {};

    createGPU(element, abort.signal, () => teardown()).then((gpu) => {
      if (!gpu) return;
      const images = new Map<string, { image: HTMLImageElement; texture: ReturnType<typeof gpu.upload> }>();
      const loading = new Set<string>();
      const peek = { open: 0, dither: 1, x: 0, y: 0, px: innerWidth / 2, py: innerHeight / 2, fx: 0, fy: 0 };
      let shown: string | null = null;
      let active = false;

      const size = () => {
        const w = Math.min(MAX, innerWidth * SHARE);
        return { w, h: w * RATIO };
      };
      const side = () => {
        const { w, h } = size();
        return { x: peek.px + GAP + w > innerWidth ? 1 : 0, y: peek.py + GAP + h > innerHeight ? 1 : 0 };
      };

      const load = (url: string) => {
        if (images.has(url) || loading.has(url)) return;
        loading.add(url);
        const image = new Image();
        image.onload = () => {
          loading.delete(url);
          if (abort.signal.aborted) return;
          images.set(url, { image, texture: gpu.upload(image) });
        };
        image.src = url;
      };

      const tick = () => {
        const url = source.current;
        const entry = shown ? images.get(shown) : undefined;
        if (!entry || (peek.open <= 0 && !url)) {
          if (!url && peek.open <= 0) {
            gpu.clear();
            stop();
          }
          return;
        }
        const follow = 1 - (1 - LAG) ** gsap.ticker.deltaRatio(FPS);
        const to = side();
        const { w, h } = size();
        peek.x += (peek.px - peek.x) * follow;
        peek.y += (peek.py - peek.y) * follow;
        peek.fx += (to.x - peek.fx) * follow;
        peek.fy += (to.y - peek.fy) * follow;
        const seed = SEED_HALF * 2;
        const tx = peek.x + GAP - peek.fx * (2 * GAP + w);
        const ty = peek.y + GAP - peek.fy * (2 * GAP + h);
        const fx = peek.x - SEED_HALF + (tx - peek.x + SEED_HALF) * peek.open;
        const fy = peek.y - SEED_HALF + (ty - peek.y + SEED_HALF) * peek.open;
        const fw = seed + (w - seed) * peek.open;
        const fh = seed + (h - seed) * peek.open;
        gpu.draw(
          {
            frame: [fx + fw / 2, fy + fh / 2, fw / 2, fh / 2],
            fit: cover(entry.image, fw, fh),
            color: INK,
            dpr: pixelRatio(),
            frameR: SEED_RADIUS,
            dither: peek.dither,
          },
          entry.texture,
        );
      };
      const stop = () => {
        if (!active) return;
        active = false;
        gsap.ticker.remove(tick);
      };
      const start = () => {
        if (active) return;
        active = true;
        gsap.ticker.add(tick);
      };

      // Called whenever `src` changes: open from the pointer, swap in place, or close.
      wake.current = () => {
        const url = source.current;
        if (url) {
          load(url);
          if (peek.open <= 0 && shown !== url) {
            const to = side();
            peek.x = peek.px;
            peek.y = peek.py;
            peek.fx = to.x;
            peek.fy = to.y;
            peek.dither = 1;
            gsap.to(peek, { dither: 0, duration: 0.5, ease: "none", overwrite: "auto" });
          }
          shown = url;
          gsap.to(peek, { open: 1, duration: 0.45, ease: SWIFT, overwrite: "auto" });
          start();
        } else {
          gsap.to(peek, { dither: 1, duration: 0.2, ease: "none", overwrite: "auto" });
          gsap.to(peek, { open: 0, duration: 0.3, ease: SMOOTH, overwrite: "auto" });
        }
      };

      const onMove = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        peek.px = event.clientX;
        peek.py = event.clientY;
      };
      const onResize = () => gpu.resize();
      window.addEventListener("pointermove", onMove);
      window.addEventListener("resize", onResize);
      wake.current();

      teardown = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("resize", onResize);
        stop();
        gsap.killTweensOf(peek);
        gpu.dispose();
        wake.current = () => {};
      };
      if (abort.signal.aborted) teardown();
    });

    return () => {
      abort.abort();
      teardown();
    };
  }, []);

  return (
    <canvas
      ref={canvas}
      width={1}
      height={1}
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 9 }}
    />
  );
}
