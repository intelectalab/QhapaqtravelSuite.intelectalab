"use client";

import { ArrowDownLeft, ArrowUpRight, Ban, Banknote, CreditCard, Landmark, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import type { TreasuryAccount, TreasuryMovement, TreasuryOverview } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";
import { toneStyle, type Tone } from "@/lib/tone";
import { FinanceStep, SummaryBox } from "./FinanceStep";

const KIND: Record<TreasuryAccount["kind"], { tone: Tone; icon: typeof Landmark }> = {
  bank: { tone: "t1", icon: Landmark },
  petty_cash: { tone: "sun", icon: Wallet },
  gateway: { tone: "violet", icon: CreditCard },
};

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

export function AccountCards({ accounts }: { accounts: TreasuryAccount[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {accounts.map((account, index) => {
        const { tone, icon: Icon } = KIND[account.kind];
        const low = account.fund !== null && account.balance < account.fund * 0.4;
        return (
          <article
            key={account.code}
            style={{ ...toneStyle(tone), animationDelay: `${index * 50}ms` }}
            className="lift group relative animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_7%,var(--surface))] p-4 hover:border-[color-mix(in_srgb,var(--tint)_45%,transparent)]"
            title={account.number ?? undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[var(--tint)] text-white shadow-[0_8px_18px_-10px_var(--tint)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                  <Icon size={17} />
                </span>
                <span className="min-w-0">
                  <Link href={`/finanzas/tesoreria/cuentas/${encodeURIComponent(account.code)}`} className="block truncate text-[13.5px] font-semibold after:absolute after:inset-0 hover:underline">{account.name}</Link>
                  <span className="text-[12px] text-fg-3">
                    {account.kind_label}
                    {account.sede ? ` · ${account.sede.split(" — ")[0]}` : ""}
                  </span>
                </span>
              </span>
              <Badge tone={account.currency === "USD" ? "t4" : "mute"} dot={false}>
                {account.currency}
              </Badge>
            </div>
            <p className={cn("mt-3 text-[22px] font-bold leading-none tracking-[-0.02em]", account.balance < 0 && "text-bad")}>{formatMoney(account.balance, account.currency)}</p>
            <p className="mt-1.5 text-[12px] text-fg-3">
              {account.fund !== null ? (
                <span className={cn(low && "font-semibold text-warn")}>
                  Fondo {formatMoney(account.fund)} · {account.custodian ?? "sin custodio"}
                </span>
              ) : account.currency === "PEN" ? (
                account.number ?? "Sin número"
              ) : (
                `${formatMoney(account.balance_pen)} al cambio de hoy`
              )}
            </p>
          </article>
        );
      })}
    </section>
  );
}

function MovementFields({ data }: { data: TreasuryOverview }) {
  const accounts = data.accounts.filter((account) => account.active).map((account) => ({ value: account.code, label: `${account.name} · ${formatMoney(account.balance, account.currency)}` }));
  return (
    <>
      <ChoiceGroup label="Tipo" name="direction" options={[{ value: "out", label: "Egreso" }, { value: "in", label: "Ingreso" }]} defaultValue="out" />
      <SelectField label="Cuenta" name="account" options={accounts} placeholder="Elige la cuenta" hint="El monto se registra en la moneda de la cuenta." />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Importe" name="amount" type="number" step="0.01" min="0.01" required />
        <TextField label="Fecha" name="date" type="date" required max={data.today} defaultValue={data.today} />
      </div>
      <TextField label="Categoría" name="category" required maxLength={60} list="treasury-categories" placeholder="Alquileres, tributos, servicios…" />
      <datalist id="treasury-categories">
        {data.categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      <TextField label="Descripción" name="description" required maxLength={255} placeholder="Ejemplo: alquiler de oficina Cusco — noviembre" />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Referencia" name="reference" maxLength={80} placeholder="OP 00887120" />
        <TextField label="Contraparte" name="counterparty" maxLength={160} />
      </div>
    </>
  );
}

export function RecordMovementAction({ data }: { data: TreasuryOverview }) {
  return (
    <FinanceStep step="movement_create" label="Registrar movimiento" icon={<Plus size={16} strokeWidth={2.4} />} variant="primary" title="Registrar movimiento" description="Ingresos y egresos que no nacen de un cobro, un pago a proveedor ni una caja chica." submitLabel="Registrar">
      <MovementFields data={data} />
    </FinanceStep>
  );
}

function VoidMovementAction({ row }: { row: TreasuryMovement }) {
  return (
    <FinanceStep step="movement_void" itemKey={row.code} label="Anular" title="Anular movimiento" description="Deja de contar en el saldo de la cuenta y queda en el historial con su motivo." submitLabel="Anular" trigger={(open) => <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} onClick={open} />}>
      <SummaryBox
        rows={[
          { label: "Movimiento", value: `${row.code} · ${row.description}` },
          { label: "Cuenta", value: row.account.name },
          { label: row.direction === "in" ? "Ingreso" : "Egreso", value: formatMoney(row.amount, row.currency), strong: true },
        ]}
      />
      <TextArea label="Motivo" name="reason" rows={4} required minLength={5} maxLength={500} />
    </FinanceStep>
  );
}

export function MovementsTable({ data }: { data: TreasuryOverview }) {
  const { movements: rows, can } = data;

  const columns: Column<TreasuryMovement>[] = [
    {
      id: "movement",
      header: "Movimiento",
      mobile: "title",
      cell: (row) => (
        <div className={cn("flex min-w-0 items-center gap-2.5", row.status === "voided" && "opacity-55")}>
          <span className={cn("grid h-8 w-8 flex-none place-items-center rounded-[9px]", row.direction === "in" ? "bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-ok" : "bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] text-bad")}>
            {row.direction === "in" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
          </span>
          <span className="min-w-0">
            <span className={cn("block truncate font-semibold", row.status === "voided" && "line-through")}>{row.description}</span>
            <small className="block truncate text-xs text-fg-3">
              {row.code} · {row.type_label}
              {row.counterparty ? ` · ${row.counterparty}` : ""}
            </small>
          </span>
        </div>
      ),
    },
    { id: "account", header: "Cuenta", cell: (row) => <span className="text-[13px]">{row.account.name}</span> },
    { id: "date", header: "Fecha", cell: (row) => <span className="text-[13px]">{formatDate(row.date)}</span> },
    {
      id: "amount",
      header: "Importe",
      align: "right",
      cell: (row) => (
        <span className={cn("font-mono text-[13px] font-semibold", row.direction === "in" ? "text-ok" : "text-fg")} title={row.reference ?? undefined}>
          {row.direction === "in" ? "+" : "−"}
          {formatMoney(row.amount, row.currency)}
        </span>
      ),
    },
    { id: "category", header: "Categoría", wideOnly: true, cell: (row) => <span className="text-[13px] text-fg-2">{row.category ?? "—"}</span> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => (
        <RowActions>
          {row.status === "voided" ? <Badge tone="bad">Anulado</Badge> : can.manage && (row.manual ? <VoidMovementAction row={row} /> : <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} disabledHint="Se corrige desde su origen (cobro, pago o caja)" />)}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<TreasuryMovement>[] = [
    { id: "in", label: "Ingresos", tone: "ok", icon: <ArrowDownLeft size={19} />, matches: (row) => row.direction === "in" && row.status === "posted" },
    { id: "out", label: "Egresos", tone: "bad", icon: <ArrowUpRight size={19} />, matches: (row) => row.direction === "out" && row.status === "posted" },
    { id: "petty", label: "Gastos de caja chica", tone: "sun", icon: <Banknote size={19} />, matches: (row) => row.type === "petty_expense" },
  ];

  const filters: FilterConfig<TreasuryMovement>[] = [
    { id: "account", label: "Cuenta", options: unique(rows.map((row) => row.account.name)).map((value) => ({ value, label: value })), value: (row) => row.account.name },
    { id: "type", label: "Tipo", options: unique(rows.map((row) => row.type_label)).map((value) => ({ value, label: value })), value: (row) => row.type_label },
    { id: "category", label: "Categoría", options: unique(rows.map((row) => row.category ?? "")).filter(Boolean).map((value) => ({ value, label: value })), value: (row) => row.category ?? "" },
  ];

  const sorts: SortOption<TreasuryMovement>[] = [
    { id: "date", label: "Fecha", type: "date", value: (row) => row.date },
    { id: "amount", label: "Importe en soles", type: "number", value: (row) => row.pen },
  ];

  return (
    <DataTable
      screen="finanzas-tesoreria"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="movimientos"
      searchText={(row) => `${row.code} ${row.description} ${row.reference ?? ""} ${row.counterparty ?? ""} ${row.account.name}`}
      searchPlaceholder="Buscar movimiento, referencia o contraparte"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
