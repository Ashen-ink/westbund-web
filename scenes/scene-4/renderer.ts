import { GLYPHS, Grid, RAMP_CANDIDATES, G } from "./grid";

export const MONO = '"EA Mono", ui-monospace, Menlo, monospace';
const LEVELS = 14;

let rampKey = "";
let rampCache: number[] = [];

function measureRamp() {
  const key = String(document.fonts.check(`12px ${MONO}`));
  if (key === rampKey) return rampCache;
  const canvas = document.createElement("canvas");
  canvas.width = 40;
  canvas.height = 64;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.font = `48px ${MONO}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const coverage = RAMP_CANDIDATES.map((glyph) => {
    context.clearRect(0, 0, 40, 64);
    context.fillText(glyph, 20, 32);
    const data = context.getImageData(0, 0, 40, 64).data;
    let sum = 0;
    for (let i = 3; i < data.length; i += 4) sum += data[i];
    return { glyph, sum };
  });
  rampKey = key;
  rampCache = coverage.sort((a, b) => a.sum - b.sum).map(({ glyph }) => G(glyph));
  return rampCache;
}

export class Renderer {
  private atlas = document.createElement("canvas");
  private cellW = 0;
  private cellH = 0;
  private key = "";

  layout(grid: Grid, width: number, height: number, frame: number, dpr: number, colors: number[][]) {
    const fontSize = Math.round(frame / 115);
    this.cellW = Math.max(1, Math.round(fontSize * 0.618 * dpr));
    this.cellH = Math.max(1, Math.round(fontSize * 1.25 * dpr));
    grid.resize(width, height, this.cellW / dpr, this.cellH / dpr);
    grid.ramp = measureRamp();
    const key = `${fontSize}:${dpr}:${rampKey}:${colors.join()}`;
    if (key !== this.key) {
      this.key = key;
      this.buildAtlas(fontSize * dpr, colors);
    }
  }

  private buildAtlas(fontPx: number, colors: number[][]) {
    const { cellW, cellH, atlas } = this;
    atlas.width = GLYPHS.length * cellW;
    atlas.height = LEVELS * colors.length * cellH;
    const context = atlas.getContext("2d")!;
    context.clearRect(0, 0, atlas.width, atlas.height);
    context.font = `${fontPx}px ${MONO}`;
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    const baseline = Math.round((cellH - fontPx * 1.2) / 2 + fontPx * 0.95);
    colors.forEach(([r, g, b], tint) => {
      for (let level = 1; level <= LEVELS; level++) {
        const alpha = 0.035 + 0.965 * (level / LEVELS) ** 1.55;
        context.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        const y = (tint * LEVELS + level - 1) * cellH + baseline;
        GLYPHS.forEach((glyph, i) => {
          if (i) context.fillText(glyph, i * cellW + cellW / 2, y);
        });
      }
    });
  }

  draw(context: CanvasRenderingContext2D, grid: Grid, offset: number, span: number) {
    const { atlas, cellW, cellH } = this;
    const { cols, rows, glyph, lum, tint } = grid;
    const from = Math.max(0, Math.floor(offset / cellW));
    const to = Math.min(cols - 1, Math.ceil((offset + span) / cellW));
    for (let y = 0; y < rows; y++) {
      for (let x = from; x <= to; x++) {
        const i = y * cols + x;
        const g = glyph[i];
        if (g === 0) continue;
        const level = Math.min(LEVELS, (lum[i] * LEVELS + 0.5) | 0);
        if (level <= 0) continue;
        context.drawImage(atlas, g * cellW, (tint[i] * LEVELS + level - 1) * cellH, cellW, cellH, x * cellW - offset, y * cellH, cellW, cellH);
      }
    }
  }
}
