"use client";

import { useMemo } from "react";
import { WallClockScheduler } from "@/core/scheduler";
import { useHost } from "@/runtime/host";
import { DebugBadge } from "./screen/debug-badge";
import { Screen } from "./screen/screen";

export function Stage() {
  const host = useHost();
  const scheduler = useMemo(() => new WallClockScheduler(), []);
  if (!host) return null; // nothing is painted until the host says which screen this is
  return (
    <>
      <Screen screen={host.screen} mode={host.mode} scheduler={scheduler} />
      {host.debug && <DebugBadge state={host} />}
    </>
  );
}
