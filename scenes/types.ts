import type { ComponentType } from "react";
import type { Scheduler } from "@/core/scheduler";

export interface Viewport {
  left: number;
  width: number;
  height: number;
  scale: number;
  pixelWidth: number;
  pixelHeight: number;
  overview: boolean;
}

export interface SceneProps {
  viewport: Viewport;
  scheduler: Scheduler;
}

export interface Scene {
  name: string;
  description: string;
  component: ComponentType<SceneProps>;
}
