import { ArrowDownLeft, ArrowUpRight, FileQuestion, Gauge, History } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { BankLinesTable } from "@/features/finance/Reconciliation";
import type { ReconciliationOverview } from "@/lib/finance";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Conciliación bancaria" };

export default async function ConciliacionPage() {
  const data = await getResource<ReconciliationOverview>("/finance/reconciliation", "No pudimos cargar la conciliación.");

  if (!data) {
    return <PageHeader title="Conciliación bancaria" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis } = data;
  const open = kpis.exceptions + kpis.pending;

  return (
    <>
      <PageHeader
        title="Conciliación bancaria"
        subtitle="Líneas del extracto bancario y el cobro u obligación con que se cruzan."
        info={<InfoTip>Cada abono se cruza con un pago y cada cargo con una obligación a proveedor, con tolerancia de S/ 0.50. Lo que no coincide queda como excepción y se resuelve con sustento.</InfoTip>}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Gauge} tone={kpis.progress === 100 ? "ok" : "t1"} label="Avance" value={`${kpis.progress} %`} note={kpis.reconciled === 1 ? "1 línea conciliada" : `${kpis.reconciled} líneas conciliadas`} />
        <TintTile icon={FileQuestion} tone={open > 0 ? "warn" : "mute"} label="Por resolver" value={open + kpis.suggested} note={`${kpis.suggested} sugeridas · ${open} excepciones`} />
        <TintTile icon={ArrowDownLeft} tone="ok" label="Abonos" value={formatMoney(kpis.credits_pen, "PEN", { compact: true })} />
        <TintTile icon={ArrowUpRight} tone="bad" label="Cargos" value={formatMoney(kpis.debits_pen, "PEN", { compact: true })} />
      </section>
      <BankLinesTable data={data} />
      {data.closures.length > 0 && (
        <Card className="mt-5">
          <TintCardTitle icon={History} title="Cierres de conciliación" />
          <ul className="grid gap-2">
            {data.closures.map((closure) => (
              <li key={closure.code} className="lift flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
                <span>
                  <b className="font-semibold">{closure.code}</b>
                  <span className="block text-xs text-fg-3">
                    Periodo {closure.period} · {closure.lines_count} líneas · {formatDateTime(closure.closed_at)}
                  </span>
                </span>
                <span className="font-mono font-semibold">{formatMoney(closure.net)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
