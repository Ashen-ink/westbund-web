"use client";

import type { ReactNode } from "react";
import "./ui.css";

export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="kbd">{children}</kbd>;

export const StatusDot = ({ tone }: { tone: "ok" | "wait" | "off" }) => <span className="dot" data-tone={tone} />;

export function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="section">
      <h3 className="section__label">{label}</h3>
      {children}
    </section>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange(value: T): void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={String(option.value)} type="button" role="radio" aria-checked={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange(): void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={onChange} />;
}
