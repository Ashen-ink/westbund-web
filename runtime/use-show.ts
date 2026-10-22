"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SCREEN_COUNT, wrapScreen } from "@/core/world";
import type { ElectronInfo } from "./electron";
import { HubClient, type LinkStatus } from "./hub-client";
import { hubUrl, SCENE_COUNT, type Layout, type RosterEntry } from "./protocol";

const KEYS = { hub: "westbund.hub", id: "westbund.id" };
const localKey = (id: string) => `westbund.local.${id}`;
const nameKey = (id: string) => `westbund.name.${id}`;
const SETTLE_MS = 1200;

const read = (storage: Storage, key: string) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};
const write = (storage: Storage, key: string, value: string | null) => {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {}
};

interface Local {
  screen: number;
  scene: number;
  layout: Layout;
}

function readLocal(id: string, hint: number): Local {
  try {
    const stored = JSON.parse(read(localStorage, localKey(id)) ?? "null");
    if (stored && Number.isInteger(stored.screen))
      return {
        screen: wrapScreen(stored.screen),
        scene: Number.isInteger(stored.scene) && stored.scene >= 1 && stored.scene <= SCENE_COUNT ? stored.scene : 1,
        layout: stored.layout === "overview" ? "overview" : "screen",
      };
  } catch {}
  return { screen: wrapScreen(hint), scene: 1, layout: "screen" };
}

function browserIdentity() {
  const query = new URLSearchParams(location.search);
  let id = query.get("id") ?? read(sessionStorage, KEYS.id);
  if (!id) {
    id = crypto.randomUUID();
    write(sessionStorage, KEYS.id, id);
  }
  return { id, name: read(localStorage, nameKey(id)) || `Browser ${id.slice(0, 8)}`, label: `${innerWidth}×${innerHeight}`, hint: Number(query.get("screen")) || 1 };
}

async function browserHub() {
  const given = read(localStorage, KEYS.hub);
  if (given) return hubUrl(given);
  try {
    const response = await fetch("/health", { signal: AbortSignal.timeout(1500) });
    if (response.ok && (await response.json()).hub) return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
  } catch {}
  return null;
}

const typing = (target: EventTarget | null) =>
  (target instanceof HTMLElement && target.closest("input, textarea, select")) || document.querySelector("dialog[open]");

export interface ShowView {
  ready: boolean;
  screen: number;
  screens: number;
  scene: number;
  layout: Layout;
  status: LinkStatus;
  offset: number;
  hubUrl: string | null;
  roster: RosterEntry[];
  self: { id: string; name: string; label: string };
  electron: ElectronInfo | null;
  actions: {
    step(delta: number): void;
    setScreen(screen: number): void;
    setScene(scene: number): void;
    toggleLayout(): void;
    assign(id: string, screen: number): void;
    join(address: string): void;
    rename(name: string): void;
    createHost(): void;
  };
}

export function useShow(): ShowView {
  const bridge = typeof window === "undefined" ? undefined : window.westbund;
  const [info, setInfo] = useState<ElectronInfo | null>(null);
  const [identity, setIdentity] = useState<{ id: string; label: string; hint: number } | null>(null);
  const [name, setName] = useState("");
  const nameRef = useRef(name);
  nameRef.current = name;
  const [address, setAddress] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<LinkStatus>("idle");
  const [offset, setOffset] = useState(0);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [local, setLocal] = useState<Local | null>(null);
  const [heard, setHeard] = useState(false);
  const [waited, setWaited] = useState(false);
  const client = useRef<HubClient | null>(null);

  useEffect(() => {
    if (!bridge) {
      const browser = browserIdentity();
      setIdentity(browser);
      setName(browser.name);
      setLocal(readLocal(browser.id, browser.hint));
      let alive = true;
      browserHub().then((found) => alive && setAddress(found));
      return () => {
        alive = false;
      };
    }
    let alive = true;
    const apply = (next: ElectronInfo | null) => {
      if (!alive || !next) return;
      setInfo(next);
      setIdentity((current) => current ?? { id: next.displayKey, label: next.label, hint: next.hint });
      setName(next.name);
      setLocal((current) => current ?? readLocal(next.displayKey, next.hint));
    };
    bridge.getInfo().then(apply);
    const off = bridge.onInfo(apply);
    return () => {
      alive = false;
      off();
    };
  }, [bridge]);

  const url = bridge ? (info?.hubUrl ?? null) : (address ?? null);
  const id = identity?.id;

  useEffect(() => {
    if (!identity || !url) {
      setStatus("idle");
      return;
    }
    setHeard(false);
    const hub = new HubClient({
      url,
      hello: { id: identity.id, name: nameRef.current, label: identity.label, hint: identity.hint },
      onStatus: setStatus,
      onOffset: setOffset,
      onShow: ({ state, roster: entries }) => {
        setHeard(true);
        setRoster(entries);
        const screen = state.assignments[identity.id];
        if (screen) {
          const next = { screen, scene: state.scene, layout: state.layout };
          setLocal(next);
          write(localStorage, localKey(identity.id), JSON.stringify(next));
        }
      },
    });
    client.current = hub;
    hub.start();
    return () => {
      hub.stop();
      if (client.current === hub) client.current = null;
      setRoster([]);
      setOffset(0);
    };
  }, [identity, url]);

  useEffect(() => {
    if (identity && name) client.current?.setHello({ id: identity.id, name, label: identity.label, hint: identity.hint });
  }, [identity, name]);

  useEffect(() => {
    setWaited(false);
    if (!url) return;
    const timer = window.setTimeout(() => setWaited(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [url]);

  const changeLocal = useCallback(
    (change: (current: Local) => Local) =>
      setLocal((current) => {
        if (!current) return current;
        const next = change(current);
        if (id) write(localStorage, localKey(id), JSON.stringify(next));
        return next;
      }),
    [id],
  );

  const step = useCallback(
    (delta: number) => {
      if (id && client.current?.command({ type: "step", id, delta })) return;
      changeLocal((current) => ({ ...current, screen: wrapScreen(current.screen + delta) }));
    },
    [id, changeLocal],
  );

  const toggleLayout = useCallback(() => {
    if (client.current?.command({ type: "toggle-layout" })) return;
    changeLocal((current) => ({ ...current, layout: current.layout === "screen" ? "overview" : "screen" }));
  }, [changeLocal]);

  const setScene = useCallback(
    (scene: number) => {
      if (client.current?.command({ type: "scene", scene })) return;
      changeLocal((current) => ({ ...current, scene }));
    },
    [changeLocal],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
      if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key.toLowerCase() === "m") toggleLayout();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, toggleLayout]);

  const actions = useMemo<ShowView["actions"]>(
    () => ({
      step,
      setScreen: (screen) => {
        if (id && client.current?.command({ type: "assign", id, screen })) return;
        changeLocal((current) => ({ ...current, screen: wrapScreen(screen) }));
      },
      setScene,
      toggleLayout,
      assign: (target, screen) => void client.current?.command({ type: "assign", id: target, screen }),
      join: (to) => {
        const clean = to.trim();
        if (!clean) return;
        if (bridge) void bridge.setRole({ role: "client", address: clean });
        else {
          write(localStorage, KEYS.hub, clean);
          setAddress(hubUrl(clean));
        }
      },
      rename: (to) => {
        const clean = to.trim().slice(0, 60);
        if (!clean) return;
        if (bridge) void bridge.setName(clean);
        else {
          if (id) write(localStorage, nameKey(id), clean);
          setName(clean);
        }
      },
      createHost: () => void bridge?.setRole({ role: "host" }),
    }),
    [bridge, id, step, changeLocal, setScene, toggleLayout],
  );

  const known = identity !== null && local !== null && (bridge ? info !== null : address !== undefined);
  return {
    ready: known && (!url || heard || waited),
    screen: local?.screen ?? 1,
    screens: SCREEN_COUNT,
    scene: local?.scene ?? 1,
    layout: local?.layout ?? "screen",
    status,
    offset,
    hubUrl: url,
    roster,
    self: { id: identity?.id ?? "", name, label: identity?.label ?? "" },
    electron: info,
    actions,
  };
}
