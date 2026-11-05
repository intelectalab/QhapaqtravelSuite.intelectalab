"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface ChoiceGroupProps {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
  onChange?: (value: string) => void;
}

export function ChoiceGroup({ label, name, options, defaultValue, hint, onChange }: ChoiceGroupProps) {
  const [value, setValue] = useState(defaultValue ?? options[0]?.value ?? "");

  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold text-fg">{label}</legend>
      {hint && <p className="-mt-1 mb-2 text-[12.5px] text-fg-3">{hint}</p>}
      <div role="radiogroup" aria-label={label} className="grid gap-1.5 rounded-control bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => {
              setValue(option.value);
              onChange?.(option.value);
            }}
            className={cn(
              "rounded-[10px] px-2 py-2 text-[12.5px] font-semibold transition",
              value === option.value ? "bg-[var(--tint,var(--accent))] text-white shadow-[0_6px_14px_-8px_var(--tint,var(--accent))]" : "text-fg-2 hover:bg-surface hover:text-fg",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <input type="hidden" name={name} value={value} />
    </fieldset>
  );
}
