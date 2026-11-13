import { BellRing, CircleCheck, Siren, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { InsightList } from "@/features/growth-ops/Insights";
import type { CursorPage, InsightKpis, InsightRow, Option } from "@/lib/growth-ops";
import { cn } from "@/lib/cn";
import { growthRead } from "@/lib/server/growth-ops";

export const metadata: Metadata = { title: "Alertas de rentabilidad" };

const STATUS_FILTERS = [
  { key: "", label: "Abiertas" },
  { key: "resuelta", label: "Resueltas" },
  { key: "descartada", label: "Descartadas" },
];

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ tipo?: string; estado?: string }> }) {
  const { tipo, estado } = await searchParams;
  const query = new URLSearchParams({ "page[size]": "100" });
  if (tipo) query.set("filter[kind]", tipo);
  if (estado) query.set("filter[status]", estado);
  const { data, blocked } = await growthRead<CursorPage<InsightRow, InsightKpis>>(`/reports/insights?${query}`, "No pudimos cargar las alertas.", true);

  if (!data) return <p className="rounded-xl bg-surface-2 px-4 py-10 text-center text-[13px] text-fg-3">{blocked}</p>;

  const { kpis } = data.meta;
  const kinds = (data.meta.kinds ?? []) as Option[];
  const href = (next: { tipo?: string; estado?: string }) => {
    const params = new URLSearchParams();
    const merged = { tipo, estado, ...next };
    if (merged.tipo) params.set("tipo", merged.tipo);
    if (merged.estado) params.set("estado", merged.estado);
    return `/reportes/alertas${params.size ? `?${params}` : ""}`;
  };

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-2">
        <h2 className="text-[17px] font-semibold">Alertas de rentabilidad</h2>
        <InfoTip>Las alertas se calculan cada día con los datos reales de la agencia: cuotas vencidas y cotizaciones con margen bajo el piso. Cada rol ve solo lo que ya puede ver; los márgenes solo llegan a quien ve rentabilidad.</InfoTip>
      </div>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={BellRing} tone="info" label="Abiertas" value={kpis.open} info={<p>Alertas nuevas o vistas que aún no se resuelven ni descartan.</p>} />
        <TintTile icon={Siren} tone="bad" label="Severidad alta" value={kpis.high} info={<p>Alertas abiertas con severidad alta: cobranza con más de 15 días o montos altos, y márgenes bajo el 5 %.</p>} />
        <TintTile icon={Sparkles} tone="violet" label="Nuevas" value={kpis.new} info={<p>Alertas generadas que nadie ha revisado todavía.</p>} />
        <TintTile icon={CircleCheck} tone="ok" label="Resueltas" value={kpis.resolved} info={<p>Alertas que el equipo marcó como resueltas.</p>} />
      </section>
      <nav aria-label="Filtros" className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((item) => (
          <Link key={item.key} href={href({ estado: item.key || undefined })} scroll={false} className={cn("rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition", (estado ?? "") === item.key ? "border-accent bg-accent/10 text-accent" : "border-line text-fg-2 hover:text-fg")}>
            {item.label}
          </Link>
        ))}
        <span className="mx-1 w-px self-stretch bg-line" />
        <Link href={href({ tipo: undefined })} scroll={false} className={cn("rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition", !tipo ? "border-accent bg-accent/10 text-accent" : "border-line text-fg-2 hover:text-fg")}>Todos los tipos</Link>
        {kinds.map((kind) => (
          <Link key={kind.key} href={href({ tipo: kind.key })} scroll={false} className={cn("rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition", tipo === kind.key ? "border-accent bg-accent/10 text-accent" : "border-line text-fg-2 hover:text-fg")}>
            {kind.label} <span className="font-mono text-[11px] text-fg-3">{kpis.by_kind[kind.key] ?? 0}</span>
          </Link>
        ))}
      </nav>
      <InsightList rows={data.data} />
    </div>
  );
}
