"use client";

import { useEffect, useMemo } from "react";
import { WallClockScheduler } from "@/core/scheduler";
import { useHost } from "@/runtime/host";
import { DebugBadge } from "./screen/debug-badge";
import { Screen } from "./screen/screen";

export function Stage() {
  const host = useHost();
  const scheduler = useMemo(() => new WallClockScheduler(), []);
  const offset = host?.clockOffset ?? 0;
  useEffect(() => scheduler.adjust(offset), [scheduler, offset]);

  if (!host) return null; // nothing is painted until the host app says what this window is
  return (
    <>
      {host.screen !== null && <Screen screen={host.screen} mode={host.mode} scheduler={scheduler} />}
      {host.debug && <DebugBadge state={host} />}
    </>
  );
}
