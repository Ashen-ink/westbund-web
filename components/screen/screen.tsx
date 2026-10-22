"use client";

import { PointerCovers } from "@/components/covers/pointer-covers";
import { COVERS } from "@/data/covers";
import { palette } from "@/core/palette";
import type { Scheduler } from "@/core/scheduler";
import { PHOTO, SCREEN_COUNT, SCREEN_HEIGHT, SCREEN_WIDTH, WORLD_WIDTH, screenX } from "@/core/world";
import { Notes } from "./notes";
import { Photo } from "./photo";
import { Title } from "./title";
import { useBox } from "./use-box";

// In overview a screen is never drawn narrower than this; a wider wall scrolls sideways.
const MIN_OVERVIEW_SCREEN_PX = 640;

const slides = COVERS.map((cover) => cover.src);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface Props {
  screen: number;
  /** "screen": this display's screen fills the window. "overview": the whole wall, fitted and centred. */
  mode: "screen" | "overview";
  scheduler: Scheduler;
}

/**
 * Screen mode fills the window at any aspect ratio. Only layout stretches: the visible world
 * height grows or shrinks, text and images keep their proportions.
 */
export function Screen({ screen, mode, scheduler }: Props) {
  const [ref, box] = useBox<HTMLDivElement>();
  const overview = mode === "overview";
  const left = overview ? 0 : screenX(screen);
  const viewWidth = overview ? WORLD_WIDTH : SCREEN_WIDTH;

  let content = null;
  let covers = null;
  if (box) {
    // The area the view is drawn into: the whole window, or the wall's 48:9 shape centred in it.
    let stage = { left: 0, top: 0, width: box.width, height: box.height };
    if (overview) {
      const fit = Math.max(Math.min(box.width / WORLD_WIDTH, box.height / SCREEN_HEIGHT), MIN_OVERVIEW_SCREEN_PX / SCREEN_WIDTH);
      const width = Math.floor(WORLD_WIDTH * fit);
      const height = Math.floor(SCREEN_HEIGHT * fit);
      stage = { left: Math.max(0, Math.floor((box.width - width) / 2)), top: Math.floor((box.height - height) / 2), width, height };
    }
    const scale = stage.width / viewWidth; // pixels per world unit
    const height = stage.height / scale; // visible world height
    const extra = height - SCREEN_HEIGHT;
    const photoLeft = (PHOTO.x - left) * scale;
    const photoWidth = PHOTO.width * scale;
    const columns = clamp(Math.round(photoWidth / 1.5 / 16) * 16, 96, 384);
    const rows = Math.round((columns * stage.height) / photoWidth);
    // The pointer-following covers belong to the two left screens.
    const zone = overview
      ? { left: stage.left, top: stage.top, width: 2 * SCREEN_WIDTH * scale, height: stage.height }
      : screen <= 2
        ? { left: 0, top: 0, width: box.width, height: box.height }
        : null;
    if (zone) covers = <PointerCovers zone={zone} />;
    content = (
      <div style={{ position: "absolute", background: palette.paper, ...stage }}>
        <svg width={stage.width} height={stage.height} viewBox={`${left} 0 ${viewWidth} ${height}`} style={{ display: "block" }}>
          <g transform={`translate(0 ${extra / 2})`}>
            <Title scheduler={scheduler} />
          </g>
          <Notes />
          {overview && (
            <rect x={0.75} y={0.75} width={WORLD_WIDTH - 1.5} height={height - 1.5} fill="none" stroke="#000" strokeOpacity={0.15} strokeWidth={1.5} />
          )}
          {overview &&
            Array.from({ length: SCREEN_COUNT - 1 }, (_, i) => (
              <line key={i} x1={SCREEN_WIDTH * (i + 1)} x2={SCREEN_WIDTH * (i + 1)} y1={0} y2={height} stroke="#000" strokeOpacity={0.15} strokeWidth={1.5} />
            ))}
        </svg>
        {photoLeft < stage.width && photoLeft + photoWidth > 0 && (
          <Photo
            scheduler={scheduler}
            slides={slides}
            columns={columns}
            rows={rows}
            box={{ left: photoLeft, top: 0, width: photoWidth, height: stage.height }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      // Overview: grey surround so the wall's top and bottom edges read as a frame; wheel scrolls sideways.
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
      {covers}
    </div>
  );
}
