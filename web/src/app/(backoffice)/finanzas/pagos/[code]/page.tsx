import { Banknote, Landmark, Link2, RotateCcw, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { MiniTable } from "@/components/ui/MiniTable";
import { TintCardTitle, ToneScope } from "@/components/ui/Tinted";
import { Button } from "@/components/ui/Button";
import { AuditCard, StatusHistoryCard } from "@/features/finance/FinanceDetailParts";
import { RetryPaymentAction } from "@/features/finance/Payments";
import type { PaymentDetail } from "@/lib/finance";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";
import { statusTone } from "@/lib/tone";

const getPayment = cache(async (code: string) => (await getResource<PaymentDetail>(`/finance/payments/${encodeURIComponent(code)}`, "No pudimos cargar el pago.")) ?? notFound());

export async function generateMetadata({ params }: PageProps<"/finanzas/pagos/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Pago ${(await getPayment(code)).code}` };
}

export default async function PagoPage({ params }: PageProps<"/finanzas/pagos/[code]">) {
  const { code } = await params;
  const row = await getPayment(code);

  return (
    <ToneScope tone={statusTone(row.status)}>
      <PageHeader
        back={{ href: "/finanzas/pagos", label: "Pagos y aplicaciones" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <Banknote size={24} />
          </span>
        }
        title={formatMoney(row.amount, row.currency)}
        info={
          <span className="ml-2 flex-none">
            <StatusBadge status={row.status} primary />
          </span>
        }
        subtitle={`${row.code} · ${row.method.replaceAll("_", " ")} · ${formatDate(row.paid_on)}`}
        actions={
          row.status === "rechazado" && row.can.retry ? (
            <RetryPaymentAction
              code={row.code}
              lockVersion={row.lock_version}
              retries={row.retries}
              summary={[
                { label: "Pago", value: `${row.code} · ${row.method.replaceAll("_", " ")}` },
                { label: "Motivo del rechazo", value: row.reject_reason ?? "—" },
                { label: "Monto", value: formatMoney(row.amount, row.currency), strong: true },
              ]}
              trigger={(show) => (
                <Button variant="primary" icon={<RotateCcw size={16} />} onClick={show}>
                  Reintentar validación
                </Button>
              )}
            />
          ) : undefined
        }
      />
      {(row.reject_reason || row.revert_reason) && (
        <p className="mb-5 rounded-card border border-[color-mix(in_srgb,var(--bad)_30%,transparent)] bg-[color-mix(in_srgb,var(--bad)_7%,transparent)] px-4 py-3 text-[13.5px]">
          <b className="font-semibold">{row.revert_reason ? "Revertido." : "Rechazado."}</b> {row.revert_reason ?? row.reject_reason}
        </p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={Wallet} title="Aplicado a" aside={row.applications.length ? String(row.applications.length) : undefined} />
            {row.applications.length === 0 ? (
              <p className="text-[13.5px] text-fg-3">El pago todavía no se aplica a ninguna cuota.</p>
            ) : (
              <MiniTable head={["Cuota", "Vence", "Aplicado", "Fecha"]} align={["left", "left", "right", "left"]}>
                {row.applications.map((item) => (
                  <tr key={item.code} className={item.reversed_at ? "opacity-50" : undefined}>
                    <td>
                      <Link href={`/finanzas/cobros/${item.code}`} className="font-semibold hover:underline">
                        {item.concept}
                      </Link>
                      <span className="block text-xs text-fg-3">{item.code}</span>
                    </td>
                    <td className="whitespace-nowrap">{formatDate(item.due_date)}</td>
                    <td className="text-right font-mono">{formatMoney(item.amount, row.currency)}</td>
                    <td className="whitespace-nowrap text-xs">{formatDateTime(item.applied_at)}</td>
                  </tr>
                ))}
              </MiniTable>
            )}
          </Card>
          <AuditCard rows={row.audit} />
        </div>
        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={Banknote} title="Datos del pago" />
            <FieldList
              fields={[
                ...(row.reservation ? [{ label: "Reserva", value: <Link href={`/reservas/${row.reservation.code}?seccion=pagos`} className="hover:underline">{row.reservation.code}</Link> }] : []),
                ...(row.client ? [{ label: "Cliente", value: <Link href={`/crm/clientes/${row.client.code}`} className="hover:underline">{row.client.name}</Link> }] : []),
                { label: "En soles", value: <span className="font-mono">{formatMoney(row.pen)}</span> },
                { label: "Operación", value: row.reference ?? "—" },
                { label: "Origen", value: row.reported_by_agency ? "Reportado por la agencia aliada" : (row.source ?? "Back-office") },
                { label: "Registró", value: `${row.registered_by ?? "Sistema"} · ${formatDateTime(row.created_at)}` },
                ...(row.retries > 0 ? [{ label: "Reintentos de validación", value: String(row.retries) }] : []),
                ...(row.note ? [{ label: "Nota", value: <span className="whitespace-normal">{row.note}</span> }] : []),
              ]}
            />
          </Card>
          <Card>
            <TintCardTitle icon={Landmark} title="Conciliación bancaria" />
            {row.bank_line ? (
              <FieldList
                fields={[
                  { label: "Línea del banco", value: row.bank_line.code },
                  { label: "Fecha", value: formatDate(row.bank_line.value_date) },
                  { label: "Descripción", value: <span className="whitespace-normal">{row.bank_line.description}</span> },
                  { label: "Estado", value: <StatusBadge status={row.bank_line.status} /> },
                ]}
              />
            ) : (
              <p className="flex items-center gap-2 text-[13.5px] text-fg-3">
                <Link2 size={15} />
                Aún no está cruzado con un movimiento del extracto.
              </p>
            )}
          </Card>
          <StatusHistoryCard rows={row.history} />
        </div>
      </div>
    </ToneScope>
  );
}
