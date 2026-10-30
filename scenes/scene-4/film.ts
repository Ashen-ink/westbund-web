import { palette, rgb } from "@/core/palette";
import { REMAINS, SHOWS, TRAITS, WHISPERS, type Lang, type ShowKind } from "./content";
import {
  dissolveOf,
  drawDust,
  drawMind,
  drawMotes,
  drawOrbits,
  drawPulse,
  drawTrace,
  layoutDust,
  layoutMind,
  layoutOrbit,
  layoutTraits,
  orbitPoint,
  type Mind,
  type Orbit,
  type Speck,
  type Trait,
} from "./field";
import { Grid } from "./grid";
import { recent, Trace } from "./heart";
import { smoothstep } from "./math";
import { MONO, Renderer } from "./renderer";
import { TIMELINE, local, moment, phase, starts, storyLength } from "./story";
import { SANS, clearSeams, drawBlock, layoutBlock, lightLook, revealLook, type Block, type TextStyle } from "./text";

const INK = rgb(palette.blue);

const DUST: [number, number][] = [
  [0, 0.35],
  [starts.body, 0.15],
  [starts.told, 0.55],
  [starts.forgotten, 0.8],
  [starts.mind, 0.35],
  [storyLength, 0.3],
];

function interpolate(points: [number, number][], x: number) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x0, y0] = points[i - 1];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}

function styleOf(kind: ShowKind | "whisper" | "trait" | "remains", lang: Lang, frame: number): TextStyle {
  const en = lang === "en";
  const at = (share: number) => (frame * share) / 100;
  switch (kind) {
    case "title":
      return { size: at(12), weight: 500, family: SANS, spacing: -0.035, lineHeight: 1 };
    case "prologue":
      return en
        ? { size: at(2.6), weight: 300, family: SANS, spacing: 0.02, lineHeight: 1.4, maxWidth: frame * 0.9 }
        : { size: at(3.2), weight: 300, family: SANS, spacing: 0.3, lineHeight: 1.4 };
    case "line":
      return en
        ? { size: at(2), weight: 300, family: SANS, spacing: 0.01, lineHeight: 1.5, maxWidth: frame * 0.86 }
        : { size: at(2.4), weight: 300, family: SANS, spacing: 0.24, lineHeight: 1.6 };
    case "tag":
      return { size: at(1.1), weight: 400, family: MONO, spacing: 0.5, lineHeight: 1, color: `rgba(${INK.join(",")},0.8)` };
    case "whisper":
      return en ? { size: at(1.25), weight: 300, family: SANS, spacing: 0.02, lineHeight: 1.2 } : { size: at(1.5), weight: 300, family: SANS, spacing: 0.16, lineHeight: 1.2 };
    case "trait":
      return en
        ? { size: at(1.4), weight: 300, family: SANS, spacing: 0.02, lineHeight: 1.2 }
        : { size: at(1.75), weight: 300, family: SANS, spacing: 0.2, lineHeight: 1.2 };
    case "remains":
      return en
        ? { size: at(2.3), weight: 300, family: SANS, spacing: 0.02, lineHeight: 1.3 }
        : { size: at(3), weight: 300, family: SANS, spacing: 0.3, lineHeight: 1.3 };
  }
}

export class Film {
  private context = document.createElement("canvas").getContext("2d")!;
  private grid = new Grid();
  private renderer = new Renderer();
  private trace = new Trace();
  private width = 0;
  private height = 0;
  private frame = 0;
  private dpr = 1;
  private lang: Lang | null = null;
  private dust: Speck[] = [];
  private orbit!: Orbit;
  private mind!: Mind;
  private traits: Trait[] = [];
  private holds = new Float32Array(TRAITS.length + 1);
  private shows: Block[] = [];
  private whispers: Block[] = [];
  private marks: Block[] = [];

  resize(width: number, height: number, frame: number, dpr: number) {
    if (width === this.width && height === this.height && frame === this.frame && dpr === this.dpr) return;
    this.width = width;
    this.height = height;
    this.frame = frame;
    this.dpr = dpr;
    this.renderer.layout(this.grid, width, height, frame, dpr, [INK, INK]);
    this.dust = layoutDust(this.grid);
    this.orbit = layoutOrbit(width, height, this.grid.cw, WHISPERS);
    this.mind = layoutMind(this.grid, width, height, frame);
    this.lang = null;
  }

  private layoutText(lang: Lang) {
    const { context, width, height, frame, mind, orbit, grid } = this;
    const seams = Array.from({ length: Math.round(width / frame) - 1 }, (_, i) => (i + 1) * frame);
    const margin = frame * 0.03;
    this.lang = lang;
    this.shows = SHOWS.map((show) => {
      const style = styleOf(show.kind, lang, frame);
      const text = show.text[lang];
      if (show.kind === "line") return layoutBlock(context, text, style, { x: width / 2, y: height * 0.87, align: "bottom" });
      if (show.kind === "tag") return layoutBlock(context, text, style, { x: width / 2, y: mind.cy + mind.size * 0.42 + 18, align: "top" });
      return layoutBlock(context, text, style, { x: width / 2, y: height / 2, align: "center" });
    });
    this.whispers = WHISPERS.map((whisper) => {
      const point = orbitPoint(orbit, whisper.ring, (whisper.angle / 360) * Math.PI * 2);
      return clearSeams(layoutBlock(context, whisper[lang], styleOf("whisper", lang, frame), { x: point.x, y: point.y, align: "above" }), seams, margin);
    });
    this.marks = [
      ...TRAITS.map((trait) =>
        clearSeams(
          layoutBlock(context, trait[lang], styleOf("trait", lang, frame), {
            x: (trait.x / 100) * width,
            y: (trait.y / 100) * height,
            align: "center",
          }),
          seams,
          margin,
        ),
      ),
      layoutBlock(context, REMAINS[lang], styleOf("remains", lang, frame), { x: width / 2, y: height / 2, align: "center" }),
    ];
    const targets = mind.cells.filter((cell) => cell.v > 0.3).map((cell) => ({ x: (cell.x + 0.5) * grid.cw, y: (cell.y + 0.5) * grid.ch }));
    this.traits = layoutTraits(
      this.marks.map((mark) => mark.box),
      this.marks.map(() => false),
      width,
      height,
      targets,
    );
  }

  render(context: CanvasRenderingContext2D, time: number, left: number, span: number) {
    const { grid, width, height, dpr } = this;
    if (!width || !height) return;
    const { round, seconds, at, opacity } = moment(time);
    const lang: Lang = round % 2 ? "en" : "zh";
    if (lang !== this.lang) this.layoutText(lang);
    const view = { width, height, t: seconds };

    const body = local("body", at);
    const told = local("told", at);
    const forgotten = local("forgotten", at);
    const gather = local("mind", at);

    grid.clear();
    drawDust(grid, this.dust, view, interpolate(DUST, at));
    const intoBody = smoothstep(0, 0.15, body);
    if (at < starts.told) drawPulse(grid, view, recent(seconds), 1 - intoBody, 1 + 26 * intoBody * intoBody);
    const contraction = smoothstep(0, 0.12, told);
    if (at >= starts.body && contraction < 1) {
      this.trace.update(seconds, grid.cols);
      drawTrace(grid, this.trace, view, intoBody, contraction);
    }
    const scatter = at >= starts.forgotten ? 0.5 + 0.5 * smoothstep(0, 0.2, forgotten) : 0.5 * smoothstep(0.86, 1, told);
    if (at >= starts.told) drawOrbits(grid, view, this.orbit, told, scatter, smoothstep(0.06, 0.14, told));
    if (at >= starts.forgotten) drawMotes(grid, view, this.traits, forgotten, this.holds, gather, 1);
    if (at >= starts.mind) drawMind(grid, view, this.mind, gather);

    const shows = this.shows.map((block, i) => ({ block, look: revealLook(block, phase(TIMELINE.shows[i], seconds)) }));
    const whispers = this.whispers.map((block, i) => ({ block, look: lightLook(phase(TIMELINE.whispers[i], seconds)) }));
    const marks = this.marks.map((block, i) => {
      const dissolve = dissolveOf(this.traits[i], forgotten, 0);
      const appear = smoothstep(0.17 + i * 0.008, 0.25 + i * 0.008, forgotten);
      return { block, look: { alpha: appear * (1 - smoothstep(0, 0.3, dissolve)), blur: dissolve * 8 } };
    });
    const remains = marks[marks.length - 1];
    for (const { block, look } of [...shows, remains]) {
      if (look.alpha < 0.25) continue;
      const { left, top, right, bottom } = block.box;
      grid.quiet(left, top, right, bottom, 0.3, 56);
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    this.renderer.draw(context, grid, Math.round(left * dpr), Math.round(span * dpr));
    context.setTransform(dpr, 0, 0, dpr, -left * dpr, 0);
    for (const { block, look } of [...whispers, ...marks, ...shows]) {
      if (block.box.right + 40 < left || block.box.left - 40 > left + span) continue;
      drawBlock(context, block, look);
    }
    if (opacity < 1) {
      context.globalAlpha = 1 - opacity;
      context.fillStyle = palette.paper;
      context.fillRect(left, 0, span, height);
      context.globalAlpha = 1;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }
}
