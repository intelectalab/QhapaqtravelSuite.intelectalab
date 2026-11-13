import type { Metadata } from "next";
import Link from "next/link";
import { PeriodSwitch, TrendAndLive, VisitBreakdown, VisitTiles } from "@/features/tracking/WebVisits";
import { cn } from "@/lib/cn";
import { platformGet } from "@/lib/server/platform";
import type { PlatformWebOverview } from "@/lib/tracking";

export const metadata: Metadata = { title: "Marketing de la vitrina" };

export default async function MarketingVitrinaPage({ searchParams }: { searchParams: Promise<{ days?: string; site?: string }> }) {
  const params = await searchParams;
  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 30;
  const site = params.site === "blog" ? "blog" : "vitrina";
  const overview = await platformGet<PlatformWebOverview>(`/analytics/web/overview?days=${days}&site=${site}`);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex overflow-hidden rounded-control border border-line">
          {(["vitrina", "blog"] as const).map((option) => (
            <Link key={option} href={`/plataforma/marketing-vitrina?days=${days}&site=${option}`} className={cn("px-3 py-1.5 text-[13px] font-semibold transition", option === site ? "bg-accent text-white" : "text-fg-2 hover:bg-surface-2")}>
              {option === "vitrina" ? "Vitrina" : "Blog"}
            </Link>
          ))}
        </span>
        <PeriodSwitch base="/plataforma/marketing-vitrina" days={days} extra={`&site=${site}`} />
      </div>
      <VisitTiles overview={overview} conversionLabel={site === "blog" ? "Clics a tours" : "Reservas y registros"} showRevenue={false} />
      <TrendAndLive overview={overview} />
      <VisitBreakdown pages={overview.pages} sources={overview.sources} devices={overview.devices} />
    </div>
  );
}
