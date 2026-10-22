// The show state and the commands that change it. Pure: the host applies commands and
// every other machine just receives the resulting state.
//
//   state    { mode: "screen" | "overview", assignments: { [displayKey]: screen } }
//   display  key is `${deviceId}:${displayId}`
//   command  { type: "toggle-mode" } | { type: "mode", mode } | { type: "assign", key, screen }
//            | { type: "step", key, delta } | { type: "register", keys }

const SCREEN_COUNT = 3;
const MODES = ["screen", "overview"];

const wrap = (n) => ((((n - 1) % SCREEN_COUNT) + SCREEN_COUNT) % SCREEN_COUNT) + 1;
const initial = () => ({ mode: "screen", assignments: {} });

const assign = (state, key, screen) =>
  state.assignments[key] === screen ? state : { ...state, assignments: { ...state.assignments, [key]: screen } };

/**
 * `live` is every display currently connected anywhere. A newly seen display takes the lowest
 * screen no live display is showing; displays that return later get their old screen back.
 */
function apply(state, command, live = []) {
  switch (command?.type) {
    case "toggle-mode":
      return { ...state, mode: state.mode === "screen" ? "overview" : "screen" };
    case "mode":
      return MODES.includes(command.mode) && command.mode !== state.mode ? { ...state, mode: command.mode } : state;
    case "assign":
      return typeof command.key === "string" ? assign(state, command.key, wrap(Number(command.screen) || 1)) : state;
    case "step":
      return typeof command.key === "string"
        ? assign(state, command.key, wrap((state.assignments[command.key] ?? 1) + (Number(command.delta) || 0)))
        : state;
    case "register": {
      const keys = (command.keys ?? []).filter((key) => typeof key === "string");
      const used = new Set(live.map((key) => state.assignments[key]).filter(Boolean));
      let next = state;
      for (const key of keys) {
        if (next.assignments[key]) continue;
        let screen = 1;
        while (used.has(screen) && screen < SCREEN_COUNT) screen++;
        used.add(screen);
        next = assign(next, key, screen);
      }
      return next;
    }
    default:
      return state;
  }
}

module.exports = { SCREEN_COUNT, initial, apply, wrap };
