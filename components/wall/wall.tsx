"use client";

import { palette } from "@/core/palette";
import type { Scheduler } from "@/core/scheduler";
import { GROUPS, SCREEN_HEIGHT, SCREEN_WIDTH, groupWidth, locate, type Group } from "@/core/world";
import { useBox } from "@/hooks/use-box";
import type { Layout } from "@/runtime/protocol";
import type { Scene, Viewport } from "@/scenes";

const MIN_OVERVIEW_SCREEN_PX = 160;
const PADDING = 32;
const ROW_GAP = 32;
const LABEL_SPACE = 28;

function Frame({ group, width, height }: { group: Group; width: number; height: number }) {
  const world = groupWidth(group);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${world} ${SCREEN_HEIGHT}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <rect x={0.75} y={0.75} width={world - 1.5} height={SCREEN_HEIGHT - 1.5} fill="none" stroke="#000" strokeOpacity={0.15} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {Array.from({ length: group.size - 1 }, (_, i) => (
        <line key={i} x1={SCREEN_WIDTH * (i + 1)} x2={SCREEN_WIDTH * (i + 1)} y1={0} y2={SCREEN_HEIGHT} stroke="#000" strokeOpacity={0.15} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export function Wall({ scene, screen, layout, scheduler }: { scene: Scene; screen: number; layout: Layout; scheduler: Scheduler }) {
  const [ref, box] = useBox<HTMLDivElement>();
  const overview = layout === "overview";
  const SceneView = scene.component;

  let content = null;
  if (box && !overview) {
    const { group, index } = locate(screen);
    const scale = box.width / SCREEN_WIDTH;
    const viewport: Viewport = {
      group: group.id,
      left: index * SCREEN_WIDTH,
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
    const widest = Math.max(...GROUPS.map(groupWidth));
    const narrowest = Math.min(...GROUPS.map(groupWidth));
    const rows = GROUPS.length;
    const fit = Math.min(
      (box.width - 2 * PADDING) / narrowest,
      (box.height - 2 * PADDING - rows * LABEL_SPACE - (rows - 1) * ROW_GAP) / (rows * SCREEN_HEIGHT),
    );
    const scale = Math.max(fit, MIN_OVERVIEW_SCREEN_PX / SCREEN_WIDTH);
    const height = Math.floor(SCREEN_HEIGHT * scale);
    const block = rows * (LABEL_SPACE + height) + (rows - 1) * ROW_GAP;
    const left = widest * scale + 2 * PADDING > box.width ? PADDING : Math.floor((box.width - widest * scale) / 2);
    const first = Math.max(PADDING, Math.floor((box.height - block) / 2));
    content = GROUPS.map((group, row) => {
      const width = Math.floor(groupWidth(group) * scale);
      const top = first + row * (LABEL_SPACE + height + ROW_GAP) + LABEL_SPACE;
      const viewport: Viewport = { group: group.id, left: 0, width: groupWidth(group), height: SCREEN_HEIGHT, scale: width / groupWidth(group), pixelWidth: width, pixelHeight: height, overview };
      return (
        <div key={group.id} style={{ position: "absolute", left, top, width, height, background: palette.paper }}>
          <div style={{ position: "absolute", bottom: "100%", left: 0, paddingBottom: 8, color: "#6b6f76", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>
            {group.name} · {group.size} screens
          </div>
          <SceneView viewport={viewport} scheduler={scheduler} />
          <Frame group={group} width={width} height={height} />
        </div>
      );
    });
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
