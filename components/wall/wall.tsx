"use client";

import { palette } from "@/core/palette";
import type { Scheduler } from "@/core/scheduler";
import { SCREEN_COUNT, SCREEN_HEIGHT, SCREEN_WIDTH, WORLD_WIDTH, screenX } from "@/core/world";
import { useBox } from "@/hooks/use-box";
import type { Layout } from "@/runtime/protocol";
import type { Scene, Viewport } from "@/scenes";

const MIN_OVERVIEW_SCREEN_PX = 320;
const PADDING = 32;

export function Wall({ scene, screen, layout, scheduler }: { scene: Scene; screen: number; layout: Layout; scheduler: Scheduler }) {
  const [ref, box] = useBox<HTMLDivElement>();
  const overview = layout === "overview";
  const SceneView = scene.component;

  let content = null;
  if (box && !overview) {
    const scale = box.width / SCREEN_WIDTH;
    const viewport: Viewport = {
      left: screenX(screen),
      width: SCREEN_WIDTH,
      height: box.height / scale,
      scale,
      pixelWidth: box.width,
      pixelHeight: box.height,
      overview,
    };
    content = (
      <div style={{ position: "absolute", inset: 0, background: palette.paper }}>
        <SceneView viewport={viewport} scheduler={scheduler} />
      </div>
    );
  }
  if (box && overview) {
    const fit = Math.min((box.width - 2 * PADDING) / WORLD_WIDTH, (box.height - 2 * PADDING) / SCREEN_HEIGHT);
    const scale = Math.max(fit, MIN_OVERVIEW_SCREEN_PX / SCREEN_WIDTH);
    const width = Math.floor(WORLD_WIDTH * scale);
    const height = Math.floor(SCREEN_HEIGHT * scale);
    const left = width + 2 * PADDING > box.width ? PADDING : Math.floor((box.width - width) / 2);
    const top = Math.max(PADDING, Math.floor((box.height - height) / 2));
    const viewport: Viewport = { left: 0, width: WORLD_WIDTH, height: SCREEN_HEIGHT, scale: width / WORLD_WIDTH, pixelWidth: width, pixelHeight: height, overview };
    content = (
      <div style={{ position: "absolute", left, top, width, height, background: palette.paper }}>
        <SceneView viewport={viewport} scheduler={scheduler} />
        <svg width={width} height={height} viewBox={`0 0 ${WORLD_WIDTH} ${SCREEN_HEIGHT}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <rect x={0.75} y={0.75} width={WORLD_WIDTH - 1.5} height={SCREEN_HEIGHT - 1.5} fill="none" stroke="#000" strokeOpacity={0.15} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          {Array.from({ length: SCREEN_COUNT - 1 }, (_, i) => (
            <line key={i} x1={SCREEN_WIDTH * (i + 1)} x2={SCREEN_WIDTH * (i + 1)} y1={0} y2={SCREEN_HEIGHT} stroke="#000" strokeOpacity={0.15} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        inset: 0,
        overflow: overview ? "auto" : "hidden",
        background: overview ? "#ececec" : palette.paper,
      }}
    >
      {content}
    </div>
  );
}
