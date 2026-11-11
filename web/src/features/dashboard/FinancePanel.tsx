import { BarChart3, CreditCard, HandCoins, Hourglass, Percent, Receipt, Scale, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SimpleTable } from "@/components/ui/SimpleTable";
import { TintTile } from "@/components/ui/Tinted";
import type { FinanceData } from "@/lib/dashboard";
import { capitalize, formatMoney, formatPercent } from "@/lib/format";
import { HBars, MaybeLink, PanelCard, PanelLink, RowList, SubHeading, shortDate, type CanOpen } from "./DashboardBlocks";
import { closedMonths, money, plural } from "./panelFormat";
import { TrendBars } from "./TrendBars";

const AGING_TONES = ["ok", "sun", "warn", "bad", "bad"] as const;

function marginLight(pct: number): { tone: "ok" | "warn" | "bad"; label: string } {
  if (pct >= 25) return { tone: "ok", label: "En meta" };
  if (pct >= 15) return { tone: "warn", label: "Vigilar" };
  return { tone: "bad", label: "Bajo mínimo" };
}

export function FinancePanel({ data, can }: { data: FinanceData; can: CanOpen }) {
  const { kpis } = data;
  const months = closedMonths(data.months);

  return (
    <>
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TintTile icon={Wallet} tone="ok" label={`Caja de ${data.month}`} value={money(kpis.cash.amount)} note={plural(kpis.cash.count, "cobro aplicado", "cobros aplicados")} info={<p>Pagos confirmados o aplicados con fecha de pago en el mes, en soles al tipo de cambio de cada pago.</p>} />
        <TintTile icon={Receipt} tone="sun" label="Por cobrar" value={money(kpis.receivable.open)} note={kpis.receivable.overdue_count > 0 ? `${kpis.receivable.overdue_count} vencidas · ${money(kpis.receivable.overdue)}` : "Nada vencido"} info={<p>Saldo de las cuentas por cobrar que no están pagadas ni canceladas. Debajo, las que ya pasaron su vencimiento.</p>} />
        <TintTile icon={CreditCard} tone={kpis.to_validate.count > 0 ? "bad" : "ok"} label="Pagos por validar" value={kpis.to_validate.count} note={kpis.to_validate.count > 0 ? money(kpis.to_validate.amount) : "Todo validado"} info={<p>Pagos reportados por asesores, clientes o agencias que siguen pendientes. No reducen la deuda hasta que se validan.</p>} />
        <TintTile icon={HandCoins} tone="violet" label="Por pagar a 7 días" value={money(kpis.payables.amount)} note={plural(kpis.payables.count, "documento", "documentos")} info={<p>Saldo de las cuentas por pagar a proveedores que vencen en los próximos 7 días, incluidas las ya vencidas.</p>} />
        <TintTile icon={Percent} tone="accent" label="Margen bruto del mes" value={kpis.margin.value === null ? "—" : formatPercent(kpis.margin.value)} note={kpis.margin.previous === null ? "Sin mes anterior" : `${formatPercent(kpis.margin.previous)} el mes anterior`} info={<p>Ventas del mes menos el costo de sus servicios no cancelados, dividido entre las ventas.</p>} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <PanelCard icon={Scale} title="Margen por reserva" tone="t1" className="lg:col-span-7" aside={<PanelLink href="/finanzas/rentabilidad" can={can}>Rentabilidad</PanelLink>}>
          <SimpleTable
            empty="No hay reservas con servicios valorizados."
            columns={[{ header: "Reserva" }, { header: "Venta", align: "right" }, { header: "Costo", align: "right" }, { header: "Margen", align: "right" }, { header: "Semáforo" }]}
            rows={data.margins.map((row) => {
              const light = marginLight(row.pct);
              return {
                key: row.code,
                cells: [
                  <span key="res">
                    <MaybeLink href={`/reservas/${row.code}`} can={can} className="block font-medium">
                      {row.title}
                    </MaybeLink>
                    <span className="font-mono text-[12px] text-fg-3">{row.code}</span>
                  </span>,
                  formatMoney(row.sale, row.currency),
                  formatMoney(row.cost, row.currency),
                  formatPercent(row.pct),
                  <Badge key="light" tone={light.tone}>
                    {light.label}
                  </Badge>,
                ],
              };
            })}
          />
          <p className="mt-2 text-[12px] text-fg-3">Las de menor margen primero. Verde desde 25 %, ámbar desde 15 %, rojo debajo.</p>
        </PanelCard>
        <PanelCard icon={Hourglass} title="Por cobrar según antigüedad" tone="sun" className="lg:col-span-5" aside={<PanelLink href="/finanzas/cobros" can={can}>Cobros</PanelLink>}>
          <HBars empty="No hay cuentas por cobrar abiertas." rows={data.aging.map((row, index) => ({ key: row.label, label: `${row.label} (${row.count})`, value: row.amount, display: formatMoney(row.amount), tone: AGING_TONES[index] }))} />
          {data.overdue.length > 0 && (
            <>
              <SubHeading>Las más atrasadas</SubHeading>
              <RowList empty="" items={data.overdue.map((row) => ({ key: row.code, title: row.client, detail: `${row.code} · venció ${shortDate(row.due)}`, aside: <b className="font-mono text-bad">{formatMoney(row.balance, row.currency)}</b> }))} />
            </>
          )}
        </PanelCard>

        <PanelCard icon={CreditCard} title="Pagos por validar" tone="bad" className="lg:col-span-4" aside={<PanelLink href="/finanzas/pagos" can={can}>Pagos</PanelLink>}>
          <RowList
            empty="No hay pagos por validar."
            items={data.to_validate.map((row) => ({ key: row.code, icon: CreditCard, tone: "warn", title: `${row.code} · ${capitalize(row.method)}`, detail: [row.reservation, shortDate(row.date), row.by ? `reportado por ${row.by}` : null].filter(Boolean).join(" · "), aside: <b className="font-mono">{formatMoney(row.amount, row.currency)}</b> }))}
          />
        </PanelCard>
        <PanelCard icon={HandCoins} title="Por pagar a proveedores" tone="violet" className="lg:col-span-4" aside={<PanelLink href="/finanzas/proveedores" can={can}>Proveedores</PanelLink>}>
          <RowList
            empty="Nada vence en los próximos 7 días."
            items={data.payables.map((row) => ({
              key: row.code,
              icon: HandCoins,
              tone: row.overdue ? "bad" : "violet",
              title: row.provider ?? row.code,
              detail: `${row.code} · ${row.overdue ? "vencida" : "vence"} ${shortDate(row.due)} · ${row.document ? `factura ${row.document}` : "sin factura"}`,
              aside: <b className="font-mono">{formatMoney(row.balance, row.currency)}</b>,
            }))}
          />
        </PanelCard>
        <PanelCard icon={Percent} title="Comisiones por aprobar" tone="sun" className="lg:col-span-4" aside={<PanelLink href="/finanzas/comisiones" can={can}>Comisiones</PanelLink>}>
          <RowList
            empty="No hay comisiones calculadas por aprobar."
            items={data.commissions.map((row) => ({ key: row.code, icon: Percent, tone: "sun", title: row.beneficiary ?? row.code, detail: [capitalize(row.kind), row.reservation, `${formatPercent(row.pct)} de ${formatMoney(row.base, row.currency)}`].filter(Boolean).join(" · "), aside: <b className="font-mono">{formatMoney(row.amount, row.currency)}</b> }))}
          />
        </PanelCard>

        <PanelCard icon={BarChart3} title="Ventas y costo de proveedores" tone="t1" className="lg:col-span-7">
          <p className="-mt-2 mb-3 text-[12.5px] text-fg-3">Meses cerrados, en soles</p>
          <TrendBars labels={months.map((month) => month.label)} unit="money" series={[{ name: "Ventas", tone: "t1", values: months.map((month) => month.sales) }, { name: "Costo de proveedores", tone: "sun", values: months.map((month) => month.cost) }]} />
        </PanelCard>
        <PanelCard icon={Wallet} title={`Caja de ${data.month} por medio de pago`} tone="ok" className="lg:col-span-5">
          <HBars empty="Aún no hay cobros aplicados este mes." rows={data.methods.map((row) => ({ key: row.label, label: `${capitalize(row.label)} (${row.count})`, value: row.sales, display: formatMoney(row.sales), tone: "ok" }))} />
        </PanelCard>
      </div>
    </>
  );
}
