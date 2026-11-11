import { CalendarClock, Receipt, Truck, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { MiniTable } from "@/components/ui/MiniTable";
import { TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { Button } from "@/components/ui/Button";
import { AuditCard, StatusHistoryCard } from "@/features/finance/FinanceDetailParts";
import { SchedulePayableAction } from "@/features/finance/Payables";
import type { PayableDetail } from "@/lib/finance";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";
import { statusTone } from "@/lib/tone";

const getPayable = cache(async (code: string) => (await getResource<PayableDetail>(`/finance/payables/${encodeURIComponent(code)}`, "No pudimos cargar la obligación.")) ?? notFound());

export async function generateMetadata({ params }: PageProps<"/finanzas/proveedores/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Obligación ${(await getPayable(code)).code}` };
}

export default async function ObligacionPage({ params }: PageProps<"/finanzas/proveedores/[code]">) {
  const { code } = await params;
  const row = await getPayable(code);

  return (
    <ToneScope tone={statusTone(row.status)}>
      <PageHeader
        back={{ href: "/finanzas/proveedores", label: "Cuentas por pagar" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <Truck size={24} />
          </span>
        }
        title={row.concept}
        info={
          <span className="ml-2 flex-none">
            <StatusBadge status={row.status} primary />
          </span>
        }
        subtitle={`${row.code}${row.provider ? ` · ${row.provider.name}` : ""}`}
        actions={
          row.can.operate && row.approved_at && Number(row.balance) > 0 && row.status !== "cancelada" ? (
            <SchedulePayableAction
              row={{ code: row.code, concept: row.concept, balance: Number(row.balance), currency: row.currency, lock_version: row.lock_version, scheduled_date: row.scheduled?.date ?? null, scheduled_account: row.scheduled?.account?.code ?? null, due_date: row.due_date, provider: { name: row.provider?.name ?? "Sin proveedor" } }}
              banks={row.bank_accounts}
              today={row.today}
              trigger={(show) => (
                <Button variant="primary" icon={<CalendarClock size={16} />} onClick={show}>
                  {row.scheduled ? "Reprogramar pago" : "Programar pago"}
                </Button>
              )}
            />
          ) : undefined
        }
      />
      {row.observation && <p className="mb-5 rounded-card border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-4 py-3 text-[13.5px]"><b className="font-semibold">Observada.</b> {row.observation}</p>}
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Receipt} tone="t1" label="Monto" value={formatMoney(row.amount, row.currency)} />
        <TintTile icon={Wallet} tone="ok" label="Pagado" value={formatMoney(row.paid, row.currency)} />
        <TintTile icon={Truck} tone={row.status === "vencida" ? "bad" : "sun"} label="Saldo" value={formatMoney(row.balance, row.currency)} />
        <TintTile icon={CalendarClock} tone="violet" label={row.scheduled_date ? "Pago programado" : "Vence"} value={<span className="text-[16px]">{formatDate(row.scheduled_date ?? row.due_date)}</span>} note={row.scheduled ? `${row.scheduled.account ? `Desde ${row.scheduled.account.name} · ` : ""}vence el ${formatDate(row.due_date)}` : undefined} />
      </section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={Wallet} title="Pagos al proveedor" aside={row.payouts.length ? String(row.payouts.length) : undefined} />
            {row.payouts.length === 0 ? (
              <p className="text-[13.5px] text-fg-3">Todavía no se le pagó.</p>
            ) : (
              <MiniTable head={["Pago", "Fecha", "Medio", "Cuenta", "Monto"]} align={["left", "left", "left", "left", "right"]}>
                {row.payouts.map((payout) => (
                  <tr key={payout.code}>
                    <td>
                      <b className="block font-semibold">{payout.code}</b>
                      {payout.operation_ref && <span className="text-xs text-fg-3">Operación {payout.operation_ref}</span>}
                    </td>
                    <td className="whitespace-nowrap">{formatDate(payout.paid_on)}</td>
                    <td className="first-letter:uppercase">{payout.method.replaceAll("_", " ")}</td>
                    <td>{payout.account ?? "—"}</td>
                    <td className="text-right font-mono">{formatMoney(payout.amount, row.currency)}</td>
                  </tr>
                ))}
              </MiniTable>
            )}
          </Card>
          <AuditCard rows={row.audit} />
        </div>
        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={Truck} title="Proveedor y origen" />
            <FieldList
              fields={[
                { label: "Proveedor", value: row.provider?.name ?? "Sin proveedor" },
                ...(row.provider?.ruc ? [{ label: "RUC", value: row.provider.ruc }] : []),
                ...(row.provider?.terms ? [{ label: "Condición de pago", value: row.provider.terms }] : []),
                ...(row.reservation ? [{ label: "Reserva", value: <Link href={`/reservas/${row.reservation.code}`} className="hover:underline">{row.reservation.code}</Link> }] : []),
                ...(row.reservation?.service ? [{ label: "Servicio", value: <span className="whitespace-normal">{row.reservation.service}</span> }] : []),
                { label: "Tipo de costo", value: row.cost_type ?? row.kind },
                { label: "Comprobante", value: row.supplier_doc ?? "Sin comprobante" },
                ...(row.approved_by ? [{ label: "Aprobó", value: `${row.approved_by}${row.approved_at ? ` · ${formatDateTime(row.approved_at)}` : ""}` }] : []),
              ]}
            />
          </Card>
          <StatusHistoryCard rows={row.history} />
        </div>
      </div>
    </ToneScope>
  );
}
