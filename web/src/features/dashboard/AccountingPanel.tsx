import { CalendarCheck, CircleCheck, CircleDashed, FileWarning, Receipt, ReceiptText, TriangleAlert, Wallet } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/MiniTable";
import { SimpleTable } from "@/components/ui/SimpleTable";
import { TintTile } from "@/components/ui/Tinted";
import type { AccountingData } from "@/lib/dashboard";
import { capitalize, formatMoney } from "@/lib/format";
import { toneStyle } from "@/lib/tone";
import { PanelCard, PanelLink, RowList, shortDate, type CanOpen } from "./DashboardBlocks";
import { money } from "./panelFormat";

const DOC_TYPES: Record<string, string> = { "01": "Factura", "03": "Boleta", "07": "Nota de crédito", "08": "Nota de débito" };

export function AccountingPanel({ data, can }: { data: AccountingData; can: CanOpen }) {
  const { kpis, close } = data;
  const progress = close.total > 0 ? (close.done / close.total) * 100 : 0;

  return (
    <>
      {data.observed.length > 0 && (
        <div style={toneStyle("warn")} className="tint-soft mb-4 flex flex-wrap items-center gap-3 rounded-[14px] px-4 py-3 text-[13px]">
          <TriangleAlert size={17} />
          <span className="min-w-0 flex-1">
            <b>Observados por el OSE:</b> {data.observed.map((row) => (row.detail ? `${row.number} (${row.detail})` : row.number)).join(", ")}
          </span>
          <PanelLink href="/finanzas/facturacion" can={can}>
            Corregir
          </PanelLink>
        </div>
      )}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={ReceiptText} tone="accent" label={`Comprobantes de ${data.month}`} value={kpis.invoices.count} note={`${money(kpis.invoices.amount)} emitido sin notas de crédito`} info={<p>Comprobantes electrónicos con fecha de emisión en el mes, sin borradores ni anulados. El monto suma facturas, boletas y notas de débito en soles.</p>} />
        <TintTile icon={FileWarning} tone={kpis.observed.count > 0 ? "bad" : "ok"} label="Observados o rechazados" value={kpis.observed.count} note={kpis.observed.count > 0 ? "Requieren corrección" : "Sin observaciones"} info={<p>Comprobantes que el OSE o SUNAT observó o rechazó, de cualquier periodo.</p>} />
        <TintTile icon={Receipt} tone={kpis.undocumented.count > 0 ? "sun" : "ok"} label="Cobros sin comprobante" value={kpis.undocumented.count} note={kpis.undocumented.count > 0 ? money(kpis.undocumented.amount) : "Todo documentado"} info={<p>Pagos confirmados o aplicados cuya reserva no tiene un comprobante (que no sea nota de crédito) por el mismo importe, con tolerancia de S/ 0,50.</p>} />
        <TintTile icon={Wallet} tone="violet" label="Cuentas por cobrar abiertas" value={kpis.receivables.count} note={money(kpis.receivables.amount)} info={<p>Cuentas por cobrar que no están pagadas ni canceladas, con su saldo en soles.</p>} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <PanelCard icon={ReceiptText} title="Comprobantes emitidos" tone="accent" className="lg:col-span-7" aside={<PanelLink href="/finanzas/facturacion" can={can}>Facturación</PanelLink>}>
          <SimpleTable
            empty="Aún no se emitieron comprobantes."
            columns={[{ header: "Comprobante" }, { header: "Tipo" }, { header: "Cliente" }, { header: "Fecha" }, { header: "Importe", align: "right" }, { header: "Estado" }]}
            rows={data.invoices.map((row) => ({
              key: row.number,
              cells: [
                <span key="number" className="font-mono text-[12.5px]">
                  {row.number}
                </span>,
                DOC_TYPES[row.type] ?? row.type,
                row.client,
                shortDate(row.date),
                `${row.credit ? "−" : ""}${formatMoney(row.total, row.currency)}`,
                <StatusBadge key="status" status={row.status} />,
              ],
            }))}
          />
        </PanelCard>
        <PanelCard icon={CalendarCheck} title={`Cierre de ${close.label.toLowerCase()}`} tone="ok" className="lg:col-span-5" aside={<PanelLink href="/finanzas/cierre" can={can}>Cierre</PanelLink>}>
          <div className="mb-2 flex items-center justify-between text-[13px]">
            <span className="text-fg-2">
              {close.done} de {close.total} controles
            </span>
            <Badge tone={close.status === "cerrado" ? "ok" : "warn"}>{close.status === "cerrado" ? "Periodo cerrado" : "Abierto"}</Badge>
          </div>
          <ProgressBar value={progress} tone={close.done === close.total ? "ok" : "warn"} />
          <ul className="mt-3">
            {close.checks.map((check) => (
              <li key={check.label} className="flex items-center gap-2.5 border-t border-line-2 py-2 text-[13px] first:border-t-0">
                {check.ok ? <CircleCheck size={16} className="flex-none text-ok" /> : <CircleDashed size={16} className={check.manual ? "flex-none text-fg-3" : "flex-none text-bad"} />}
                <span className="min-w-0 flex-1">{check.label}</span>
                <span className="text-[12px] text-fg-3">{check.manual ? "Manual" : "Automático"}</span>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard icon={Receipt} title="Cobros sin comprobante" tone="sun" className="lg:col-span-6" aside={<PanelLink href="/finanzas/facturacion" can={can}>Emitir</PanelLink>}>
          <RowList
            empty="Todos los cobros aplicados tienen comprobante."
            items={data.undocumented.map((row) => ({ key: row.code, icon: Receipt, tone: "sun", title: `${row.code} · ${capitalize(row.method)}`, detail: [row.reservation, shortDate(row.date)].filter(Boolean).join(" · "), aside: <b className="font-mono">{formatMoney(row.amount, row.currency)}</b> }))}
          />
        </PanelCard>
        <PanelCard icon={Wallet} title="Cuentas por cobrar" tone="violet" className="lg:col-span-6" aside={<PanelLink href="/finanzas/cobros" can={can}>Cobros</PanelLink>}>
          <RowList
            empty="No hay cuentas por cobrar abiertas."
            items={data.receivables.map((row) => ({
              key: row.code,
              icon: Wallet,
              tone: row.overdue ? "bad" : "violet",
              title: `${row.code} · ${row.client}`,
              detail: `${row.concept ?? "Cuota"} · ${row.overdue ? "venció" : "vence"} ${shortDate(row.due)}`,
              aside: (
                <>
                  <b className="font-mono">{formatMoney(row.balance, row.currency)}</b>
                  <StatusBadge status={row.status} />
                </>
              ),
            }))}
          />
        </PanelCard>
      </div>
    </>
  );
}
