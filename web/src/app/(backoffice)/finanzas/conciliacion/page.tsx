import { ArrowDownLeft, ArrowUpRight, FileSpreadsheet, Gauge, History, Lock, Route, Scale } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoTip } from "@/components/ui/InfoTip";
import { MiniTable } from "@/components/ui/MiniTable";
import { Journey, TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { BankLinesTable, CloseReconciliationAction, ImportStatementAction, MatchingAction } from "@/features/finance/Reconciliation";
import type { ReconciliationOverview } from "@/lib/finance";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Conciliación bancaria" };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
const periodLabel = (period: string) => {
  const [year, month] = period.split("-");
  const name = MONTHS[Number(month) - 1];
  return name ? `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}` : period;
};

export default async function ConciliacionPage() {
  const data = await getResource<ReconciliationOverview>("/finance/bank-lines", "No pudimos cargar la conciliación.");

  if (!data) {
    return <PageHeader title="Conciliación bancaria" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis, can } = data;
  const open = data.rows.filter((row) => !row.closure);
  const net = kpis.credits_pen - kpis.debits_pen;
  const steps = [
    { label: "Importar", at: data.last_import?.imported_at ?? null, done: open.length > 0 },
    { label: "Matching", at: null, done: open.length > 0 && kpis.pending === 0 },
    { label: "Resolver", at: null, done: open.length > 0 && kpis.pending + kpis.suggested + kpis.exceptions === 0 },
    { label: "Cerrar", at: null, done: false },
  ];

  return (
    <>
      <PageHeader
        title="Conciliación bancaria"
        subtitle="Líneas del extracto bancario y el cobro u obligación con que se cruzan."
        info={<InfoTip>Cada abono se cruza con un pago y cada cargo con una obligación a proveedor, con tolerancia de S/ 0.50. Lo que no coincide queda como excepción y se resuelve con sustento.</InfoTip>}
        actions={
          can.operate ? (
            <>
              <ImportStatementAction data={data} />
              {kpis.pending > 0 && <MatchingAction pending={kpis.pending} />}
              {open.length > 0 && kpis.pending + kpis.suggested + kpis.exceptions === 0 && <CloseReconciliationAction data={data} />}
            </>
          ) : undefined
        }
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Gauge} tone={kpis.progress === 100 ? "ok" : "t1"} label="Avance" value={`${kpis.progress} %`} note={open.length === 1 ? "1 línea abierta" : `${open.length} líneas abiertas`} />
        <TintTile icon={ArrowDownLeft} tone="ok" label="Abonos" value={formatMoney(kpis.credits_pen, "PEN", { compact: true })} />
        <TintTile icon={ArrowUpRight} tone="bad" label="Cargos" value={formatMoney(kpis.debits_pen, "PEN", { compact: true })} />
        <TintTile icon={Scale} tone={net >= 0 ? "t3" : "warn"} label="Neto del extracto" value={formatMoney(net, "PEN", { compact: true })} />
      </section>
      <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ToneScope tone="t1">
          <Card className="h-full">
            <TintCardTitle icon={Route} title="Proceso de conciliación" />
            <Journey steps={steps} formatAt={formatDateTime} />
            <p className="mt-4 text-[12.5px] text-fg-3">Los pagos en dólares se comparan al tipo de cambio guardado en el pago; las obligaciones, por su saldo o por su importe si ya están pagadas.</p>
          </Card>
        </ToneScope>
        <Card className="h-full">
          <TintCardTitle icon={FileSpreadsheet} title="Último extracto" tone="t3" />
          {data.last_import ? (
            <dl className="grid gap-1.5 text-[13px]">
              <div className="flex justify-between gap-3"><dt className="text-fg-3">Archivo</dt><dd className="truncate font-semibold">{data.last_import.filename}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-fg-3">Banco</dt><dd>{data.last_import.bank}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-fg-3">Líneas</dt><dd>{data.last_import.lines_count}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-fg-3">Importado</dt><dd>{formatDateTime(data.last_import.imported_at)}{data.last_import.imported_by ? ` · ${data.last_import.imported_by}` : ""}</dd></div>
            </dl>
          ) : (
            <p className="text-[13px] text-fg-3">Todavía no se importó un extracto. Las líneas actuales vienen de la carga inicial.</p>
          )}
        </Card>
      </section>
      <BankLinesTable data={data} />
      <Card className="mt-5">
        <TintCardTitle icon={History} title="Cierres de conciliación" />
        {data.closures.length > 0 ? (
          <MiniTable head={["Cierre", "Periodo", "Líneas", "Con match", "Otros", "Abonos", "Cargos", "Neto", "Responsable"]} align={["left", "left", "right", "right", "right", "right", "right", "right", "left"]} minWidth={860}>
            {data.closures.map((closure) => (
              <tr key={closure.code}>
                <td>
                  <b className="font-mono font-semibold">{closure.code}</b>
                  <span className="block text-xs text-fg-3">{formatDateTime(closure.closed_at)}</span>
                </td>
                <td>{periodLabel(closure.period)}</td>
                <td className="text-right">{closure.lines_count}</td>
                <td className="text-right">{closure.matched_count}</td>
                <td className="text-right">{closure.others_count}</td>
                <td className="text-right font-mono text-ok">{formatMoney(closure.credits)}</td>
                <td className="text-right font-mono">{formatMoney(closure.debits)}</td>
                <td className="text-right font-mono font-semibold">{formatMoney(closure.net)}</td>
                <td className="text-fg-2">{closure.closed_by ?? "—"}</td>
              </tr>
            ))}
          </MiniTable>
        ) : (
          <EmptyState icon={<Lock size={20} />} title="Sin cierres todavía" description="Resuelve las sugerencias y excepciones del extracto para cerrar la conciliación del periodo." />
        )}
      </Card>
    </>
  );
}
