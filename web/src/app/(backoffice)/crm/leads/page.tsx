import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { LeadsTable } from "@/features/leads/LeadsTable";
import { LeadCreateAction } from "@/features/leads/LeadCreateAction";
import { getCatalogs, listLeads } from "@/lib/server/leads";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage() {
  const [leads, catalogs] = await Promise.all([listLeads(), getCatalogs()]);
  const valid = leads.filter((lead) => lead.status !== "duplicado");
  const converted = leads.filter((lead) => lead.status === "convertido").length;
  const rate = valid.length ? Math.round((converted / valid.length) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} leads · ${rate} % se convirtieron en clientes`}
        actions={catalogs ? <LeadCreateAction catalogs={catalogs} /> : undefined}
        info={<InfoTip>Cada lead se revisa contra los leads y clientes que ya existen, se asigna, se contacta y se califica antes de convertirlo en cliente y oportunidad. Los duplicados no cuentan para la conversión.</InfoTip>}
      />
      <LeadsTable leads={leads} />
    </>
  );
}
