"use client";

import { palette } from "@/core/palette";
import type { SceneProps } from "../types";

export function Scene4({ viewport }: SceneProps) {
  const { left, width, height, pixelWidth, pixelHeight } = viewport;
  return (
    <svg width={pixelWidth} height={pixelHeight} viewBox={`${left} 0 ${width} ${height}`} style={{ display: "block" }}>
      <text x={left + width / 2} y={height / 2} textAnchor="middle" dominantBaseline="middle" fontSize={72} fill={palette.ink} opacity={0.12}>
        4
      </text>
    </svg>
  );
}
