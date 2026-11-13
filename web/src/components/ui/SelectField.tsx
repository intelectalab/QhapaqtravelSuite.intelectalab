"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { Select, type SelectOption } from "./Select";

interface SelectFieldProps {
  label: string;
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  value?: string;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  clearable?: boolean;
  searchable?: boolean;
  className?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

export function SelectField({ label, name, options, defaultValue = "", value, placeholder, hint, error, clearable, searchable, className, onChange, disabled }: SelectFieldProps) {
  const id = useId();
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;

  return (
    <div className={className}>
      <span id={id} className="mb-1.5 block text-[13px] font-semibold text-fg">
        {label}
      </span>
      <Select
        value={current}
        onChange={(next) => {
          setInner(next);
          onChange?.(next);
        }}
        options={options}
        placeholder={placeholder}
        clearable={clearable}
        searchable={searchable}
        ariaLabel={label}
        className={cn("h-12 w-full", error && "border-bad")}
        testId={`field:${name}`}
        disabled={disabled}
      />
      <input type="hidden" name={name} value={current} />
      {error ? <div className="mt-1.5 text-[12.5px] font-medium text-bad">{error}</div> : hint && <div className="mt-1.5 text-[12.5px] text-fg-3">{hint}</div>}
    </div>
  );
}
