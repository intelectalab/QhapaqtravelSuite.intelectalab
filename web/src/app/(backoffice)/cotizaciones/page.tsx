import { ConsultModeNotice } from "@/components/ui/ConsultMode";
import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
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
        subtitle={`${kpis.open} en curso · ${formatMoney(kpis.followup_pen, "PEN", { compact: true })} en seguimiento con el cliente${kpis.conversion !== null ? ` · ${kpis.conversion} % se aprueban` : ""}`}
        actions={options ? <QuoteWizardAction options={options} opportunityCode={typeof oportunidad === "string" ? oportunidad : undefined} defaultOpen={nueva === "1"} /> : undefined}
        info={<InfoTip>Una cotización vence al pasar su fecha de vigencia si nadie la aprobó. El monto en seguimiento suma en soles las enviadas, vistas y en negociación, sin borradores. El porcentaje de aprobación compara las aprobadas con todas las ya cerradas.</InfoTip>}
      />
      <ConsultModeNotice permissions={["quotes.create"]} what="crear ni editar cotizaciones" />
      {kpis.pending_internal ? (
        <p className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-4 py-3 text-[13.5px]" data-testid="quotes-pending-internal">
          <ShieldAlert size={17} className="text-warn" />
          <b className="font-semibold">{kpis.pending_internal === 1 ? "1 cotización espera" : `${kpis.pending_internal} cotizaciones esperan`} tu aprobación.</b>
          {list.data
            .filter((row) => row.internal_status === "pend")
            .slice(0, 4)
            .map((row) => (
              <Link key={row.code} href={`/cotizaciones/${row.code}`} className="font-semibold text-accent hover:underline">
                {row.code}
              </Link>
            ))}
        </p>
      ) : null}
      <QuotesTable rows={list.data} canManage={can.manage} />
    </>
  );
}
