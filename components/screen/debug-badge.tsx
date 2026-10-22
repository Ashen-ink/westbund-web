"use client";

import { useState, type CSSProperties } from "react";
import type { HostState, RoleChoice } from "@/runtime/host";

const pill: CSSProperties = {
  padding: "6px 14px",
  borderRadius: 999,
  background: "rgb(17 17 17 / .82)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1.3,
  whiteSpace: "nowrap",
};
const button: CSSProperties = {
  font: "inherit",
  color: "inherit",
  background: "rgb(255 255 255 / .14)",
  border: 0,
  borderRadius: 6,
  padding: "4px 10px",
  cursor: "pointer",
};

const setRole = (choice: RoleChoice) => void window.westbund?.setRole(choice);

/** Debug: which screen this is, and the network role. Click to open the role panel. */
export function DebugBadge({ state }: { state: HostState }) {
  const [open, setOpen] = useState(false);
  const { network } = state;
  const label = state.screen === null ? "NO SCREEN" : state.mode === "overview" ? "OVERVIEW" : `SCREEN ${state.screen} / ${state.screens}`;
  const link = network
    ? network.role === "host"
      ? `HOST${network.peers ? ` · ${network.peers} joined` : ""}`
      : network.connected
        ? `JOINED ${network.host}`
        : "SEARCHING…"
    : null;

  return (
    <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 10, textAlign: "center" }}>
      <div
        onClick={() => network && setOpen((value) => !value)}
        style={{ ...pill, cursor: network ? "pointer" : "default", display: "inline-block" }}
      >
        {label}
        {state.display ? ` · ${state.display}` : ""}
        {link ? ` · ${link}` : ""}
      </div>
      {open && network && (
        <div style={{ ...pill, borderRadius: 12, marginTop: 8, padding: 12, display: "grid", gap: 8, textAlign: "left" }}>
          <div>{network.name}</div>
          <button style={{ ...button, background: network.role === "host" ? "#1546b0" : button.background }} onClick={() => setRole({ role: "host" })}>
            Host the show
          </button>
          {network.discovered.map((host) => (
            <button
              key={host.name}
              style={{ ...button, background: network.role === "client" && network.host === host.address ? "#1546b0" : button.background }}
              onClick={() => setRole({ role: "client", address: host.address })}
            >
              Join {host.name} · {host.address}
            </button>
          ))}
          {network.discovered.length === 0 && <div style={{ opacity: 0.6 }}>No other hosts found</div>}
          {network.role === "host" && <div style={{ opacity: 0.6 }}>Clock offset: host (0 ms)</div>}
          {network.role === "client" && <div style={{ opacity: 0.6 }}>Clock offset: {Math.round(state.clockOffset)} ms</div>}
        </div>
      )}
    </div>
  );
}
