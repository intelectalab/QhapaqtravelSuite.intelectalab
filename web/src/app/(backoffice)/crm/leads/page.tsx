import { ConsultModeNotice } from "@/components/ui/ConsultMode";
import { ChartPie, Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { LeadsTable } from "@/features/leads/LeadsTable";
import { LeadCreateAction } from "@/features/leads/LeadCreateAction";
import { LeadJourney } from "@/features/leads/LeadJourney";
import { ReportChartView } from "@/features/reports/ReportCharts";
import type { LeadRow } from "@/lib/leads";
import { getAdvisors, getCatalogs, listLeads } from "@/lib/server/leads";
import { statusLabel } from "@/lib/tone";

export const metadata: Metadata = { title: "Leads" };

const tally = (leads: LeadRow[], key: (lead: LeadRow) => string) =>
  [...leads.reduce((counts, lead) => counts.set(key(lead), (counts.get(key(lead)) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

export default async function LeadsPage({ searchParams }: PageProps<"/crm/leads">) {
  const [leads, catalogs, advisors, { nuevo }] = await Promise.all([listLeads(), getCatalogs(), getAdvisors(), searchParams]);
  const valid = leads.filter((lead) => lead.status !== "duplicado");
  const converted = leads.filter((lead) => lead.status === "convertido").length;
  const rate = valid.length ? Math.round((converted / valid.length) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} leads · ${rate} % se convirtieron en clientes`}
        actions={catalogs ? <LeadCreateAction catalogs={catalogs} advisors={advisors} defaultOpen={nuevo === "1"} /> : undefined}
        info={<InfoTip>Cada lead se revisa contra los leads y clientes que ya existen, se asigna, se contacta y se califica antes de convertirlo en cliente y oportunidad. Los duplicados no cuentan para la conversión.</InfoTip>}
      />
      <ConsultModeNotice permissions={["crm.leads.manage"]} what="registrar ni gestionar leads" />
      <LeadJourney leads={leads} />
      <section className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card className="lift">
          <TintCardTitle icon={Megaphone} title="Leads por fuente" aside={<InfoTip label="De dónde sale">Todos los leads que ves en la lista, agrupados por la fuente con la que se registraron.</InfoTip>} />
          <ReportChartView tone="t1" chart={{ key: "source", title: "Leads por fuente", type: "hbar", format: "number", series: tally(leads, (lead) => lead.source) }} />
        </Card>
        <Card className="lift">
          <TintCardTitle icon={ChartPie} title="Leads por estado" aside={<InfoTip label="De dónde sale">Los mismos leads, según el estado en que están hoy. Pasa el cursor por la dona para ver el detalle.</InfoTip>} />
          <ReportChartView tone="t4" chart={{ key: "status", title: "Leads por estado", type: "donut", format: "number", series: tally(leads, (lead) => statusLabel(lead.status)) }} />
        </Card>
      </section>
      <LeadsTable leads={leads} catalogs={catalogs} />
    </>
  );
}
