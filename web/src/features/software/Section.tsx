import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Reveal } from "./Reveal";

export function Section({ id, children, className, tinted = false }: { id?: string; children: ReactNode; className?: string; tinted?: boolean }) {
  return (
    <section id={id} className={cn("relative scroll-mt-24 py-16 sm:py-24", tinted && "border-y border-line bg-surface", className)}>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">{children}</div>
    </section>
  );
}

interface SectionHeadProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  aside?: ReactNode;
}

export function SectionHead({ eyebrow, title, description, align = "left", aside }: SectionHeadProps) {
  return (
    <Reveal className={cn("mb-10 flex flex-wrap items-end justify-between gap-6 sm:mb-14", align === "center" && "justify-center text-center")}>
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        <Eyebrow className={align === "center" ? "mx-auto" : undefined}>{eyebrow}</Eyebrow>
        <h2 className="site-display mt-4 text-[30px] font-bold leading-[1.08] tracking-[-0.035em] text-fg sm:text-[42px]">{title}</h2>
        {description && <p className="mt-4 text-[15.5px] leading-relaxed text-fg-2 sm:text-[17px]">{description}</p>}
      </div>
      {aside}
    </Reveal>
  );
}

export function Eyebrow({ children, className, inverted = false }: { children: ReactNode; className?: string; inverted?: boolean }) {
  return (
    <span className={cn("flex w-fit items-center gap-2.5 text-[12.5px] font-semibold tracking-[0.08em]", inverted ? "text-white/70" : "text-fg-2", className)}>
      <span aria-hidden className="weave-line h-1.5 w-8 rounded-full" />
      {children}
    </span>
  );
}

export function PageHero({ eyebrow, title, description, children }: { eyebrow: string; title: ReactNode; description: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      <span aria-hidden className="ambient-glow absolute inset-0 -z-10" />
      <span aria-hidden className="weave-fade absolute inset-y-0 right-0 -z-10 w-1/2">
        <span className="weave-tint absolute inset-0 opacity-[0.07] [mask-size:36px_36px]" />
      </span>
      <div className="mx-auto max-w-[1200px] px-5 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
        <div className="max-w-3xl animate-[rise-in_620ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="site-display mt-5 text-[36px] font-bold leading-[1.04] tracking-[-0.045em] text-fg sm:text-[56px]">{title}</h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-fg-2 sm:text-[18px]">{description}</p>
        </div>
        {children && <div className="mt-9 animate-[rise-in_620ms_cubic-bezier(0.22,1,0.36,1)_backwards] [animation-delay:140ms]">{children}</div>}
      </div>
    </section>
  );
}

export function ArrowLink({ href, children, inverted = false }: { href: string; children: ReactNode; inverted?: boolean }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-1.5 text-[14px] font-semibold", inverted ? "text-white" : "text-accent")}>
      {children}
      <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}
