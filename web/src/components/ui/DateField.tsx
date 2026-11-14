"use client";

import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { addDays, addMonths, formatTyped, isDisabledDate, maskTyped, monthMatrix, parseIso, parseTyped, todayIso, weekdayIndex, type DateLimits } from "@/lib/date-field";
import { FieldError } from "./FieldError";
import { InfoTip } from "./InfoTip";

export type DateFieldLocale = "es" | "en";

export interface DateFieldProps {
  label: string;
  name: string;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
  min?: string | null;
  max?: string | null;
  disablePast?: boolean;
  isDateDisabled?: (iso: string) => boolean;
  locale?: DateFieldLocale;
  today?: string;
  placeholder?: string;
  hint?: ReactNode;
  tip?: ReactNode;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  variant?: "field" | "bare";
  hideLabel?: boolean;
  icon?: ReactNode;
  className?: string;
  inputClassName?: string;
  testId?: string;
  hiddenInput?: boolean;
}

const TEXT = {
  es: { weekdays: ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"], clear: "Limpiar", today: "Hoy", previous: "Mes anterior", next: "Mes siguiente", open: "Abrir calendario", placeholder: "dd/mm/aaaa", invalid: "Escribe la fecha como dd/mm/aaaa.", unavailable: "Esa fecha no está disponible.", intl: "es-PE" },
  en: { weekdays: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], clear: "Clear", today: "Today", previous: "Previous month", next: "Next month", open: "Open calendar", placeholder: "dd/mm/yyyy", invalid: "Type the date as dd/mm/yyyy.", unavailable: "That date is not available.", intl: "en-US" },
} as const;

const monthTitle = (iso: string, intl: string) => {
  const parts = parseIso(iso);
  if (!parts) return "";
  const text = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(parts.year, parts.month - 1, 1)));
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const fullDate = (iso: string, intl: string) => {
  const parts = parseIso(iso);
  return parts ? new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day))) : iso;
};

export function DateField({
  label,
  name,
  value,
  defaultValue = null,
  onChange,
  min,
  max,
  disablePast = false,
  isDateDisabled,
  locale = "es",
  today: todayProp,
  placeholder,
  hint,
  tip,
  error,
  required,
  disabled = false,
  clearable = true,
  variant = "field",
  hideLabel = false,
  icon,
  className,
  inputClassName,
  testId,
  hiddenInput = true,
}: DateFieldProps) {
  const text = TEXT[locale];
  const id = useId();
  const gridId = `${id}-grid`;
  const errorId = `${id}-error`;
  const today = todayProp ?? todayIso();
  const [inner, setInner] = useState<string | null>(parseIso(defaultValue) ? defaultValue : null);
  const current = value !== undefined ? (parseIso(value) ? value : null) : inner;
  const [draft, setDraft] = useState<string | null>(null);
  const [typedError, setTypedError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState<string>(current ?? today);
  const grid = useRef<HTMLDivElement>(null);
  const limits: DateLimits = useMemo(() => ({ min, max, disablePast, today, isDateDisabled }), [min, max, disablePast, today, isDateDisabled]);
  const view = parseIso(focused) ?? parseIso(today)!;
  const weeks = useMemo(() => monthMatrix(view.year, view.month), [view.year, view.month]);
  const shownError = error ?? typedError;

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, focused]);

  const commit = (next: string | null) => {
    setDraft(null);
    setTypedError(null);
    if (value === undefined) setInner(next);
    if (next !== current) onChange?.(next);
  };

  const openCalendar = (next: boolean) => {
    if (disabled) return;
    if (next) setFocused(current ?? (isDisabledDate(today, limits) && min && min > today ? min : today));
    setOpen(next);
  };

  const commitTyped = () => {
    if (draft === null) return;
    if (draft.trim() === "") {
      commit(null);
      return;
    }
    const parsed = parseTyped(draft);
    if (!parsed) {
      setTypedError(text.invalid);
      return;
    }
    if (isDisabledDate(parsed, limits)) {
      setTypedError(text.unavailable);
      return;
    }
    commit(parsed);
  };

  const pick = (iso: string) => {
    if (isDisabledDate(iso, limits)) return;
    commit(iso);
    setOpen(false);
  };

  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => addDays(focused, -weekdayIndex(focused)),
      End: () => addDays(focused, 6 - weekdayIndex(focused)),
      PageUp: () => addMonths(focused, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, event.shiftKey ? 12 : 1),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setFocused(move());
  };

  const box = variant === "field"
    ? cn("flex h-12 items-center gap-2 rounded-control border bg-surface pl-3.5 pr-1.5 transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)]", shownError ? "border-bad" : "border-line", disabled && "opacity-60")
    : cn("flex h-8 items-center gap-1", disabled && "opacity-60");

  return (
    <div className={className}>
      {!hideLabel && (
        <div className="mb-1.5 flex items-center gap-1">
          <label htmlFor={id} className="block truncate text-[13px] font-semibold text-fg">
            {label}
          </label>
          {tip && <InfoTip label={`Qué es ${label.toLowerCase()}`}>{tip}</InfoTip>}
        </div>
      )}
      <Popover.Root open={open} onOpenChange={openCalendar}>
        <Popover.Anchor asChild>
          <div className={box}>
            {icon && <span className="flex-none text-fg-3">{icon}</span>}
            <input
              id={id}
              type="text"
              data-testid={testId ?? `field:${name}`}
              role="combobox"
              inputMode="numeric"
              autoComplete="off"
              aria-label={hideLabel ? label : undefined}
              aria-invalid={shownError ? true : undefined}
              aria-describedby={shownError ? errorId : undefined}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={open ? gridId : undefined}
              required={required}
              disabled={disabled}
              placeholder={placeholder ?? text.placeholder}
              value={draft ?? formatTyped(current)}
              onChange={(event) => {
                setTypedError(null);
                setDraft(maskTyped(event.target.value));
              }}
              onBlur={commitTyped}
              onKeyDown={(event) => {
                if (event.key === "Enter" && draft !== null) {
                  event.preventDefault();
                  commitTyped();
                }
                if (event.key === "ArrowDown" && event.altKey) {
                  event.preventDefault();
                  openCalendar(true);
                }
              }}
              className={cn("h-full min-w-0 flex-1 bg-transparent text-[15px] tabular-nums text-fg outline-none placeholder:text-fg-3", variant === "bare" && "text-[14px]", inputClassName)}
            />
            <Popover.Trigger asChild>
              <button type="button" disabled={disabled} aria-label={text.open} className="grid h-9 w-9 flex-none place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed">
                <CalendarDays size={17} />
              </button>
            </Popover.Trigger>
          </div>
        </Popover.Anchor>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="z-50 w-[296px] rounded-[16px] border border-line bg-surface p-3 text-fg shadow-[0_24px_60px_-28px_rgb(14_17_32/0.55)] animate-[rise-in_220ms_cubic-bezier(0.22,1,0.36,1)]"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button type="button" aria-label={text.previous} onClick={() => setFocused(addMonths(focused, -1))} className="grid h-8 w-8 place-items-center rounded-lg text-fg-2 transition hover:bg-surface-2 hover:text-fg">
              <ChevronLeft size={17} />
            </button>
            <p className="text-[14px] font-semibold" aria-live="polite">
              {monthTitle(focused, text.intl)}
            </p>
            <button type="button" aria-label={text.next} onClick={() => setFocused(addMonths(focused, 1))} className="grid h-8 w-8 place-items-center rounded-lg text-fg-2 transition hover:bg-surface-2 hover:text-fg">
              <ChevronRight size={17} />
            </button>
          </div>
          <div id={gridId} ref={grid} role="grid" aria-label={monthTitle(focused, text.intl)} onKeyDown={onGridKey}>
            <div role="row" className="grid grid-cols-7 gap-1 pb-1">
              {text.weekdays.map((day) => (
                <span key={day} role="columnheader" className="grid h-7 place-items-center text-[11.5px] font-semibold text-fg-3">
                  {day}
                </span>
              ))}
            </div>
            {weeks.map((week) => (
              <div key={week[0].iso} role="row" className="grid grid-cols-7 gap-1">
                {week.map((day) => {
                  const off = isDisabledDate(day.iso, limits);
                  const selected = day.iso === current;
                  return (
                    <span key={day.iso} role="gridcell" aria-selected={selected}>
                      <button
                        type="button"
                        data-date={day.iso}
                        tabIndex={day.iso === focused ? 0 : -1}
                        aria-label={fullDate(day.iso, text.intl)}
                        aria-disabled={off || undefined}
                        aria-current={day.iso === today ? "date" : undefined}
                        onClick={() => pick(day.iso)}
                        className={cn(
                          "grid h-9 w-full place-items-center rounded-[10px] text-[13.5px] tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-accent",
                          !day.inMonth && "text-fg-3/70",
                          off ? "cursor-not-allowed text-fg-3/50 line-through decoration-fg-3/40" : "hover:bg-surface-2",
                          day.iso === today && !selected && "font-bold text-accent",
                          selected && "bg-brand font-semibold text-brand-fg hover:bg-brand",
                        )}
                      >
                        {Number(day.iso.slice(8, 10))}
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line-2 pt-2">
            <button type="button" disabled={isDisabledDate(today, limits)} onClick={() => pick(today)} className="h-8 rounded-lg px-2.5 text-[13px] font-semibold text-accent transition hover:bg-surface-2 disabled:opacity-40">
              {text.today}
            </button>
            {clearable && (
              <button
                type="button"
                onClick={() => {
                  commit(null);
                  setOpen(false);
                }}
                className="h-8 rounded-lg px-2.5 text-[13px] font-semibold text-fg-2 transition hover:bg-surface-2 hover:text-fg"
              >
                {text.clear}
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Root>
      {hiddenInput && <input type="hidden" name={name} value={current ?? ""} disabled={disabled} />}
      {shownError ? (
        <span id={errorId}>
          <FieldError name={name} message={shownError} />
        </span>
      ) : (
        hint && <div className="mt-1.5 text-[12.5px] text-fg-3">{hint}</div>
      )}
    </div>
  );
}
