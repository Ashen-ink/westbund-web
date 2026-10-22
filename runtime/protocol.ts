export const HUB_PORT = 7733;

export type Layout = "screen" | "overview";

export const SCENE_COUNT = 9;

interface ShowState {
  scene: number;
  layout: Layout;
  assignments: Record<string, number>;
}

export interface RosterEntry {
  id: string;
  name: string;
  label: string;
  screen: number | null;
}

export interface Show {
  state: ShowState;
  roster: RosterEntry[];
}

export type Command =
  | { type: "scene"; scene: number }
  | { type: "toggle-layout" }
  | { type: "layout"; layout: Layout }
  | { type: "assign"; id: string; screen: number }
  | { type: "step"; id: string; delta: number };

export interface Hello {
  id: string;
  name: string;
  label: string;
  hint?: number;
  role?: "screen" | "remote";
}

export const hubUrl = (address: string) => `ws://${address.includes(":") ? address : `${address}:${HUB_PORT}`}/ws`;
