"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: ReactNode;
  icon?: ReactNode;
  revealable?: boolean;
}

export function TextField({ label, hint, icon, revealable = false, type = "text", className, ...input }: TextFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const inputType = revealable ? (revealed ? "text" : "password") : type;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-fg">
        {label}
      </label>
      <div className="flex h-12 items-center gap-2.5 rounded-control border border-line bg-surface px-3.5 transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)]">
        {icon && <span className="flex-none text-fg-3">{icon}</span>}
        <input id={id} type={inputType} {...input} className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-3" />
        {revealable && (
          <button type="button" onClick={() => setRevealed(!revealed)} aria-label={revealed ? "Ocultar contraseña" : "Mostrar contraseña"} className={cn("grid h-8 w-8 flex-none place-items-center rounded-lg text-fg-3 hover:bg-surface-2 hover:text-fg")}>
            {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
      {hint && <div className="mt-1.5 text-[12.5px] text-fg-3">{hint}</div>}
    </div>
  );
}
