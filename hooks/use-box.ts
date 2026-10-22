"use client";

import { useEffect, useRef, useState } from "react";

interface Box {
  width: number;
  height: number;
}

export function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const width = Math.floor(element.clientWidth);
      const height = Math.floor(element.clientHeight);
      if (width && height) setBox((previous) => (previous?.width === width && previous.height === height ? previous : { width, height }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  return [ref, box] as const;
}
