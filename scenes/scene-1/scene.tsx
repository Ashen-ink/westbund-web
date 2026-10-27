"use client";

import { useRef } from "react";
import { clamp } from "@/core/math";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "@/core/world";
import { COVERS } from "./covers";
import type { SceneProps } from "../types";
import { Notes } from "./notes";
import { Photo } from "./photo";
import { PointerCovers } from "./pointer-covers";
import { Title } from "./title";

const slides = COVERS.map((cover) => cover.src);
const COVERS_WIDTH = 2 * SCREEN_WIDTH;
const PHOTO = { x: 2 * SCREEN_WIDTH, width: SCREEN_WIDTH };

export function WestBundScene({ viewport, scheduler }: SceneProps) {
  const area = useRef<HTMLDivElement>(null);
  const { group, left, width, height, scale, pixelWidth, pixelHeight } = viewport;
  const extra = height - SCREEN_HEIGHT;

  const photoLeft = (PHOTO.x - left) * scale;
  const photoWidth = PHOTO.width * scale;
  const columns = clamp(Math.round(photoWidth / 1.5 / 16) * 16, 96, 384);
  const rows = Math.round((columns * pixelHeight) / photoWidth);
  const coversLeft = -left * scale;
  const coversWidth = COVERS_WIDTH * scale;

  if (group !== "left") return null;
  return (
    <>
      <svg width={pixelWidth} height={pixelHeight} viewBox={`${left} 0 ${width} ${height}`} style={{ display: "block" }}>
        <g transform={`translate(0 ${extra / 2})`}>
          <Title scheduler={scheduler} />
        </g>
        <Notes />
      </svg>
      {photoLeft < pixelWidth && photoLeft + photoWidth > 0 && (
        <Photo
          scheduler={scheduler}
          slides={slides}
          columns={columns}
          rows={rows}
          box={{ left: photoLeft, top: 0, width: photoWidth, height: pixelHeight }}
        />
      )}
      {coversLeft < pixelWidth && coversLeft + coversWidth > 0 && (
        <>
          <div ref={area} style={{ position: "absolute", top: 0, left: coversLeft, width: coversWidth, height: pixelHeight, pointerEvents: "none" }} />
          <PointerCovers area={area} screenWidth={SCREEN_WIDTH * scale} />
        </>
      )}
    </>
  );
}
