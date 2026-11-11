"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Select } from "./Select";

export interface SideFilterOption {
  value: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface SideFilterListProps {
  label: string;
  options: SideFilterOption[];
  value: string;
  onChange: (value: string) => void;
  testId?: string;
}

export function SideFilterList({ label, options, value, onChange, testId }: SideFilterListProps) {
  return (
    <>
      <div className="lg:hidden">
        <Select value={value} onChange={onChange} options={options.map((option) => ({ value: option.value, label: option.count === undefined ? option.label : `${option.label} (${option.count})` }))} ariaLabel={label} className="h-11 w-full" testId={testId ? `${testId}-select` : undefined} />
      </div>
      <nav aria-label={label} data-testid={testId} className="sticky top-20 hidden rounded-card border border-line bg-surface p-2 shadow-card lg:block">
        <p className="px-2.5 pb-2 pt-1 text-[12px] font-semibold text-fg-3">{label}</p>
        <ul className="flex flex-col gap-0.5">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value || "all"}>
                <button
                  type="button"
                  onClick={() => onChange(option.value)}
                  aria-current={active ? "true" : undefined}
                  className={cn("group flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold transition", active ? "bg-accent text-white shadow-[0_6px_14px_-8px_var(--accent)]" : "text-fg-2 hover:translate-x-0.5 hover:bg-surface-2 hover:text-fg")}
                >
                  {option.icon && <span className={cn("flex-none transition", active ? "text-white" : "text-fg-3 group-hover:text-accent")}>{option.icon}</span>}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.count !== undefined && <span className={cn("flex-none rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-white/20" : "bg-surface-2 text-fg-3 group-hover:bg-surface")}>{option.count}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
