import { ConsultModeNotice } from "@/components/ui/ConsultMode";
import { Percent, Scale, Target, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { OpportunitiesTable } from "@/features/opportunities/OpportunitiesTable";
import { OpportunityCreateAction } from "@/features/opportunities/OpportunityForms";
import { formatMoney, TIME_ZONE } from "@/lib/format";
import { getBoard, getOpportunityFormOptions } from "@/lib/server/opportunities";

export const metadata: Metadata = { title: "Oportunidades" };

export default async function OportunidadesPage({ searchParams }: PageProps<"/crm/oportunidades">) {
  const [board, options, { nueva }] = await Promise.all([getBoard(), getOpportunityFormOptions(), searchParams]);
  if (!board) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
  const { kpis } = board;

  return (
    <>
      <PageHeader
        title="Oportunidades"
        actions={options ? <OpportunityCreateAction options={options} defaultOpen={nueva === "1"} /> : undefined}
        info={<InfoTip>El monto ponderado multiplica cada oportunidad por la probabilidad de su etapa. Los montos en dólares se pasan a soles con el tipo de cambio del día.</InfoTip>}
      />
      <ConsultModeNotice permissions={["crm.opportunities.manage"]} what="crear ni mover oportunidades" />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Target} tone="t1" label="En el embudo" value={formatMoney(kpis.open_pen, "PEN", { compact: true })} info={<p>Suma del monto de las oportunidades abiertas (de calificación a negociación), en soles.</p>} />
        <TintTile icon={Scale} tone="violet" label="Ponderado" value={formatMoney(kpis.weighted_pen, "PEN", { compact: true })} info={<p>Cada oportunidad abierta multiplicada por su probabilidad. Es lo que se espera cerrar.</p>} />
        <TintTile icon={Trophy} tone="ok" label="Ganado este mes" value={formatMoney(kpis.won_month_pen, "PEN", { compact: true })} info={<p>Monto de las oportunidades marcadas como ganadas con fecha de cierre en el mes en curso.</p>} />
        <TintTile icon={Percent} tone="sun" label="Tasa de cierre" value={kpis.close_rate === null ? "—" : `${kpis.close_rate} %`} note="Ganadas sobre cerradas" info={<p>Oportunidades ganadas entre todas las cerradas (ganadas y perdidas).</p>} />
      </section>
      <OpportunitiesTable board={board} today={today} />
    </>
  );
}
