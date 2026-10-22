export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const smooth = (amount: number) => {
  const t = clamp(amount);
  return t * t * (3 - 2 * t);
};
