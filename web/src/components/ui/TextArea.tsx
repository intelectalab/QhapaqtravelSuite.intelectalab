"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FieldError } from "./FieldError";

interface TextAreaProps extends Omit<ComponentProps<"textarea">, "id"> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
}

export function TextArea({ label, hint, error, className, rows = 4, ...textarea }: TextAreaProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-fg">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        data-testid={textarea.name ? `field:${textarea.name}` : undefined}
        aria-invalid={error ? true : undefined}
        {...textarea}
        className={cn(
          "w-full resize-none rounded-control border bg-surface px-3.5 py-3 text-[14.5px] text-fg outline-none transition placeholder:text-fg-3 focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)]",
          error ? "border-bad" : "border-line",
        )}
      />
      <FieldError name={textarea.name} message={error} />
      {hint && !error && <div className="mt-1.5 text-[12.5px] text-fg-3">{hint}</div>}
    </div>
  );
}
