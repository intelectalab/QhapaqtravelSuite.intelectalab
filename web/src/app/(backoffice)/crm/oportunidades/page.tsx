import { ConsultModeNotice } from "@/components/ui/ConsultMode";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { OpportunitiesTable } from "@/features/opportunities/OpportunitiesTable";
import { OpportunityCreateAction } from "@/features/opportunities/OpportunityForms";
import { TIME_ZONE } from "@/lib/format";
import { getBoard, getOpportunityFormOptions } from "@/lib/server/opportunities";

export const metadata: Metadata = { title: "Oportunidades" };

export default async function OportunidadesPage({ searchParams }: PageProps<"/crm/oportunidades">) {
  const [board, options, { nueva }] = await Promise.all([getBoard(), getOpportunityFormOptions(), searchParams]);
  if (!board) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

  return (
    <>
      <PageHeader
        title="Oportunidades"
        actions={options ? <OpportunityCreateAction options={options} defaultOpen={nueva === "1"} /> : undefined}
        info={<InfoTip>El monto ponderado multiplica cada oportunidad por la probabilidad de su etapa. Los montos en dólares se pasan a soles con el tipo de cambio del día.</InfoTip>}
      />
      <ConsultModeNotice permissions={["crm.opportunities.manage"]} what="crear ni mover oportunidades" />
      <OpportunitiesTable board={board} today={today} />
    </>
  );
}
