import { Coins, PiggyBank, Receipt, Scale, Stamp, TrendingDown, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { MiniTable } from "@/components/ui/MiniTable";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { ViewPanel } from "@/components/ui/ViewPanel";
import { ApproveCostButton, ReservationCostAction } from "@/features/finance/Payables";
import { SettlementSection } from "@/features/finance/Settlement";
import type { SettlementDetail } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

const getSettlement = cache(async (code: string) => getResource<SettlementDetail>(`/finance/reservations/${encodeURIComponent(code)}/settlement`, "No pudimos cargar la rentabilidad de la reserva."));

export async function generateMetadata({ params }: PageProps<"/finanzas/rentabilidad/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Rentabilidad ${code}` };
}

function Waterfall({ statement }: { statement: SettlementDetail["statement"] }) {
  const income = Math.max(Number(statement.income), 0);
  const steps = [
    { label: "Ingresos sin IGV", value: income, tone: "var(--t1)" },
    { label: "Costo de servicios", value: -Number(statement.service_cost ?? statement.cost), tone: "var(--warn)" },
    { label: "Costos adicionales aprobados", value: -Number(statement.extra_cost ?? 0), tone: "var(--bad)" },
    { label: "Comisiones", value: -Number(statement.commissions), tone: "var(--violet)" },
    { label: "Utilidad neta", value: Number(statement.net), tone: Number(statement.net) < 0 ? "var(--bad)" : "var(--ok)" },
  ];
  const scale = Math.max(income, ...steps.map((step) => Math.abs(step.value)), 1);
  return (
    <ul className="flex flex-col gap-3">
      {steps.map((step) => (
        <li key={step.label} className="group grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] items-center gap-3 text-[13px]">
          <span className="truncate text-fg-2">{step.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full origin-left rounded-full transition-[filter] group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.32,0.72,0,1)]" style={{ width: `${(Math.abs(step.value) / scale) * 100}%`, background: step.tone }} />
          </span>
          <span className="whitespace-nowrap text-right font-mono">{step.value < 0 ? "− " : ""}{formatMoney(Math.abs(step.value))}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function RentabilidadReservaPage({ params }: PageProps<"/finanzas/rentabilidad/[code]">) {
  const { code } = await params;
  const data = await getSettlement(code);
  if (data === null) {
    return <PageHeader back={{ href: "/finanzas/rentabilidad", label: "Rentabilidad" }} title={`Rentabilidad de ${code}`} subtitle="La rentabilidad la ven quienes tienen acceso a los márgenes de la agencia." />;
  }
  if (!data.reservation) notFound();

  const { reservation, statement } = data;
  const pending = data.pending_extras ?? [];
  const costs = data.payables;
  const gross = Number(statement.gross ?? Number(statement.income) - Number(statement.cost));

  return (
    <>
      <PageHeader
        back={{ href: "/finanzas/rentabilidad", label: "Rentabilidad" }}
        jump={false}
        title={reservation.title}
        info={
          <span className="ml-2 flex-none">
            <StatusBadge status={reservation.status} primary />
          </span>
        }
        subtitle={
          <>
            <Link href={`/reservas/${reservation.code}`} className="hover:underline">{reservation.code}</Link> · {reservation.client}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ViewPanel label="Liquidación" icon={<Scale size={16} />} testId="settlement-open" title={`Liquidación de ${reservation.code}`} description="Estado de resultados, flujo de caja y lo que falta para cerrar la reserva.">
              <SettlementSection data={data} />
            </ViewPanel>
            {data.can?.register_cost && data.cost_form && <ReservationCostAction reservation={{ code: reservation.code, currency: reservation.currency }} form={data.cost_form} />}
          </div>
        }
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Receipt} tone="t1" label="Ingresos sin IGV" value={formatMoney(statement.income)} info="Suma de las cuotas por cobrar de la reserva en soles. En soles se descuenta el IGV; en dólares es venta de exportación." />
        <TintTile icon={TrendingDown} tone="warn" label="Costos" value={formatMoney(statement.cost)} info="Costo de los servicios más los costos adicionales ya aprobados. Los costos por aprobar no cuentan." />
        <div data-testid="profit-margin" data-value={gross.toFixed(2)} data-pct={statement.margin_pct ?? ""} className="contents">
          <TintTile icon={TrendingUp} tone={gross < 0 ? "bad" : "ok"} label="Margen bruto" value={formatMoney(gross)} note={statement.margin_pct !== null ? `${statement.margin_pct} % de los ingresos` : undefined} info="Ingresos sin IGV menos costos." />
        </div>
        <TintTile icon={PiggyBank} tone={Number(statement.net) < 0 ? "bad" : "violet"} label="Utilidad neta" value={formatMoney(statement.net)} note={statement.net_pct != null ? `${statement.net_pct} %` : undefined} info="Margen bruto menos las comisiones de la reserva." />
      </section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <TintCardTitle icon={Coins} title="De la venta a la utilidad" aside="En soles" />
          <Waterfall statement={statement} />
        </Card>
        <div className="flex flex-col gap-5">
          {pending.length > 0 && (
            <Card>
              <TintCardTitle icon={Stamp} title="Costos por aprobar" aside={String(pending.length)} />
              <p className="mb-3 text-[12.5px] text-fg-3">No restan margen hasta que se aprueban.</p>
              <ul className="flex flex-col">
                {pending.map((item) => (
                  <li key={item.code} className="flex items-center gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                    <span className="min-w-0 flex-1">
                      <Link href={`/finanzas/proveedores/${item.code}`} className="block truncate font-semibold hover:underline">{item.concept}</Link>
                      <span className="text-xs text-fg-3">{[item.code, item.provider].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="font-mono">{formatMoney(item.amount, item.currency)}</span>
                    {data.can?.approve_cost && item.lock_version !== undefined && <ApproveCostButton code={item.code} lockVersion={item.lock_version} />}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <TintCardTitle icon={TrendingDown} title="Costos que restan margen" aside={String(costs.length)} />
            {costs.length === 0 ? (
              <p className="text-[13.5px] text-fg-3">La reserva no tiene costos registrados.</p>
            ) : (
              <MiniTable head={["Obligación", "Monto", "Pagado", "Estado"]} align={["left", "right", "right", "left"]} minWidth={460}>
                {costs.map((item) => (
                  <tr key={item.code}>
                    <td>
                      <Link href={`/finanzas/proveedores/${item.code}`} className="font-semibold hover:underline">{item.concept}</Link>
                      <span className="block text-xs text-fg-3">{[item.code, item.provider].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="text-right font-mono">{formatMoney(item.amount, item.currency)}</td>
                    <td className="text-right font-mono">{formatMoney(item.paid_amount, item.currency)}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </MiniTable>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
