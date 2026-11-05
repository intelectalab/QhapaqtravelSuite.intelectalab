import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Sparkline } from "./Charts";

type TileTone = "t1" | "t2" | "t3" | "t4";

const TILE: Record<TileTone, string> = {
  t1: "bg-t1 text-white",
  t2: "bg-t2 text-t2-fg",
  t3: "bg-t3 text-white",
  t4: "bg-t4 text-white",
};

export function KpiTile({ label, value, note, tone, trend }: { label: string; value: ReactNode; note?: ReactNode; tone: TileTone; trend?: number[] }) {
  return (
    <div className={cn("relative min-h-[150px] overflow-hidden rounded-card px-5 pb-4 pt-[18px]", TILE[tone])}>
      <div className="weave-pattern pointer-events-none absolute -right-1.5 -top-1.5 h-[120px] w-[120px] opacity-[0.14] [mask-image:radial-gradient(circle_at_100%_0,#000_30%,transparent_72%)]" />
      <p className="relative text-[12.5px] font-medium opacity-85">{label}</p>
      <p className="relative mb-0.5 mt-2 text-[32px] font-bold leading-tight tracking-[-0.04em]">{value}</p>
      {note && <p className="relative text-[12.5px] opacity-85">{note}</p>}
      {trend && <Sparkline values={trend} className="absolute inset-x-0 bottom-0 h-[46px] w-full" />}
    </div>
  );
}
