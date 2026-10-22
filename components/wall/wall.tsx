"use client";

import { palette } from "@/core/palette";
import type { Scheduler } from "@/core/scheduler";
import { SCREEN_COUNT, SCREEN_HEIGHT, SCREEN_WIDTH, WORLD_WIDTH, screenX } from "@/core/world";
import { useBox } from "@/hooks/use-box";
import type { Layout } from "@/runtime/protocol";
import type { Scene, Viewport } from "@/scenes";

const MIN_OVERVIEW_SCREEN_PX = 640;

export function Wall({ scene, screen, layout, scheduler }: { scene: Scene; screen: number; layout: Layout; scheduler: Scheduler }) {
  const [ref, box] = useBox<HTMLDivElement>();
  const overview = layout === "overview";
  const SceneView = scene.component;

  let content = null;
  if (box) {
    let stage = { left: 0, top: 0, width: box.width, height: box.height };
    if (overview) {
      const fit = Math.max(Math.min(box.width / WORLD_WIDTH, box.height / SCREEN_HEIGHT), MIN_OVERVIEW_SCREEN_PX / SCREEN_WIDTH);
      const width = Math.floor(WORLD_WIDTH * fit);
      const height = Math.floor(SCREEN_HEIGHT * fit);
      stage = { left: Math.max(0, Math.floor((box.width - width) / 2)), top: Math.floor((box.height - height) / 2), width, height };
    }
    const visible = overview ? WORLD_WIDTH : SCREEN_WIDTH;
    const scale = stage.width / visible;
    const viewport: Viewport = {
      left: overview ? 0 : screenX(screen),
      width: visible,
      height: stage.height / scale,
      scale,
      pixelWidth: stage.width,
      pixelHeight: stage.height,
      overview,
    };
    content = (
      <div style={{ position: "absolute", background: palette.paper, ...stage }}>
        <SceneView viewport={viewport} scheduler={scheduler} />
        {overview && (
          <svg
            width={stage.width}
            height={stage.height}
            viewBox={`0 0 ${WORLD_WIDTH} ${SCREEN_HEIGHT}`}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            <rect x={0.75} y={0.75} width={WORLD_WIDTH - 1.5} height={SCREEN_HEIGHT - 1.5} fill="none" stroke="#000" strokeOpacity={0.15} strokeWidth={1.5} />
            {Array.from({ length: SCREEN_COUNT - 1 }, (_, i) => (
              <line key={i} x1={SCREEN_WIDTH * (i + 1)} x2={SCREEN_WIDTH * (i + 1)} y1={0} y2={SCREEN_HEIGHT} stroke="#000" strokeOpacity={0.15} strokeWidth={1.5} />
            ))}
          </svg>
        )}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      onWheel={overview ? (event) => event.currentTarget.scrollBy({ left: event.deltaY + event.deltaX }) : undefined}
      style={{
        position: "fixed",
        inset: 0,
        overflowX: overview ? "auto" : "hidden",
        overflowY: "hidden",
        background: overview ? "#ececec" : palette.paper,
      }}
    >
      {content}
    </div>
  );
}
