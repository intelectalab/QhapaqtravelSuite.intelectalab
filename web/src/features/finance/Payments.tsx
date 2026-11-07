"use client";

import { CircleCheck, CircleX, Hourglass, Landmark, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import type { PaymentRow, PaymentsOverview } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";
import { statusLabel } from "@/lib/tone";
import { FinanceStep, SummaryBox } from "./FinanceStep";

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
      <TextArea label="Motivo" name="reason" rows={4} required minLength={5} maxLength={500} />
    </FinanceStep>
  );
}

export function PaymentsTable({ data }: { data: PaymentsOverview }) {
  const { rows, can } = data;

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
        const validable = row.status === "pendiente" || (row.status === "confirmado" && row.apply_to.length > 0);
        const revertible = row.status === "confirmado" || row.status === "aplicado";
        return (
          <RowActions>
            <RowIcon tone="view" label="Ver reserva" href={`/reservas/${row.reservation.code}`} />
            {can.validate && (validable ? <ConfirmPaymentAction row={row} /> : <RowIcon tone="edit" label="Validar" icon={<CircleCheck size={15} />} disabledHint="Solo se validan pagos pendientes" />)}
            {can.validate && row.status === "pendiente" && <ReasonStep row={row} step="payment_reject" label="Rechazar" title="Rechazar pago" description="La cuota se mantiene con su saldo y el pago queda como rechazado." submitLabel="Rechazar pago" icon={<CircleX size={15} />} tone="delete" />}
            {can.revert && (revertible ? <ReasonStep row={row} step="payment_revert" label="Revertir" title="Revertir pago" description="Se desaplica de la cuota y su saldo vuelve a quedar pendiente. Es definitivo." submitLabel="Revertir pago" icon={<Undo2 size={15} />} tone="delete" /> : row.status !== "pendiente" && <RowIcon tone="delete" label="Revertir" icon={<Undo2 size={15} />} disabledHint={`Un pago ${statusLabel(row.status).toLowerCase()} no se revierte`} />)}
          </RowActions>
        );
      },
    },
  ];

  const metrics: MetricFilter<PaymentRow>[] = [
    { id: "pending", label: "Por validar", tone: "warn", icon: <Hourglass size={19} />, matches: (row) => row.status === "pendiente" },
    { id: "applied", label: "Aplicados", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "aplicado" },
    { id: "unmatched", label: "Sin línea de banco", tone: "t1", icon: <Landmark size={19} />, matches: (row) => !row.bank_line && row.status !== "revertido" && row.status !== "rechazado" },
    { id: "reverted", label: "Revertidos o rechazados", tone: "bad", icon: <Undo2 size={19} />, matches: (row) => row.status === "revertido" || row.status === "rechazado" },
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
