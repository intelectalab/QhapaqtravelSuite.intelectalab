"use client";

import { CircleCheck, CircleX, Hourglass, Landmark, Paperclip, RotateCcw, Undo2 } from "lucide-react";
import { PAYMENTS_CSV } from "@/lib/finance-csv";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { cn } from "@/lib/cn";
import type { PaymentRow, PaymentsOverview, TransferProofState } from "@/lib/finance";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { statusLabel } from "@/lib/tone";
import { FinanceStep, SummaryBox, type StepButton } from "./FinanceStep";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

function paymentSummary(row: PaymentRow) {
  return [
    { label: "Pago", value: `${row.code} · ${row.method}` },
    { label: "Reserva", value: `${row.reservation.code}${row.client ? ` · ${row.client}` : ""}` },
    { label: "Referencia", value: row.reference ?? "Sin referencia" },
    { label: "Monto", value: formatMoney(row.amount, row.currency), strong: true },
  ];
}

export function ConfirmPaymentAction({ row }: { row: PaymentRow }) {
  if (row.kind === "reembolso") {
    return (
      <FinanceStep
        step="payment_confirm"
        itemKey={row.code}
        label="Registrar reembolso hecho"
        title="Registrar reembolso hecho"
        description="Márcalo cuando la devolución al cliente ya salió del banco. No se aplica a ninguna cuota."
        submitLabel="Registrar"
        trigger={(open) => <RowIcon tone="edit" label="Registrar reembolso hecho" icon={<CircleCheck size={15} />} onClick={open} />}
      >
        <SummaryBox rows={paymentSummary(row)} />
      </FinanceStep>
    );
  }
  const options = row.apply_to.map((option) => ({ value: option.code, label: `${option.code} · ${option.concept} · saldo ${formatMoney(option.balance, row.currency)}` }));
  return (
    <FinanceStep
      step="payment_confirm"
      itemKey={row.code}
      label={row.status === "pendiente" ? "Validar pago" : "Aplicar a una cuota"}
      title={row.status === "pendiente" ? "Validar pago" : "Aplicar a una cuota"}
      description={row.status === "pendiente" ? "Confírmalo cuando el abono figure en el banco. Si eliges una cuota, se aplica en el mismo paso." : "El pago ya está confirmado; elige la cuota que salda."}
      submitLabel={row.status === "pendiente" ? "Confirmar" : "Aplicar"}
      trigger={(open) => <RowIcon tone="edit" label={row.status === "pendiente" ? "Validar pago" : "Aplicar a una cuota"} icon={<CircleCheck size={15} />} onClick={open} />}
    >
      <SummaryBox rows={paymentSummary(row)} />
      {row.bank_line ? (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] px-3.5 py-2.5 text-[12.5px] text-ok">El abono figura en el extracto ({row.bank_line}).</p>
      ) : (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 py-2.5 text-[12.5px] text-fg-2">Aún no hay una línea del extracto vinculada a este pago. Verifícalo en el banco antes de confirmar.</p>
      )}
      {options.length > 0 ? (
        <SelectField label={row.status === "pendiente" ? "Aplicar a la cuota (opcional)" : "Cuota"} name="receivable" options={row.status === "pendiente" ? [{ value: "", label: "Solo confirmar, aplicar después" }, ...options] : options} defaultValue={row.status === "pendiente" ? "" : options[0].value} />
      ) : (
        <p className="text-[12.5px] text-fg-3">No hay cuotas de esta reserva con saldo suficiente en {row.currency}; el pago quedará confirmado por aplicar.</p>
      )}
    </FinanceStep>
  );
}

function ReasonStep({ row, step, label, title, description, submitLabel, icon, tone }: { row: PaymentRow; step: string; label: string; title: string; description: string; submitLabel: string; icon: ReactNode; tone: "delete" | "neutral" }) {
  return (
    <FinanceStep step={step} itemKey={row.code} label={label} title={title} description={description} submitLabel={submitLabel} trigger={(open) => <RowIcon tone={tone} label={label} icon={icon} onClick={open} />}>
      <input type="hidden" name="lock_version" value={row.lock_version} />
      <SummaryBox rows={paymentSummary(row)} />
      {step === "payment_revert" &&
        (row.application ? (
          <SummaryBox
            rows={[
              { label: "Cuota afectada", value: row.application.receivable },
              { label: "Saldo de la cuota hoy", value: formatMoney(row.application.balance_before, row.currency) },
              { label: "Saldo tras revertir", value: formatMoney(row.application.balance_after, row.currency), strong: true },
            ]}
          />
        ) : (
          <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-fg-3">El pago no está aplicado a ninguna cuota: ningún saldo cambia.</p>
        ))}
      <TextArea label="Motivo" name="reason" rows={4} required minLength={5} maxLength={500} />
    </FinanceStep>
  );
}

export function RetryPaymentAction({ code, lockVersion, retries, summary, trigger, button }: { code: string; lockVersion: number; retries: number; summary: { label: string; value: ReactNode; strong?: boolean }[]; trigger?: (open: () => void) => ReactNode; button?: StepButton }) {
  return (
    <FinanceStep button={button} step="payment_retry" itemKey={code} label="Reintentar validación" title="Reintentar validación" description="El pago vuelve a pendiente para validarlo otra vez, por ejemplo cuando el cliente reenvía la constancia." submitLabel="Volver a pendiente" trigger={trigger ?? ((open) => <RowIcon tone="neutral" label="Reintentar validación" icon={<RotateCcw size={15} />} onClick={open} />)}>
      <input type="hidden" name="lock_version" value={lockVersion} />
      <SummaryBox rows={[...summary, { label: "Intentos previos", value: retries }]} />
      <TextArea label="Nota (opcional)" name="note" rows={3} maxLength={500} placeholder="Ejemplo: el cliente envió la constancia correcta" />
    </FinanceStep>
  );
}

export function businessTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function ProofTag({ code, proof }: { code: string; proof: TransferProofState }) {
  return (
    <a
      href={`/finanzas/pagos/${encodeURIComponent(code)}/constancia`}
      target="_blank"
      rel="noopener noreferrer"
      title={`${proof.file_name} · subida el ${formatDateTime(proof.uploaded_at, false)}${proof.escalated ? " · escalada a Gerencia" : ""}`}
      className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold transition hover:brightness-110", proof.escalated ? "bg-[color-mix(in_srgb,var(--bad)_12%,transparent)] text-bad" : "bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-info")}
    >
      <Paperclip size={12} />
      Constancia · {businessTime(proof.business_minutes)} hábiles
    </a>
  );
}

const PROOF_RANK = { escalada: 0, recordada: 1, recibida: 2 } as const;

function proofFirst(rows: PaymentRow[]): PaymentRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const rank = (row: PaymentRow) => (row.proof ? PROOF_RANK[row.proof.stage] : 3);
      return rank(a.row) - rank(b.row) || (a.row.proof && b.row.proof ? b.row.proof.business_minutes - a.row.proof.business_minutes : 0) || a.index - b.index;
    })
    .map(({ row }) => row);
}

export function PaymentsTable({ data }: { data: PaymentsOverview }) {
  const { can } = data;
  const rows = proofFirst(data.rows);
  const [monthStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });

  const columns: Column<PaymentRow>[] = [
    {
      id: "payment",
      header: "Pago",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <span className="font-semibold">{row.method}</span>
          <small className="block text-xs text-fg-3">
            {row.code} · {row.reference ?? "Sin referencia"}
          </small>
        </div>
      ),
    },
    {
      id: "reservation",
      header: "Reserva",
      cell: (row) => (
        <Link href={`/reservas/${row.reservation.code}`} className="text-[13px] hover:underline">
          {row.client ?? row.reservation.code}
          <span className="block text-xs text-fg-3">
            {row.reservation.code}
            {row.receivable ? ` · ${row.receivable}` : row.kind === "reembolso" ? " · reembolso" : ""}
          </span>
        </Link>
      ),
    },
    { id: "date", header: "Fecha", cell: (row) => <span className="text-[13px]">{formatDate(row.paid_on)}</span> },
    {
      id: "amount",
      header: "Monto",
      align: "right",
      cell: (row) => (
        <span className="font-mono text-[13px] font-semibold" title={row.currency === "PEN" ? undefined : `${formatMoney(row.pen)} al tipo de cambio ${row.fx_rate ?? ""}`}>
          {formatMoney(row.amount, row.currency)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="grid justify-items-start gap-0.5" title={row.reason ?? undefined}>
          <StatusBadge status={row.status} />
          {row.reason && <span className="max-w-[200px] truncate text-[11.5px] text-fg-3">{row.reason}</span>}
          {row.proof && <ProofTag code={row.code} proof={row.proof} />}
        </span>
      ),
    },
    { id: "by", header: "Registró", wideOnly: true, cell: (row) => <span className="text-[13px] text-fg-2">{row.registered_by}</span> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => {
        const validable = row.status === "pendiente" || (row.kind !== "reembolso" && row.status === "confirmado" && row.apply_to.length > 0);
        const revertible = row.status === "confirmado" || row.status === "aplicado";
        return (
          <RowActions>
            <RowIcon tone="view" label="Ver pago" href={`/finanzas/pagos/${row.code}`} />
            {can.validate && (validable ? <ConfirmPaymentAction row={row} /> : <RowIcon tone="edit" label="Validar" icon={<CircleCheck size={15} />} disabledHint="Solo se validan pagos pendientes" />)}
            {can.validate && row.status === "rechazado" && <RetryPaymentAction code={row.code} lockVersion={row.lock_version} retries={row.retries} summary={paymentSummary(row)} />}
            {can.validate && row.status === "pendiente" && <ReasonStep row={row} step="payment_reject" label="Rechazar" title="Rechazar pago" description="La cuota se mantiene con su saldo y el pago queda como rechazado." submitLabel="Rechazar pago" icon={<CircleX size={15} />} tone="delete" />}
            {can.revert && (revertible ? <ReasonStep row={row} step="payment_revert" label="Revertir" title="Revertir pago" description="Se desaplica de la cuota y su saldo vuelve a quedar pendiente. Es definitivo." submitLabel="Revertir pago" icon={<Undo2 size={15} />} tone="delete" /> : row.status !== "pendiente" && <RowIcon tone="delete" label="Revertir" icon={<Undo2 size={15} />} disabledHint={`Un pago ${statusLabel(row.status).toLowerCase()} no se revierte`} />)}
          </RowActions>
        );
      },
    },
  ];

  const { kpis } = data;
  const rejectedPen = data.rows.filter((row) => row.status === "rechazado").reduce((sum, row) => sum + row.pen, 0);
  const metrics: MetricFilter<PaymentRow>[] = [
    { id: "pending", label: "Por validar", tone: "warn", icon: <Hourglass size={19} />, display: formatMoney(kpis.pending_pen, "PEN", { compact: true }), note: `${kpis.pending_count === 1 ? "1 pago espera" : `${kpis.pending_count} pagos esperan`} confirmarse en el banco`, info: <p>Monto en soles de los pagos de clientes reportados que aún no se validan contra el banco.</p>, matches: (row) => row.kind === "cobro" && row.status === "pendiente" },
    { id: "applied", label: "Aplicado este mes", tone: "ok", icon: <CircleCheck size={19} />, display: formatMoney(kpis.applied_month_pen, "PEN", { compact: true }), note: `${kpis.applied_month_count === 1 ? "1 pago" : `${kpis.applied_month_count} pagos`} · ${kpis.to_apply_count ?? 0} por aplicar`, info: <p>Pagos aplicados a una cuota con fecha desde el día 1 del mes. «Por aplicar» cuenta los pagos ya confirmados que aún no saldan ninguna cuota.</p>, matches: (row) => row.status === "aplicado" && row.paid_on >= monthStart },
    { id: "unmatched", label: "Sin línea de banco", tone: "t1", icon: <Landmark size={19} />, info: <p>Pagos vigentes que todavía no se emparejan con un movimiento del extracto bancario en Conciliación.</p>, matches: (row) => !row.bank_line && row.status !== "revertido" && row.status !== "rechazado" },
    { id: "reverted", label: "Revertidos", tone: "bad", icon: <Undo2 size={19} />, display: formatMoney(kpis.reverted_pen, "PEN", { compact: true }), note: `${kpis.reverted_count === 1 ? "1 pago desaplicado" : `${kpis.reverted_count} pagos desaplicados`} de su cuota`, info: <p>Monto de los pagos revertidos: dejaron de contar en el saldo de su cuota.</p>, matches: (row) => row.status === "revertido" },
    { id: "rejected", label: "Rechazados", tone: "mute", icon: <CircleX size={19} />, display: formatMoney(rejectedPen, "PEN", { compact: true }), note: `${kpis.rejected_count === 1 ? "1 pago" : `${kpis.rejected_count} pagos`} · se pueden reintentar`, info: <p>Monto de los pagos rechazados al validar. Con una nueva constancia vuelven a pendiente con Reintentar validación.</p>, matches: (row) => row.status === "rechazado" },
  ];

  const filters: FilterConfig<PaymentRow>[] = [
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.status)).map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
    { id: "method", label: "Medio", options: unique(rows.map((row) => row.method)).map((value) => ({ value, label: value })), value: (row) => row.method },
  ];

  const sorts: SortOption<PaymentRow>[] = [
    { id: "date", label: "Fecha", type: "date", value: (row) => row.paid_on },
    { id: "amount", label: "Monto en soles", type: "number", value: (row) => row.pen },
  ];

  return (
    <DataTable
      screen="finanzas-pagos"
      csv={PAYMENTS_CSV}
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="pagos"
      searchText={(row) => `${row.code} ${row.method} ${row.reference ?? ""} ${row.client ?? ""} ${row.reservation.code}`}
      searchPlaceholder="Buscar pago, referencia o cliente"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
