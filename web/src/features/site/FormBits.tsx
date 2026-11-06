"use client";

import { AlertCircle, Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Option } from "@/lib/site";

export function CheckBox({ name, label, defaultChecked = false, error, onChange }: { name: string; label: ReactNode; defaultChecked?: boolean; error?: string; onChange?: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => {
          setChecked(!checked);
          onChange?.(!checked);
        }}
        className="group flex w-full items-start gap-3 rounded-xl text-left"
      >
        <span className={cn("mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-md border transition", checked ? "border-accent bg-accent text-white" : error ? "border-bad" : "border-fg-3/50 group-hover:border-accent")}>
          {checked && <Check size={13} strokeWidth={3} className="animate-[pop-in_200ms_ease-out]" />}
        </span>
        <span className="text-[13px] leading-relaxed text-fg-2">{label}</span>
      </button>
      {checked && <input type="hidden" name={name} value="on" />}
      <FieldError message={error} />
    </div>
  );
}

export function ChipGroup({ name, label, options, defaultValue = [], error }: { name: string; label: string; options: Option[]; defaultValue?: string[]; error?: string }) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  return (
    <fieldset>
      <legend className="mb-1.5 block text-[13px] font-semibold text-fg">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(active ? selected.filter((value) => value !== option.value) : [...selected, option.value])}
              className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition hover:-translate-y-0.5", active ? "border-accent bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-accent" : "border-line text-fg-2 hover:border-fg-3/40")}
            >
              {active && <Check size={13} strokeWidth={2.6} />}
              {option.label}
            </button>
          );
        })}
      </div>
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      <FieldError message={error} />
    </fieldset>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-bad">
      <AlertCircle size={13} />
      {message}
    </p>
  );
}

export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--bad)_30%,transparent)] bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3.5 py-3 text-[13px] text-bad">
      <AlertCircle size={16} className="mt-0.5 flex-none" />
      {message}
    </div>
  );
}

export function Consent({ error, agency }: { error?: string; agency: string }) {
  return (
    <CheckBox
      name="consent"
      error={error}
      label={
        <>
          Autorizo a <b className="font-semibold text-fg">{agency}</b> a tratar mis datos personales para atender esta solicitud, conforme a la Ley 29733 de Protección de Datos Personales.
        </>
      }
    />
  );
}
