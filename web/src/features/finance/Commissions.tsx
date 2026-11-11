"use client";

import { Ban, Calculator, CircleCheck, HandCoins, Hourglass, Stamp } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { CommissionRow, CommissionsOverview } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";
import { statusLabel } from "@/lib/tone";
import { FinanceStep, SummaryBox } from "./FinanceStep";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

const pct = (value: number) => `${value.toLocaleString("es-PE", { maximumFractionDigits: 2 })} %`;

function commissionSummary(row: CommissionRow) {
  return [
    { label: "Beneficiario", value: `${row.beneficiary} · ${row.kind_label}` },
    { label: "Base", value: `${formatMoney(row.base, row.currency)} × ${pct(row.pct)}` },
    { label: "Comisión", value: formatMoney(row.amount, row.currency), strong: true },
  ];
}

export function CalculateCommissionsAction({ pending }: { pending: number }) {
  return (
    <FinanceStep step="commission_calculate" label="Calcular pendientes" icon={<Calculator size={16} />} variant="primary" title="Calcular comisiones pendientes" description="Aplica la regla vigente a cada reserva vendida que aún no tiene comisión. No duplica las ya calculadas." submitLabel="Calcular">
      <SummaryBox rows={[{ label: "Reservas sin comisión", value: pending, strong: true }]} />
      <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-2">Las comisiones nuevas quedan calculadas y requieren aprobación antes de pagarse.</p>
    </FinanceStep>
  );
}

function ApproveCommissionAction({ row }: { row: CommissionRow }) {
  return (
    <FinanceStep step="commission_approve" itemKey={row.code} label="Aprobar" title="Aprobar comisión" description={row.rule} submitLabel="Aprobar" trigger={(open) => <RowIcon tone="neutral" label="Aprobar" icon={<Stamp size={15} />} onClick={open} />}>
      <input type="hidden" name="lock_version" value={row.lock_version} />
      <SummaryBox rows={commissionSummary(row)} />
    </FinanceStep>
  );
}

function PayCommissionAction({ row }: { row: CommissionRow }) {
  return (
    <FinanceStep step="commission_pay" itemKey={row.code} label="Registrar pago" title="Registrar pago de comisión" submitLabel="Registrar pago" trigger={(open) => <RowIcon tone="edit" label="Registrar pago" icon={<HandCoins size={15} />} onClick={open} />}>
      <input type="hidden" name="lock_version" value={row.lock_version} />
      <SummaryBox rows={commissionSummary(row)} />
      <SelectField label="Forma de pago" name="method" options={row.pay_methods.map((value) => ({ value, label: value }))} defaultValue={row.pay_methods[0]} />
      <TextField label="Referencia" name="reference" required maxLength={80} placeholder="Planilla 2026-10 u OP 00918273" />
    </FinanceStep>
  );
}

function AnnulCommissionAction({ row }: { row: CommissionRow }) {
  return (
    <FinanceStep step="commission_annul" itemKey={row.code} label="Anular" title="Anular comisión" description="Se descarta este cálculo. La reserva vuelve a quedar pendiente de comisión." submitLabel="Anular" trigger={(open) => <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} onClick={open} />}>
      <SummaryBox rows={commissionSummary(row)} />
      <TextArea label="Motivo" name="reason" rows={4} required minLength={5} maxLength={500} />
    </FinanceStep>
  );
}

export function CommissionsTable({ data }: { data: CommissionsOverview }) {
  const { rows, can } = data;

  const columns: Column<CommissionRow>[] = [
    {
      id: "beneficiary",
      header: "Beneficiario",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <span className="font-semibold">{row.beneficiary}</span>
          <small className="block text-xs text-fg-3">
            {row.code} · {row.kind_label}
          </small>
        </div>
      ),
    },
    {
      id: "origin",
      header: "Origen",
      cell: (row) =>
        row.reservation ? (
          <Link href={`/reservas/${row.reservation.code}`} className="text-[13px] hover:underline">
            {row.reservation.code}
            <span className="block max-w-[220px] truncate text-xs text-fg-3">{row.reservation.title}</span>
          </Link>
        ) : (
          <span className="block max-w-[240px] truncate text-[13px] text-fg-2" title={row.rule}>
            {row.rule}
          </span>
        ),
    },
    { id: "base", header: "Base", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px] text-fg-2" title={row.rule}>{formatMoney(row.base, row.currency)} · {pct(row.pct)}</span> },
    { id: "amount", header: "Comisión", align: "right", cell: (row) => <span className="font-mono text-[13px] font-semibold">{formatMoney(row.amount, row.currency)}</span> },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="grid justify-items-start gap-0.5">
          <StatusBadge status={row.status} />
          {row.payment && <span className="max-w-[200px] truncate text-[11.5px] text-fg-3">{row.paid_at ? `${formatDate(row.paid_at)} · ` : ""}{row.payment}</span>}
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
          <RowIcon tone="view" label="Ver comisión" href={`/finanzas/comisiones/${row.code}`} />
          {can.approve && row.status === "calculada" && <ApproveCommissionAction row={row} />}
          {can.operate && row.status === "aprobada" && <PayCommissionAction row={row} />}
          {can.approve && (row.status === "calculada" ? <AnnulCommissionAction row={row} /> : <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} disabledHint={`Una comisión ${statusLabel(row.status).toLowerCase()} se ajusta en el siguiente periodo`} />)}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<CommissionRow>[] = [
    { id: "calculated", label: "Por aprobar", tone: "info", icon: <Hourglass size={19} />, matches: (row) => row.status === "calculada" },
    { id: "approved", label: "Por pagar", tone: "warn", icon: <Stamp size={19} />, matches: (row) => row.status === "aprobada" },
    { id: "paid", label: "Pagadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "pagada" },
  ];

  const filters: FilterConfig<CommissionRow>[] = [
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.status)).map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
    { id: "kind", label: "Tipo", options: unique(rows.map((row) => row.kind_label)).map((value) => ({ value, label: value })), value: (row) => row.kind_label },
    { id: "beneficiary", label: "Beneficiario", options: unique(rows.map((row) => row.beneficiary)).map((value) => ({ value, label: value })), value: (row) => row.beneficiary },
  ];

  const sorts: SortOption<CommissionRow>[] = [
    { id: "date", label: "Fecha de cálculo", type: "date", value: (row) => row.created_at },
    { id: "amount", label: "Monto en soles", type: "number", value: (row) => row.pen },
  ];

  return (
    <DataTable
      screen="finanzas-comisiones"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="comisiones"
      searchText={(row) => `${row.code} ${row.beneficiary} ${row.reservation?.code ?? ""} ${row.rule}`}
      searchPlaceholder="Buscar beneficiario o reserva"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
