import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function NightBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(900px_420px_at_80%_-10%,color-mix(in_srgb,var(--t1)_55%,transparent),transparent_70%),radial-gradient(700px_380px_at_0%_110%,color-mix(in_srgb,var(--brand)_35%,transparent),transparent_70%)]" />
      <div className="weave-tint absolute inset-0 bg-white opacity-[0.045] [mask-size:36px_36px]" />
      <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[46%] w-full">
        <path d="M0 230 L120 150 L210 200 L330 90 L450 190 L560 130 L700 210 L820 110 L940 180 L1060 70 L1190 170 L1300 120 L1440 190 L1440 320 L0 320 Z" fill="white" opacity="0.05" />
        <path d="M0 270 L160 200 L300 250 L430 170 L590 250 L720 190 L880 260 L1010 180 L1150 250 L1290 200 L1440 250 L1440 320 L0 320 Z" fill="white" opacity="0.07" />
        <path d="M1060 70 L1082 92 L1070 92 L1060 82 L1048 96 L1036 92 Z" fill="white" opacity="0.5" />
        <circle cx="1220" cy="70" r="26" fill="var(--t2)" opacity="0.65" />
      </svg>
    </div>
  );
}

export function PageHero({ eyebrow, title, description, children, aside }: { eyebrow?: string; title: string; description?: ReactNode; children?: ReactNode; aside?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-menu text-white">
      <NightBackdrop />
      <div className="relative mx-auto grid max-w-[1240px] gap-8 px-5 pb-14 pt-12 sm:px-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div className="animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
          {eyebrow && (
            <span className="mb-3 inline-flex items-center gap-2 text-[12.5px] font-semibold text-t2">
              <span className="weave-line h-[3px] w-6 rounded-full" />
              {eyebrow}
            </span>
          )}
          <h1 className="text-[32px] font-bold leading-[1.1] tracking-tight sm:text-[42px]">{title}</h1>
          {description && <div className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-white/75">{description}</div>}
          {children}
        </div>
        {aside && <div className="animate-[rise-in_620ms_cubic-bezier(0.22,1,0.36,1)_backwards]">{aside}</div>}
      </div>
    </section>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="mb-4 flex flex-wrap items-center gap-1.5 text-[12.5px] text-white/60">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
          {index > 0 && <span aria-hidden>/</span>}
          {item.href ? (
            <Link href={item.href} className="transition hover:text-white">
              {item.label}
            </Link>
          ) : (
            <span className="text-white/85">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
