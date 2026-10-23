"use client";

import { useEffect, useMemo, useState } from "react";
import { WallClockScheduler } from "@/core/scheduler";
import { useShow } from "@/runtime/use-show";
import { SCENES } from "@/scenes";
import { SettingsDialog } from "./settings/settings-dialog";
import { Wall } from "./wall/wall";

export function Stage() {
  const show = useShow();
  const scheduler = useMemo(() => new WallClockScheduler(), []);
  const [asked, setAsked] = useState(false);
  const { setScene } = show.actions;
  useEffect(() => scheduler.adjust(show.offset), [scheduler, show.offset]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select")) return;
      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        setAsked((value) => !value);
      } else if (/^[1-9]$/.test(event.key) && !document.querySelector("dialog[open]")) {
        setScene(Number(event.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setScene]);

  if (!show.ready) return null;
  const scene = SCENES[show.scene] ?? SCENES[1];
  return (
    <>
      <Wall scene={scene} screen={show.screen} layout={show.layout} scheduler={scheduler} />
      <SettingsDialog show={show} open={asked} onClose={() => setAsked(false)} />
    </>
  );
}
