"use client";

import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  hint?: ReactNode;
}

export function TextArea({ label, hint, className, rows = 4, ...textarea }: TextAreaProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-fg">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        {...textarea}
        className="w-full resize-none rounded-control border border-line bg-surface px-3.5 py-3 text-[14.5px] text-fg outline-none transition placeholder:text-fg-3 focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)]"
      />
      {hint && <div className="mt-1.5 text-[12.5px] text-fg-3">{hint}</div>}
    </div>
  );
}
