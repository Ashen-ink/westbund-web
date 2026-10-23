import { smooth } from "@/core/math";
import { palette, rgb } from "@/core/palette";

const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];
export const developRank = (x: number, y: number) => BAYER[((y + 5) % 8) * 8 + ((x + 3) % 8)];

const INK = rgb(palette.blue);
const PAPER = rgb(palette.paper);


export interface PrintTexture {
  columns: number;
  rows: number;
  dots: Uint8Array;
  canvas: HTMLCanvasElement;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

export function printTexture(image: HTMLImageElement, columns: number, rows: number): PrintTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = columns;
  canvas.height = rows;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const scale = Math.max(columns / image.width, rows / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  context.drawImage(image, (columns - w) / 2, (rows - h) / 2, w, h);
  const frame = context.getImageData(0, 0, columns, rows);
  const data = frame.data;
  const dots = new Uint8Array(columns * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const at = (y * columns + x) * 4;
      const light = (0.2126 * data[at] + 0.7152 * data[at + 1] + 0.0722 * data[at + 2]) / 255;
      const ink = smooth((light - 0.08) / 0.84) < (BAYER[(y % 8) * 8 + (x % 8)] + 0.5) / 64;
      dots[y * columns + x] = Number(ink);
      const color = ink ? INK : PAPER;
      data[at] = color[0];
      data[at + 1] = color[1];
      data[at + 2] = color[2];
      data[at + 3] = 255;
    }
  }
  context.putImageData(frame, 0, 0);
  return { columns, rows, dots, canvas };
}
