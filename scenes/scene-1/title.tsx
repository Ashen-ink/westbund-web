"use client";

import { useEffect, useRef, useState } from "react";
import { palette } from "@/core/palette";
import type { Scheduler } from "@/core/scheduler";
import { marqueeOffset } from "./timeline";
import { useFrame } from "@/hooks/use-frame";

const START = 54;
const GAP = 220;
const BASELINE = 240;
const SIZE = 108;
const roman = { fontWeight: 400, fontStyle: "normal", fill: palette.blue, letterSpacing: -4.3 } as const;
const italic = { fontWeight: 400, fontStyle: "italic", fill: palette.olive, fontSize: 100, letterSpacing: -3 } as const;
const ink = { fontWeight: 400, fill: palette.ink, letterSpacing: -1.5 } as const;

export function Title({ scheduler }: { scheduler: Scheduler }) {
  const words = useRef<(SVGTextElement | null)[]>([]);
  const track = useRef<SVGGElement>(null);
  const [layout, setLayout] = useState<{ shift: number[]; cycle: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const measure = () => {
      if (!alive) return;
      let cursor = START;
      const shift = words.current.map((word) => {
        const box = word!.getBBox();
        const at = cursor - box.x;
        cursor += box.width + GAP;
        return at;
      });
      setLayout({ shift, cycle: cursor - START });
    };
    document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => {
      alive = false;
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, []);

  useFrame(() => {
    if (!layout) return;
    track.current?.setAttribute("transform", `translate(${-marqueeOffset(scheduler.now(), layout.cycle)} 0)`);
  });

  const at = (index: number) => `translate(${layout?.shift[index] ?? 0} 0)`;
  const set = (index: number) => (node: SVGTextElement | null) => {
    words.current[index] = node;
  };

  return (
    <g opacity={layout ? 1 : 0}>
      <defs>
        <clipPath id="wb-title-clip">
          <rect x={0} y={90} width={1920} height={184} />
        </clipPath>
        <g id="wb-strip">
          <g transform={at(0)}>
            <text ref={set(0)} x={0} y={BASELINE} fontSize={SIZE}>
              <tspan {...roman}>{"Collectivity "}</tspan>
              <tspan {...italic}>{"and "}</tspan>
              <tspan {...roman}>{"Alternative Forms "}</tspan>
              <tspan {...italic}>{"of "}</tspan>
              <tspan {...ink}>{"Knowledge."}</tspan>
            </text>
          </g>
          <g transform={at(1)}>
            <text ref={set(1)} x={0} y={BASELINE} fontSize={SIZE} {...roman}>{"Migration,"}</text>
          </g>
          <g transform={at(2)}>
            <text ref={set(2)} x={0} y={BASELINE} {...italic}>{"Fluidity,"}</text>
          </g>
          <g transform={at(3)}>
            <text ref={set(3)} x={0} y={BASELINE} fontSize={SIZE} {...ink}>{"Resilience."}</text>
          </g>
        </g>
      </defs>
      <g clipPath="url(#wb-title-clip)">
        <g ref={track}>
          {[0, 1, 2].map((copy) => (
            <use key={copy} href="#wb-strip" x={copy * (layout?.cycle ?? 0)} />
          ))}
        </g>
      </g>
    </g>
  );
}
