"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SCREEN_WIDTH, WORLD_WIDTH } from "@/core/world";
import { useFrame } from "@/hooks/use-frame";
import type { SceneProps } from "../types";
import { Film } from "./film";
import { MONO } from "./renderer";

const REFERENCE = 2;

let fontLoading: Promise<unknown> | null = null;
function loadFont() {
  fontLoading ??= new FontFace("EA Mono", "url(/scenes/scene-4/fragment-mono.woff2)")
    .load()
    .then((face) => {
      document.fonts.add(face);
      return document.fonts.load(`12px ${MONO}`);
    })
    .catch(() => {});
  return fontLoading;
}

export function Scene4({ viewport, scheduler }: SceneProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const film = useMemo(() => new Film(), []);
  const [ready, setReady] = useState(false);
  const { left, width, height, scale, pixelWidth, pixelHeight } = viewport;

  useEffect(() => {
    let alive = true;
    loadFont().then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useFrame(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!ready || !element || !context) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(pixelWidth * dpr);
    const h = Math.round(pixelHeight * dpr);
    if (element.width !== w || element.height !== h) {
      element.width = w;
      element.height = h;
    }
    film.resize(WORLD_WIDTH * REFERENCE, Math.round(height * REFERENCE), SCREEN_WIDTH * REFERENCE, (scale / REFERENCE) * dpr);
    film.render(context, scheduler.now(), left * REFERENCE, width * REFERENCE);
  });

  return <canvas ref={canvas} style={{ position: "absolute", inset: 0, width: pixelWidth, height: pixelHeight, display: "block" }} />;
}

