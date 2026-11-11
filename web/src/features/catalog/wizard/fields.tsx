"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ProductDraft, ProductFormOptions } from "@/lib/catalog";
import type { DraftPatch } from "./draft";

export interface StepProps {
  draft: ProductDraft;
  set: (patch: DraftPatch | ((draft: ProductDraft) => DraftPatch)) => void;
  options: ProductFormOptions;
  errors: Record<string, string>;
}

export function Group({ title, hint, action, children, className }: { title: string; hint?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-line-2 pb-1.5">
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-semibold text-fg">{title}</h3>
          {hint && <p className="mt-0.5 text-[12.5px] text-fg-3">{hint}</p>}
        </div>
        {action && <div className="flex flex-none items-center gap-2">{action}</div>}
      </header>
      {children}
    </section>
  );
}

export function ToggleChips({ label, options, selected, onChange, locked = [], testId }: { label: string; options: { value: string; label: string; hint?: string }[]; selected: string[]; onChange: (next: string[]) => void; locked?: string[]; testId?: string }) {
  return (
    <fieldset data-testid={testId}>
      <legend className="mb-1.5 text-[13px] font-semibold text-fg">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = selected.includes(option.value);
          const fixed = locked.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              title={option.hint}
              aria-pressed={on}
              disabled={fixed}
              onClick={() => onChange(on ? selected.filter((item) => item !== option.value) : [...selected, option.value])}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition hover:-translate-y-px disabled:cursor-not-allowed disabled:hover:translate-y-0", on ? "border-accent bg-accent/10 text-accent" : "border-line text-fg-2 hover:border-accent/40 hover:text-fg")}
            >
              {on && <Check size={13} />}
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ErrorList({ errors, prefix }: { errors: Record<string, string>; prefix: string[] }) {
  const messages = [...new Set(Object.entries(errors).filter(([field]) => prefix.some((key) => field === key || field.startsWith(`${key}.`))).map(([, message]) => message))];
  if (messages.length === 0) return null;
  return (
    <div role="alert" className="rounded-xl border border-bad/30 bg-bad/[0.07] px-3.5 py-3 text-[13px] text-bad">
      <ul className="flex flex-col gap-1">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

export function ManageLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-[12.5px] font-semibold text-accent hover:underline">
      {label}
    </a>
  );
}

export function numberValue(value: string): number {
  return value === "" ? 0 : Number(value);
}

export function rowError(errors: Record<string, string>, base: string, index: number, field: string): string | undefined {
  return errors[`${base}.${index}.${field}`];
}
