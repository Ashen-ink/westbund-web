import type { HostState } from "@/runtime/host";

export function DebugBadge({ state }: { state: HostState }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "6px 14px",
        borderRadius: 999,
        background: "rgb(17 17 17 / .82)",
        color: "#fff",
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.3,
        letterSpacing: ".02em",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      {state.mode === "overview" ? "OVERVIEW" : `SCREEN ${state.screen} / ${state.screens}`}
      {state.display ? ` · ${state.display}` : ""}
    </div>
  );
}
