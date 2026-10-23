const SCREEN_COUNT = 9;
const SCENE_COUNT = 9;
const LAYOUTS = ["screen", "overview"];

const wrap = (n) => ((((n - 1) % SCREEN_COUNT) + SCREEN_COUNT) % SCREEN_COUNT) + 1;
const initial = () => ({ scene: 1, layout: "screen", assignments: {} });

function sanitize(value) {
  const state = initial();
  if (Number.isInteger(value?.scene) && value.scene >= 1 && value.scene <= SCENE_COUNT) state.scene = value.scene;
  const layout = value?.layout ?? value?.mode;
  if (LAYOUTS.includes(layout)) state.layout = layout;
  for (const [id, screen] of Object.entries(value?.assignments ?? {})) {
    if (Number.isInteger(screen) && screen >= 1 && screen <= SCREEN_COUNT) state.assignments[id] = screen;
  }
  return state;
}

const assign = (state, id, screen) =>
  state.assignments[id] === screen ? state : { ...state, assignments: { ...state.assignments, [id]: screen } };

function apply(state, command, live = []) {
  switch (command?.type) {
    case "scene": {
      const scene = Math.round(Number(command.scene));
      return scene >= 1 && scene <= SCENE_COUNT && scene !== state.scene ? { ...state, scene } : state;
    }
    case "toggle-layout":
      return { ...state, layout: state.layout === "screen" ? "overview" : "screen" };
    case "layout":
      return LAYOUTS.includes(command.layout) && command.layout !== state.layout ? { ...state, layout: command.layout } : state;
    case "assign":
      return typeof command.id === "string" ? assign(state, command.id, wrap(Math.round(Number(command.screen)) || 1)) : state;
    case "step":
      return typeof command.id === "string"
        ? assign(state, command.id, wrap((state.assignments[command.id] ?? 1) + (Math.round(Number(command.delta)) || 0)))
        : state;
    case "register": {
      if (typeof command.id !== "string" || state.assignments[command.id]) return state;
      const taken = new Set(live.filter((id) => id !== command.id).map((id) => state.assignments[id]));
      const hint = Math.round(Number(command.hint));
      let screen = hint >= 1 && hint <= SCREEN_COUNT && !taken.has(hint) ? hint : 1;
      while (taken.has(screen) && screen < SCREEN_COUNT) screen++;
      return assign(state, command.id, screen);
    }
    default:
      return state;
  }
}

module.exports = { SCREEN_COUNT, sanitize, apply };
