"use client";

import gsap from "gsap";
import { useEffect, useRef, type RefObject } from "react";
import { COVERS } from "@/data/covers";

const SPAWN_DISTANCE = 100;
const RADIUS = 3;
const SIZE = "clamp(220px, 20vw, 400px)";

export function PointerCovers({ area }: { area: RefObject<HTMLElement | null> }) {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = [...layer.current!.querySelectorAll("img")];
    gsap.set(items, { xPercent: -50, yPercent: -50 });
    const animations = new Set<gsap.core.Timeline>();
    const pointer = { x: 0, y: 0 };
    const lag = { x: 0, y: 0 };
    const last = { x: 0, y: 0 };
    let next = 0;
    let depth = 1;
    let ticking = false;
    let anchored = false;

    const stopTicking = () => {
      gsap.ticker.remove(tick);
      ticking = false;
    };
    const tick = () => {
      if (document.hidden) {
        anchored = false;
        stopTicking();
        return;
      }
      const follow = 1 - 0.9 ** gsap.ticker.deltaRatio(120);
      lag.x += (pointer.x - lag.x) * follow;
      lag.y += (pointer.y - lag.y) * follow;
      if (Math.hypot(pointer.x - last.x, pointer.y - last.y) > SPAWN_DISTANCE) {
        last.x = pointer.x;
        last.y = pointer.y;
        const item = items[next++ % items.length];
        gsap.killTweensOf(item);
        const animation = gsap
          .timeline({ onComplete: () => void animations.delete(animation) })
          .set(item, { x: lag.x, y: lag.y, rotate: 20, scale: 1, opacity: 1, zIndex: depth++ }, 0)
          .to(item, { x: pointer.x, y: pointer.y, rotate: 0, duration: 1, ease: "expo.out" }, 0)
          .to(item, { scale: 0.2, duration: 0.5, ease: "power3.inOut" }, 0.4)
          .to(item, { opacity: 0, duration: 0.3, ease: "none" }, 0.5);
        animations.add(animation);
      }
      if (Math.hypot(pointer.x - lag.x, pointer.y - lag.y) < 0.1) stopTicking();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const zone = area.current?.getBoundingClientRect();
      const inside =
        zone !== undefined &&
        event.clientX >= zone.left &&
        event.clientX < zone.right &&
        event.clientY >= zone.top &&
        event.clientY < zone.bottom;
      if (!inside) {
        anchored = false;
        return;
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (!anchored) {
        lag.x = last.x = pointer.x;
        lag.y = last.y = pointer.y;
        anchored = true;
      }
      if (!ticking) {
        ticking = true;
        gsap.ticker.add(tick);
      }
    };
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointermove", move);
      stopTicking();
      animations.forEach((animation) => animation.kill());
    };
  }, [area]);

  return (
    <div
      ref={layer}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 9 }}
    >
      {COVERS.map(({ src, width, height }) => {
        const wide = width >= height;
        return (
          <img
            key={src}
            src={src}
            width={width}
            height={height}
            alt=""
            draggable={false}
            decoding="async"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              display: "block",
              maxWidth: "none",
              width: wide ? SIZE : "auto",
              height: wide ? "auto" : SIZE,
              borderRadius: RADIUS,
              opacity: 0,
              userSelect: "none",
              willChange: "transform, opacity",
            }}
          />
        );
      })}
    </div>
  );
}
