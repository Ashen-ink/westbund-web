import type { Scene } from "./types";
import { WestBundScene } from "./west-bund/scene";

export const SCENES: Partial<Record<number, Scene>> = {
  1: {
    name: "West Bund",
    description: "Title line, dot-print slideshow and pointer covers",
    component: WestBundScene,
  },
};

export type { Scene, SceneProps, Viewport } from "./types";
