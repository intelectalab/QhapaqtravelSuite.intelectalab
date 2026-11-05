"use client";

import { useId, useState } from "react";
import { Select, type SelectOption } from "./Select";

interface SelectFieldProps {
  label: string;
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  className?: string;
  onChange?: (value: string) => void;
}

export function SelectField({ label, name, options, defaultValue = "", placeholder, hint, className, onChange }: SelectFieldProps) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);

  return (
    <div className={className}>
      <span id={id} className="mb-1.5 block text-[13px] font-semibold text-fg">
        {label}
      </span>
      <Select
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
        options={options}
        placeholder={placeholder}
        ariaLabel={label}
        className="h-12 w-full"
      />
      <input type="hidden" name={name} value={value} />
      {hint && <div className="mt-1.5 text-[12.5px] text-fg-3">{hint}</div>}
    </div>
  );
}
