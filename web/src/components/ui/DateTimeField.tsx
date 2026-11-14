"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { splitDateTime, timeSlots } from "@/lib/date-field";
import { DateField, type DateFieldLocale } from "./DateField";
import { Select } from "./Select";

export interface DateTimeFieldProps {
  label: string;
  name: string;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  min?: string | null;
  max?: string | null;
  disablePast?: boolean;
  locale?: DateFieldLocale;
  timeLabel?: string;
  defaultTime?: string;
  step?: number;
  hint?: ReactNode;
  tip?: ReactNode;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  testId?: string;
}

const join = (date: string | null, time: string) => (date ? `${date}T${time}` : "");

export function DateTimeField({
  label,
  name,
  value,
  defaultValue = null,
  onChange,
  min,
  max,
  disablePast,
  locale = "es",
  timeLabel = locale === "en" ? "Time" : "Hora",
  defaultTime = "09:00",
  step = 15,
  hint,
  tip,
  error,
  required,
  disabled = false,
  icon,
  className,
  testId,
}: DateTimeFieldProps) {
  const timeId = useId();
  const [inner, setInner] = useState(() => splitDateTime(value !== undefined ? value : defaultValue));
  const outer = value !== undefined ? splitDateTime(value) : null;
  const date = outer ? outer.date : inner.date;
  const time = (outer ? outer.time : null) ?? inner.time ?? defaultTime;
  const combined = join(date, time);
  const options = useMemo(() => timeSlots(step, time).map((slot) => ({ value: slot, label: slot })), [step, time]);

  const update = (nextDate: string | null, nextTime: string) => {
    setInner({ date: nextDate, time: nextTime });
    const next = join(nextDate, nextTime);
    if (next !== combined) onChange?.(next);
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-start gap-3">
        <DateField
          label={label}
          name={name}
          hiddenInput={false}
          value={date}
          onChange={(next) => update(next, time)}
          min={min?.slice(0, 10)}
          max={max?.slice(0, 10)}
          disablePast={disablePast}
          locale={locale}
          required={required}
          disabled={disabled}
          icon={icon}
          tip={tip}
          error={error}
          testId={testId ?? `field:${name}`}
        />
        <div>
          <span id={timeId} className="mb-1.5 block truncate text-[13px] font-semibold text-fg">
            {timeLabel}
          </span>
          <Select value={time} onChange={(next) => next && update(date, next)} options={options} ariaLabel={`${timeLabel} · ${label}`} className={cn("h-12 w-full", error && "border-bad")} disabled={disabled} testId={`field:${name}.time`} />
        </div>
      </div>
      <input type="hidden" name={name} value={combined} disabled={disabled} />
      {hint && !error && <div className="mt-1.5 text-[12.5px] text-fg-3">{hint}</div>}
    </div>
  );
}
