"use client";

import { AlarmClock, Ban, BellRing, CalendarClock, CircleCheck, FilePlus2, HandCoins, Landmark, Wallet } from "lucide-react";
import { RECEIVABLES_CSV } from "@/lib/finance-csv";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import type { AdvanceOption, PaymentMethodOption, ReceivableRow, ReceivablesOverview } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";
import { statusLabel } from "@/lib/tone";
import { FinanceStep, SummaryBox } from "./FinanceStep";
import { IssueInvoiceAction } from "./Invoices";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

export type PayableReceivable = Pick<ReceivableRow, "code" | "concept" | "balance" | "currency" | "fx_rate"> & { client: { name: string } };

function PaymentFields({ row, methods, today, usdRate }: { row: PayableReceivable; methods: PaymentMethodOption[]; today: string; usdRate: number }) {
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

export function RegisterPaymentAction({ row, methods, today, usdRate, trigger }: { row: PayableReceivable; methods: PaymentMethodOption[]; today: string; usdRate: number; trigger?: (open: () => void) => ReactNode }) {
  return (
    <FinanceStep
      step="receivable_payment"
      itemKey={row.code}
      label="Registrar pago"
      title="Registrar pago"
      description="Se registra confirmado y se aplica a esta cuota en la misma operación."
      submitLabel="Registrar y aplicar"
      trigger={trigger ?? ((open) => <RowIcon tone="edit" label="Registrar pago" icon={<Wallet size={15} />} onClick={open} />)}
    >
      <PaymentFields row={row} methods={methods} today={today} usdRate={usdRate} />
    </FinanceStep>
  );
}

function PickedPaymentFields({ rows, methods, today, usdRate }: { rows: ReceivableRow[]; methods: PaymentMethodOption[]; today: string; usdRate: number }) {
  const [code, setCode] = useState("");
  const row = rows.find((item) => item.code === code);
  return (
    <>
      <SelectField label="Cuota" name="receivable_id" searchable options={rows.map((item) => ({ value: item.code, label: `${item.code} · ${item.client.name} · saldo ${formatMoney(item.balance, item.currency)}` }))} placeholder="Busca la cuota que se paga" onChange={setCode} />
      {row ? <PaymentFields key={row.code} row={row} methods={methods} today={today} usdRate={usdRate} /> : <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-3">Elige la cuota para ver su saldo y registrar el pago.</p>}
    </>
  );
}

export function PickPaymentAction({ data }: { data: ReceivablesOverview }) {
  const open = data.rows.filter((row) => row.status !== "pagada" && row.status !== "cancelada" && row.balance > 0);
  return (
    <FinanceStep step="receivable_payment_pick" label="Registrar pago" icon={<Wallet size={16} />} title="Registrar pago" description="Elige la cuota: el pago se registra confirmado y se aplica en la misma operación." submitLabel="Registrar y aplicar">
      <PickedPaymentFields rows={open} methods={data.methods} today={data.today} usdRate={data.usd_rate} />
    </FinanceStep>
  );
}

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

function AdvanceFields({ options, today }: { options: AdvanceOption[]; today: string }) {
  const [code, setCode] = useState("");
  const [pct, setPct] = useState("50");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [notify, setNotify] = useState(true);
  const option = options.find((item) => item.value === code);
  const suggest = (picked: AdvanceOption | undefined, value: string) => {
    if (!picked || value === "") return;
    const share = Number(value);
    setAmount(Math.min(picked.available, (picked.total * share) / 100).toFixed(2));
    setConcept(`Anticipo ${share} % — ${picked.title ?? picked.label}`);
  };
  const pick = (value: string) => {
    setCode(value);
    suggest(options.find((item) => item.value === value), pct);
  };
  const fromPct = (value: string) => {
    setPct(value);
    suggest(option, value);
  };
  return (
    <>
      <SelectField label="Reserva" name="reservation" searchable options={options.map(({ value, label }) => ({ value, label }))} placeholder="Busca la reserva" onChange={pick} hint={options.length === 0 ? "Todas las reservas vigentes ya tienen su total repartido en cuotas." : undefined} />
      {option && (
        <SummaryBox
          rows={[
            { label: "Cliente", value: option.client },
            { label: "Total de la reserva", value: formatMoney(option.total, option.currency) },
            { label: "Ya comprometido en cuotas", value: formatMoney(option.committed, option.currency) },
            { label: "Disponible para anticipo", value: formatMoney(option.available, option.currency), strong: true },
          ]}
        />
      )}
      <div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
        <TextField label="% del total" name="pct" type="number" step="0.01" min="1" max="100" value={pct} onChange={(event) => fromPct(event.target.value)} />
        <TextField label={`Importe${option ? ` (${option.currency})` : ""}`} name="amount" type="number" step="0.01" min="0.01" max={option?.available} required value={amount} onChange={(event) => setAmount(event.target.value)} hint={option && option.available < (option.total * Number(pct || 0)) / 100 ? "Se limitó a lo disponible de la reserva." : undefined} />
      </div>
      <TextField label="Vence" name="due_date" type="date" required min={today} defaultValue={addDays(today, 3)} />
      <TextField label="Concepto" name="concept" required minLength={3} maxLength={255} value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="Ejemplo: anticipo para reservar el tren a Machu Picchu" />
      <SwitchField label="Avisar al cliente por correo" name="notify_switch" checked={notify} onCheckedChange={setNotify} hint="Le llega el aviso de pago pendiente con el importe." />
      <input type="hidden" name="notify" value={notify ? "1" : "0"} />
    </>
  );
}

export function RequestAdvanceAction({ data }: { data: ReceivablesOverview }) {
  return (
    <FinanceStep step="receivable_advance" label="Solicitar anticipo" icon={<HandCoins size={16} />} variant="primary" title="Solicitar anticipo" description="Crea una cuota de anticipo sobre lo que aún no se comprometió de la reserva." submitLabel="Solicitar anticipo">
      <AdvanceFields options={data.advance_reservations} today={data.today} />
    </FinanceStep>
  );
}

export function RemindAction({ row, trigger }: { row: Pick<ReceivableRow, "code" | "concept" | "balance" | "currency"> & { client: { name: string } }; trigger?: (open: () => void) => ReactNode }) {
  return (
    <FinanceStep step="receivable_remind" itemKey={row.code} label="Enviar recordatorio" title="Enviar recordatorio de pago" description="Le llega al cliente un correo con el saldo pendiente. Queda en el historial de la cuota." submitLabel="Enviar" trigger={trigger ?? ((open) => <RowIcon tone="neutral" label="Enviar recordatorio" icon={<BellRing size={15} />} onClick={open} />)}>
      <SummaryBox
        rows={[
          { label: "Cuota", value: `${row.code} · ${row.concept}` },
          { label: "Cliente", value: row.client.name },
          { label: "Saldo que se recuerda", value: formatMoney(row.balance, row.currency), strong: true },
        ]}
      />
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
          <RowIcon tone="view" label="Ver cuota" href={`/finanzas/cobros/${row.code}`} />
          {can.register && (closed(row) ? <RowIcon tone="edit" label="Registrar pago" icon={<Wallet size={15} />} disabledHint={row.status === "pagada" ? "La cuota ya está pagada" : "La cuota está anulada"} /> : <RegisterPaymentAction row={row} methods={methods} today={today} usdRate={usdRate} />)}
          {can.register && !closed(row) && <RemindAction row={row} />}
          {can.invoice && row.paid > 0 && row.status !== "cancelada" && <IssueInvoiceAction code={row.code} trigger={(open) => <RowIcon tone="neutral" label="Emitir comprobante" icon={<FilePlus2 size={15} />} onClick={open} />} />}
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
      csv={RECEIVABLES_CSV}
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
