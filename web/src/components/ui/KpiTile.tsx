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

export function KpiTile({ label, value, note, tone, trend, trendLabels }: { label: string; value: ReactNode; note?: ReactNode; tone: TileTone; trend?: number[]; trendLabels?: string[] }) {
  return (
    <div className={cn("lift group relative min-h-[150px] overflow-hidden rounded-card px-5 pb-4 pt-[18px] hover:shadow-[0_18px_34px_-18px_rgb(0_0_0/0.45)]", TILE[tone])}>
      <div className="weave-pattern pointer-events-none absolute -right-1.5 -top-1.5 h-[120px] w-[120px] opacity-[0.14] transition-transform duration-500 ease-out group-hover:rotate-6 group-hover:scale-110 [mask-image:radial-gradient(circle_at_100%_0,#000_30%,transparent_72%)]" />
      <p className="relative text-[12.5px] font-medium opacity-85">{label}</p>
      <p className="relative mb-0.5 mt-2 text-[32px] font-bold leading-tight tracking-[-0.04em]">{value}</p>
      {note && <p className="relative text-[12.5px] opacity-85">{note}</p>}
      {trend && <Sparkline values={trend} labels={trendLabels} className="absolute inset-x-0 bottom-0 h-[46px] w-full" />}
    </div>
  );
}
