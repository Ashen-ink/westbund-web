import { RING_LEVELS, waveAt } from "./field";
import { clamp } from "./math";
import { SHOWS, WHISPERS } from "./content";

export const chapters = [
  { id: "prologue", length: 1.8 },
  { id: "body", length: 2.2 },
  { id: "told", length: 2.2 },
  { id: "forgotten", length: 2.8 },
  { id: "mind", length: 2.2 },
] as const;

export type ChapterId = (typeof chapters)[number]["id"];

export const starts = chapters.reduce<Record<ChapterId, number>>((acc, chapter, i) => {
  acc[chapter.id] = i === 0 ? 0 : acc[chapters[i - 1].id] + chapters[i - 1].length;
  return acc;
}, {} as Record<ChapterId, number>);

export const storyLength = chapters.reduce((sum, chapter) => sum + chapter.length, 0);

const lengthOf = (id: ChapterId) => chapters.find((chapter) => chapter.id === id)!.length;

export const local = (id: ChapterId, at: number) => clamp((at - starts[id]) / lengthOf(id));

export const RATE = 0.2;
const STEP = 1 / 120;
const MIN_VISIBLE = 2.2;
const SLOT_GAP = 0.65;
const HOLD = 6;
const FADE_OUT = 1.2;
const BLANK = 0.7;
const FADE_IN = 1.2;

export type Toggle = { on: number; off: number };

const active = (id: ChapterId, at: number) => at >= starts[id] - 0.001 && (id === chapters[chapters.length - 1].id || at <= starts[id] + lengthOf(id));

function simulate() {
  const shows = SHOWS.map((show) => ({
    show,
    start: starts[show.chapter] + show.from * lengthOf(show.chapter),
    end: starts[show.chapter] + Math.min(show.to, 1) * lengthOf(show.chapter),
    on: false,
    since: 0,
    done: false,
    toggles: [] as Toggle[],
  }));
  const whispers = WHISPERS.map(() => ({ lit: false, toggles: [] as Toggle[] }));
  const slots = new Map<string, { owner: (typeof shows)[number] | null; free: number }>();
  const story: number[] = [];
  let at = 0;
  let time = 0;

  while (at < storyLength) {
    let limit = Infinity;
    for (const entry of shows) {
      if (!entry.show.slot) continue;
      if (at < entry.start - 0.001) {
        entry.done = false;
        continue;
      }
      if (entry.done) continue;
      if (entry.on && time - entry.since >= MIN_VISIBLE) entry.done = true;
      else limit = Math.min(limit, entry.end - 0.002);
    }
    at = Math.min(at + RATE * STEP, storyLength, Math.max(at, limit));
    story.push(at);

    const entering: typeof shows = [];
    for (const entry of shows) {
      const { chapter, from, to } = entry.show;
      const p = local(chapter, at);
      const on = active(chapter, at) && p >= from && (to >= 1 ? p <= 1 : p < to);
      if (on === entry.on) continue;
      if (on) {
        entering.push(entry);
        continue;
      }
      entry.on = false;
      entry.toggles[entry.toggles.length - 1].off = time;
      const slot = entry.show.slot ? slots.get(entry.show.slot) : undefined;
      if (slot?.owner === entry) {
        slot.owner = null;
        slot.free = time + SLOT_GAP;
      }
    }
    for (const entry of entering) {
      if (entry.show.slot) {
        let slot = slots.get(entry.show.slot);
        if (!slot) slots.set(entry.show.slot, (slot = { owner: null, free: 0 }));
        if (slot.owner || time < slot.free) continue;
        slot.owner = entry;
      }
      entry.on = true;
      entry.since = time;
      entry.toggles.push({ on: time, off: Infinity });
    }

    const told = local("told", at);
    const wave = waveAt(told);
    WHISPERS.forEach((whisper, i) => {
      const lit = active("told", at) && wave >= RING_LEVELS[whisper.ring] + 0.02 && told < 0.92;
      if (lit === whispers[i].lit) return;
      whispers[i].lit = lit;
      if (lit) whispers[i].toggles.push({ on: time, off: Infinity });
      else whispers[i].toggles[whispers[i].toggles.length - 1].off = time;
    });
    time += STEP;
  }
  return { story: Float32Array.from(story), play: time, shows: shows.map((entry) => entry.toggles), whispers: whispers.map((entry) => entry.toggles) };
}

export const TIMELINE = simulate();

export const LOOP = TIMELINE.play + HOLD + FADE_OUT + BLANK;

export function moment(time: number) {
  const round = Math.floor(time / LOOP);
  const seconds = time - round * LOOP;
  const index = Math.min(TIMELINE.story.length - 1, Math.floor(seconds / STEP));
  const out = clamp((seconds - TIMELINE.play - HOLD) / FADE_OUT);
  return {
    round,
    seconds,
    at: seconds >= TIMELINE.play ? storyLength : TIMELINE.story[index],
    opacity: Math.min(clamp(seconds / FADE_IN), 1 - out),
  };
}

export function phase(toggles: Toggle[], seconds: number) {
  for (let i = toggles.length - 1; i >= 0; i--) {
    const { on, off } = toggles[i];
    if (seconds < on) continue;
    return seconds < off ? { on: true, since: seconds - on } : { on: false, since: seconds - off };
  }
  return null;
}
