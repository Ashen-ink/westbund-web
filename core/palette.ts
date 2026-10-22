export const palette = {
  blue: "#1546b0",
  olive: "#727343",
  ink: "#111111",
  paper: "#ffffff",
} as const;

export const rgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)) as [number, number, number];
