import { Percent, Scale, Target, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { OpportunityCreateAction } from "@/features/opportunities/OpportunityForms";
import { PipelineBoard } from "@/features/opportunities/PipelineBoard";
import { formatMoney, TIME_ZONE } from "@/lib/format";
import { getBoard, getOpportunityFormOptions } from "@/lib/server/opportunities";

export const metadata: Metadata = { title: "Oportunidades" };

export default async function OportunidadesPage() {
  const [board, options] = await Promise.all([getBoard(), getOpportunityFormOptions()]);
  if (!board) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
  const { kpis } = board;

  return (
    <>
      <PageHeader
        title="Oportunidades"
        actions={options ? <OpportunityCreateAction options={options} /> : undefined}
        info={<InfoTip>El monto ponderado multiplica cada oportunidad por la probabilidad de su etapa. Los montos en dólares se pasan a soles con el tipo de cambio del día.</InfoTip>}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Target} tone="t1" label="En el embudo" value={formatMoney(kpis.open_pen, "PEN", { compact: true })} />
        <TintTile icon={Scale} tone="violet" label="Ponderado" value={formatMoney(kpis.weighted_pen, "PEN", { compact: true })} />
        <TintTile icon={Trophy} tone="ok" label="Ganado este mes" value={formatMoney(kpis.won_month_pen, "PEN", { compact: true })} />
        <TintTile icon={Percent} tone="sun" label="Tasa de cierre" value={kpis.close_rate === null ? "—" : `${kpis.close_rate} %`} note="Ganadas sobre cerradas" />
      </section>
      <PipelineBoard board={board} today={today} />
    </>
  );
}
