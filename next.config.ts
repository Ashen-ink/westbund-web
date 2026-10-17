import type { NextConfig } from "next";

// Static export: Electron serves `out/` through its own app:// protocol.
const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default config;
