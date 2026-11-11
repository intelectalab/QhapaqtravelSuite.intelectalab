import { Building2, CircleCheck, CircleX, CreditCard, FileMinus, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { HeroBand, HeroChip, HeroPanel, SOFT_TINT, TintCardTitle, ToneScope } from "@/components/ui/Tinted";
import { ManualPaymentAction, PaymentLinkAction, ResendInvoiceAction, RetryChargeAction, VoidInvoiceAction } from "@/features/platform/InvoiceActions";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { ATTEMPT_SOURCE, INVOICE_STATUS, isCollectible, SUBSCRIPTION_STATUS, SUNAT_STATUS } from "@/lib/platformBilling";
import { getPlatformInvoice } from "@/lib/server/platformConsole";

export async function generateMetadata({ params }: PageProps<"/plataforma/facturacion/facturas/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await getPlatformInvoice(id)).number };
}

export default async function FacturaPage({ params }: PageProps<"/plataforma/facturacion/facturas/[id]">) {
  const { id } = await params;
  const invoice = await getPlatformInvoice(id);
  const status = INVOICE_STATUS[invoice.status];
  const target = { ...invoice, credit_note: invoice.credit_note?.number ?? null, attempts: invoice.attempts.length };

  return (
    <ToneScope tone={status.tone === "mute" ? "t1" : status.tone}>
      <PageHeader
        back={{ href: "/plataforma/facturacion/facturas", label: "Facturas" }}
        jump={false}
        title={invoice.number}
        info={
          <span className="ml-2 flex-none">
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        }
        subtitle={`Emitida el ${formatDate(invoice.issue_date)} · vence el ${formatDate(invoice.due_date)}`}
        actions={
          <>
            {isCollectible(invoice) && <RetryChargeAction invoice={target} />}
            {isCollectible(invoice) && <ManualPaymentAction invoice={target} />}
            {isCollectible(invoice) && <PaymentLinkAction invoice={target} />}
            <ResendInvoiceAction invoice={target} />
            {invoice.status !== "void" && <VoidInvoiceAction invoice={target} />}
          </>
        }
      />

      <HeroBand>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-[13px] font-medium text-white/70">Total con IGV</p>
            <p className="mt-1 text-[40px] font-bold leading-none tracking-[-0.03em]">{formatMoney(invoice.total, invoice.currency)}</p>
            <p className="mt-2 text-[13.5px] text-white/75">
              Periodo del {formatDate(invoice.period_from)} al {formatDate(invoice.period_to)}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <HeroChip icon={<ReceiptText size={14} />}>{SUNAT_STATUS[invoice.sunat_status]?.label ?? invoice.sunat_status}</HeroChip>
              <HeroChip icon={<CreditCard size={14} />}>{SUBSCRIPTION_STATUS[invoice.subscription_status]?.label ?? invoice.subscription_status}</HeroChip>
            </div>
          </div>
          <HeroPanel>
            <Link href={`/plataforma/agencias/${invoice.tenant.code}`} className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold hover:underline">
              <Building2 size={15} />
              {invoice.tenant.name}
            </Link>
            <dl className="grid gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
              <Fact label="Razón social" value={invoice.bill_to.name} />
              <Fact label="RUC" value={invoice.bill_to.ruc} />
              <Fact label="Domicilio" value={invoice.bill_to.address} />
              <Fact label={invoice.paid_at ? "Pagada" : "Medio"} value={invoice.paid_at ? `${formatDateTime(invoice.paid_at)} · ${invoice.payment_ref ?? ""}` : (invoice.payment_ref ?? "Sin medio registrado")} />
            </dl>
          </HeroPanel>
        </div>
      </HeroBand>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <TintCardTitle icon={ReceiptText} title="Detalle" aside={`IGV ${invoice.igv_pct} %`} />
          <ul className="flex flex-col">
            {invoice.lines.map((line) => (
              <li key={line.description} className="flex items-start justify-between gap-4 border-t border-line-2 py-2.5 text-[13.5px] first:border-t-0">
                <span className="min-w-0">
                  {line.description}
                  {line.quantity !== 1 && <small className="block text-xs text-fg-3">{line.quantity} × {formatMoney(line.unit_price, invoice.currency)}</small>}
                </span>
                <span className={cn("font-mono font-semibold", line.amount < 0 && "text-ok")}>{formatMoney(line.amount, invoice.currency)}</span>
              </li>
            ))}
          </ul>
          <dl className={cn("mt-3 grid gap-1.5 rounded-[12px] px-4 py-3 text-[13.5px]", SOFT_TINT)}>
            <Row label="Subtotal" value={formatMoney(invoice.subtotal, invoice.currency)} />
            <Row label={`IGV ${invoice.igv_pct} %`} value={formatMoney(invoice.igv, invoice.currency)} />
            <Row label="Total" value={formatMoney(invoice.total, invoice.currency)} strong />
          </dl>
          {invoice.credit_note && (
            <div className="mt-4 flex items-start gap-3 rounded-[12px] border border-line px-4 py-3 text-[13.5px]">
              <FileMinus size={18} className="mt-0.5 flex-none text-bad" />
              <p>
                <b className="font-semibold">Nota de crédito {invoice.credit_note.number}</b> por {formatMoney(invoice.credit_note.amount, invoice.currency)} el {formatDate(invoice.credit_note.at)}.
                <span className="block text-fg-2">{invoice.credit_note.reason}</span>
                {invoice.credit_note.refund_ref && <span className="block text-xs text-fg-3">{invoice.credit_note.refund_ref}</span>}
              </p>
            </div>
          )}
        </Card>

        <Card>
          <TintCardTitle icon={CreditCard} title="Intentos de cobro" aside={String(invoice.attempts.length)} />
          {invoice.attempts.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">Todavía no se intentó cobrar esta factura.</p>
          ) : (
            <ol className="relative flex flex-col gap-1 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
              {invoice.attempts.map((attempt, index) => {
                const ok = attempt.result === "succeeded";
                return (
                  <li key={attempt.number} className="group relative grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-x-3 rounded-[12px] px-1 py-2 transition-colors hover:bg-surface-2 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 60}ms` }}>
                    <ToneScope tone={ok ? "ok" : "bad"}>
                      <span className="relative grid h-8 w-8 place-items-center rounded-full bg-[var(--tint)] text-white ring-4 ring-surface transition-transform duration-300 group-hover:scale-110">{ok ? <CircleCheck size={15} /> : <CircleX size={15} />}</span>
                    </ToneScope>
                    <span className="min-w-0 pt-0.5">
                      <b className="block text-[13.5px] font-semibold">{ATTEMPT_SOURCE[attempt.source] ?? attempt.source}</b>
                      <span className="block text-[12.5px] text-fg-2">{attempt.message}</span>
                    </span>
                    <span className="pt-0.5 text-right text-xs text-fg-3">
                      {formatDateTime(attempt.at)}
                      {attempt.code && <span className="block font-mono">{attempt.code}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </ToneScope>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-white/60">{label}</dt>
      <dd className="truncate font-medium text-white/95" title={value}>
        {value}
      </dd>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong && "border-t border-line pt-1.5 text-[15px] font-bold")}>
      <dt className={strong ? undefined : "text-fg-2"}>{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
