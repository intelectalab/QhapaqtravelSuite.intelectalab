"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { opsStep, type OpsState } from "@/app/(backoffice)/operaciones/actions";
import { PanelAction } from "@/components/ui/PanelAction";
import { cn } from "@/lib/cn";

const initial: OpsState = { message: null, done: false };

interface OpsStepProps {
  step: string;
  target?: string;
  label: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  title: string;
  description?: ReactNode;
  submitLabel: string;
  trigger?: (open: () => void) => ReactNode;
  defaultOpen?: boolean;
  formKey?: string;
  children?: ReactNode;
}

export function OpsStep({ step, target = "", label, icon, variant = "secondary", size, title, description, submitLabel, trigger, defaultOpen, formKey, children }: OpsStepProps) {
  const router = useRouter();
  return (
    <PanelAction<OpsState>
      label={label}
      icon={icon}
      variant={variant}
      size={size}
      formId={`ops-${step}-${formKey ?? target ?? "new"}`.replace(/[^\w-]/g, "-")}
      title={title}
      description={description}
      submitLabel={submitLabel}
      action={opsStep}
      initial={initial}
      trigger={trigger}
      defaultOpen={defaultOpen}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="step" value={step} />
          <input type="hidden" name="target" value={target} />
          {children}
        </>
      )}
    </PanelAction>
  );
}

interface ToggleChipsProps {
  label: string;
  name: string;
  options: { value: string; label: string; hint?: string }[];
  defaultValue?: string[];
  hint?: string;
  max?: number;
}

export function ToggleChips({ label, name, options, defaultValue = [], hint, max }: ToggleChipsProps) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const toggle = (value: string) =>
    setSelected((current) => (current.includes(value) ? current.filter((item) => item !== value) : max && current.length >= max ? current : [...current, value]));

  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold text-fg">{label}</legend>
      {hint && <p className="-mt-1 mb-2 text-[12.5px] text-fg-3">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role="checkbox"
              aria-checked={active}
              title={option.hint}
              onClick={() => toggle(option.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition duration-200 hover:-translate-y-0.5",
                active ? "border-accent bg-accent text-white shadow-[0_6px_14px_-8px_var(--accent)]" : "border-line bg-surface text-fg-2 hover:border-fg-3/40 hover:text-fg",
              )}
            >
              {active && <Check size={13} strokeWidth={3} />}
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

export function ConfirmNote({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "bad" }) {
  return (
    <p
      className={cn(
        "rounded-xl px-3.5 py-3 text-[12.5px] leading-relaxed",
        tone === "neutral" && "bg-surface-2 text-fg-2",
        tone === "warn" && "bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] text-fg",
        tone === "bad" && "bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] text-fg",
      )}
    >
      {children}
    </p>
  );
}
