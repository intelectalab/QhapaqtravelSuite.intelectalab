import type { ReactNode } from "react";
import { OpenRowsBody } from "@/components/table/OpenRowsBody";
import { cn } from "@/lib/cn";

export function MiniTable({ head, children, align = [], minWidth = 560 }: { head: string[]; children: ReactNode; align?: ("left" | "right")[]; minWidth?: number }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full text-[13px]" style={{ minWidth }}>
        <thead>
          <tr className="text-left text-[12px] text-fg-3">
            {head.map((label, index) => (
              <th key={`${label}-${index}`} className={cn("px-1 pb-2 font-semibold", align[index] === "right" && "text-right")}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <OpenRowsBody className="[&>tr]:border-t [&>tr]:border-line-2 [&_td]:px-1 [&_td]:py-2.5 [&_td]:align-top [&_td.font-mono]:whitespace-nowrap">
          {children}
        </OpenRowsBody>
      </table>
    </div>
  );
}

export function ProgressBar({ value, tone = "ok" }: { value: number; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
      <span className={cn("block h-full rounded-full transition-[width] duration-700", tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : "bg-bad")} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
