"use client";

import { Ban, CircleCheck, Gift, HandCoins, Plus, Wallet } from "lucide-react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { SummaryBox } from "@/features/finance/FinanceStep";
import type { GiftCardRow, PaymentTarget } from "@/lib/growth-ops";
import { formatDate, formatMoney } from "@/lib/format";
import type { Tone } from "@/lib/tone";
import { GrowthStep } from "./GrowthStep";

const TONES: Record<GiftCardRow["status"], Tone> = { pendiente: "info", activa: "ok", agotada: "mute", vencida: "warn", anulada: "bad" };

function cardSummary(row: GiftCardRow) {
  return [
    { label: "Vale", value: `${row.code} · ••••${row.last4}` },
    { label: "Para", value: row.recipient_name ?? "Sin destinatario" },
    { label: "Saldo", value: formatMoney(row.balance, row.currency), strong: true },
  ];
}

export function IssueCardAction() {
  return (
    <GrowthStep step="card_issue" label="Emitir vale" icon={<Plus size={15} strokeWidth={2.4} />} variant="primary" title="Emitir vale de regalo" description="El código de canje se muestra una sola vez y se envía al correo del destinatario." submitLabel="Emitir vale">
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
        <TextField label="Monto" name="amount" type="number" step="0.01" min="20" max="20000" required />
        <SelectField label="Moneda" name="currency" options={[{ value: "PEN", label: "Soles" }, { value: "USD", label: "Dólares" }]} defaultValue="PEN" />
      </div>
      <TextField label="Para (nombre)" name="recipient_name" maxLength={160} />
      <TextField label="Correo del destinatario" name="recipient_email" type="email" maxLength={190} hint="Le enviamos el vale con su código de canje." />
      <TextArea label="Mensaje (opcional)" name="message" rows={3} maxLength={500} />
      <TextField label="Vence (opcional)" name="expires_at" type="date" hint="Si lo dejas vacío, vence en 12 meses." />
    </GrowthStep>
  );
}

function RedeemCardAction({ row, targets }: { row: GiftCardRow; targets: PaymentTarget[] }) {
  const options = targets.filter((item) => item.currency === row.currency);
  return (
    <GrowthStep step="card_redeem" itemKey={row.code} label="Canjear" title={`Canjear ${row.code}`} description="El canje registra un pago con vale y baja el saldo de la cuota." submitLabel="Canjear" trigger={(open) => <RowIcon tone="edit" label="Canjear" icon={<HandCoins size={15} />} onClick={open} />}>
      <SummaryBox rows={cardSummary(row)} />
      <TextField label="Código de canje" name="redeem_code" required placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" />
      {options.length > 0 ? (
        <SelectField label="Cuota que se paga" name="receivable_id" searchable options={options.map((item) => ({ value: item.code, label: `${item.label} · ${formatMoney(item.open, item.currency)}` }))} defaultValue={options[0].code} />
      ) : (
        <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">No hay cuotas pendientes en {row.currency === "PEN" ? "soles" : "dólares"}.</p>
      )}
      <TextField label="Monto a canjear" name="amount" type="number" step="0.01" min="0.01" max={row.balance} defaultValue={row.balance} required />
    </GrowthStep>
  );
}

function VoidCardAction({ row }: { row: GiftCardRow }) {
  return (
    <GrowthStep step="card_void" itemKey={row.code} label="Anular" title={`Anular ${row.code}`} description="El saldo se devuelve al comprador solo si el vale nunca se canjeó." submitLabel="Anular vale" trigger={(open) => <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} onClick={open} />}>
      <input type="hidden" name="lock_version" value={row.lock_version} />
      <SummaryBox rows={cardSummary(row)} />
      <TextArea label="Motivo" name="reason" rows={3} maxLength={300} />
    </GrowthStep>
  );
}

export function GiftCardsTable({ rows, targets }: { rows: GiftCardRow[]; targets: PaymentTarget[] }) {
  const columns: Column<GiftCardRow>[] = [
    {
      id: "card",
      header: "Vale",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <span className="font-semibold">{row.recipient_name ?? "Sin destinatario"}</span>
          <small className="block text-xs text-fg-3">{row.code} · ••••{row.last4} · {row.created_by}</small>
        </div>
      ),
    },
    {
      id: "balance",
      header: "Saldo",
      cell: (row) => (
        <span className="grid min-w-[150px] gap-1">
          <span className="flex items-baseline justify-between gap-2 font-mono text-[13px]">
            <b>{formatMoney(row.balance, row.currency)}</b>
            <span className="text-[11.5px] text-fg-3">de {formatMoney(row.initial_amount, row.currency)}</span>
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full origin-left rounded-full bg-ok motion-safe:animate-[fill-x_700ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${100 - row.used_pct}%` }} />
          </span>
        </span>
      ),
    },
    { id: "expires", header: "Vence", wideOnly: true, cell: (row) => <span className="text-[13px] text-fg-2">{formatDate(row.expires_at)}</span> },
    { id: "status", header: "Estado", cell: (row) => <Badge tone={TONES[row.status]}>{row.status_label}</Badge> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => (
        <RowActions>
          {row.status === "activa" ? <RedeemCardAction row={row} targets={targets} /> : <RowIcon tone="edit" label="Canjear" icon={<HandCoins size={15} />} disabledHint={`El vale está ${row.status_label.toLowerCase()}`} />}
          {row.status === "activa" || row.status === "pendiente" ? <VoidCardAction row={row} /> : <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} disabledHint={`El vale está ${row.status_label.toLowerCase()}`} />}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<GiftCardRow>[] = [
    { id: "active", label: "Activos", tone: "ok", icon: <Gift size={19} />, matches: (row) => row.status === "activa" },
    { id: "used", label: "Agotados", tone: "mute", icon: <CircleCheck size={19} />, matches: (row) => row.status === "agotada" },
    { id: "closed", label: "Vencidos o anulados", tone: "warn", icon: <Wallet size={19} />, matches: (row) => row.status === "vencida" || row.status === "anulada" },
  ];

  const filters: FilterConfig<GiftCardRow>[] = [
    { id: "status", label: "Estado", options: [...new Set(rows.map((row) => row.status))].map((value) => ({ value, label: rows.find((row) => row.status === value)?.status_label ?? value })), value: (row) => row.status },
    { id: "currency", label: "Moneda", options: [{ value: "PEN", label: "Soles" }, { value: "USD", label: "Dólares" }], value: (row) => row.currency },
  ];

  const sorts: SortOption<GiftCardRow>[] = [
    { id: "created", label: "Fecha de emisión", type: "date", value: (row) => row.created_at },
    { id: "expires", label: "Vencimiento", type: "date", value: (row) => row.expires_at },
    { id: "balance", label: "Saldo", type: "number", value: (row) => Number(row.balance) },
  ];

  return (
    <DataTable
      screen="finanzas-vales"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="vales"
      searchText={(row) => `${row.code} ${row.last4} ${row.recipient_name ?? ""} ${row.buyer?.name ?? ""}`}
      searchPlaceholder="Buscar vale, últimos 4 dígitos o destinatario"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
      emptyTitle="Aún no hay vales de regalo"
    />
  );
}
