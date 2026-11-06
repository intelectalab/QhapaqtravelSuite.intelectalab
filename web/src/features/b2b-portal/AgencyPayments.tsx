"use client";

import { Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { PanelActionState } from "@/components/ui/PanelAction";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { reportPayment } from "@/app/(agencia)/agencia/actions";
import { EmptyLine, RISE, rise } from "@/features/portal/PortalUi";
import type { AgencyInstallment, AgencyPayment, PaymentMethodOption } from "@/lib/b2b-portal";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { toneStyle } from "@/lib/tone";
import { AgencyBadge } from "./AgencyUi";

const initial: PanelActionState = { message: null, done: false };

function ReportPanel({ row, methods, today }: { row: AgencyInstallment; methods: PaymentMethodOption[]; today: string }) {
  const [method, setMethod] = useState("");
  const available = Math.max(0, row.balance - row.reported);
  return (
    <PanelAction
      label="Informar pago"
      icon={<Send size={15} />}
      variant="primary"
      size="sm"
      formId={`pago-${row.code}`}
      title="Informar un pago"
      description={`${row.concept} · saldo ${formatMoney(available, row.currency)}`}
      submitLabel="Enviar a Finanzas"
      action={reportPayment.bind(null, row.code, row.reservation)}
      initial={initial}
    >
      {(state) => (
        <>
          <p className="rounded-tile bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">Finanzas valida el pago con el banco. Al aplicarlo se libera el crédito usado por esta reserva.</p>
          <TextField label={`Monto pagado (${row.currency})`} name="amount" type="number" step="0.01" min="0.01" max={available} defaultValue={available.toFixed(2)} required />
          <SelectField label="Medio de pago" name="method" placeholder="Elige el medio" options={methods.map((item) => ({ value: item.value, label: item.label }))} onChange={setMethod} />
          <TextField label="Número de operación" name="reference" minLength={3} maxLength={60} required hint={method ? "Lo encuentras en la constancia del banco." : undefined} />
          <TextField label="Fecha del pago" name="paid_on" type="date" defaultValue={today} max={today} />
          <TextArea label="Comentario" name="note" rows={3} maxLength={500} placeholder="Opcional" />
          {state.message && <p className="text-[13px] font-medium text-bad">{state.message}</p>}
        </>
      )}
    </PanelAction>
  );
}

export function InstallmentList({ rows, methods, today, linkReservation = false }: { rows: AgencyInstallment[]; methods: PaymentMethodOption[]; today: string; linkReservation?: boolean }) {
  if (rows.length === 0) return <EmptyLine>No hay cuotas registradas.</EmptyLine>;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row, index) => {
        const available = row.balance - row.reported;
        const pct = row.amount ? Math.round((row.paid / row.amount) * 100) : 0;
        return (
          <li key={row.code} style={{ ...toneStyle(row.overdue ? "bad" : row.balance > 0 ? "t2" : "ok"), ...rise(index) }} className={cn("lift relative overflow-hidden rounded-tile border border-line bg-surface py-3 pl-5 pr-4", RISE)}>
            <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-[var(--tint)]" />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <b className="block text-[14px] font-semibold">{row.concept}</b>
                {linkReservation && row.reservation && (
                  <Link href={`/agencia/reservas/${row.reservation}`} className="text-[12px] text-fg-3 transition hover:text-t3">
                    {row.reservation_title ?? row.reservation} · {row.reservation}
                  </Link>
                )}
              </div>
              <AgencyBadge status={row.overdue ? "vencida" : row.status} />
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
                {row.reported > 0 && <p className="mt-1.5 text-[12px] font-medium text-info">{formatMoney(row.reported, row.currency)} informado, en validación</p>}
              </div>
              {available > 0.004 && <ReportPanel row={row} methods={methods} today={today} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function PaymentList({ rows }: { rows: AgencyPayment[] }) {
  if (rows.length === 0) return <EmptyLine>Aún no hay pagos registrados.</EmptyLine>;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <li key={row.code} style={rise(index)} className={cn("lift flex items-center justify-between gap-3 rounded-tile border border-line bg-surface px-3.5 py-2.5", RISE)}>
          <span className="min-w-0">
            <b className="block text-[13.5px] font-semibold">{formatMoney(row.amount, row.currency)}</b>
            <span className="block truncate text-[12px] text-fg-3">
              {row.method} · {formatDate(row.paid_on)}
              {row.reference ? ` · ${row.reference}` : ""}
              {row.reservation ? ` · ${row.reservation}` : ""}
            </span>
            {row.reject_reason && <span className="block text-[12px] text-bad">{row.reject_reason}</span>}
          </span>
          <AgencyBadge status={row.status} />
        </li>
      ))}
    </ul>
  );
}
