"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { Check } from "lucide-react";
import { Fragment, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { BUBBLE } from "./InfoTip";

interface StepIndicatorProps {
  steps: readonly string[];
  current: number;
  done: (index: number) => boolean;
  reachable: (index: number) => boolean;
  failed?: (index: number) => boolean;
  hints?: string[];
  onSelect: (index: number) => void;
}

export function StepIndicator({ steps, current, done, reachable, failed = () => false, hints, onSelect }: StepIndicatorProps) {
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = nav.current;
    const active = container?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!container || !active) return;
    container.scrollTo({ left: active.offsetLeft - container.clientWidth / 2 + active.clientWidth / 2, behavior: "smooth" });
  }, [current]);

  return (
    <Tooltip.Provider delayDuration={200}>
      <nav ref={nav} aria-label="Pasos" className="scroll-thin overflow-x-auto">
        <ol className="relative flex min-w-[720px] items-start px-1 py-1.5">
          {steps.map((step, index) => {
            const active = index === current;
            const complete = done(index) && !active;
            const bad = failed(index) && !active;
            const button = (
              <button
                type="button"
                data-testid={`wizard-step:${index + 1}`}
                aria-current={active ? "step" : undefined}
                aria-label={`Paso ${index + 1}: ${step}`}
                disabled={!reachable(index)}
                onClick={() => onSelect(index)}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full text-[12.5px] font-bold transition hover:scale-110 disabled:cursor-not-allowed disabled:hover:scale-100",
                  active && "bg-t2/15 text-fg ring-2 ring-t2",
                  complete && "bg-accent text-white shadow-[0_6px_14px_-8px_var(--accent)]",
                  bad && "bg-bad/15 text-bad ring-2 ring-bad/50",
                  !active && !complete && !bad && "bg-surface-2 text-fg-3 ring-1 ring-line",
                )}
              >
                {complete ? <Check size={15} strokeWidth={2.8} /> : index + 1}
              </button>
            );
            return (
              <Fragment key={step}>
                {index > 0 && <li aria-hidden className={cn("mt-[15px] h-0.5 flex-1 rounded-full transition-colors", done(index - 1) ? "bg-accent" : "bg-line")} />}
                <li className="flex w-[78px] flex-none flex-col items-center gap-1.5">
                  {hints?.[index] ? (
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content side="bottom" sideOffset={8} collisionPadding={12} className={cn(BUBBLE, "z-[60]")}>
                          <b className="block text-fg">{step}</b>
                          {hints[index]}
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  ) : (
                    button
                  )}
                  <span className={cn("text-center text-[12px] leading-tight", active ? "font-semibold text-fg" : "text-fg-3")}>{step}</span>
                </li>
              </Fragment>
            );
          })}
        </ol>
      </nav>
    </Tooltip.Provider>
  );
}
