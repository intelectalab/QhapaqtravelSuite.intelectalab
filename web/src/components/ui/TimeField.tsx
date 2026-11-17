"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, Clock } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { maskTypedTime, nearestSlot, nowTime, parseTypedTime, timeSlots } from "@/lib/date-field";
import { FieldError } from "./FieldError";
import { InfoTip } from "./InfoTip";

export type TimeFieldLocale = "es" | "en";

const TEXT = {
  es: { open: "Elegir la hora", placeholder: "hh:mm", invalid: "Escribe la hora como hh:mm, de 00:00 a 23:59.", clear: "Sin hora" },
  en: { open: "Choose a time", placeholder: "hh:mm", invalid: "Type the time as hh:mm, from 00:00 to 23:59.", clear: "No time" },
} as const;

const normalize = (value: string | null | undefined) => (value ? parseTypedTime(value.slice(0, 5)) : null);

export interface TimePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  step?: number;
  clearable?: boolean;
  locale?: TimeFieldLocale;
  timeZone?: string;
  ariaLabel?: string;
  id?: string;
  error?: string | null;
  onInvalid?: (message: string | null) => void;
  required?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  testId?: string;
}

export function TimePicker({ value, onChange, step = 15, clearable = false, locale = "es", timeZone, ariaLabel, id, error, onInvalid, required, disabled = false, icon = <Clock size={16} />, className, testId }: TimePickerProps) {
  const text = TEXT[locale];
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const slots = useMemo(() => timeSlots(step, value), [step, value]);
  const [anchor, setAnchor] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !anchor) return;
    const frame = requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>(`[data-time="${anchor}"]`)?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(frame);
  }, [open, anchor]);

  const toggle = (next: boolean) => {
    if (disabled) return;
    if (next) setAnchor(value && slots.includes(value) ? value : nearestSlot(slots, value ?? nowTime(timeZone)));
    setOpen(next);
  };

  const commit = (next: string | null) => {
    setDraft(null);
    onInvalid?.(null);
    if (next !== value) onChange(next);
  };

  const commitTyped = () => {
    if (draft === null) return;
    if (draft.trim() === "") {
      if (clearable || !required) commit(null);
      else setDraft(null);
      return;
    }
    const parsed = parseTypedTime(draft);
    if (!parsed) {
      onInvalid?.(text.invalid);
      return;
    }
    commit(parsed);
  };

  return (
    <Popover.Root open={open} onOpenChange={toggle}>
      <Popover.Anchor asChild>
        <div
          className={cn(
            "flex h-12 items-center gap-2 rounded-control border bg-surface pl-3.5 pr-1.5 transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)]",
            error ? "border-bad" : "border-line",
            disabled && "opacity-60",
            className,
          )}
        >
          <input
            id={id}
            type="text"
            role="combobox"
            inputMode="numeric"
            autoComplete="off"
            data-testid={testId}
            aria-label={ariaLabel}
            aria-invalid={error ? true : undefined}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            required={required}
            disabled={disabled}
            placeholder={text.placeholder}
            value={draft ?? value ?? ""}
            onChange={(event) => {
              onInvalid?.(null);
              setDraft(maskTypedTime(event.target.value));
            }}
            onBlur={commitTyped}
            onKeyDown={(event) => {
              if (event.key === "Enter" && draft !== null) {
                event.preventDefault();
                commitTyped();
              }
              if (event.key === "ArrowDown" && event.altKey) {
                event.preventDefault();
                toggle(true);
              }
            }}
            className="h-full w-full min-w-0 flex-1 bg-transparent text-[15px] tabular-nums text-fg outline-none placeholder:text-fg-3"
          />
          <Popover.Trigger asChild>
            <button type="button" disabled={disabled} aria-label={text.open} className="grid h-9 w-9 flex-none place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed">
              {icon}
            </button>
          </Popover.Trigger>
        </div>
      </Popover.Anchor>
      <Popover.Content
        align="start"
        sideOffset={8}
        collisionPadding={12}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[168px] overflow-hidden rounded-[14px] border border-line bg-surface p-1.5 shadow-[0_18px_40px_-16px_rgb(14_17_32/0.35)] animate-[rise-in_220ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        <div id={listId} ref={list} role="listbox" aria-label={ariaLabel} className="scroll-thin max-h-60 overflow-y-auto">
          {clearable && (
            <button
              type="button"
              onClick={() => {
                commit(null);
                setOpen(false);
              }}
              className={cn("flex w-full items-center rounded-[10px] px-2.5 py-2 text-left text-[13.5px] text-fg-3 hover:bg-surface-2", !value && "font-semibold text-accent")}
            >
              {text.clear}
            </button>
          )}
          {slots.map((slot) => {
            const selected = slot === value;
            return (
              <button
                key={slot}
                type="button"
                role="option"
                aria-selected={selected}
                data-time={slot}
                data-anchor={slot === anchor || undefined}
                onClick={() => {
                  commit(slot);
                  setOpen(false);
                }}
                className={cn("flex w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13.5px] tabular-nums hover:bg-surface-2", selected && "font-semibold text-accent", slot === anchor && !selected && "bg-surface-2")}
              >
                {slot}
                {selected && <Check size={15} strokeWidth={2.4} className="flex-none" />}
              </button>
            );
          })}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}

export interface TimeFieldProps {
  label: string;
  name: string;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
  step?: number;
  locale?: TimeFieldLocale;
  hint?: ReactNode;
  tip?: ReactNode;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  testId?: string;
}

export function TimeField({ label, name, value, defaultValue = null, onChange, step = 15, locale = "es", hint, tip, error, required, disabled = false, icon, className, testId }: TimeFieldProps) {
  const id = useId();
  const [inner, setInner] = useState<string | null>(() => normalize(defaultValue));
  const [typedError, setTypedError] = useState<string | null>(null);
  const current = value !== undefined ? normalize(value) : inner;
  const shownError = error ?? typedError;

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center gap-1">
        <label htmlFor={id} className="block truncate text-[13px] font-semibold text-fg">
          {label}
        </label>
        {tip && <InfoTip label={`Qué es ${label.toLowerCase()}`}>{tip}</InfoTip>}
      </div>
      <TimePicker
        id={id}
        value={current}
        onChange={(next) => {
          if (value === undefined) setInner(next);
          onChange?.(next);
        }}
        step={step}
        clearable={!required}
        locale={locale}
        ariaLabel={label}
        error={shownError}
        onInvalid={setTypedError}
        required={required}
        disabled={disabled}
        icon={icon}
        testId={testId ?? `field:${name}`}
      />
      <input type="hidden" name={name} value={current ?? ""} disabled={disabled} />
      <FieldError name={name} message={shownError} />
      {hint && !shownError && <div className="mt-1.5 text-[12.5px] text-fg-3">{hint}</div>}
    </div>
  );
}
