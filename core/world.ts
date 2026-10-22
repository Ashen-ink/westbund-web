export const SCREEN_WIDTH = 960;
export const SCREEN_HEIGHT = 540;
export const SCREEN_COUNT = 3;
export const WORLD_WIDTH = SCREEN_WIDTH * SCREEN_COUNT;

export const screenX = (screen: number) => (screen - 1) * SCREEN_WIDTH;
export const wrapScreen = (screen: number) =>
  ((((screen - 1) % SCREEN_COUNT) + SCREEN_COUNT) % SCREEN_COUNT) + 1;

export const PHOTO = { x: screenX(SCREEN_COUNT), width: SCREEN_WIDTH } as const;
