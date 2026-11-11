"use client";

import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const BUBBLE = "z-50 max-w-[300px] rounded-[12px] border border-line bg-surface px-3.5 py-3 text-[13px] leading-relaxed text-fg-2 shadow-[0_18px_40px_-16px_rgb(14_17_32/0.35)]";

export function InfoTip({ children, label = "Más información", className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        className={cn("inline-grid h-5 w-5 place-items-center rounded-full text-fg-3 transition hover:bg-surface-2 hover:text-accent", className)}
      >
        <Info size={14} strokeWidth={2.2} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} collisionPadding={12} onEscapeKeyDown={(event) => event.stopPropagation()} className={BUBBLE}>
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export interface CountItem {
  label: string;
  included: boolean;
}

export function CountTip({ items, unit, className }: { items: CountItem[]; unit: string; className?: string }) {
  const included = items.filter((item) => item.included).length;
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span tabIndex={0} className={cn("cursor-default font-mono text-[13px] font-medium underline decoration-dotted decoration-fg-3/50 underline-offset-4", className)}>
            {included} de {items.length} {unit}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={6} collisionPadding={12} className={BUBBLE}>
            <ul className="grid gap-1.5">
              {items.map((item) => (
                <li key={item.label} className={cn(item.included ? "text-fg" : "text-fg-3 line-through")}>
                  {item.label}
                </li>
              ))}
            </ul>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
