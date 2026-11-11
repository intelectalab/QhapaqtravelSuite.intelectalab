import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const RISE = "animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards]";

export function AndesBand({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div className={cn("py-14 sm:py-20", index % 2 === 1 && "bg-[var(--andes-ice)]")}>
      <div className="mx-auto max-w-[1280px] px-5 sm:px-12">{children}</div>
    </div>
  );
}

export function CommitmentGrid({ items }: { items: { icon: LucideIcon; title: string; text: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ icon: Icon, title, text }, index) => (
        <article key={title} className={cn("lift relative rounded-card border border-line bg-surface p-6 shadow-[0_2px_8px_rgb(15_39_71/0.04)]", RISE)} style={{ animationDelay: `${index * 70}ms` }}>
          <span className="absolute right-5 top-4 text-[30px] font-semibold leading-none text-[color-mix(in_srgb,var(--site-accent)_22%,transparent)]" style={{ fontFamily: "var(--andes-serif)" }}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="grid h-11 w-11 place-items-center rounded-[12px] border border-line bg-[var(--andes-ice)] text-[var(--site-accent)]">
            <Icon size={20} />
          </span>
          <h3 className="mt-4 text-[19px] leading-snug text-fg">{title}</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">{text}</p>
        </article>
      ))}
    </div>
  );
}
