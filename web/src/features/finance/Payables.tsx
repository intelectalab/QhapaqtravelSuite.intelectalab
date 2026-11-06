"use client";

import { AlarmClock, Ban, BadgeCheck, CircleCheck, FilePlus2, HandCoins, Stamp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import type { PayableRow, PayablesOverview } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";
import { statusLabel } from "@/lib/tone";
import { FinanceStep, SummaryBox } from "./FinanceStep";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

function payableSummary(row: PayableRow) {
  return [
    { label: "Obligación", value: `${row.code} · ${row.concept}` },
    { label: "Proveedor", value: row.provider.name },
    { label: "Saldo", value: formatMoney(row.balance, row.currency), strong: true },
  ];
}

function CostFields({ options, today, usdRate }: { options: PayablesOverview["options"]; today: string; usdRate: number }) {
  const [currency, setCurrency] = useState("PEN");
  return (
    <>
      <SelectField label="Reserva" name="reservation" options={options.reservations} placeholder="Elige la reserva" onChange={(value) => setCurrency(options.reservations.find((option) => option.value === value)?.currency ?? currency)} />
      <SelectField label="Proveedor" name="provider" options={options.providers} placeholder="Elige el proveedor" hint="Solo proveedores activos." />
      <SelectField label="Tipo de costo" name="cost_type" options={options.cost_types} defaultValue={options.cost_types[0]?.value} />
      <TextField label="Concepto" name="concept" required maxLength={255} placeholder="Ejemplo: traslado adicional aeropuerto por cambio de vuelo" />
      <ChoiceGroup key={currency} label="Moneda" name="currency" options={[{ value: "PEN", label: "Soles" }, { value: "USD", label: "Dólares" }]} defaultValue={currency} onChange={setCurrency} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Importe" name="amount" type="number" step="0.01" min="0.01" required />
        <TextField label="Vence" name="due_date" type="date" min={today} defaultValue={addDays(today, 15)} />
      </div>
      {currency === "USD" && <TextField label="Tipo de cambio" name="fx_rate" type="number" step="0.0001" min="0.5" max="20" defaultValue={String(usdRate)} />}
      <TextField label="Documento del proveedor (opcional)" name="supplier_doc" maxLength={30} placeholder="F001-000123" />
      <TextArea label="Sustento (opcional)" name="evidence" rows={3} maxLength={1000} />
      <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-2">El costo nace abierto y solo impacta la rentabilidad de la reserva cuando se aprueba.</p>
    </>
  );
}

export function CreateCostAction({ data }: { data: PayablesOverview }) {
  return (
    <FinanceStep step="payable_create" label="Registrar costo" icon={<FilePlus2 size={16} />} variant="primary" title="Registrar costo adicional" description="Un gasto no previsto de una reserva que se debe pagar a un proveedor." submitLabel="Registrar costo">
      <CostFields options={data.options} today={data.today} usdRate={data.usd_rate} />
    </FinanceStep>
  );
}

function EditPayableAction({ row }: { row: PayableRow }) {
  return (
    <FinanceStep step="payable_update" itemKey={row.code} label="Editar" title="Editar obligación" description={`${row.code} · ${row.provider.name}`} submitLabel="Guardar cambios" trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />}>
      <TextField label="Concepto" name="concept" required maxLength={255} defaultValue={row.concept} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label={`Importe (${row.currency})`} name="amount" type="number" step="0.01" min="0.01" defaultValue={row.amount.toFixed(2)} disabled={row.approved || row.paid > 0} hint={row.approved ? "Aprobada: el importe ya no cambia." : undefined} />
        <TextField label="Vence" name="due_date" type="date" required defaultValue={row.due_date} />
      </div>
      <TextField label="Documento del proveedor" name="supplier_doc" maxLength={30} defaultValue={row.supplier_doc ?? ""} placeholder="F001-000123" />
      <TextArea label="Sustento" name="evidence" rows={3} maxLength={1000} defaultValue={row.evidence ?? ""} />
    </FinanceStep>
  );
}

function ApprovePayableAction({ row }: { row: PayableRow }) {
  return (
    <FinanceStep step="payable_approve" itemKey={row.code} label="Aprobar" title="Aprobar obligación" description="Una vez aprobada se puede programar y pagar. Si es un costo adicional, empieza a restar en la rentabilidad." submitLabel="Aprobar" trigger={(open) => <RowIcon tone="neutral" label="Aprobar" icon={<Stamp size={15} />} onClick={open} />}>
      <SummaryBox rows={[...payableSummary(row), { label: "Vence", value: formatDate(row.due_date) }]} />
      {row.provider.status !== "activo" && <p className="rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 py-2.5 text-[12.5px] text-fg-2">El proveedor no está activo. Puedes aprobar, pero revisa el contrato antes de pagar.</p>}
    </FinanceStep>
  );
}

function PayPayableAction({ row, methods, today, usdRate }: { row: PayableRow; methods: PayablesOverview["options"]["payout_methods"]; today: string; usdRate: number }) {
  return (
    <FinanceStep step="payable_pay" itemKey={row.code} label="Pagar" title="Registrar pago al proveedor" description="Si el pago cubre el saldo, la obligación queda pagada." submitLabel="Registrar pago" trigger={(open) => <RowIcon tone="edit" label="Pagar" icon={<HandCoins size={15} />} onClick={open} />}>
      <SummaryBox rows={payableSummary(row)} />
      <SelectField label="Forma de pago" name="method" options={methods} defaultValue={methods[0]?.value} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label={`Monto (${row.currency})`} name="amount" type="number" step="0.01" min="0.01" max={row.balance} required defaultValue={row.balance.toFixed(2)} />
        <TextField label="Fecha" name="paid_on" type="date" required max={today} defaultValue={today} />
      </div>
      <TextField label="Número de operación" name="operation_ref" required maxLength={80} placeholder="OP 00910022" />
      {row.currency !== "PEN" && <TextField label="Tipo de cambio" name="fx_rate" type="number" step="0.0001" min="0.5" max="20" defaultValue={String(row.fx_rate ?? usdRate)} />}
    </FinanceStep>
  );
}

function CancelPayableAction({ row }: { row: PayableRow }) {
  return (
    <FinanceStep step="payable_cancel" itemKey={row.code} label="Anular" title="Anular obligación" description="Sale de las cuentas por pagar y queda en el historial con su motivo." submitLabel="Anular" trigger={(open) => <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} onClick={open} />}>
      <SummaryBox rows={payableSummary(row)} />
      <TextArea label="Motivo" name="reason" rows={4} required minLength={5} maxLength={500} placeholder="Ejemplo: el servicio se canceló sin penalidad." />
    </FinanceStep>
  );
}

export function PayablesTable({ data }: { data: PayablesOverview }) {
  const { rows, can, today, usd_rate: usdRate, options } = data;
  const week = addDays(today, 7);
  const closed = (row: PayableRow) => row.status === "pagada" || row.status === "cancelada";

  const columns: Column<PayableRow>[] = [
    {
      id: "payable",
      header: "Obligación",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <span className="font-semibold">{row.concept}</span>
          {row.kind === "costo_adicional" && <Badge tone="violet" className="ml-2">Costo adicional</Badge>}
          <small className="block text-xs text-fg-3">
            {row.code} · {row.provider.name}
          </small>
        </div>
      ),
    },
    {
      id: "reservation",
      header: "Reserva",
      cell: (row) =>
        row.reservation ? (
          <Link href={`/reservas/${row.reservation.code}`} className="text-[13px] hover:underline">
            {row.reservation.code}
            <span className="block max-w-[200px] truncate text-xs text-fg-3">{row.reservation.title}</span>
          </Link>
        ) : (
          <span className="text-[13px] text-fg-3">Gasto general</span>
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
    { id: "balance", header: "Saldo", align: "right", cell: (row) => (row.balance > 0 ? <span className="font-mono text-[13px] font-semibold">{formatMoney(row.balance, row.currency)}</span> : <span className="text-[12.5px] text-fg-3">—</span>) },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="flex items-center gap-1.5" title={row.observation ?? undefined}>
          <StatusBadge status={row.status} />
          {row.approved && row.status !== "aprobada" && row.status !== "pagada" && row.status !== "cancelada" && <BadgeCheck size={15} className="text-ok" aria-label="Aprobada" />}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => (
        <RowActions>
          {row.reservation ? <RowIcon tone="view" label="Ver reserva" href={`/reservas/${row.reservation.code}`} /> : <RowIcon tone="view" label="Ver reserva" disabledHint="Gasto sin reserva" />}
          {can.manage && (closed(row) ? <RowIcon tone="edit" label="Editar" disabledHint={`La obligación está ${statusLabel(row.status).toLowerCase()}`} /> : <EditPayableAction row={row} />)}
          {can.manage && !closed(row) && !row.approved && <ApprovePayableAction row={row} />}
          {can.operate && !closed(row) && row.approved && <PayPayableAction row={row} methods={options.payout_methods} today={today} usdRate={usdRate} />}
          {can.manage && (closed(row) || row.paid > 0 ? <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} disabledHint={row.paid > 0 ? "Ya tiene pagos registrados" : `La obligación está ${statusLabel(row.status).toLowerCase()}`} /> : <CancelPayableAction row={row} />)}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<PayableRow>[] = [
    { id: "overdue", label: "Vencidas", tone: "bad", icon: <AlarmClock size={19} />, matches: (row) => row.status === "vencida" },
    { id: "approve", label: "Por aprobar", tone: "warn", icon: <Stamp size={19} />, matches: (row) => !closed(row) && !row.approved },
    { id: "week", label: "Vencen en 7 días", tone: "t1", icon: <HandCoins size={19} />, matches: (row) => !closed(row) && row.status !== "vencida" && row.due_date <= week },
    { id: "paid", label: "Pagadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "pagada" },
  ];

  const filters: FilterConfig<PayableRow>[] = [
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.status)).map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
    { id: "provider", label: "Proveedor", options: unique(rows.map((row) => row.provider.name)).map((value) => ({ value, label: value })), value: (row) => row.provider.name },
    { id: "kind", label: "Tipo", options: [{ value: "servicio", label: "Servicio de reserva" }, { value: "costo_adicional", label: "Costo adicional" }], value: (row) => row.kind },
  ];

  const sorts: SortOption<PayableRow>[] = [
    { id: "due", label: "Vencimiento", type: "date", value: (row) => row.due_date },
    { id: "balance", label: "Saldo en soles", type: "number", value: (row) => row.balance_pen },
    { id: "provider", label: "Proveedor", value: (row) => row.provider.name },
  ];

  return (
    <DataTable
      screen="finanzas-proveedores"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="obligaciones"
      searchText={(row) => `${row.code} ${row.concept} ${row.provider.name} ${row.reservation?.code ?? ""}`}
      searchPlaceholder="Buscar obligación, proveedor o reserva"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
