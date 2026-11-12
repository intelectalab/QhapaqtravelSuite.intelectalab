"use client";

import { ArrowDownLeft, ArrowUpRight, Ban, Banknote, CreditCard, FileText, Landmark, Plus, Wallet } from "lucide-react";
import { MOVEMENTS_CSV } from "@/lib/finance-csv";
import Link from "next/link";
import { useState } from "react";
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
import { DetailPanel, PanelSection } from "@/features/channels/ChannelUi";
import { FieldList } from "@/components/ui/Details";
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
  const [direction, setDirection] = useState<"in" | "out">("out");
  const accounts = data.accounts.filter((account) => account.active && account.kind === "bank").map((account) => ({ value: account.code, label: `${account.name} · ${formatMoney(account.balance, account.currency)}` }));
  const categories = data.categories[direction].map((value) => ({ value, label: value }));
  return (
    <>
      <ChoiceGroup label="Tipo" name="direction" options={[{ value: "out", label: "Egreso" }, { value: "in", label: "Ingreso" }]} defaultValue="out" onChange={(value) => setDirection(value === "in" ? "in" : "out")} />
      <SelectField label="Cuenta bancaria" name="account" options={accounts} placeholder="Elige la cuenta" hint="Las cajas chicas registran gastos y las pasarelas su liquidación." />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Importe" name="amount" type="number" step="0.01" min="0.01" required />
        <TextField label="Fecha" name="date" type="date" required max={data.today} defaultValue={data.today} />
      </div>
      <SelectField key={direction} label="Categoría" name="category" options={categories} defaultValue={categories[0]?.value} />
      <TextField label="Descripción" name="description" required maxLength={255} placeholder="Ejemplo: alquiler de oficina Cusco — noviembre" />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Número de operación" name="reference" required maxLength={80} placeholder="OP 00887120" />
        <TextField label="Contraparte (opcional)" name="counterparty" maxLength={160} />
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

function MovementDetail({ row }: { row: TreasuryMovement }) {
  const signed = `${row.direction === "in" ? "+" : "−"}${formatMoney(row.amount, row.currency)}`;
  return (
    <DetailPanel label="Ver movimiento" title={row.description} description={`${row.code} · ${row.type_label} · ${formatDate(row.date)}`}>
      <div className={cn("rounded-tile px-4 py-3.5", row.direction === "in" ? "bg-[color-mix(in_srgb,var(--ok)_9%,transparent)]" : "bg-[color-mix(in_srgb,var(--bad)_7%,transparent)]")}>
        <p className="text-[12.5px] text-fg-3">{row.direction === "in" ? "Ingreso" : "Egreso"} en {row.account.name}</p>
        <p className={cn("font-mono text-[24px] font-bold", row.status === "voided" && "line-through opacity-60")}>{signed}</p>
        {row.currency !== "PEN" && <p className="text-[12px] text-fg-3">{formatMoney(row.pen)} al tipo de cambio {row.fx_rate ?? "del día"}</p>}
      </div>
      {row.status === "voided" && (
        <p className="rounded-xl border border-[color-mix(in_srgb,var(--bad)_30%,transparent)] bg-[color-mix(in_srgb,var(--bad)_7%,transparent)] px-3.5 py-2.5 text-[13px]">
          <b className="font-semibold">Anulado</b>
          {row.voided?.by ? ` por ${row.voided.by}` : ""}
          {row.voided?.at ? ` el ${formatDate(row.voided.at)}` : ""}. {row.void_reason}
        </p>
      )}
      <PanelSection title="Datos">
        <FieldList
          fields={[
            { label: "Categoría", value: row.category ?? "—" },
            { label: "Número de operación", value: row.reference ?? "—" },
            { label: "Contraparte", value: row.counterparty ?? "—" },
            { label: "Origen", value: row.origin ? row.origin.href ? <Link href={row.origin.href} className="hover:underline">{`${row.origin.label}${row.origin.code ? ` ${row.origin.code}` : ""}`}</Link> : `${row.origin.label}${row.origin.code ? ` ${row.origin.code}` : ""}` : "Registro manual" },
            ...(row.reservation ? [{ label: "Reserva", value: <Link href={`/reservas/${row.reservation}`} className="hover:underline">{row.reservation}</Link> }] : []),
            { label: "Registró", value: `${row.user} · ${formatDate(row.created_at)}` },
          ]}
        />
      </PanelSection>
      {row.receipt && (
        <PanelSection title="Comprobante" aside={row.receipt.type}>
          <FieldList
            fields={[
              { label: "Serie y número", value: row.receipt.number ?? "No aplica" },
              { label: "RUC del emisor", value: row.receipt.ruc ?? "—" },
              { label: "Pagado a", value: row.receipt.supplier },
            ]}
          />
          {row.receipt.file ? (
            <a href={`/finanzas/tesoreria/movimientos/${encodeURIComponent(row.code)}/comprobante`} target="_blank" rel="noreferrer" className="lift inline-flex items-center gap-2 self-start rounded-xl border border-line px-3.5 py-2 text-[13px] font-semibold hover:bg-surface-2">
              <FileText size={15} />
              Ver archivo del comprobante
            </a>
          ) : (
            <p className="text-[12.5px] text-fg-3">Sin archivo adjunto.</p>
          )}
        </PanelSection>
      )}
      {!row.voidable && row.status === "posted" && <p className="text-[12.5px] text-fg-3">No se anula aquí: se corrige desde su origen.</p>}
    </DetailPanel>
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
              {row.category ? ` · ${row.category}` : ""}
            </small>
          </span>
        </div>
      ),
    },
    { id: "account", header: "Cuenta", cell: (row) => <span className="text-[13px]">{row.account.name}</span> },
    { id: "date", header: "Fecha", cell: (row) => <span className="text-[13px]">{formatDate(row.date)}</span> },
    {
      id: "origin",
      header: "Origen",
      wideOnly: true,
      cell: (row) =>
        row.origin ? (
          row.origin.href ? (
            <Link href={row.origin.href} className="text-[13px] hover:underline">
              {row.origin.label}
              {row.origin.code && <span className="block text-xs text-fg-3">{row.origin.code}</span>}
            </Link>
          ) : (
            <span className="text-[13px]">
              {row.origin.label}
              {row.origin.code && <span className="block text-xs text-fg-3">{row.origin.code}</span>}
            </span>
          )
        ) : (
          <span className="text-[13px] text-fg-3">Manual</span>
        ),
    },
    { id: "in", header: "Ingreso", align: "right", cell: (row) => (row.direction === "in" ? <span className="font-mono text-[13px] font-semibold text-ok" title={row.currency === "PEN" ? undefined : formatMoney(row.pen)}>+{formatMoney(row.amount, row.currency)}</span> : <span className="text-fg-3">—</span>) },
    { id: "out", header: "Egreso", align: "right", cell: (row) => (row.direction === "out" ? <span className="font-mono text-[13px] font-semibold" title={row.currency === "PEN" ? undefined : formatMoney(row.pen)}>−{formatMoney(row.amount, row.currency)}</span> : <span className="text-fg-3">—</span>) },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => (
        <RowActions>
          <MovementDetail row={row} />
          {row.status === "voided" ? <Badge tone="bad">Anulado</Badge> : can.manage && (row.voidable ? <VoidMovementAction row={row} /> : <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} disabledHint="Se corrige desde su origen (cobro, pago o caja)" />)}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<TreasuryMovement>[] = [
    { id: "manual", label: "Manuales", tone: "t1", icon: <Landmark size={19} />, matches: (row) => row.manual && row.status === "posted" },
    { id: "petty", label: "Gastos de caja chica", tone: "sun", icon: <Banknote size={19} />, matches: (row) => row.type === "petty_expense" && row.status === "posted" },
    { id: "gateway", label: "Pasarelas", tone: "violet", icon: <CreditCard size={19} />, matches: (row) => row.type.startsWith("gateway") && row.status === "posted" },
    { id: "voided", label: "Anulados", tone: "bad", icon: <Wallet size={19} />, matches: (row) => row.status === "voided" },
  ];

  const filters: FilterConfig<TreasuryMovement>[] = [
    { id: "account", label: "Cuenta", options: unique(rows.map((row) => row.account.name)).map((value) => ({ value, label: value })), value: (row) => row.account.name },
    { id: "type", label: "Tipo", options: unique(rows.map((row) => row.type_label)).map((value) => ({ value, label: value })), value: (row) => row.type_label },
    { id: "direction", label: "Sentido", options: [{ value: "in", label: "Ingreso" }, { value: "out", label: "Egreso" }], value: (row) => row.direction },
    { id: "status", label: "Estado", options: [{ value: "posted", label: "Vigente" }, { value: "voided", label: "Anulado" }], value: (row) => row.status },
  ];

  const sorts: SortOption<TreasuryMovement>[] = [
    { id: "date", label: "Fecha", type: "date", value: (row) => row.date },
    { id: "amount", label: "Importe en soles", type: "number", value: (row) => row.pen },
  ];

  return (
    <DataTable
      screen="finanzas-tesoreria"
      csv={MOVEMENTS_CSV}
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="movimientos"
      searchText={(row) => `${row.code} ${row.description} ${row.reference ?? ""} ${row.counterparty ?? ""} ${row.account.name} ${row.origin?.code ?? ""}`}
      searchPlaceholder="Buscar movimiento, referencia o contraparte"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
