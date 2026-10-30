import type { ChapterId } from "./story";

export type Lang = "zh" | "en";
export type Text = Record<Lang, string>;

export type ShowKind = "title" | "prologue" | "line" | "tag";

export const SHOWS: { chapter: ChapterId; from: number; to: number; slot: string; kind: ShowKind; text: Text }[] = [
  { chapter: "prologue", from: 0, to: 0.4, slot: "prologue", kind: "title", text: { zh: "Everlasting", en: "Everlasting" } },
  { chapter: "prologue", from: 0.46, to: 0.86, slot: "prologue", kind: "prologue", text: { zh: "人的一生，会死去三次。", en: "A person dies three times." } },
  { chapter: "body", from: 0.7, to: 0.98, slot: "line", kind: "line", text: { zh: "第一次，是心跳停止的时候。", en: "The first, when the heart stops." } },
  { chapter: "told", from: 0.74, to: 0.98, slot: "line", kind: "line", text: { zh: "第二次，是所有人都知道你离开了。", en: "The second, when everyone learns that you are gone." } },
  {
    chapter: "forgotten",
    from: 0.82,
    to: 0.995,
    slot: "line",
    kind: "line",
    text: { zh: "第三次，是最后一个记得你的人，也离开了。", en: "The third, when the last person who remembers you is gone." },
  },
  { chapter: "mind", from: 0.3, to: 1, slot: "", kind: "tag", text: { zh: "HUMAN-LIFE MODEL", en: "HUMAN-LIFE MODEL" } },
  { chapter: "mind", from: 0.42, to: 0.6, slot: "line", kind: "line", text: { zh: "声音、影像，与书写下的思想。", en: "Voice, video and written thoughts." } },
  { chapter: "mind", from: 0.6, to: 0.78, slot: "line", kind: "line", text: { zh: "只取自一个人自己的数据。", en: "Built only from a person’s own data." } },
  { chapter: "mind", from: 0.78, to: 1, slot: "line", kind: "line", text: { zh: "一个不断演化的你。", en: "An evolving representation of who you are." } },
];

export const WHISPERS = [
  { zh: "走了", en: "Gone.", ring: 0, angle: 205 },
  { zh: "听说了吗", en: "Did you hear?", ring: 1, angle: 322 },
  { zh: "什么时候的事", en: "When did it happen?", ring: 1, angle: 28 },
  { zh: "上个星期", en: "Last week.", ring: 2, angle: 248 },
  { zh: "我才知道", en: "I only just found out.", ring: 3, angle: 162 },
  { zh: "太突然了", en: "So sudden.", ring: 3, angle: 118 },
  { zh: "周六送别", en: "The farewell is on Saturday.", ring: 4, angle: 58 },
];

export const TRAITS = [
  { zh: "声音", en: "Voice", x: 14, y: 21 },
  { zh: "笔迹", en: "Handwriting", x: 40, y: 16 },
  { zh: "口音", en: "Accent", x: 65, y: 19 },
  { zh: "生平", en: "A life story", x: 86, y: 24 },
  { zh: "未完成的作品", en: "Unfinished work", x: 27, y: 31 },
  { zh: "做决定的方式", en: "How decisions were made", x: 73, y: 33 },
  { zh: "停顿", en: "Pauses", x: 10, y: 45 },
  { zh: "信念", en: "Values", x: 89, y: 46 },
  { zh: "犹豫的方式", en: "The way one hesitates", x: 20, y: 70 },
  { zh: "一种笑声", en: "A particular laugh", x: 45, y: 75 },
  { zh: "偏爱的颜色", en: "A preferred colour", x: 70, y: 71 },
];

export const REMAINS: Text = { zh: "一个人，还剩下什么", en: "What remains of a person" };
