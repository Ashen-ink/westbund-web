export const SCREEN_WIDTH = 960;
export const SCREEN_HEIGHT = 540;

export const GROUPS = [
  { id: "left", name: "Left", size: 3 },
  { id: "right", name: "Right", size: 6 },
] as const;

export type Group = (typeof GROUPS)[number];
export type GroupId = Group["id"];

export const SCREEN_COUNT = GROUPS.reduce((total, group) => total + group.size, 0);

export const wrapScreen = (screen: number) =>
  ((((screen - 1) % SCREEN_COUNT) + SCREEN_COUNT) % SCREEN_COUNT) + 1;

export const groupWidth = (group: Group) => group.size * SCREEN_WIDTH;

export function locate(screen: number) {
  let first = 1;
  for (const group of GROUPS) {
    if (screen < first + group.size) return { group, index: screen - first, first };
    first += group.size;
  }
  return { group: GROUPS[0], index: 0, first: 1 };
}

export const screensOf = (group: Group) => {
  const first = 1 + GROUPS.slice(0, GROUPS.indexOf(group)).reduce((total, previous) => total + previous.size, 0);
  return Array.from({ length: group.size }, (_, index) => first + index);
};

export function screenName(screen: number) {
  const { group, index } = locate(screen);
  return `${group.name} ${index + 1}`;
}
