"use client";

import { AlarmClock, BadgeCheck, Hourglass, ReceiptText, Send, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { PanelActionState } from "@/components/ui/PanelAction";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { reportPayment } from "@/app/(portal)/portal/actions";
import { MoneyLines } from "@/features/channels/ChannelUi";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { PortalBilling, PortalInstallment } from "@/lib/portal";
import { toneStyle } from "@/lib/tone";
import { EmptyLine, PortalBadge, PortalTitle, RISE, rise, SectionCard } from "./PortalUi";

const initial: PanelActionState = { message: null, done: false };

function ReportPanel({ row, methods, today }: { row: PortalInstallment; methods: PortalBilling["methods"]; today: string }) {
  const [method, setMethod] = useState("");
  const available = Math.max(0, row.balance - (row.reported ?? 0));
  const needsReference = methods.find((item) => item.value === method)?.requires_reference ?? true;
  return (
    <PanelAction
      label="Reportar pago"
      icon={<Send size={15} />}
      variant="primary"
      size="sm"
      formId={`pago-${row.code}`}
      title="Reportar un pago"
      description={`${row.concept} · saldo ${formatMoney(available, row.currency)}`}
      submitLabel="Enviar para validación"
      action={reportPayment.bind(null, row.code)}
      initial={initial}
    >
      {() => (
        <>
          <p className="rounded-tile bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">La agencia valida tu pago con el banco y lo verás acreditado en uno o dos días hábiles. Puedes pagar en partes.</p>
          <TextField label={`Monto pagado (${row.currency})`} name="amount" type="number" step="0.01" min="0.01" max={available} defaultValue={available.toFixed(2)} required />
          <SelectField label="Medio de pago" name="method" placeholder="Elige cómo pagaste" options={methods.map((item) => ({ value: item.value, label: item.label }))} onChange={setMethod} />
          <TextField label="Número de operación" name="reference" maxLength={60} required={needsReference} hint="Lo encuentras en la constancia de tu banco o billetera." />
          <TextField label="Fecha del pago" name="paid_on" type="date" defaultValue={today} max={today} />
          <TextArea label="Comentario" name="note" rows={3} maxLength={500} placeholder="Opcional" />
        </>
      )}
    </PanelAction>
  );
}

export function PortalPayments({ billing }: { billing: PortalBilling }) {
  const overdue = billing.installments.filter((row) => row.overdue);
  const reported = billing.payments.filter((row) => row.status === "pendiente");
  const paid = billing.payments.filter((row) => ["aplicado", "confirmado"].includes(row.status));

  return (
    <>
      <PortalTitle title="Pagos" subtitle="Tus cuotas, lo que ya pagaste y lo que está en validación." />
      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={Wallet} tone="t2" label="Saldo pendiente" value={<MoneyLines values={billing.balance} empty="Al día" />} note="Puedes pagar en partes" />
        <TintTile icon={AlarmClock} tone={overdue.length ? "bad" : "ok"} label="Cuotas vencidas" value={overdue.length} note={overdue.length ? "Regulariza para no perder espacios" : "Ninguna"} />
        <TintTile icon={Hourglass} tone="info" label="En validación" value={reported.length} note="Pagos que reportaste" />
        <TintTile icon={BadgeCheck} tone="ok" label="Pagos acreditados" value={paid.length} note="Confirmados por la agencia" />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <SectionCard icon={ReceiptText} title="Cuotas" aside={billing.installments.length}>
          {billing.installments.length === 0 ? (
            <EmptyLine>No tienes cuotas por pagar.</EmptyLine>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {billing.installments.map((row, index) => {
                const available = row.balance - (row.reported ?? 0);
                const pct = row.amount ? Math.round((row.paid / row.amount) * 100) : 0;
                return (
                  <li key={row.code} style={{ ...toneStyle(row.overdue ? "bad" : row.balance > 0 ? "t2" : "ok"), ...rise(index) }} className={cn("lift relative overflow-hidden rounded-tile border border-line bg-surface py-3 pl-5 pr-4", RISE)}>
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-[var(--tint)]" />
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <b className="block text-[14px] font-semibold">{row.concept}</b>
                        <Link href={`/portal/viajes/${row.reservation}`} className="text-[12px] text-fg-3 transition hover:text-t1">
                          {row.reservation_title ?? row.reservation}
                        </Link>
                      </div>
                      <PortalBadge status={row.overdue ? "vencida" : row.status} />
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-fg-2">
                          <span>
                            Cuota <b className="text-fg">{formatMoney(row.amount, row.currency)}</b>
                          </span>
                          <span>
                            Saldo <b className="text-fg">{formatMoney(row.balance, row.currency)}</b>
                          </span>
                          <span className={cn(row.overdue && "font-semibold text-bad")}>Vence {formatDate(row.due_date)}</span>
                        </div>
                        <span className="mt-2 block h-1.5 w-full max-w-[320px] overflow-hidden rounded-full bg-surface-2" title={`${pct} % pagado`}>
                          <span className="block h-full origin-left rounded-full bg-ok motion-safe:animate-[fill-x_700ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${Math.max(3, pct)}%` }} />
                        </span>
                        {!!row.reported && <p className="mt-1.5 text-[12px] font-medium text-info">{formatMoney(row.reported, row.currency)} en validación</p>}
                      </div>
                      {available > 0.004 && <ReportPanel row={row} methods={billing.methods} today={billing.today} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard icon={BadgeCheck} title="Pagos registrados" aside={billing.payments.length}>
          {billing.payments.length === 0 ? (
            <EmptyLine>Aún no registras pagos.</EmptyLine>
          ) : (
            <ul className="flex flex-col gap-2">
              {billing.payments.map((row, index) => (
                <li key={row.code} style={rise(index)} className={cn("lift flex items-center justify-between gap-3 rounded-tile border border-line bg-surface px-3.5 py-2.5", RISE)}>
                  <span className="min-w-0">
                    <b className="block text-[13.5px] font-semibold">{formatMoney(row.amount, row.currency)}</b>
                    <span className="block truncate text-[12px] text-fg-3">
                      {row.method} · {formatDate(row.paid_on)}
                      {row.reference ? ` · ${row.reference}` : ""}
                    </span>
                    {row.reject_reason && <span className="block text-[12px] text-bad">{row.reject_reason}</span>}
                  </span>
                  <PortalBadge status={row.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
