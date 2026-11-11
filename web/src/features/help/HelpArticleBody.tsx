"use client";

import { ChevronDown, ListChecks, MessageCircleQuestion } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { HelpFaq, HelpStep } from "@/lib/help";

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-fg">
      <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-accent/10 text-accent">{icon}</span>
      {children}
    </h3>
  );
}

export function HelpSteps({ steps, compact = false }: { steps: HelpStep[]; compact?: boolean }) {
  if (steps.length === 0) return null;
  return (
    <section>
      <SectionLabel icon={<ListChecks size={15} />}>Cómo se usa</SectionLabel>
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <li key={`${index}-${step.title}`} className="group flex gap-3 rounded-[14px] border border-line-2 bg-surface px-3.5 py-3 transition hover:-translate-y-px hover:border-accent/35 hover:shadow-card motion-safe:animate-[rise-in_360ms_ease-out_backwards]" style={{ animationDelay: `${index * 50}ms` }}>
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-brand/10 text-[12.5px] font-bold text-brand transition-transform duration-300 group-hover:scale-110">{index + 1}</span>
            <span className="min-w-0">
              <b className="block text-[13.5px] font-semibold leading-snug">{step.title}</b>
              <span className={cn("mt-0.5 block text-fg-2", compact ? "text-[12.5px]" : "text-[13.5px] leading-relaxed")}>{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HelpFaqs({ faqs, compact = false }: { faqs: HelpFaq[]; compact?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  if (faqs.length === 0) return null;
  return (
    <section>
      <SectionLabel icon={<MessageCircleQuestion size={15} />}>Dudas frecuentes</SectionLabel>
      <ul className="overflow-hidden rounded-[14px] border border-line-2">
        {faqs.map((faq, index) => {
          const expanded = open === index;
          return (
            <li key={`${index}-${faq.question}`} className="border-b border-line-2 last:border-0">
              <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : index)} className={cn("flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-surface-2", expanded && "bg-surface-2")}>
                <span className={cn("min-w-0 flex-1 font-semibold leading-snug", compact ? "text-[13px]" : "text-[13.5px]")}>{faq.question}</span>
                <ChevronDown size={16} className={cn("flex-none text-fg-3 transition-transform duration-300", expanded && "rotate-180 text-accent")} />
              </button>
              <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                <div className="overflow-hidden">
                  <p className={cn("px-3.5 pb-3.5 text-fg-2", compact ? "text-[12.5px]" : "text-[13.5px] leading-relaxed")}>{faq.answer}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function HelpArticleBody({ summary, steps, faqs, compact = false }: { summary: string; steps: HelpStep[]; faqs: HelpFaq[]; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <p className={cn("text-fg-2", compact ? "text-[13.5px] leading-relaxed" : "text-[15px] leading-relaxed")}>{summary}</p>
      <HelpSteps steps={steps} compact={compact} />
      <HelpFaqs faqs={faqs} compact={compact} />
    </div>
  );
}
