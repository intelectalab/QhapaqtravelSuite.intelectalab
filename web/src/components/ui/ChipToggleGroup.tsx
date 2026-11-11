"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

interface ChipToggleGroupProps {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string[];
  hint?: string;
}

export function ChipToggleGroup({ label, name, options, defaultValue = [], hint }: ChipToggleGroupProps) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const toggle = (value: string) => setSelected((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));

  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold text-fg">{label}</legend>
      {hint && <p className="-mt-1 mb-2 text-[12.5px] text-fg-3">{hint}</p>}
      <div className="flex flex-wrap gap-1.5" data-testid={`field:${name}`}>
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <button key={option.value} type="button" aria-pressed={on} onClick={() => toggle(option.value)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition", on ? "border-accent bg-accent/10 text-accent" : "border-line text-fg-2 hover:border-accent/40 hover:text-fg")}>
              {on && <Check size={13} />}
              {option.label}
            </button>
          );
        })}
      </div>
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
    </fieldset>
  );
}
