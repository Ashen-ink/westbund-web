import { palette } from "@/core/palette";
import { clamp, cubicBezier } from "./math";

export const SANS = '"Helvetica Neue", "PingFang SC", "Hiragino Sans GB", sans-serif';
const SETTLE = cubicBezier(0.16, 1, 0.3, 1);

export type Box = { left: number; top: number; right: number; bottom: number };

export type TextStyle = { size: number; weight: number; family: string; spacing: number; lineHeight: number; maxWidth?: number; color?: string };

type Anchor = { x: number; y: number; align: "center" | "bottom" | "top" | "above" };

export type Block = { font: string; spacing: number; size: number; color: string; lines: { y: number; chars: { char: string; x: number }[] }[]; count: number; box: Box };

export type Look = { alpha: number; blur: number; char?: (index: number) => { alpha: number; blur: number; dy: number } };

function wrap(context: CanvasRenderingContext2D, text: string, maxWidth?: number) {
  if (!maxWidth || context.measureText(text).width <= maxWidth || !text.includes(" ")) return [text];
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    const next = current ? `${current} ${word}` : word;
    if (current && context.measureText(next).width > maxWidth) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

export function layoutBlock(context: CanvasRenderingContext2D, text: string, style: TextStyle, anchor: Anchor): Block {
  const font = `${style.weight} ${style.size}px ${style.family}`;
  const spacing = style.spacing * style.size;
  context.font = font;
  context.letterSpacing = `${spacing}px`;
  const lines = wrap(context, text, style.maxWidth);
  const lineHeight = style.size * style.lineHeight;
  const height = lines.length * lineHeight;
  const top =
    anchor.align === "center" ? anchor.y - height / 2 : anchor.align === "bottom" ? anchor.y - height : anchor.align === "above" ? anchor.y - 12 - height : anchor.y;
  let widest = 0;
  let count = 0;
  const laid = lines.map((line, row) => {
    const width = context.measureText(line).width;
    widest = Math.max(widest, width);
    const start = anchor.x - width / 2 + spacing / 2;
    const chars = [...line].map((char, i, all) => ({ char, x: start + context.measureText(all.slice(0, i).join("")).width }));
    count += chars.length;
    return { y: top + (row + 0.5) * lineHeight, chars };
  });
  context.letterSpacing = "0px";
  return {
    font,
    spacing,
    size: style.size,
    color: style.color ?? palette.blue,
    lines: laid,
    count,
    box: { left: anchor.x - widest / 2, right: anchor.x + widest / 2, top, bottom: top + height },
  };
}

export function clearSeams(block: Block, seams: number[], margin: number) {
  const { box } = block;
  for (const seam of seams) {
    if (box.left >= seam || box.right <= seam) continue;
    const dx = (box.left + box.right) / 2 < seam ? seam - margin - box.right : seam + margin - box.left;
    box.left += dx;
    box.right += dx;
    for (const line of block.lines) for (const char of line.chars) char.x += dx;
  }
  return block;
}

export function drawBlock(context: CanvasRenderingContext2D, block: Block, look: Look) {
  if (look.alpha <= 0.003) return;
  context.font = block.font;
  context.letterSpacing = "0px";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = block.color;
  let index = 0;
  for (const line of block.lines) {
    for (const { char, x } of line.chars) {
      const own = look.char?.(index) ?? { alpha: 1, blur: 0, dy: 0 };
      index++;
      const alpha = look.alpha * own.alpha;
      if (alpha <= 0.003) continue;
      const blur = look.blur + own.blur;
      context.globalAlpha = alpha;
      context.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : "none";
      context.fillText(char, x, line.y + own.dy);
    }
  }
  context.globalAlpha = 1;
  context.filter = "none";
}

export function revealLook(block: Block, state: { on: boolean; since: number } | null): Look {
  if (!state) return { alpha: 0, blur: 0 };
  if (!state.on) {
    const p = clamp(state.since / 0.6);
    return { alpha: 1 - p * p, blur: 8 * p * p };
  }
  const stagger = Math.min(0.06, 0.8 / Math.max(1, block.count));
  return {
    alpha: 1,
    blur: 0,
    char: (index) => {
      const e = SETTLE(clamp((state.since - index * stagger) / 1.4));
      return { alpha: e, blur: 10 * (1 - e), dy: 0.4 * block.size * (1 - e) };
    },
  };
}

export function lightLook(state: { on: boolean; since: number } | null): Look {
  if (!state) return { alpha: 0, blur: 0 };
  if (state.on) {
    const e = SETTLE(clamp(state.since / 1.2));
    return { alpha: e, blur: 6 * (1 - e) };
  }
  const p = clamp(state.since / 0.6);
  return { alpha: 1 - p * p, blur: 6 * p * p };
}
