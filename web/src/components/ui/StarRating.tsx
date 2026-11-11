"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

const WORDS = ["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"];

export function StarRating({ label, name, required = false, defaultValue = 0, size = 26, hint }: { label: string; name: string; required?: boolean; defaultValue?: number; size?: number; hint?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold text-fg">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} de 5`}
            onMouseEnter={() => setHover(star)}
            onClick={() => setValue(value === star && !required ? 0 : star)}
            className="rounded-md p-0.5 transition-transform duration-150 hover:scale-115 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Star size={size} strokeWidth={1.7} className={cn("transition-colors", star <= shown ? "fill-[var(--t2)] text-[var(--t2)]" : "text-line")} />
          </button>
        ))}
        <span className="ml-2 text-[13px] font-medium text-fg-2">{shown ? WORDS[shown] : hint ?? ""}</span>
      </div>
      <input type="hidden" name={name} value={value || ""} />
    </fieldset>
  );
}
