"use client";

import { useEffect, useState } from "react";
import { SCREEN_COUNT, wrapScreen } from "@/core/world";

/** What the host (Electron, later a backend) tells this window to show. */
export interface HostState {
  /** 1-based screen of the wall this window displays. */
  screen: number;
  screens: number;
  /** "screen": fill the window with this window's screen. "overview": the whole wall, fitted. */
  mode: "screen" | "overview";
  /** Show the debug badge. */
  debug: boolean;
  /** Human-readable description of the physical display, if known. */
  display?: string;
}

declare global {
  interface Window {
    westbund?: {
      getState(): Promise<HostState | null>;
      onState(callback: (state: HostState) => void): () => void;
    };
  }
}

const STORAGE_KEY = "westbund.screen";

function browserState(): HostState {
  let screen = 1;
  try {
    screen = wrapScreen(Number(localStorage.getItem(STORAGE_KEY)) || 1);
  } catch {}
  return { screen, screens: SCREEN_COUNT, mode: "screen", debug: true, display: "browser" };
}

/** null until the host has answered, so a wrong screen is never painted first. */
export function useHost(): HostState | null {
  const [state, setState] = useState<HostState | null>(null);

  useEffect(() => {
    const bridge = window.westbund;
    if (bridge) {
      let alive = true;
      bridge.getState().then((initial) => alive && initial && setState(initial));
      const off = bridge.onState((next) => alive && setState(next));
      return () => {
        alive = false;
        off();
      };
    }
    // Plain browser (development): arrow keys switch the screen and M the mode here instead of in Electron.
    setState(browserState());
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "m") {
        setState((current) => current && { ...current, mode: current.mode === "screen" ? "overview" : "screen" });
        return;
      }
      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      setState((current) => {
        if (!current) return current;
        const screen = wrapScreen(current.screen + step);
        try {
          localStorage.setItem(STORAGE_KEY, String(screen));
        } catch {}
        return { ...current, screen };
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return state;
}
