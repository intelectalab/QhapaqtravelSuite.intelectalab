"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export interface FaqItem {
  question: string;
  answer: string;
}

export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ul className="grid gap-3">
      {items.map((item, index) => {
        const expanded = open === index;
        return (
          <li key={item.question} style={{ animationDelay: `${index * 60}ms` }} className={cn("rounded-[18px] border bg-surface transition-[border-color,box-shadow] duration-300 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]", expanded ? "border-[color-mix(in_srgb,var(--accent)_35%,transparent)] shadow-[0_18px_40px_-30px_var(--accent)]" : "border-line hover:border-[color-mix(in_srgb,var(--fg-3)_40%,transparent)]")}>
            <button type="button" onClick={() => setOpen(expanded ? null : index)} aria-expanded={expanded} className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6">
              <span className="text-[15px] font-semibold text-fg sm:text-[16px]">{item.question}</span>
              <span className={cn("grid h-8 w-8 flex-none place-items-center rounded-full transition-all duration-300", expanded ? "rotate-45 bg-accent text-white" : "bg-surface-2 text-fg-2 group-hover:rotate-90")}>
                <Plus size={16} />
              </span>
            </button>
            <div className={cn("grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-fg-2 sm:px-6">{item.answer}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
