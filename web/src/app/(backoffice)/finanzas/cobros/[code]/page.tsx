import { Bell, CalendarClock, HandCoins, Receipt, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { MiniTable, ProgressBar } from "@/components/ui/MiniTable";
import { TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { AuditCard } from "@/features/finance/FinanceDetailParts";
import type { ReceivableDetail } from "@/lib/finance";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { DOC_TYPE } from "@/lib/reservations";
import { getResource } from "@/lib/server/resource";
import { statusTone } from "@/lib/tone";

const getReceivable = cache(async (code: string) => (await getResource<ReceivableDetail>(`/finance/receivables/${encodeURIComponent(code)}`, "No pudimos cargar la cuota.")) ?? notFound());

export async function generateMetadata({ params }: PageProps<"/finanzas/cobros/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Cuota ${(await getReceivable(code)).code}` };
}

export default async function CuotaPage({ params }: PageProps<"/finanzas/cobros/[code]">) {
  const { code } = await params;
  const row = await getReceivable(code);
  const paidPct = Number(row.amount) > 0 ? (Number(row.paid) / Number(row.amount)) * 100 : 0;

  return (
    <ToneScope tone={statusTone(row.status)}>
      <PageHeader
        back={{ href: "/finanzas/cobros", label: "Cuentas por cobrar" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <HandCoins size={24} />
          </span>
        }
        title={row.concept}
        info={
          <span className="ml-2 flex-none">
            <StatusBadge status={row.status} primary />
          </span>
        }
        subtitle={`${row.code} · ${row.client.name}`}
      />
      {row.cancel_reason && <p className="mb-5 rounded-card border border-line bg-surface-2 px-4 py-3 text-[13.5px] text-fg-2"><b className="text-fg">Anulada.</b> {row.cancel_reason}</p>}
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Receipt} tone="t1" label="Monto" value={formatMoney(row.amount, row.currency)} />
        <TintTile icon={Wallet} tone="ok" label="Pagado" value={formatMoney(row.paid, row.currency)} />
        <TintTile icon={HandCoins} tone={row.status === "vencida" ? "bad" : "sun"} label="Saldo" value={formatMoney(row.balance, row.currency)} />
        <TintTile icon={CalendarClock} tone="violet" label="Vence" value={<span className="text-[16px]">{formatDate(row.due_date)}</span>} />
      </section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={Wallet} title="Pagos aplicados" aside={row.payments.length ? String(row.payments.length) : undefined} />
            <div className="mb-4">
              <ProgressBar value={paidPct} tone={row.status === "vencida" ? "bad" : "ok"} />
            </div>
            {row.payments.length === 0 ? (
              <p className="text-[13.5px] text-fg-3">Todavía no se aplicaron pagos a esta cuota.</p>
            ) : (
              <MiniTable head={["Pago", "Fecha", "Medio", "Aplicado", "Estado"]} align={["left", "left", "left", "right", "left"]}>
                {row.payments.map((payment) => (
                  <tr key={payment.code} className={payment.reversed_at ? "opacity-50" : undefined}>
                    <td>
                      <Link href={`/finanzas/pagos/${payment.code}`} className="font-semibold hover:underline">
                        {payment.code}
                      </Link>
                      {payment.reference && <span className="block text-xs text-fg-3">Operación {payment.reference}</span>}
                    </td>
                    <td className="whitespace-nowrap">{formatDate(payment.paid_on)}</td>
                    <td className="first-letter:uppercase">{payment.method.replaceAll("_", " ")}</td>
                    <td className="text-right font-mono">{formatMoney(payment.amount, row.currency)}</td>
                    <td>
                      <StatusBadge status={payment.reversed_at ? "revertido" : payment.status} />
                    </td>
                  </tr>
                ))}
              </MiniTable>
            )}
          </Card>
          <Card>
            <TintCardTitle icon={Receipt} title="Comprobantes" aside={row.invoices.length ? String(row.invoices.length) : undefined} />
            {row.invoices.length === 0 ? (
              <p className="text-[13.5px] text-fg-3">Esta cuota aún no tiene comprobante electrónico.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {row.invoices.map((invoice) => (
                  <li key={invoice.number} className="lift flex items-center gap-3 rounded-[12px] border border-line-2 px-3 py-2.5 text-[13px] hover:bg-surface-2">
                    <Link href={`/finanzas/facturacion/${invoice.number}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
                      {DOC_TYPE[invoice.doc_type] ?? "Comprobante"} {invoice.number}
                    </Link>
                    <span className="text-xs text-fg-3">{formatDate(invoice.issue_date)}</span>
                    <span className="font-mono">{formatMoney(invoice.total_amount, invoice.currency)}</span>
                    <StatusBadge status={invoice.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <AuditCard rows={row.audit} />
        </div>
        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={Receipt} title="Datos" />
            <FieldList
              fields={[
                { label: "Reserva", value: <Link href={`/reservas/${row.reservation.code}?seccion=pagos`} className="hover:underline">{row.reservation.code}</Link> },
                { label: "Cliente", value: <Link href={`/crm/clientes/${row.client.code}`} className="hover:underline">{row.client.name}</Link> },
                { label: "Tipo", value: <span className="first-letter:uppercase">{row.kind}</span> },
                { label: "Moneda", value: row.currency === "PEN" ? "Soles" : `${row.currency} · cambio ${Number(row.fx_rate)}` },
                { label: "Creada", value: formatDateTime(row.created_at) },
              ]}
            />
          </Card>
          <Card>
            <TintCardTitle icon={Bell} title="Recordatorios y avisos" />
            {row.reminders.length === 0 && row.notifications.length === 0 ? (
              <p className="text-[13.5px] text-fg-3">No se le enviaron recordatorios por esta cuota.</p>
            ) : (
              <ul className="flex flex-col">
                {row.reminders.map((reminder, index) => (
                  <li key={`r${index}`} className="border-t border-line-2 py-2 text-[13px] first:border-t-0">
                    <b className="font-semibold">Recordatorio {reminder.channels ? `por ${reminder.channels.replace(/[{}"]/g, "")}` : ""}</b>
                    <span className="block text-xs text-fg-3">
                      {formatDateTime(reminder.sent_at)}
                      {reminder.sent_by && ` · ${reminder.sent_by}`}
                      {reminder.balance_at_send && ` · saldo ${formatMoney(reminder.balance_at_send, row.currency)}`}
                    </span>
                  </li>
                ))}
                {row.notifications.map((message) => (
                  <li key={message.code} className="flex items-center gap-2 border-t border-line-2 py-2 text-[13px] first:border-t-0">
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-semibold">{message.subject ?? "Aviso"}</b>
                      <span className="text-xs text-fg-3">{formatDateTime(message.sent_at ?? message.created_at)}</span>
                    </span>
                    <StatusBadge status={message.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </ToneScope>
  );
}
