"use client";

import { useEffect, useRef } from "react";

export function useFrame(callback: () => void) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  useEffect(() => {
    let id = 0;
    const tick = () => {
      latest.current();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
}
