"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { normalize } from "@/lib/format";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  variant?: "field" | "chip";
  clearable?: boolean;
  searchable?: boolean;
  onAdd?: () => void;
  addLabel?: string;
  ariaLabel?: string;
  className?: string;
  testId?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Elegir",
  variant = "field",
  clearable = variant === "chip",
  searchable = options.length > 8,
  onAdd,
  addLabel = "Crear nuevo",
  ariaLabel,
  className,
  testId,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const visible = useMemo(
    () => (query ? options.filter((option) => normalize(option.label).includes(normalize(query))) : options),
    [options, query],
  );

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <Popover.Trigger
        aria-label={ariaLabel}
        data-testid={testId}
        data-value={value}
        className={cn(
          "inline-flex items-center gap-1.5 text-left transition",
          variant === "chip"
            ? cn("h-7 font-semibold", selected ? "text-accent" : "text-fg")
            : "h-10 w-full justify-between rounded-control border border-line bg-surface px-3 hover:border-fg-3/40",
          className,
        )}
      >
        <span className={cn("truncate", !selected && variant === "field" && "text-fg-3")}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={14} className="flex-none text-fg-3" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[220px] overflow-hidden rounded-[14px] border border-line bg-surface p-1.5 shadow-[0_18px_40px_-16px_rgb(14_17_32/0.35)]"
        >
          {searchable && (
            <label className="mb-1 flex h-9 items-center gap-2 rounded-[10px] bg-surface-2 px-2.5 text-fg-3">
              <Search size={14} />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" className="w-full bg-transparent text-[13px] text-fg outline-none" />
            </label>
          )}
          <div className="scroll-thin max-h-64 overflow-y-auto">
            {clearable && (
              <OptionRow value="" label={placeholder} selected={!value} muted onSelect={() => choose("")} />
            )}
            {visible.map((option) => (
              <OptionRow key={option.value} value={option.value} label={option.label} hint={option.hint} disabled={option.disabled} selected={option.value === value} onSelect={() => choose(option.value)} />
            ))}
            {visible.length === 0 && <p className="px-3 py-2.5 text-[13px] text-fg-3">Sin coincidencias</p>}
          </div>
          {onAdd && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAdd();
              }}
              className="mt-1 flex h-9 w-full items-center gap-2 rounded-[10px] border-t border-line px-2.5 text-[13px] font-semibold text-accent hover:bg-surface-2"
            >
              <Plus size={14} strokeWidth={2.4} />
              {addLabel}
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function OptionRow({ value, label, hint, selected, muted, disabled = false, onSelect }: { value: string; label: string; hint?: string; selected: boolean; muted?: boolean; disabled?: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled && !selected}
      data-testid={`option:${value}`}
      className={cn("flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13.5px] hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent", selected && "font-semibold text-accent", muted && !selected && "text-fg-3")}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint && <span className="block truncate text-[12px] font-normal text-fg-3">{hint}</span>}
      </span>
      {selected && <Check size={15} strokeWidth={2.4} className="flex-none" />}
    </button>
  );
}
