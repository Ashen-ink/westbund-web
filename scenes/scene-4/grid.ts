export const GLYPHS = [
  " ", ".", "·", ",", "'", "`", ":", "-", "~", "=", "+", "*", "x", "o", "%", "#", "@", "&", "8",
  "_", "¯", "|", "/", "\\", "•", "m", "i", "n", "d",
] as const;

type Glyph = (typeof GLYPHS)[number];

const index = new Map<string, number>(GLYPHS.map((glyph, i) => [glyph, i]));
export const G = (glyph: Glyph) => index.get(glyph)!;

export const RAMP_CANDIDATES: Glyph[] = [".", "·", ":", "-", "~", "=", "+", "*", "o", "x", "%", "#", "@"];

export class Grid {
  cols = 0;
  rows = 0;
  cw = 0;
  ch = 0;
  glyph = new Uint8Array(0);
  lum = new Float32Array(0);
  tint = new Uint8Array(0);
  ramp: number[] = RAMP_CANDIDATES.map(G);

  resize(width: number, height: number, cw: number, ch: number) {
    this.cw = cw;
    this.ch = ch;
    this.cols = Math.ceil(width / cw);
    this.rows = Math.ceil(height / ch);
    const size = this.cols * this.rows;
    this.glyph = new Uint8Array(size);
    this.lum = new Float32Array(size);
    this.tint = new Uint8Array(size);
  }

  clear() {
    this.glyph.fill(0);
    this.lum.fill(0);
    this.tint.fill(0);
  }

  put(x: number, y: number, glyph: number, lum: number, tint = 0) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows || lum <= 0) return;
    const i = y * this.cols + x;
    if (lum > this.lum[i]) {
      this.lum[i] = lum > 1 ? 1 : lum;
      this.glyph[i] = glyph;
      this.tint[i] = tint;
    }
  }

  rampGlyph(value: number) {
    const ramp = this.ramp;
    return ramp[Math.min(ramp.length - 1, Math.max(0, Math.floor(value * ramp.length)))];
  }

  quiet(left: number, top: number, right: number, bottom: number, keep: number, feather: number) {
    const { cw, ch, cols, lum } = this;
    const x0 = Math.max(0, Math.floor((left - feather) / cw));
    const x1 = Math.min(cols - 1, Math.ceil((right + feather) / cw));
    const y0 = Math.max(0, Math.floor((top - feather) / ch));
    const y1 = Math.min(this.rows - 1, Math.ceil((bottom + feather) / ch));
    for (let y = y0; y <= y1; y++) {
      const py = (y + 0.5) * ch;
      const dy = py < top ? top - py : py > bottom ? py - bottom : 0;
      for (let x = x0; x <= x1; x++) {
        const px = (x + 0.5) * cw;
        const dx = px < left ? left - px : px > right ? px - right : 0;
        const d = Math.sqrt(dx * dx + dy * dy) / feather;
        if (d >= 1) continue;
        lum[y * cols + x] *= keep + (1 - keep) * d * d * (3 - 2 * d);
      }
    }
  }
}
