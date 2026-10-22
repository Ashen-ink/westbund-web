"use client";

import { useEffect, useRef, useState } from "react";
import { CentralIcon, type CentralIconName } from "@/components/icons";
import { Kbd, Section, Segmented, StatusDot, Switch } from "@/components/ui/primitives";
import { HUB_PORT } from "@/runtime/protocol";
import type { ShowView } from "@/runtime/use-show";
import { SCENES } from "@/scenes";
import { SCENE_COUNT } from "@/runtime/protocol";

const hostOf = (url: string | null) => (url ? new URL(url.replace(/^ws/, "http")).host : "");

type Page = "modes" | "screen" | "host" | "screens" | "shortcuts";
const PAGES: { id: Page; label: string; icon: CentralIconName; description: string }[] = [
  { id: "host", label: "Show host", icon: "IconSignalTower", description: "The machine every screen follows. Create it here or join one on the network." },
  { id: "modes", label: "Modes", icon: "IconLayoutDashboard", description: "What the whole show runs. Switching changes every screen in the room." },
  { id: "screen", label: "This screen", icon: "IconStudioDisplay", description: "What this display shows, and the name other machines see." },
  { id: "screens", label: "Screens", icon: "IconDevices", description: "Every screen connected to the show, and which part of the wall it shows." },
  { id: "shortcuts", label: "Shortcuts", icon: "IconKeyboard", description: "Keys that work on any screen." },
];

export function SettingsDialog({ show, open, onClose }: { show: ShowView; open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState<Page>("host");

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const current = PAGES.find((entry) => entry.id === page)!;
  const link = linkStatus(show);

  return (
    <dialog ref={dialog} className="panel panel--settings" onClose={onClose} aria-label="Show settings">
      <nav className="sidebar" aria-label="Settings">
        {PAGES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="sidebar__item"
            aria-current={entry.id === page ? "page" : undefined}
            onClick={() => setPage(entry.id)}
          >
            <CentralIcon name={entry.icon} size={16} stroke="1.5" />
            {entry.label}
            {entry.id === "screens" && show.roster.length > 0 && <span className="sidebar__count">{show.roster.length}</span>}
          </button>
        ))}
        <div className="sidebar__status">
          <StatusDot tone={link.tone} />
          <span>{link.short}</span>
        </div>
      </nav>

      <div className="content">
        <header className="content__head">
          <div>
            <h2>{current.label}</h2>
            <p>{current.description}</p>
          </div>
          <button type="button" className="btn" data-icon aria-label="Close" onClick={onClose}>
            <CentralIcon name="IconCrossSmall" size={18} stroke="1.5" />
          </button>
        </header>
        <div className="content__body">
          {page === "modes" && <ModesPage show={show} />}
          {page === "screen" && <ScreenPage show={show} />}
          {page === "host" && <HostPage show={show} link={link} />}
          {page === "screens" && <ScreensPage show={show} />}
          {page === "shortcuts" && <ShortcutsPage />}
        </div>
      </div>
    </dialog>
  );
}

function linkStatus(show: ShowView) {
  const hosting = Boolean(show.electron?.hosting);
  if (show.status === "online")
    return {
      tone: "ok" as const,
      icon: "IconWifiFull" as const,
      short: hosting ? "Hosting" : "Connected",
      title: hosting ? "Hosting this show" : `Connected to ${hostOf(show.hubUrl)}`,
      sub: `Clock ${Math.round(show.offset)} ms from host · ${show.roster.length} screen${show.roster.length === 1 ? "" : "s"} online`,
    };
  if (show.status === "connecting" || (show.electron?.role === "client" && !show.hubUrl))
    return {
      tone: "wait" as const,
      icon: "IconLoader" as const,
      short: "Connecting",
      title: show.hubUrl ? `Connecting to ${hostOf(show.hubUrl)}` : "Looking for a host",
      sub: "Showing the last known screen until it answers",
    };
  return {
    tone: "off" as const,
    icon: "IconWifiNoSignal" as const,
    short: "Standalone",
    title: "Standalone",
    sub: "Not connected to a host; this screen runs on its own",
  };
}

function ModesPage({ show }: { show: ShowView }) {
  return (
    <Section label={show.status === "online" ? "Every screen follows" : "This screen only, until it reaches the host"}>
      {Array.from({ length: SCENE_COUNT }, (_, index) => {
        const number = index + 1;
        const scene = SCENES[number];
        const active = number === show.scene;
        return (
          <button
            key={number}
            type="button"
            className="row"
            data-active={active || undefined}
            data-empty={!scene || undefined}
            disabled={!scene}
            onClick={() => show.actions.setScene(number)}
          >
            <Kbd>{number}</Kbd>
            <div className="row__main">
              <div className="row__title">{scene?.name ?? "Empty"}</div>
              {scene && <div className="row__sub">{scene.description}</div>}
            </div>
            {active && <CentralIcon name="IconCheckmark1Small" size={18} stroke="1.5" />}
          </button>
        );
      })}
    </Section>
  );
}

const screenOptions = (count: number) => Array.from({ length: count }, (_, index) => ({ value: index + 1, label: String(index + 1) }));

function ScreenPage({ show }: { show: ShowView }) {
  return (
    <>
      <Section label="Device name">
        <NameField show={show} />
        <p className="note">Every screen and host on this network sees this name.</p>
      </Section>
      <Section label="Display">
      <div className="row">
        <CentralIcon className="row__icon" name="IconStudioDisplay" size={18} stroke="1.5" />
        <div className="row__main">
          <div className="row__title">Shows screen</div>
          <div className="row__sub">{show.self.label}</div>
        </div>
        <Segmented label="Screen" value={show.screen} options={screenOptions(show.screens)} onChange={show.actions.setScreen} />
      </div>
      <div className="row">
        <CentralIcon className="row__icon" name="IconLayoutGrid1" size={18} stroke="1.5" />
        <div className="row__main">
          <div className="row__title">Overview</div>
          <div className="row__sub">The whole wall on every screen</div>
        </div>
        <Switch label="Overview" checked={show.layout === "overview"} onChange={show.actions.toggleLayout} />
      </div>
      </Section>
    </>
  );
}

function NameField({ show }: { show: ShowView }) {
  const [value, setValue] = useState(show.self.name);
  useEffect(() => setValue(show.self.name), [show.self.name]);
  const changed = value.trim() !== "" && value.trim() !== show.self.name;
  return (
    <form
      className="inline"
      onSubmit={(event) => {
        event.preventDefault();
        if (changed) show.actions.rename(value);
      }}
    >
      <input className="field" value={value} maxLength={60} onChange={(event) => setValue(event.target.value)} aria-label="Device name" />
      <button type="submit" className="btn" data-primary disabled={!changed}>
        Save
      </button>
    </form>
  );
}

function HostPage({ show, link }: { show: ShowView; link: ReturnType<typeof linkStatus> }) {
  const { electron, actions } = show;
  const [address, setAddress] = useState("");
  const hosting = electron?.hosting;
  return (
    <>
      <Section label={electron ? "Host or join" : "Join"}>
        {electron && (
          <button type="button" className="row" data-active={electron.role === "host" || undefined} onClick={actions.createHost}>
            <CentralIcon className="row__icon" name="IconSignalTower" size={18} stroke="1.5" />
            <div className="row__main">
              <div className="row__title">Create host on this machine</div>
              <div className="row__sub">Other screens join this one</div>
            </div>
            {electron.role === "host" && <CentralIcon name="IconCheckmark1Small" size={18} stroke="1.5" />}
          </button>
        )}
        {electron?.discovered.map((host) => {
          const active = electron.role === "client" && Boolean(show.hubUrl?.includes(host.address));
          return (
            <button key={host.name} type="button" className="row" data-active={active || undefined} onClick={() => actions.join(host.address)}>
              <CentralIcon className="row__icon" name="IconChainLink1" size={18} stroke="1.5" />
              <div className="row__main">
                <div className="row__title">Join {host.name}</div>
                <div className="row__sub">{host.address} · found on this network</div>
              </div>
              {active && <CentralIcon name="IconCheckmark1Small" size={18} stroke="1.5" />}
            </button>
          );
        })}
        <form
          className="inline"
          onSubmit={(event) => {
            event.preventDefault();
            actions.join(address);
          }}
        >
          <input
            className="field"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder={`Host address, e.g. 192.168.1.20 (port ${HUB_PORT})`}
            aria-label="Host address"
          />
          <button type="submit" className="btn" data-primary disabled={!address.trim()}>
            Join
          </button>
        </form>
        {!electron && (
          <p className="note">
            A browser can join a host but not be one. To host from a terminal, run <code>bun run host</code>.
          </p>
        )}
      </Section>
      <Section label="Status">
        <div className="card">
          <StatusDot tone={link.tone} />
          <div className="row__main">
            <div className="row__title">{link.title}</div>
            <div className="row__sub">{link.sub}</div>
          </div>
          <CentralIcon className="row__icon" name={link.icon} size={18} stroke="1.5" />
        </div>
        {hosting && (
          <p className="note">
            {hosting.serving && hosting.addresses.length
              ? `Open ${hosting.addresses.map((entry) => `http://${entry}:${hosting.port}`).join(" or ")} in any browser to add a screen.`
              : `Other machines join at ${hosting.addresses[0] ?? "this machine's address"}:${hosting.port}.`}
          </p>
        )}
        {electron?.hubError && (
          <p className="note" data-tone="error">
            {electron.hubError}
          </p>
        )}
      </Section>
    </>
  );
}

function ScreensPage({ show }: { show: ShowView }) {
  if (show.roster.length === 0)
    return (
      <div className="empty">
        <CentralIcon name="IconDevices" size={24} stroke="1.5" />
        <p>No screens connected. Create or join a host to see every screen on the show here.</p>
      </div>
    );
  return (
    <Section label={`${show.roster.length} connected`}>
      {show.roster.map((entry) => (
        <div key={entry.id} className="row" data-self={entry.id === show.self.id || undefined}>
          <CentralIcon className="row__icon" name="IconStudioDisplay" size={18} stroke="1.5" />
          <div className="row__main">
            <div className="row__title">{entry.name}</div>
            <div className="row__sub">{entry.id === show.self.id ? `This screen · ${entry.label}` : entry.label}</div>
          </div>
          <Segmented
            label={`Screen for ${entry.name}`}
            value={entry.screen ?? 0}
            options={screenOptions(show.screens)}
            onChange={(screen) => show.actions.assign(entry.id, screen)}
          />
        </div>
      ))}
    </Section>
  );
}

function ShortcutsPage() {
  const keys: [string[], string][] = [
    [["P"], "Open or close settings"],
    [["←", "→"], "Show the previous or next screen"],
    [["1", "…", "9"], "Switch every screen to that mode"],
    [["M"], "Toggle overview on every screen"],
    [["Esc"], "Close settings"],
    [["⌘", "⇧", "Q"], "Quit the app"],
  ];
  return (
    <Section label="Keyboard">
      {keys.map(([combo, action]) => (
        <div key={action} className="row">
          <div className="row__main">
            <div className="row__title">{action}</div>
          </div>
          <span className="keys">
            {combo.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </span>
        </div>
      ))}
    </Section>
  );
}
