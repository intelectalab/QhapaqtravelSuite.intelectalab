"use client";

import { ArrowDownLeft, ArrowUpRight, CircleAlert, CircleCheck, CreditCard, FileText, Landmark, Scale, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/ui/Charts";
import { SwitchField } from "@/components/ui/SwitchField";
import { cn } from "@/lib/cn";
import type { CsvExport } from "@/lib/csv";
import { SESSION_TODAY, type CashCount, type CashFlowItem, type CashFlowProjection, type LedgerMovement, type TreasuryAccount, type TreasuryLedger, type TreasuryOverview } from "@/lib/finance";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { MovementDetail } from "./Treasury";
import { AccountFormAction, CountDecisionActions } from "./TreasuryOps";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

const accountHref = (code: string) => `/finanzas/tesoreria/cuentas/${encodeURIComponent(code)}`;

const KIND_ICON: Record<TreasuryAccount["kind"], typeof Landmark> = { bank: Landmark, petty_cash: Wallet, gateway: CreditCard };

const operationalState = (account: TreasuryAccount): { label: string; tone: "ok" | "warn" | "mute" | "t4" } => {
  if (!account.active) return { label: "Inactiva", tone: "mute" };
  if (account.kind === "petty_cash") return SESSION_TODAY[account.session_today ?? "none"];
  if (account.kind === "gateway") return account.balance > 0 ? { label: "Por liquidar", tone: "t4" } : { label: "Liquidada", tone: "ok" };
  return { label: "Operativa", tone: "ok" };
};

export function AccountsDataTable({ data, editable }: { data: TreasuryOverview; editable: boolean }) {
  const rows = data.accounts;
  const columns: Column<TreasuryAccount>[] = [
    {
      id: "account",
      header: "Cuenta",
      mobile: "title",
      cell: (account) => {
        const Icon = KIND_ICON[account.kind];
        return (
          <span className={cn("flex min-w-0 items-center gap-2.5", !account.active && "opacity-55")}>
            <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-surface-2 text-fg-2">
              <Icon size={15} />
            </span>
            <span className="min-w-0">
              <Link href={accountHref(account.code)} className="block truncate font-semibold hover:underline">
                {account.name}
              </Link>
              <span className="block truncate text-xs text-fg-3">{[account.code, account.bank, account.number, account.custodian && `custodia ${account.custodian}`].filter(Boolean).join(" · ")}</span>
            </span>
          </span>
        );
      },
    },
    { id: "kind", header: "Tipo", cell: (account) => <span className="text-[13px]">{account.kind_label}</span> },
    { id: "sede", header: "Sede", wideOnly: true, cell: (account) => <span className="text-[13px] text-fg-2">{account.sede ?? "—"}</span> },
    { id: "balance", header: "Saldo", align: "right", cell: (account) => <span className={cn("font-mono text-[13px] font-semibold", account.balance < 0 && "text-bad")}>{formatMoney(account.balance, account.currency)}</span> },
    { id: "pen", header: "En soles", align: "right", cell: (account) => <span className="font-mono text-[13px] text-fg-2">{account.currency === "PEN" ? "—" : formatMoney(account.balance_pen)}</span> },
    {
      id: "state",
      header: "Estado",
      cell: (account) => {
        const state = operationalState(account);
        return <Badge tone={state.tone}>{state.label}</Badge>;
      },
    },
    { id: "actions", header: "", mobile: "hidden", align: "right", cell: (account) => (editable ? <RowActions><AccountFormAction data={data} account={account} /></RowActions> : null) },
  ];

  const metrics: MetricFilter<TreasuryAccount>[] = [
    { id: "bank", label: "Bancos", tone: "t1", icon: <Landmark size={19} />, matches: (account) => account.kind === "bank" && account.active },
    { id: "closed", label: "Cajas sin aperturar hoy", tone: "warn", icon: <Wallet size={19} />, matches: (account) => account.kind === "petty_cash" && account.active && account.session_today !== "open" },
    { id: "settle", label: "Pasarelas por liquidar", tone: "violet", icon: <CreditCard size={19} />, matches: (account) => account.kind === "gateway" && account.active && account.balance > 0 },
  ];

  const filters: FilterConfig<TreasuryAccount>[] = [
    { id: "kind", label: "Tipo", options: unique(rows.map((account) => account.kind_label)).map((value) => ({ value, label: value })), value: (account) => account.kind_label },
    { id: "currency", label: "Moneda", options: unique(rows.map((account) => account.currency)).map((value) => ({ value, label: value === "PEN" ? "Soles" : value === "USD" ? "Dólares" : value })), value: (account) => account.currency },
    { id: "state", label: "Estado", options: unique(rows.map((account) => operationalState(account).label)).map((value) => ({ value, label: value })), value: (account) => operationalState(account).label },
  ];

  const sorts: SortOption<TreasuryAccount>[] = [
    { id: "name", label: "Nombre", value: (account) => account.name },
    { id: "pen", label: "Saldo en soles", type: "number", value: (account) => account.balance_pen },
  ];

  return (
    <DataTable
      screen="finanzas-tesoreria-cuentas"
      rows={rows}
      columns={columns}
      getKey={(account) => account.code}
      entityLabel="cuentas"
      searchText={(account) => `${account.code} ${account.name} ${account.bank ?? ""} ${account.number ?? ""} ${account.custodian ?? ""}`}
      searchPlaceholder="Buscar cuenta, banco o custodia"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
      toolbarEnd={editable ? <AccountFormAction data={data} /> : undefined}
      footer={(visible) => ({
        account: <span className="font-semibold">Total consolidado</span>,
        pen: <span className="font-mono text-[13px] font-semibold">{formatMoney(visible.reduce((sum, account) => sum + account.balance_pen, 0))}</span>,
      })}
    />
  );
}

const RESULT_TONE: Record<string, "ok" | "warn" | "bad"> = { Cuadrado: "ok", Sobrante: "warn", Faltante: "bad" };

export function CountsTable({ data, editable }: { data: TreasuryOverview; editable: boolean }) {
  const rows = data.counts;
  const columns: Column<CashCount>[] = [
    {
      id: "count",
      header: "Arqueo",
      mobile: "title",
      cell: (count) => (
        <span className="min-w-0">
          <b className="block font-semibold">{count.code}</b>
          <span className="text-xs text-fg-3">
            {count.kind === "closing" ? "Cierre" : "Sorpresa"} · {formatDateTime(count.at)}
          </span>
        </span>
      ),
    },
    { id: "account", header: "Caja", cell: (count) => <span className="text-[13px]">{count.account.name}</span> },
    { id: "expected", header: "Sistema", align: "right", wideOnly: true, cell: (count) => <span className="font-mono text-[13px]">{formatMoney(count.expected)}</span> },
    { id: "counted", header: "Contado", align: "right", cell: (count) => <span className="font-mono text-[13px]">{formatMoney(count.counted)}</span> },
    {
      id: "result",
      header: "Resultado",
      cell: (count) => (
        <span className="grid justify-items-start gap-0.5" title={count.note ?? undefined}>
          <Badge tone={RESULT_TONE[count.result] ?? "mute"}>{count.result}</Badge>
          {Number(count.difference) !== 0 && <span className="font-mono text-[11.5px] text-fg-3">{formatMoney(count.difference)}</span>}
        </span>
      ),
    },
    {
      id: "signed",
      header: "Firmó",
      wideOnly: true,
      cell: (count) => (
        <span className="text-[12.5px]">
          {count.signed_by ?? "—"}
          {count.witness && <span className="block text-fg-3">testigo {count.witness}</span>}
        </span>
      ),
    },
    { id: "status", header: "Estado", cell: (count) => <StatusBadge status={count.status_label} /> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (count) => (
        <RowActions>
          <a href={`/finanzas/tesoreria/arqueos/${encodeURIComponent(count.code)}/acta`} target="_blank" rel="noreferrer" title="Acta del arqueo en PDF" aria-label={`Acta del arqueo ${count.code}`} className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent/10 text-accent transition hover:-translate-y-0.5">
            <FileText size={15} />
          </a>
          {editable && <CountDecisionActions count={count} viewerId={data.viewer_id} />}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<CashCount>[] = [
    { id: "balanced", label: "Cuadrados", tone: "ok", icon: <CircleCheck size={19} />, matches: (count) => count.result === "Cuadrado" },
    { id: "difference", label: "Con diferencia", tone: "warn", icon: <Scale size={19} />, matches: (count) => count.result !== "Cuadrado" },
    { id: "pending", label: "Por aprobar", tone: "bad", icon: <CircleAlert size={19} />, matches: (count) => count.status === "pending_approval" },
  ];

  const filters: FilterConfig<CashCount>[] = [
    { id: "account", label: "Caja", options: unique(rows.map((count) => count.account.name)).map((value) => ({ value, label: value })), value: (count) => count.account.name },
    { id: "status", label: "Estado", options: unique(rows.map((count) => count.status_label)).map((value) => ({ value, label: value })), value: (count) => count.status_label },
    { id: "result", label: "Resultado", options: unique(rows.map((count) => count.result)).map((value) => ({ value, label: value })), value: (count) => count.result },
  ];

  return (
    <DataTable
      screen="finanzas-tesoreria-arqueos"
      rows={rows}
      columns={columns}
      getKey={(count) => count.code}
      entityLabel="arqueos"
      searchText={(count) => `${count.code} ${count.account.name} ${count.signed_by ?? ""} ${count.note ?? ""}`}
      searchPlaceholder="Buscar arqueo, caja o responsable"
      metrics={metrics}
      filters={filters}
      sorts={[{ id: "at", label: "Fecha", type: "date", value: (count) => count.at }]}
      emptyTitle="Todavía no hay arqueos registrados"
    />
  );
}

const DONUT_TONES = ["var(--t1)", "var(--t4)", "var(--t2)", "var(--violet)"];

export function BalanceComposition({ items }: { items: { label: string; pen: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const total = items.reduce((sum, item) => sum + Math.max(0, item.pen), 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashes = items.map((item) => (total > 0 ? Math.max(0, item.pen) / total : 0) * circumference);
  const offsets = dashes.map((_, index) => dashes.slice(0, index).reduce((sum, value) => sum + value, 0));
  const focus = active === null ? null : items[active];
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-[132px] w-[132px] flex-none">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
          {items.map((item, index) => {
            const dash = dashes[index];
            return (
              <circle
                key={item.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={DONUT_TONES[index % DONUT_TONES.length]}
                strokeWidth={active === index ? 15 : 12}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offsets[index]}
                className={cn("cursor-default transition-[stroke-width,opacity] duration-200 motion-safe:animate-[fade-in_700ms_ease-out]", active !== null && active !== index && "opacity-40")}
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
              />
            );
          })}
        </svg>
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <span>
            <b className="block font-mono text-[15px]">{formatMoney(focus ? focus.pen : total, "PEN", { compact: true })}</b>
            <span className="text-[11px] text-fg-3">{focus ? `${total > 0 ? Math.round((Math.max(0, focus.pen) / total) * 100) : 0} %` : "consolidado"}</span>
          </span>
        </span>
      </div>
      <ul className="flex min-w-[180px] flex-1 flex-col gap-1.5">
        {items.map((item, index) => (
          <li key={item.label} className={cn("flex items-center gap-2 rounded-lg px-2 py-1 text-[12.5px] transition-colors", active === index && "bg-surface-2")} onPointerEnter={() => setActive(index)} onPointerLeave={() => setActive(null)}>
            <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: DONUT_TONES[index % DONUT_TONES.length] }} />
            <span className="flex-1 text-fg-2">{item.label}</span>
            <span className="font-mono font-semibold">{formatMoney(item.pen, "PEN", { compact: true })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BalanceHistory({ points }: { points: { date: string; pen: number }[] }) {
  if (points.length < 2) return null;
  const first = points[0].pen;
  const last = points[points.length - 1].pen;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-[12.5px] text-fg-3">
        <span>{formatDate(points[0].date)}</span>
        <span className={cn("font-mono font-semibold", last >= first ? "text-ok" : "text-bad")}>
          {last >= first ? "+" : "−"}
          {formatMoney(Math.abs(last - first), "PEN", { compact: true })} en 28 días
        </span>
        <span>Hoy</span>
      </div>
      <div className="relative h-[46px] text-accent">
        <Sparkline values={points.map((point) => point.pen)} labels={points.map((point) => `${formatDate(point.date).replace(/ \d{4}$/, "")} · ${formatMoney(point.pen, "PEN", { compact: true })}`)} className="h-full" />
      </div>
    </div>
  );
}

const FLOW_TYPE: Record<NonNullable<CashFlowItem["type"]>, string> = { cxc: "Cuenta por cobrar", cxp: "Cuenta por pagar", commission: "Comisión", fixed: "Egreso fijo" };

const daysFrom = (start: string, date: string) => Math.round((new Date(`${date}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86400000);

export function FlowToggles({ options }: { options: { include_overdue: boolean; include_fixed: boolean } }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [overdue, setOverdue] = useState(options.include_overdue);
  const [fixed, setFixed] = useState(options.include_fixed);
  const apply = (key: "vencidas" | "fijos", value: boolean) => {
    const next = new URLSearchParams(params.toString());
    next.set("seccion", "flujo");
    if (value) next.delete(key);
    else next.set(key, "0");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SwitchField label="Incluir cuotas vencidas como cobro inmediato" name="include_overdue" checked={overdue} onCheckedChange={(value) => { setOverdue(value); apply("vencidas", value); }} hint="Se asumen cobradas hoy: es el escenario optimista de cobranza." />
      <SwitchField label="Incluir egresos fijos estimados" name="include_fixed" checked={fixed} onCheckedChange={(value) => { setFixed(value); apply("fijos", value); }} hint="Planilla, alquileres y tributos configurados en Parámetros." />
    </div>
  );
}

export function WeeklyFlowChart({ weeks }: { weeks: NonNullable<CashFlowProjection["weeks"]> }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.flatMap((week) => [week.in, week.out]));
  const height = 120;
  const current = active === null ? null : weeks[active];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[12px] text-fg-3">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ok" />Entradas</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-bad" />Salidas</span>
        <span className="ml-auto min-h-[18px] font-mono text-fg-2">{current ? `Semana del ${formatDate(current.start)} · entra ${formatMoney(current.in, "PEN", { compact: true })} · sale ${formatMoney(current.out, "PEN", { compact: true })} · saldo ${formatMoney(current.balance, "PEN", { compact: true })}` : ""}</span>
      </div>
      <div className="grid items-end gap-1.5" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }} onPointerLeave={() => setActive(null)}>
        {weeks.map((week, index) => (
          <div key={week.start} className="flex cursor-default flex-col items-center gap-1" onPointerEnter={() => setActive(index)}>
            <div className="flex w-full items-end justify-center gap-0.5" style={{ height }}>
              {[{ value: week.in, tone: "bg-ok" }, { value: week.out, tone: "bg-bad" }].map((serie, position) => (
                <span key={position} className={cn("w-full max-w-[12px] origin-bottom rounded-t-[4px] transition-opacity motion-safe:animate-[grow-up_700ms_cubic-bezier(0.2,0.8,0.2,1)_backwards]", serie.tone, active !== null && active !== index && "opacity-40")} style={{ height: `${Math.max(3, (serie.value / max) * height)}px`, animationDelay: `${index * 40 + position * 30}ms` }} />
              ))}
            </div>
            <span className={cn("font-mono text-[10.5px] text-fg-3", active === index && "text-fg")}>{formatDate(week.start).replace(/ \d{4}$/, "")}</span>
          </div>
        ))}
      </div>
      <p className="mb-1 mt-4 text-[12px] font-semibold text-fg-3">Saldo proyectado</p>
      <div className="relative h-[46px] text-accent">
        <Sparkline values={weeks.map((week) => week.balance)} labels={weeks.map((week) => formatMoney(week.balance, "PEN", { compact: true }))} className="h-full" />
      </div>
    </div>
  );
}

export function CashFlowDetailTable({ flow }: { flow: CashFlowProjection }) {
  const start = flow.weeks?.[0]?.start ?? flow.items[0]?.date ?? "";
  const horizon = (item: CashFlowItem) => {
    const days = start ? daysFrom(start, item.date) : 0;
    return days <= 30 ? "30" : days <= 60 ? "60" : "90";
  };
  const columns: Column<CashFlowItem>[] = [
    {
      id: "date",
      header: "Fecha",
      cell: (item) => (
        <span className="whitespace-nowrap text-[13px]">
          {formatDate(item.date)}
          {item.overdue && item.due && <span className="block text-xs text-bad">Vencida {formatDate(item.due)}</span>}
        </span>
      ),
    },
    {
      id: "document",
      header: "Documento",
      mobile: "title",
      cell: (item) =>
        item.code && item.href ? (
          <Link href={item.href} className="font-mono text-[12.5px] font-semibold hover:underline">
            {item.code}
          </Link>
        ) : (
          <span className="text-[12.5px] text-fg-3">{item.source}</span>
        ),
    },
    { id: "type", header: "Tipo", cell: (item) => <Badge tone={item.kind === "in" ? "ok" : item.type === "fixed" ? "mute" : "warn"}>{item.type ? FLOW_TYPE[item.type] : item.source}</Badge> },
    {
      id: "concept",
      header: "Concepto",
      cell: (item) => (
        <span className="min-w-0 text-[13px]">
          {item.concept}
          {item.party && <span className="block text-xs text-fg-3">{item.party}</span>}
        </span>
      ),
    },
    { id: "amount", header: "Monto", align: "right", wideOnly: true, cell: (item) => <span className="font-mono text-[13px] text-fg-2">{item.amount !== undefined ? formatMoney(item.amount, item.currency ?? "PEN") : "—"}</span> },
    {
      id: "pen",
      header: "Efecto en soles",
      align: "right",
      cell: (item) => (
        <span className={cn("inline-flex items-center gap-1 font-mono text-[13px] font-semibold", item.kind === "in" ? "text-ok" : "text-bad")}>
          {item.kind === "in" ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
          {item.kind === "in" ? "+" : "−"}
          {formatMoney(item.pen)}
        </span>
      ),
    },
  ];

  const filters: FilterConfig<CashFlowItem>[] = [
    { id: "type", label: "Tipo", options: Object.entries(FLOW_TYPE).map(([value, label]) => ({ value, label })), value: (item) => item.type ?? "" },
    { id: "horizon", label: "Horizonte", options: [{ value: "30", label: "0 a 30 días" }, { value: "60", label: "31 a 60 días" }, { value: "90", label: "61 a 90 días" }], value: horizon },
  ];

  const csv: CsvExport<CashFlowItem> = {
    fileName: "flujo-proyectado",
    columns: [
      { header: "Fecha", value: (item) => item.date, type: "date" },
      { header: "Documento", value: (item) => item.code ?? "" },
      { header: "Tipo", value: (item) => (item.type ? FLOW_TYPE[item.type] : item.source) },
      { header: "Concepto", value: (item) => item.concept },
      { header: "Contraparte", value: (item) => item.party ?? "" },
      { header: "Moneda", value: (item) => item.currency ?? "PEN" },
      { header: "Monto", value: (item) => item.amount ?? item.pen, type: "money" },
      { header: "Efecto en soles", value: (item) => (item.kind === "in" ? item.pen : -item.pen), type: "money", total: true },
    ],
  };

  return (
    <DataTable
      screen="finanzas-tesoreria-flujo"
      csv={csv}
      rows={flow.items}
      columns={columns}
      getKey={(item) => `${item.type ?? item.source}-${item.code ?? item.concept}-${item.date}`}
      entityLabel="partidas"
      searchText={(item) => `${item.code ?? ""} ${item.concept} ${item.party ?? ""}`}
      searchPlaceholder="Buscar documento o contraparte"
      filters={filters}
      sorts={[{ id: "date", label: "Fecha", type: "date", value: (item) => item.date }, { id: "pen", label: "Efecto en soles", type: "number", value: (item) => item.pen }]}
      emptyTitle="Sin cobros ni pagos en los próximos 90 días"
    />
  );
}

const LEDGER_CSV: CsvExport<LedgerMovement> = {
  fileName: "libro-de-cuenta",
  columns: [
    { header: "Código", value: (row) => row.code },
    { header: "Fecha", value: (row) => row.date, type: "date" },
    { header: "Tipo", value: (row) => row.type_label },
    { header: "Origen", value: (row) => (row.origin ? `${row.origin.label}${row.origin.code ? ` ${row.origin.code}` : ""}` : "Manual") },
    { header: "Descripción", value: (row) => row.description },
    { header: "Referencia", value: (row) => row.reference ?? "" },
    { header: "Ingreso", value: (row) => (row.direction === "in" ? Number(row.amount) : ""), type: "money" },
    { header: "Egreso", value: (row) => (row.direction === "out" ? Number(row.amount) : ""), type: "money" },
    { header: "Saldo", value: (row) => Number(row.balance), type: "money" },
    { header: "Estado", value: (row) => (row.status === "voided" ? "Anulado" : "Vigente") },
  ],
};

export function LedgerTable({ ledger }: { ledger: TreasuryLedger }) {
  const rows = ledger.movements;
  const columns: Column<LedgerMovement>[] = [
    { id: "date", header: "Fecha", cell: (row) => <span className="whitespace-nowrap text-[13px]">{formatDate(row.date)}</span> },
    {
      id: "movement",
      header: "Movimiento",
      mobile: "title",
      cell: (row) => (
        <span className={cn("min-w-0", row.status === "voided" && "opacity-55")}>
          <span className={cn("block truncate font-semibold", row.status === "voided" && "line-through")}>{row.description}</span>
          <span className="block truncate text-xs text-fg-3">
            {row.code} · {row.type_label}
            {row.category ? ` · ${row.category}` : ""}
          </span>
        </span>
      ),
    },
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
    { id: "in", header: "Ingreso", align: "right", cell: (row) => (row.direction === "in" ? <span className="font-mono text-[13px] font-semibold text-ok">+{formatMoney(row.amount, ledger.currency)}</span> : <span className="text-fg-3">—</span>) },
    { id: "out", header: "Egreso", align: "right", cell: (row) => (row.direction === "out" ? <span className="font-mono text-[13px] font-semibold">−{formatMoney(row.amount, ledger.currency)}</span> : <span className="text-fg-3">—</span>) },
    { id: "balance", header: "Saldo", align: "right", cell: (row) => <span className="font-mono text-[13px] text-fg-2">{row.status === "voided" ? "—" : formatMoney(row.balance, ledger.currency)}</span> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => (
        <RowActions>
          <MovementDetail row={{ ...row, amount: Number(row.amount) }} />
          {row.status === "voided" && <Badge tone="bad">Anulado</Badge>}
        </RowActions>
      ),
    },
  ];

  const filters: FilterConfig<LedgerMovement>[] = [
    { id: "type", label: "Tipo", options: unique(rows.map((row) => row.type_label)).map((value) => ({ value, label: value })), value: (row) => row.type_label },
    { id: "direction", label: "Sentido", options: [{ value: "in", label: "Ingreso" }, { value: "out", label: "Egreso" }], value: (row) => row.direction },
    { id: "status", label: "Estado", options: [{ value: "posted", label: "Vigente" }, { value: "voided", label: "Anulado" }], value: (row) => row.status },
  ];

  return (
    <DataTable
      screen="finanzas-tesoreria-libro"
      csv={{ ...LEDGER_CSV, fileName: `libro-${ledger.code}` }}
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="movimientos"
      searchText={(row) => `${row.code} ${row.description} ${row.reference ?? ""} ${row.counterparty ?? ""} ${row.origin?.code ?? ""}`}
      searchPlaceholder="Buscar movimiento, referencia u origen"
      filters={filters}
      sorts={[{ id: "date", label: "Fecha", type: "date", value: (row) => row.date }]}
      emptyTitle="Sin movimientos registrados"
    />
  );
}
