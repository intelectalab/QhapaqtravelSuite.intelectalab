"use client";

import { AlarmClock, Ban, CalendarClock, CircleCheck, Landmark, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import type { PaymentMethodOption, ReceivableRow, ReceivablesOverview } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";
import { statusLabel } from "@/lib/tone";
import { FinanceStep, SummaryBox } from "./FinanceStep";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

function PaymentFields({ row, methods, today, usdRate }: { row: ReceivableRow; methods: PaymentMethodOption[]; today: string; usdRate: number }) {
  const [method, setMethod] = useState(methods[0]?.value ?? "");
  const selected = methods.find((option) => option.value === method);
  return (
    <>
      <SummaryBox
        rows={[
          { label: "Cuota", value: `${row.code} · ${row.concept}` },
          { label: "Cliente", value: row.client.name },
          { label: "Saldo pendiente", value: formatMoney(row.balance, row.currency), strong: true },
        ]}
      />
      <SelectField label="Medio de pago" name="method" options={methods.map(({ value, label }) => ({ value, label }))} defaultValue={method} onChange={setMethod} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label={`Monto (${row.currency})`} name="amount" type="number" step="0.01" min="0.01" max={row.balance} required defaultValue={row.balance.toFixed(2)} />
        <TextField label="Fecha del pago" name="paid_on" type="date" required max={today} defaultValue={today} />
      </div>
      <TextField
        label={selected?.requires_reference ? "Número de operación" : "Número de operación (opcional)"}
        name="reference"
        required={selected?.requires_reference}
        maxLength={80}
        placeholder={selected?.b2b ? "Se descuenta de la línea de crédito de la agencia" : "OP 00918273"}
      />
      {row.currency !== "PEN" && <TextField label="Tipo de cambio" name="fx_rate" type="number" step="0.0001" min="0.5" max="20" defaultValue={String(row.fx_rate ?? usdRate)} hint="Se conserva en el pago para consolidar en soles." />}
      <TextArea label="Observación (opcional)" name="note" rows={3} maxLength={500} />
    </>
  );
}

export function RegisterPaymentAction({ row, methods, today, usdRate }: { row: ReceivableRow; methods: PaymentMethodOption[]; today: string; usdRate: number }) {
  return (
    <FinanceStep
      step="receivable_payment"
      itemKey={row.code}
      label="Registrar pago"
      title="Registrar pago"
      description="Se registra confirmado y se aplica a esta cuota en la misma operación."
      submitLabel="Registrar y aplicar"
      trigger={(open) => <RowIcon tone="edit" label="Registrar pago" icon={<Wallet size={15} />} onClick={open} />}
    >
      <PaymentFields row={row} methods={methods} today={today} usdRate={usdRate} />
    </FinanceStep>
  );
}

export function CancelReceivableAction({ row }: { row: ReceivableRow }) {
  return (
    <FinanceStep
      step="receivable_cancel"
      itemKey={row.code}
      label="Anular cuota"
      title="Anular cuota"
      description="La cuota deja de exigirse y sale de los saldos por cobrar. Queda en el historial con su motivo."
      submitLabel="Anular cuota"
      trigger={(open) => <RowIcon tone="delete" label="Anular cuota" icon={<Ban size={15} />} onClick={open} />}
    >
      <SummaryBox
        rows={[
          { label: "Cuota", value: `${row.code} · ${row.concept}` },
          { label: "Pagado", value: formatMoney(row.paid, row.currency) },
          { label: "Saldo que se anula", value: formatMoney(row.balance, row.currency), strong: true },
        ]}
      />
      <TextArea label="Motivo" name="reason" rows={4} required minLength={5} maxLength={500} placeholder="Ejemplo: el cliente redujo el número de pasajeros y se emitió una nueva cuota." />
    </FinanceStep>
  );
}

export function ReceivablesTable({ data }: { data: ReceivablesOverview }) {
  const { rows, methods, today, usd_rate: usdRate, can } = data;
  const week = new Date(`${today}T12:00:00`);
  week.setDate(week.getDate() + 7);
  const weekIso = week.toISOString().slice(0, 10);
  const closed = (row: ReceivableRow) => row.status === "pagada" || row.status === "cancelada";

  const columns: Column<ReceivableRow>[] = [
    {
      id: "receivable",
      header: "Cuota",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <span className="font-semibold">{row.concept}</span>
          <small className="block text-xs text-fg-3">
            {row.code} · {row.client.name}
          </small>
        </div>
      ),
    },
    {
      id: "reservation",
      header: "Reserva",
      cell: (row) => (
        <Link href={`/reservas/${row.reservation.code}`} className="text-[13px] hover:underline">
          {row.reservation.code}
          <span className="block max-w-[220px] truncate text-xs text-fg-3">{row.reservation.title}</span>
        </Link>
      ),
    },
    {
      id: "due",
      header: "Vence",
      cell: (row) => (
        <span className={cn("text-[13px]", row.status === "vencida" && "font-semibold text-bad")}>
          {formatDate(row.due_date)}
          {row.days_overdue > 0 && <span className="block text-xs font-normal">{row.days_overdue === 1 ? "1 día de atraso" : `${row.days_overdue} días de atraso`}</span>}
        </span>
      ),
    },
    { id: "amount", header: "Importe", align: "right", cell: (row) => <span className="font-mono text-[13px]">{formatMoney(row.amount, row.currency)}</span> },
    {
      id: "balance",
      header: "Saldo",
      align: "right",
      cell: (row) =>
        row.balance > 0 ? (
          <span className="font-mono text-[13px] font-semibold" title={row.currency === "PEN" ? undefined : `${formatMoney(row.balance_pen)} al tipo de cambio de la cuota`}>
            {formatMoney(row.balance, row.currency)}
          </span>
        ) : (
          <span className="text-[12.5px] text-fg-3">—</span>
        ),
    },
    { id: "status", header: "Estado", cell: (row) => <StatusBadge status={row.status} /> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => (
        <RowActions>
          <RowIcon tone="view" label="Ver reserva" href={`/reservas/${row.reservation.code}`} />
          {can.register && (closed(row) ? <RowIcon tone="edit" label="Registrar pago" icon={<Wallet size={15} />} disabledHint={row.status === "pagada" ? "La cuota ya está pagada" : "La cuota está anulada"} /> : <RegisterPaymentAction row={row} methods={methods} today={today} usdRate={usdRate} />)}
          {can.cancel && (closed(row) ? <RowIcon tone="delete" label="Anular cuota" icon={<Ban size={15} />} disabledHint={row.status === "pagada" ? "Una cuota pagada no se anula" : "Ya está anulada"} /> : <CancelReceivableAction row={row} />)}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<ReceivableRow>[] = [
    { id: "overdue", label: "Vencidas", tone: "bad", icon: <AlarmClock size={19} />, matches: (row) => row.status === "vencida" },
    { id: "week", label: "Vencen en 7 días", tone: "warn", icon: <CalendarClock size={19} />, matches: (row) => !closed(row) && row.status !== "vencida" && row.due_date <= weekIso },
    { id: "open", label: "Con saldo", tone: "t1", icon: <Landmark size={19} />, matches: (row) => !closed(row) },
    { id: "paid", label: "Pagadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "pagada" },
  ];

  const filters: FilterConfig<ReceivableRow>[] = [
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.status)).map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
    { id: "currency", label: "Moneda", options: unique(rows.map((row) => row.currency)).map((value) => ({ value, label: value })), value: (row) => row.currency },
  ];

  const sorts: SortOption<ReceivableRow>[] = [
    { id: "due", label: "Vencimiento", type: "date", value: (row) => row.due_date },
    { id: "balance", label: "Saldo en soles", type: "number", value: (row) => row.balance_pen },
    { id: "client", label: "Cliente", value: (row) => row.client.name },
  ];

  return (
    <DataTable
      screen="finanzas-cobros"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="cuotas"
      searchText={(row) => `${row.code} ${row.concept} ${row.client.name} ${row.reservation.code}`}
      searchPlaceholder="Buscar cuota, cliente o reserva"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
