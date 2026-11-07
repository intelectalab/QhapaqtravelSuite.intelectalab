import { CalendarDays, FileText, History, ReceiptText, Route, ScrollText, UserRound, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { InvoiceRowActions } from "@/features/finance/Invoices";
import { cn } from "@/lib/cn";
import type { FinanceOption, InvoiceDetail } from "@/lib/finance";
import { amountAttr, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";
import { statusLabel, statusTone } from "@/lib/tone";

type InvoicePage = InvoiceDetail & { reasons: FinanceOption[]; can: { issue: boolean } };

const ACTION_LABEL: Record<string, string> = { send: "Envío al OSE", status: "Consulta de estado", resend: "Corrección y reenvío", void: "Comunicación de baja" };

const EVENT_TONE: Record<string, string> = { ok: "text-ok", error_temporal: "text-warn", error_definitivo: "text-bad" };

const EVENT_LABEL: Record<string, string> = { ok: "Correcto", error_temporal: "Error temporal, se reintenta", error_definitivo: "Error definitivo" };

async function load(number: string) {
  return getResource<InvoicePage>(`/finance/invoices/${encodeURIComponent(number)}`, "No pudimos cargar el comprobante.");
}

export async function generateMetadata({ params }: PageProps<"/finanzas/facturacion/[number]">): Promise<Metadata> {
  const { number } = await params;
  return { title: number };
}

export default async function ComprobantePage({ params }: PageProps<"/finanzas/facturacion/[number]">) {
  const { number } = await params;
  const invoice = await load(number);

  if (!invoice) {
    return <PageHeader back={{ href: "/finanzas/facturacion", label: "Facturación" }} title={number} subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const credit = invoice.doc_type === "07";

  return (
    <ToneScope tone={statusTone(invoice.status)}>
      <PageHeader
        back={{ href: "/finanzas/facturacion", label: "Facturación" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <ReceiptText size={24} />
          </span>
        }
        title={<span className="font-mono">{invoice.number}</span>}
        info={
          <span className="ml-2 flex flex-none items-center gap-2">
            <Badge tone="t1" dot={false}>
              {invoice.type}
            </Badge>
            <StatusBadge status={invoice.status} primary />
          </span>
        }
        subtitle={invoice.ref_number ? `Modifica ${invoice.ref_number}` : invoice.description}
        actions={invoice.can.issue ? <div className="flex flex-wrap items-center justify-end gap-2" data-testid="invoice-actions"><InvoiceRowActions row={invoice} reasons={invoice.reasons} /></div> : undefined}
      />

      {invoice.ose_message && (
        <p className={cn("mb-5 rounded-card border px-4 py-3 text-[13.5px]", invoice.status === "aceptado" ? "border-line bg-surface-2 text-fg-2" : "border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]")}>
          <b className="font-semibold">Respuesta del OSE.</b> {invoice.ose_message}
          {invoice.ose_ticket ? ` · Ticket ${invoice.ose_ticket}` : ""}
        </p>
      )}

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={UserRound} tone="t1" label="Cliente" value={<span className="text-[16px]">{invoice.customer.name}</span>} note={`${invoice.customer.doc_type} ${invoice.customer.doc_number}`} />
        <TintTile icon={Route} tone="t4" label="Reserva" value={<Link href={`/reservas/${invoice.reservation.code}`} className="text-[16px] hover:underline">{invoice.reservation.code}</Link>} note={invoice.receivable ?? undefined} />
        <TintTile icon={CalendarDays} tone="violet" label="Emisión" value={<span className="text-[16px]">{formatDate(invoice.issue_date)}</span>} note={invoice.issued_by ?? undefined} />
        <TintTile icon={Wallet} tone="sun" label="Total" value={<span data-testid="invoice-total" data-amount={amountAttr(invoice.total)} className={cn("text-[16px]", credit && "text-bad")}>{credit ? "− " : ""}{formatMoney(invoice.total, invoice.currency)}</span>} note={invoice.delivered ? "Entregado al cliente" : invoice.currency !== "PEN" && invoice.fx_rate ? `TC ${invoice.fx_rate}` : undefined} />
      </section>

      <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={FileText} title="Detalle" aside={invoice.operation === "gravada" ? "Operación gravada" : "Exportación"} />
            <ul className="flex flex-col">
              {invoice.lines.map((line) => (
                <li key={line.line_no} className="flex items-start gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                  <span className="min-w-0 flex-1">
                    <b className="block font-semibold">{line.description}</b>
                    <span className="text-xs text-fg-3">
                      {Number(line.quantity)} {line.unit_code === "ZZ" ? "servicio" : line.unit_code} · {line.igv_affectation === "10" ? "Gravado" : "Exportación"}
                    </span>
                  </span>
                  <span className="font-mono">{formatMoney(line.line_amount, invoice.currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 flex flex-col gap-1.5 border-t border-line-2 pt-3 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-fg-3">{invoice.operation === "gravada" ? "Base imponible" : "Valor de exportación"}</dt>
                <dd className="font-mono">{formatMoney(invoice.taxable, invoice.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-3">IGV 18 %</dt>
                <dd className="font-mono">{formatMoney(invoice.igv, invoice.currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-line-2 pt-1.5 text-[17px] font-bold">
                <dt>Total</dt>
                <dd className="font-mono">{formatMoney(invoice.total, invoice.currency)}</dd>
              </div>
              <p className="text-[12px] text-fg-3">{invoice.in_words}</p>
            </dl>
          </Card>

          {invoice.credit_notes.length > 0 && (
            <Card>
              <TintCardTitle icon={ScrollText} title="Notas de crédito" aside={String(invoice.credit_notes.length)} />
              <ul className="flex flex-col">
                {invoice.credit_notes.map((note) => (
                  <li key={note.number} className="flex items-center gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                    <span className="min-w-0 flex-1">
                      <Link href={`/finanzas/facturacion/${note.number}`} className="font-mono font-semibold hover:underline">
                        {note.number}
                      </Link>
                      {note.credit_note_reason && <span className="block text-xs text-fg-3">{note.credit_note_reason}</span>}
                    </span>
                    <span className="font-mono text-bad">− {formatMoney(note.total_amount, invoice.currency)}</span>
                    <StatusBadge status={note.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={ReceiptText} title="Envíos al OSE" aside={invoice.fiscal_events.length ? String(invoice.fiscal_events.length) : undefined} />
            {invoice.fiscal_events.length === 0 ? (
              <p className="text-[13.5px] text-fg-3">{invoice.status === "pendiente_envio" ? "En cola: el envío al OSE sale en unos segundos." : "Sin envíos registrados."}</p>
            ) : (
              <ul className="flex flex-col">
                {invoice.fiscal_events.map((event, index) => (
                  <li key={index} className="flex items-start gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                    <span className="min-w-0 flex-1">
                      <b className="block font-semibold">
                        {ACTION_LABEL[event.action] ?? event.action}
                        {event.attempt > 1 ? ` · intento ${event.attempt}` : ""}
                      </b>
                      <span className="text-xs text-fg-3">
                        {formatDateTime(event.created_at)}
                        {event.response_message ? ` · ${event.response_message}` : ""}
                      </span>
                    </span>
                    <span className={cn("flex-none text-[12px] font-semibold", EVENT_TONE[event.status] ?? "text-fg-2")}>{EVENT_LABEL[event.status] ?? event.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <TintCardTitle icon={History} title="Historial" />
            <ol className="flex flex-col gap-3 border-l-2 border-[color-mix(in_srgb,var(--tint)_25%,transparent)] pl-4">
              {invoice.history.map((event, index) => (
                <li key={index} className="relative text-[13px]">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[var(--tint)]" />
                  <b className="font-semibold">{statusLabel(event.status)}</b>
                  <span className="block text-xs text-fg-3">
                    {formatDateTime(event.created_at)}
                    {event.user ? ` · ${event.user}` : ""}
                    {event.note ? ` · ${event.note}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </ToneScope>
  );
}
