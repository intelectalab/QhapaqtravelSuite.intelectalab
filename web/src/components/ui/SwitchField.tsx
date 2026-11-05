"use client";

import * as Switch from "@radix-ui/react-switch";
import { useId } from "react";
import { cn } from "@/lib/cn";

interface SwitchFieldProps {
  label: string;
  name: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}

export function SwitchField({ label, name, checked, onCheckedChange, disabled = false, hint }: SwitchFieldProps) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", disabled && "opacity-60")}>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="relative mt-0.5 h-6 w-11 flex-none rounded-full bg-[color-mix(in_srgb,var(--fg-3)_35%,transparent)] transition data-[state=checked]:bg-ok disabled:cursor-not-allowed"
      >
        <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
      </Switch.Root>
      <label htmlFor={id} className="text-[13.5px]">
        <span className="font-medium text-fg">{label}</span>
        {hint && <span className="block text-[12.5px] text-fg-3">{hint}</span>}
      </label>
      {checked && !disabled && <input type="hidden" name={name} value="on" />}
    </div>
  );
}
