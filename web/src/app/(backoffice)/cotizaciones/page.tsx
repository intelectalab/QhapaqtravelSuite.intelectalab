import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { QuotesTable } from "@/features/quotes/QuotesTable";
import { QuoteWizardAction } from "@/features/quotes/wizard/QuoteWizard";
import { formatMoney } from "@/lib/format";
import { getQuoteFormOptions, listQuotes } from "@/lib/server/quotes";

export const metadata: Metadata = { title: "Cotizaciones" };

export default async function CotizacionesPage({ searchParams }: PageProps<"/cotizaciones">) {
  const [list, options, { nueva, oportunidad }] = await Promise.all([listQuotes(), getQuoteFormOptions(), searchParams]);
  if (!list) return <NoAccess home="/dashboard" />;
  const { kpis, can } = list.meta;

  return (
    <>
      <PageHeader
        title="Cotizaciones"
        subtitle={`${kpis.open} en curso por ${formatMoney(kpis.open_pen, "PEN", { compact: true })}${kpis.conversion !== null ? ` · ${kpis.conversion} % se aprueban` : ""}`}
        actions={options ? <QuoteWizardAction options={options} opportunityCode={typeof oportunidad === "string" ? oportunidad : undefined} defaultOpen={nueva === "1"} /> : undefined}
        info={<InfoTip>Una cotización vence al pasar su fecha de vigencia si nadie la aprobó. El porcentaje de aprobación compara las aprobadas con todas las ya cerradas.</InfoTip>}
      />
      <QuotesTable rows={list.data} canManage={can.manage} />
    </>
  );
}
