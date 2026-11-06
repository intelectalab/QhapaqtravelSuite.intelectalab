import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { QuotesTable } from "@/features/quotes/QuotesTable";
import { formatMoney } from "@/lib/format";
import { listQuotes } from "@/lib/server/quotes";

export const metadata: Metadata = { title: "Cotizaciones" };

export default async function CotizacionesPage() {
  const list = await listQuotes();
  if (!list) return <NoAccess home="/dashboard" />;
  const { kpis } = list;

  return (
    <>
      <PageHeader
        title="Cotizaciones"
        subtitle={`${kpis.open} en curso por ${formatMoney(kpis.open_pen, "PEN", { compact: true })}${kpis.conversion !== null ? ` · ${kpis.conversion} % se aprueban` : ""}`}
        actions={
          <Link href="/cotizaciones/nueva" className="inline-flex h-10 items-center gap-2 rounded-control bg-brand px-4 text-[13.5px] font-semibold text-white shadow-[0_8px_18px_-10px_var(--brand)] transition-transform duration-300 hover:-translate-y-0.5">
            <Plus size={16} strokeWidth={2.4} />
            Nueva cotización
          </Link>
        }
        info={<InfoTip>Una cotización vence al pasar su fecha de vigencia si nadie la aprobó. El porcentaje de aprobación compara las aprobadas con todas las ya cerradas.</InfoTip>}
      />
      <QuotesTable rows={list.items} canManage={list.can.manage} />
    </>
  );
}
