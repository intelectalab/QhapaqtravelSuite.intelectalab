"use client";

import { AlarmClock, Ban, BadgeCheck, Building2, CalendarClock, CircleCheck, FilePlus2, HandCoins, Stamp, TrendingDown, Wallet } from "lucide-react";
import { PAYABLES_CSV } from "@/lib/finance-csv";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { DetailPanel } from "@/features/channels/ChannelUi";
import { cn } from "@/lib/cn";
import type { BankAccountOption, PayableRow, PayablesOverview } from "@/lib/finance";
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

function CostFields({ options, today, usdRate, row }: { options: PayablesOverview["options"]; today: string; usdRate: number; row?: PayableRow }) {
  const [currency, setCurrency] = useState(row?.currency ?? "PEN");
  return (
    <>
      <SelectField label="Reserva" name="reservation" options={options.reservations} defaultValue={row?.reservation?.code} placeholder="Elige la reserva" onChange={(value) => setCurrency(options.reservations.find((option) => option.value === value)?.currency ?? currency)} />
      <SelectField label="Proveedor" name="provider" options={options.providers} defaultValue={row?.provider.ref} placeholder="Elige el proveedor" hint="Solo proveedores activos." />
      <SelectField label="Tipo de costo" name="cost_type" options={options.cost_types} defaultValue={row?.cost_type ?? options.cost_types[0]?.value} />
      <TextField label="Concepto" name="concept" required maxLength={255} defaultValue={row?.concept} placeholder="Ejemplo: traslado adicional aeropuerto por cambio de vuelo" />
      <ChoiceGroup key={currency} label="Moneda" name="currency" options={[{ value: "PEN", label: "Soles" }, { value: "USD", label: "Dólares" }]} defaultValue={currency} onChange={setCurrency} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Importe" name="amount" type="number" step="0.01" min="0.01" required defaultValue={row ? row.amount.toFixed(2) : undefined} />
        <TextField label="Vence" name="due_date" type="date" min={row ? undefined : today} required={Boolean(row)} defaultValue={row?.due_date ?? addDays(today, 15)} />
      </div>
      {currency === "USD" && <TextField label="Tipo de cambio" name="fx_rate" type="number" step="0.0001" min="0.5" max="20" defaultValue={String(row?.fx_rate ?? usdRate)} />}
      <TextField label="Documento del proveedor (opcional)" name="supplier_doc" maxLength={30} defaultValue={row?.supplier_doc ?? ""} placeholder="F001-000123" />
      <TextArea label="Sustento (opcional)" name="evidence" rows={3} maxLength={1000} defaultValue={row?.evidence ?? ""} />
      <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-2">{row ? "Mientras no se apruebe, el costo se puede reasignar a otra reserva o proveedor." : "El costo nace abierto y solo impacta la rentabilidad de la reserva cuando se aprueba."}</p>
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

function EditPayableAction({ row, data }: { row: PayableRow; data: PayablesOverview }) {
  const reassignable = row.kind === "costo_adicional" && !row.approved && row.paid === 0;
  if (reassignable) {
    return (
      <FinanceStep step="payable_update" itemKey={row.code} label="Editar" title="Editar costo adicional" description={`${row.code} · ${row.provider.name}`} submitLabel="Guardar cambios" trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />}>
        <input type="hidden" name="lock_version" value={row.lock_version} />
        <CostFields options={data.options} today={data.today} usdRate={data.usd_rate} row={row} />
      </FinanceStep>
    );
  }
  return (
    <FinanceStep step="payable_update" itemKey={row.code} label="Editar" title="Editar obligación" description={`${row.code} · ${row.provider.name}`} submitLabel="Guardar cambios" trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />}>
      <input type="hidden" name="lock_version" value={row.lock_version} />
      <TextField label="Concepto" name="concept" required maxLength={255} defaultValue={row.concept} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label={`Importe (${row.currency})`} name="amount" type="number" step="0.01" min="0.01" defaultValue={row.amount.toFixed(2)} disabled={row.managed || row.approved || row.paid > 0} hint={row.managed ? "Sale del costo del servicio." : row.approved ? "Aprobada: el importe ya no cambia." : undefined} />
        <TextField label="Vence" name="due_date" type="date" required defaultValue={row.due_date} disabled={row.managed} hint={row.managed ? "Sigue la condición de pago del proveedor." : undefined} />
      </div>
      {row.managed && <input type="hidden" name="due_date" value={row.due_date} />}
      {row.managed && <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-2">Esta obligación se genera desde el servicio {row.service?.code} y se ajusta sola mientras no esté aprobada. Para pagar en otra fecha, apruébala y programa el pago; una diferencia de precio se registra como costo adicional.</p>}
      <TextField label="Documento del proveedor" name="supplier_doc" maxLength={30} defaultValue={row.supplier_doc ?? ""} placeholder="F001-000123" />
      <TextArea label="Sustento" name="evidence" rows={3} maxLength={1000} defaultValue={row.evidence ?? ""} />
    </FinanceStep>
  );
}

function ApprovePayableAction({ row }: { row: PayableRow }) {
  return (
    <FinanceStep step="payable_approve" itemKey={row.code} label="Aprobar" title="Aprobar obligación" description="Una vez aprobada se puede programar y pagar. Si es un costo adicional, empieza a restar en la rentabilidad." submitLabel="Aprobar" trigger={(open) => <RowIcon tone="neutral" label="Aprobar" icon={<Stamp size={15} />} onClick={open} />}>
      <input type="hidden" name="lock_version" value={row.lock_version} />
      <SummaryBox rows={[...payableSummary(row), { label: "Vence", value: formatDate(row.due_date) }]} />
      {row.provider.status !== "activo" && <p className="rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 py-2.5 text-[12.5px] text-fg-2">El proveedor no está activo. Puedes aprobar, pero revisa el contrato antes de pagar.</p>}
    </FinanceStep>
  );
}

export function SchedulePayableAction({ row, banks, today, trigger }: { row: Pick<PayableRow, "code" | "concept" | "balance" | "currency" | "lock_version" | "scheduled_date" | "scheduled_account" | "due_date"> & { provider: { name: string } }; banks: BankAccountOption[]; today: string; trigger?: (open: () => void) => ReactNode }) {
  const accounts = banks.filter((bank) => bank.currency === row.currency);
  return (
    <FinanceStep step="payable_schedule" itemKey={row.code} label="Programar pago" title="Programar pago" description="Fija la fecha y la cuenta desde la que se pagará. Aparece en el flujo proyectado." submitLabel={row.scheduled_date ? "Reprogramar" : "Programar"} trigger={trigger ?? ((open) => <RowIcon tone="neutral" label={row.scheduled_date ? "Reprogramar pago" : "Programar pago"} icon={<CalendarClock size={15} />} onClick={open} />)}>
      <input type="hidden" name="lock_version" value={row.lock_version} />
      <SummaryBox rows={[{ label: "Obligación", value: `${row.code} · ${row.concept}` }, { label: "Proveedor", value: row.provider.name }, { label: "Vence", value: formatDate(row.due_date) }, { label: "Saldo", value: formatMoney(row.balance, row.currency), strong: true }]} />
      <TextField label="Fecha programada" name="scheduled_date" type="date" required min={today} defaultValue={row.scheduled_date ?? (row.due_date >= today ? row.due_date : today)} />
      {accounts.length > 0 ? <SelectField label="Cuenta de origen" name="bank_account" options={accounts} defaultValue={row.scheduled_account ?? accounts[0]?.value} /> : <p className="rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 py-2.5 text-[12.5px] text-fg-2">No hay cuentas bancarias activas en {row.currency}. Créala en Tesorería › Cuentas.</p>}
    </FinanceStep>
  );
}

function PayPayableAction({ row, methods, banks, today, usdRate }: { row: PayableRow; methods: PayablesOverview["options"]["payout_methods"]; banks: BankAccountOption[]; today: string; usdRate: number }) {
  const accounts = banks.filter((bank) => bank.currency === row.currency);
  return (
    <FinanceStep step="payable_pay" itemKey={row.code} label="Pagar" title="Registrar pago al proveedor" description="Si el pago cubre el saldo, la obligación queda pagada." submitLabel="Registrar pago" trigger={(open) => <RowIcon tone="edit" label="Pagar" icon={<HandCoins size={15} />} onClick={open} />}>
      <input type="hidden" name="lock_version" value={row.lock_version} />
      <SummaryBox rows={payableSummary(row)} />
      <SelectField label="Forma de pago" name="method" options={methods} defaultValue={methods[0]?.value} />
      {accounts.length > 0 && <SelectField label="Cuenta de origen" name="bank_account" options={accounts} defaultValue={row.scheduled_account ?? accounts[0]?.value} />}
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

const closed = (row: PayableRow) => row.status === "pagada" || row.status === "cancelada";
const withoutInvoice = (row: PayableRow) => !closed(row) && row.supplier_invoice == null;

function PayableRowActions({ row, data }: { row: PayableRow; data: PayablesOverview }) {
  const { can, today, usd_rate: usdRate, options } = data;
  return (
    <RowActions>
      <RowIcon tone="view" label="Ver obligación" href={`/finanzas/proveedores/${row.code}`} />
      {can.manage && (closed(row) ? <RowIcon tone="edit" label="Editar" disabledHint={`La obligación está ${statusLabel(row.status).toLowerCase()}`} /> : <EditPayableAction row={row} data={data} />)}
      {can.manage && !closed(row) && !row.approved && <ApprovePayableAction row={row} />}
      {can.operate && !closed(row) && row.approved && <SchedulePayableAction row={row} banks={options.bank_accounts} today={today} />}
      {can.operate && !closed(row) && row.approved && <PayPayableAction row={row} methods={options.payout_methods} banks={options.bank_accounts} today={today} usdRate={usdRate} />}
      {can.manage && (closed(row) || row.paid > 0 ? <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} disabledHint={row.paid > 0 ? "Ya tiene pagos registrados" : `La obligación está ${statusLabel(row.status).toLowerCase()}`} /> : <CancelPayableAction row={row} />)}
    </RowActions>
  );
}

const reservationCell = (row: PayableRow) =>
  row.reservation ? (
    <Link href={`/reservas/${row.reservation.code}`} className="text-[13px] hover:underline">
      {row.reservation.code}
      <span className="block max-w-[200px] truncate text-xs text-fg-3">{row.service ? `${row.service.code} · servicio del ${formatDate(row.service.date)}` : row.reservation.title}</span>
    </Link>
  ) : (
    <span className="text-[13px] text-fg-3">Gasto general</span>
  );

export function PayablesTiles({ data }: { data: PayablesOverview }) {
  const { kpis, rows, by_provider: providers } = data;
  const costs = rows.filter((row) => row.kind === "costo_adicional" && row.status !== "cancelada");
  const impact = costs.filter((row) => row.approved).reduce((total, row) => total + row.amount_pen, 0);
  const waiting = costs.filter((row) => !row.approved).length;
  const top = providers[0];
  return (
    <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <TintTile icon={Wallet} tone="t1" label="Por pagar" value={formatMoney(kpis.payable_pen, "PEN", { compact: true })} note={kpis.payable_count === 1 ? "1 obligación abierta" : `${kpis.payable_count} obligaciones abiertas`} info={<p>Saldo de las obligaciones abiertas, en soles. Incluye {formatMoney(kpis.overdue_pen)} ya vencido y {formatMoney(kpis.due_week_pen)} que vence en los próximos 7 días.</p>} />
      <TintTile icon={HandCoins} tone="ok" label="Pagado este mes" value={formatMoney(kpis.paid_month_pen, "PEN", { compact: true })} note={kpis.scheduled_week_pen > 0 ? `Programado a 7 días: ${formatMoney(kpis.scheduled_week_pen, "PEN", { compact: true })}` : "Nada programado esta semana"} info={<p>Pagos a proveedores registrados desde el día 1, al tipo de cambio de cada pago. La nota suma los pagos programados para los próximos 7 días.</p>} />
      <TintTile icon={TrendingDown} tone="violet" label="Costos que restan margen" value={formatMoney(impact, "PEN", { compact: true })} note="Costos adicionales aprobados" info={<p>Un costo adicional resta en la rentabilidad de su reserva desde que se aprueba. {waiting === 0 ? "No hay costos esperando aprobación." : waiting === 1 ? "Hay 1 costo que aún no resta." : `Hay ${waiting} costos que aún no restan.`}</p>} />
      <TintTile
        icon={Building2}
        tone="sun"
        label="Mayor saldo"
        value={top ? formatMoney(top.pen, "PEN", { compact: true }) : "—"}
        note={top?.name ?? "Sin saldos pendientes"}
        info={
          providers.length ? (
            <ul className="flex flex-col gap-1">
              {providers.slice(0, 5).map((item) => (
                <li key={item.name} className="flex justify-between gap-3">
                  <span className="truncate">{item.name}</span>
                  <b className="font-mono">{formatMoney(item.pen)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p>No hay saldos pendientes con proveedores.</p>
          )
        }
      />
    </section>
  );
}

interface ProviderBalance {
  ref: string;
  name: string;
  status: string;
  rows: PayableRow[];
  open: number;
  total: number;
  paid: number;
  balance: number;
  overdue: number;
  next: string | null;
}

function providerBalances(rows: PayableRow[]): ProviderBalance[] {
  const groups = new Map<string, ProviderBalance>();
  for (const row of rows) {
    const group = groups.get(row.provider.ref) ?? { ref: row.provider.ref, name: row.provider.name, status: row.provider.status, rows: [], open: 0, total: 0, paid: 0, balance: 0, overdue: 0, next: null };
    group.rows.push(row);
    if (row.status !== "cancelada") {
      group.total += row.amount_pen;
      group.paid += row.paid_pen;
      group.balance += row.balance_pen;
    }
    if (!closed(row)) {
      group.open += 1;
      if (row.status === "vencida") group.overdue += row.balance_pen;
      else if (group.next === null || row.due_date < group.next) group.next = row.due_date;
    }
    groups.set(row.provider.ref, group);
  }
  return [...groups.values()];
}

function ProviderDetail({ group, data }: { group: ProviderBalance; data: PayablesOverview }) {
  return (
    <DetailPanel label="Ver documentos del proveedor" title={group.name} description={`${group.rows.length} ${group.rows.length === 1 ? "documento" : "documentos"} · saldo ${formatMoney(group.balance)}`}>
      <ul className="flex flex-col gap-2">
        {group.rows.map((row) => (
          <li key={row.code} className="lift flex items-center justify-between gap-3 rounded-tile border border-line px-3.5 py-2.5">
            <span className="min-w-0">
              <Link href={`/finanzas/proveedores/${row.code}`} className="block truncate text-[13.5px] font-semibold hover:underline">
                {row.concept}
              </Link>
              <span className="block text-[12px] text-fg-3">
                {row.code} · vence {formatDate(row.due_date)}
              </span>
            </span>
            <span className="flex flex-none flex-col items-end gap-1">
              <span className="font-mono text-[13px]">{formatMoney(row.balance, row.currency)}</span>
              <StatusBadge status={row.status} />
            </span>
          </li>
        ))}
      </ul>
      {data.can.manage && <p className="text-[12.5px] text-fg-3">Aprueba, paga o anula cada documento desde Por documento.</p>}
    </DetailPanel>
  );
}

export function ProviderBalancesTable({ data }: { data: PayablesOverview }) {
  const groups = providerBalances(data.rows);
  const columns: Column<ProviderBalance>[] = [
    {
      id: "provider",
      header: "Proveedor",
      mobile: "title",
      cell: (group) => (
        <span className="min-w-0">
          <span className="font-semibold">{group.name}</span>
          {group.status !== "activo" && <Badge tone="warn" className="ml-2">{statusLabel(group.status)}</Badge>}
          <small className="block text-xs text-fg-3">{group.open === 1 ? "1 documento abierto" : `${group.open} documentos abiertos`} de {group.rows.length}</small>
        </span>
      ),
    },
    { id: "total", header: "Total", align: "right", wideOnly: true, cell: (group) => <span className="font-mono text-[13px]">{formatMoney(group.total)}</span> },
    { id: "paid", header: "Pagado", align: "right", wideOnly: true, cell: (group) => <span className="font-mono text-[13px] text-fg-2">{formatMoney(group.paid)}</span> },
    { id: "balance", header: "Saldo", align: "right", cell: (group) => (group.balance > 0 ? <span className="font-mono text-[13px] font-semibold">{formatMoney(group.balance)}</span> : <span className="text-[12.5px] text-fg-3">—</span>) },
    { id: "overdue", header: "Vencido", align: "right", cell: (group) => (group.overdue > 0 ? <span className="font-mono text-[13px] font-semibold text-bad">{formatMoney(group.overdue)}</span> : <span className="text-[12.5px] text-fg-3">—</span>) },
    { id: "next", header: "Próximo vencimiento", mobile: "detail", cell: (group) => <span className="text-[13px]">{group.next ? formatDate(group.next) : "—"}</span> },
    { id: "actions", header: "", mobile: "hidden", align: "right", cell: (group) => <RowActions><ProviderDetail group={group} data={data} /></RowActions> },
  ];
  const metrics: MetricFilter<ProviderBalance>[] = [
    { id: "late", label: "Con saldo vencido", tone: "bad", icon: <AlarmClock size={19} />, matches: (group) => group.overdue > 0 },
    { id: "owing", label: "Con saldo", tone: "warn", icon: <Wallet size={19} />, matches: (group) => group.balance > 0 },
    { id: "clear", label: "Sin saldo", tone: "ok", icon: <CircleCheck size={19} />, matches: (group) => group.balance <= 0 },
  ];
  const sorts: SortOption<ProviderBalance>[] = [
    { id: "balance", label: "Saldo", type: "number", value: (group) => group.balance },
    { id: "overdue", label: "Vencido", type: "number", value: (group) => group.overdue },
    { id: "name", label: "Proveedor", value: (group) => group.name },
  ];
  return <DataTable screen="finanzas-proveedores-saldos" rows={groups} columns={columns} getKey={(group) => group.ref} entityLabel="proveedores" searchText={(group) => group.name} searchPlaceholder="Buscar proveedor" metrics={metrics} sorts={sorts} emptyTitle="Sin obligaciones con proveedores" />;
}

export function CostsTable({ data }: { data: PayablesOverview }) {
  const rows = data.rows.filter((row) => row.kind === "costo_adicional");
  const types = Object.fromEntries(data.options.cost_types.map((option) => [option.value, option.label]));
  const columns: Column<PayableRow>[] = [
    {
      id: "cost",
      header: "Costo",
      mobile: "title",
      cell: (row) => (
        <span className="min-w-0">
          <span className="font-semibold">{row.concept}</span>
          <small className="block text-xs text-fg-3">
            {row.code} · {row.provider.name}
          </small>
        </span>
      ),
    },
    { id: "reservation", header: "Reserva", cell: reservationCell },
    { id: "type", header: "Tipo", wideOnly: true, cell: (row) => <span className="text-[13px] text-fg-2">{row.cost_type ? (types[row.cost_type] ?? row.cost_type) : "—"}</span> },
    { id: "amount", header: "Monto", align: "right", cell: (row) => <span className="font-mono text-[13px]">{formatMoney(row.amount, row.currency)}</span> },
    { id: "validation", header: "Validación", cell: (row) => (row.status === "cancelada" ? <StatusBadge status="cancelada" /> : row.approved ? <Badge tone="ok">Aprobado</Badge> : <Badge tone="warn">Por aprobar</Badge>) },
    { id: "impact", header: "Rentabilidad", mobile: "detail", cell: (row) => (row.approved && row.status !== "cancelada" ? <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-bad"><TrendingDown size={14} /> Resta margen</span> : <span className="text-[12.5px] text-fg-3">Sin impacto</span>) },
    { id: "actions", header: "", mobile: "hidden", align: "right", cell: (row) => <PayableRowActions row={row} data={data} /> },
  ];
  const metrics: MetricFilter<PayableRow>[] = [
    { id: "approved", label: "Aprobados", tone: "violet", icon: <TrendingDown size={19} />, matches: (row) => row.approved && row.status !== "cancelada" },
    { id: "approve", label: "Por aprobar", tone: "warn", icon: <Stamp size={19} />, matches: (row) => !row.approved && row.status !== "cancelada" },
    { id: "void", label: "Anulados", tone: "mute", icon: <Ban size={19} />, matches: (row) => row.status === "cancelada" },
  ];
  const filters: FilterConfig<PayableRow>[] = [
    { id: "type", label: "Tipo de costo", options: data.options.cost_types, value: (row) => row.cost_type ?? "" },
    { id: "provider", label: "Proveedor", options: unique(rows.map((row) => row.provider.name)).map((value) => ({ value, label: value })), value: (row) => row.provider.name },
  ];
  return <DataTable screen="finanzas-proveedores-costos" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="costos" searchText={(row) => `${row.code} ${row.concept} ${row.provider.name} ${row.reservation?.code ?? ""}`} searchPlaceholder="Buscar costo, proveedor o reserva" metrics={metrics} filters={filters} emptyTitle="Sin costos adicionales registrados" />;
}

export function PayablesWorkspace({ data, section }: { data: PayablesOverview; section: "documents" | "providers" | "costs" }) {
  if (section === "providers") return <ProviderBalancesTable data={data} />;
  if (section === "costs") return <CostsTable data={data} />;
  return <PayablesTable data={data} />;
}

export function PayablesTable({ data }: { data: PayablesOverview }) {
  const { rows, today } = data;
  const week = addDays(today, 7);

  const columns: Column<PayableRow>[] = [
    {
      id: "payable",
      header: "Obligación",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <span className="font-semibold">{row.concept}</span>
          {row.kind === "costo_adicional" && <Badge tone="violet" className="ml-2">Costo adicional</Badge>}
          {row.managed && row.service?.status === "cancelado" && row.status !== "cancelada" && <Badge tone="warn" className="ml-2">Servicio cancelado</Badge>}
          {withoutInvoice(row) && (
            <span title="El proveedor aún no carga su factura en la extranet. Finanzas programa el pago solo con la factura registrada.">
              <Badge tone="warn" className="ml-2">
                Sin factura
              </Badge>
            </span>
          )}
          <small className="block text-xs text-fg-3">
            {row.code} · {row.provider.name}
            {row.supplier_invoice && ` · factura ${row.supplier_invoice.number}`}
          </small>
        </div>
      ),
    },
    { id: "reservation", header: "Reserva", cell: reservationCell },
    {
      id: "due",
      header: "Vence",
      cell: (row) => (
        <span className={cn("text-[13px]", row.status === "vencida" && "font-semibold text-bad")}>
          {formatDate(row.due_date)}
          {row.days_overdue > 0 && <span className="block text-xs font-normal">{row.days_overdue === 1 ? "1 día de atraso" : `${row.days_overdue} días de atraso`}</span>}
          {row.scheduled_date && !closed(row) && <span className="block text-xs font-normal text-fg-3">Programado {formatDate(row.scheduled_date)}</span>}
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
      cell: (row) => <PayableRowActions row={row} data={data} />,
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
    { id: "invoice", label: "Factura", options: [{ value: "sin", label: "Sin factura" }, { value: "con", label: "Con factura" }], value: (row) => (withoutInvoice(row) ? "sin" : "con") },
  ];

  const sorts: SortOption<PayableRow>[] = [
    { id: "due", label: "Vencimiento", type: "date", value: (row) => row.due_date },
    { id: "balance", label: "Saldo en soles", type: "number", value: (row) => row.balance_pen },
    { id: "provider", label: "Proveedor", value: (row) => row.provider.name },
  ];

  return (
    <DataTable
      screen="finanzas-proveedores"
      csv={PAYABLES_CSV}
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="obligaciones"
      searchText={(row) => `${row.code} ${row.concept} ${row.provider.name} ${row.reservation?.code ?? ""} ${row.service?.code ?? ""}`}
      searchPlaceholder="Buscar obligación, proveedor o reserva"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
