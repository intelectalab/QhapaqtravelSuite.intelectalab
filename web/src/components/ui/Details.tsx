import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SectionTitle({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
          {linkLabel}
          <ArrowRight size={14} strokeWidth={2.2} />
        </Link>
      )}
    </div>
  );
}

export function FieldList({ fields }: { fields: { label: string; value: ReactNode }[] }) {
  return (
    <dl>
      {fields.map((field) => (
        <div key={field.label} className="grid grid-cols-[118px_1fr] items-center gap-2 border-t border-line-2 py-2.5 text-[13.5px] first:border-t-0">
          <dt className="text-[12.5px] text-fg-3">{field.label}</dt>
          <dd className="min-w-0 truncate">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StatCard({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-tile border border-line bg-surface px-4 py-3.5 shadow-card">
      <p className="text-[12.5px] text-fg-3">{label}</p>
      <p className={cn("mt-1.5 text-[22px] font-bold tracking-tight", tone === "ok" && "text-ok", tone === "bad" && "text-bad")}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-fg-3">{note}</p>}
    </div>
  );
}
