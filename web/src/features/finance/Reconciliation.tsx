"use client";

import { ArrowDownLeft, ArrowUpRight, Clock3, CircleCheck, CircleX, FileQuestion, Link2, Lock, Sparkles, Upload, Wrench, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { importStatement, loadLineCandidates } from "@/app/(backoffice)/finanzas/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { FilePicker } from "@/components/ui/FilePicker";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { cn } from "@/lib/cn";
import type { BankLineRow, LineCandidate, ReconciliationOverview } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { statusLabel } from "@/lib/tone";
import { FinanceStep, SummaryBox } from "./FinanceStep";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

function lineSummary(row: BankLineRow) {
  return [
    { label: "Línea", value: `${row.code} · ${row.bank} · ${formatDate(row.date)}` },
    { label: "Descripción", value: row.description },
    { label: row.amount > 0 ? "Abono" : "Cargo", value: formatMoney(Math.abs(row.amount), row.currency), strong: true },
    ...(row.match ? [{ label: row.match.kind === "payment" ? "Pago sugerido" : "Obligación sugerida", value: `${row.match.code} · ${formatMoney(row.match.amount, row.match.currency)}` }] : []),
  ];
}

function ConfirmLineAction({ row }: { row: BankLineRow }) {
  return (
    <FinanceStep step="line_confirm" itemKey={row.code} label="Confirmar" title="Confirmar coincidencia" description={row.match?.kind === "payment" && row.match.status === "pendiente" ? "El pago pendiente pasa a confirmado; su aplicación a la cuota se hace en Pagos." : "La línea queda conciliada con su contraparte."} submitLabel="Confirmar" trigger={(open) => <RowIcon tone="edit" label="Confirmar coincidencia" icon={<CircleCheck size={15} />} onClick={open} />}>
      <SummaryBox rows={lineSummary(row)} />
      {row.difference !== null && Math.abs(row.difference) >= 0.5 && <p className="rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 py-2.5 text-[12.5px] text-fg-2">Diferencia de {formatMoney(row.difference)} entre el banco y el documento en soles.</p>}
    </FinanceStep>
  );
}

function RejectLineAction({ row }: { row: BankLineRow }) {
  return (
    <FinanceStep step="line_reject" itemKey={row.code} label="Rechazar" title="Rechazar coincidencia" description="La línea pasa a excepción y deberá resolverse con sustento." submitLabel="Rechazar" trigger={(open) => <RowIcon tone="delete" label="Rechazar coincidencia" icon={<CircleX size={15} />} onClick={open} />}>
      <SummaryBox rows={lineSummary(row)} />
    </FinanceStep>
  );
}

function CandidatePicker({ code, credit }: { code: string; credit: boolean }) {
  const [rows, setRows] = useState<LineCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState("");

  useEffect(() => {
    loadLineCandidates(code).then((result) => {
      setError(result.message);
      setRows(result.rows);
      setPicked(result.rows[0]?.code ?? "");
    });
  }, [code]);

  if (error) return <p className="text-[13px] text-bad">{error}</p>;
  if (!rows) return <p className="py-4 text-center text-[13px] text-fg-3">Buscando {credit ? "pagos" : "obligaciones"} disponibles…</p>;
  if (rows.length === 0) return <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-3">No hay {credit ? "pagos" : "obligaciones"} libres para asignar. Resuélvela como {credit ? "otro ingreso" : "gasto bancario"}.</p>;

  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold text-fg">{credit ? "Pago registrado" : "Obligación con el proveedor"}</legend>
      <input type="hidden" name="target" value={picked} />
      <div role="radiogroup" className="grid max-h-[280px] grid-cols-[minmax(0,1fr)] gap-1.5 overflow-y-auto overflow-x-hidden pr-1">
        {rows.map((row) => {
          const exact = Math.abs(row.difference) < 0.5;
          return (
            <button
              key={row.code}
              type="button"
              role="radio"
              aria-checked={picked === row.code}
              onClick={() => setPicked(row.code)}
              className={cn("lift flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[13px] transition", picked === row.code ? "border-t1 bg-[color-mix(in_srgb,var(--t1)_8%,var(--surface))]" : "border-line bg-surface hover:border-[color-mix(in_srgb,var(--t1)_40%,transparent)]")}
            >
              <span className="min-w-0 flex-1">
                <b className="font-semibold">{row.code}</b>
                <span className="block truncate text-xs text-fg-3">{row.label || "Sin detalle"}</span>
              </span>
              <span className="grid flex-none justify-items-end gap-0.5">
                <span className="font-mono font-semibold">{formatMoney(row.amount, row.currency)}</span>
                <span className="flex gap-1">
                  {row.reference_hit && <Badge tone="info">Referencia</Badge>}
                  {exact ? <Badge tone="ok">Mismo importe</Badge> : <Badge tone="warn">Dif. {formatMoney(row.difference)}</Badge>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ResolveLineAction({ row }: { row: BankLineRow }) {
  const credit = row.amount > 0;
  const other = credit ? "otro_ingreso" : "gasto_bancario";
  const [mode, setMode] = useState("asignado");
  return (
    <FinanceStep
      step="line_resolve"
      itemKey={row.code}
      label="Resolver"
      title="Resolver excepción"
      description={mode === "asignado" ? (credit ? "La línea se concilia con el pago elegido; si estaba pendiente, queda confirmado." : "La línea se concilia con la obligación; si tiene saldo, se registra el pago por cargo bancario.") : "Se concilia sin afectar cobros ni obligaciones."}
      submitLabel="Resolver"
      trigger={(open) => <RowIcon tone="edit" label="Resolver excepción" icon={<Wrench size={15} />} onClick={open} />}
    >
      <SummaryBox rows={lineSummary(row)} />
      <ChoiceGroup label="Resolución" name="resolution" defaultValue="asignado" onChange={setMode} options={[{ value: "asignado", label: credit ? "Asignar a un pago" : "Asignar a una obligación" }, { value: other, label: credit ? "Otro ingreso" : "Gasto bancario" }]} />
      {mode === "asignado" && <CandidatePicker code={row.code} credit={credit} />}
      <TextArea label="Sustento" name="note" rows={3} required minLength={5} maxLength={500} placeholder={mode === "asignado" ? "Ejemplo: el cliente envió el voucher de la transferencia." : credit ? "Ejemplo: devolución de garantía del local, confirmada con el banco." : "Ejemplo: comisión de mantenimiento de cuenta."} />
    </FinanceStep>
  );
}

export function ImportStatementAction({ data }: { data: ReconciliationOverview }) {
  const router = useRouter();
  const [account, setAccount] = useState("");
  return (
    <PanelAction<StepResult>
      label="Importar extracto"
      icon={<Upload size={16} />}
      formId="finance-statement-import"
      title="Importar extracto bancario"
      description="Cada fila trae fecha, descripción e importe con signo: los abonos en positivo y los cargos en negativo. Las líneas entran pendientes de matching."
      submitLabel="Importar"
      action={importStatement}
      initial={{ message: null, done: false }}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          {data.accounts.length > 0 && <SelectField label="Cuenta bancaria" name="bank_account" clearable placeholder="Sin cuenta de tesorería" value={account} onChange={setAccount} options={data.accounts.map((item) => ({ value: item.code, label: `${item.name} · ${item.currency}`, hint: item.bank ?? undefined }))} hint="Toma el banco y la moneda de la cuenta." />}
          {account === "" && <SelectField label="Banco" name="bank" defaultValue={data.banks[0]} options={data.banks.map((bank) => ({ value: bank, label: bank }))} />}
          <FilePicker label="Archivo del extracto" accept=".csv,.txt,.xlsx" formats="CSV, TXT o XLSX" maxKb={2048} />
          <div className="rounded-xl bg-surface-2 px-3.5 py-2.5">
            <span className="mb-1 block text-[12px] font-semibold text-fg-3">Formato esperado</span>
            <p className="font-mono text-[12px] text-fg-2">30/09/2026;ABONO TRANSF REF 99812;1907.40<br />30/09/2026;COMISION MANTENIMIENTO;-18.50</p>
          </div>
        </>
      )}
    </PanelAction>
  );
}

export function MatchingAction({ pending }: { pending: number }) {
  return (
    <FinanceStep step="reconciliation_matching" label="Ejecutar matching" icon={<Zap size={16} />} title="Ejecutar matching" description={`Se cruzan ${pending === 1 ? "la línea pendiente" : `las ${pending} líneas pendientes`} con pagos y obligaciones: mismo importe en soles (±0,50) y, si hay varias, la que coincide en referencia o RUC. Lo que no coincide queda como excepción.`} submitLabel="Ejecutar" />
  );
}

export function CloseReconciliationAction({ data }: { data: ReconciliationOverview }) {
  const open = data.rows.filter((row) => !row.closure);
  const credits = open.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0);
  const debits = open.filter((row) => row.amount < 0).reduce((sum, row) => sum + row.amount, 0);
  return (
    <FinanceStep step="reconciliation_close" label="Cerrar conciliación" icon={<Lock size={16} />} variant="primary" title="Cerrar conciliación" description="Las líneas cerradas quedan bloqueadas y no se pueden confirmar, rechazar ni resolver." submitLabel="Cerrar conciliación">
      <SummaryBox rows={[{ label: "Líneas", value: String(open.length) }, { label: "Abonos", value: formatMoney(credits) }, { label: "Cargos", value: formatMoney(debits) }, { label: "Neto", value: formatMoney(credits + debits), strong: true }]} />
    </FinanceStep>
  );
}

export function BankLinesTable({ data }: { data: ReconciliationOverview }) {
  const { rows, can } = data;

  const columns: Column<BankLineRow>[] = [
    {
      id: "line",
      header: "Línea del extracto",
      mobile: "title",
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("grid h-8 w-8 flex-none place-items-center rounded-[9px]", row.amount > 0 ? "bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-ok" : "bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] text-bad")}>
            {row.amount > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-mono text-[13px] font-semibold">{row.description}</span>
            <small className="block text-xs text-fg-3">
              {row.code} · {row.bank} · {formatDate(row.date)}
            </small>
          </span>
        </div>
      ),
    },
    {
      id: "amount",
      header: "Importe",
      align: "right",
      cell: (row) => (
        <span className={cn("font-mono text-[13px] font-semibold", row.amount > 0 ? "text-ok" : "text-fg")}>
          {row.amount > 0 ? "+" : "−"}
          {formatMoney(Math.abs(row.amount), row.currency)}
        </span>
      ),
    },
    {
      id: "match",
      header: "Contraparte",
      cell: (row) =>
        row.match ? (
          <span className="text-[13px]" title={row.difference !== null ? `Diferencia ${formatMoney(row.difference)}` : undefined}>
            <span className="flex items-center gap-1.5 font-semibold">
              <Link2 size={13} className="text-fg-3" />
              {row.match.code}
            </span>
            <span className="block max-w-[240px] truncate text-xs text-fg-3">{row.match.label}</span>
          </span>
        ) : (
          <span className="text-[13px] text-fg-3">{row.resolution ?? "Sin contraparte"}</span>
        ),
    },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="grid justify-items-start gap-0.5" title={row.note ?? undefined}>
          {row.status === "excepcion" ? <Badge tone="warn">Excepción</Badge> : <StatusBadge status={row.status} />}
          {row.status === "conciliado" && row.resolution && <span className="text-[11.5px] text-fg-3">{row.resolution}</span>}
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
          {can.operate && row.status === "sugerido" && !row.closure && (
            <>
              <ConfirmLineAction row={row} />
              <RejectLineAction row={row} />
            </>
          )}
          {can.operate && row.status === "excepcion" && !row.closure && <ResolveLineAction row={row} />}
          {(row.status === "conciliado" || row.closure) && <RowIcon tone="edit" label="Conciliada" icon={<CircleCheck size={15} />} disabledHint={row.closure ? `Cerrada en ${row.closure}` : `Conciliada${row.resolved_by ? ` por ${row.resolved_by}` : ""}`} />}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<BankLineRow>[] = [
    { id: "suggested", label: "Sugeridas", tone: "info", icon: <Sparkles size={19} />, matches: (row) => row.status === "sugerido" },
    { id: "pending", label: "Sin matching", tone: "sun", icon: <Clock3 size={19} />, matches: (row) => row.status === "pendiente" },
    { id: "exceptions", label: "Excepciones", tone: "warn", icon: <FileQuestion size={19} />, matches: (row) => row.status === "excepcion" },
    { id: "reconciled", label: "Conciliadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "conciliado" },
  ];

  const filters: FilterConfig<BankLineRow>[] = [
    { id: "bank", label: "Banco", options: unique(rows.map((row) => row.bank)).map((value) => ({ value, label: value })), value: (row) => row.bank },
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.status)).map((value) => ({ value, label: value === "excepcion" ? "Excepción" : statusLabel(value) })), value: (row) => row.status },
    { id: "closure", label: "Cierre", options: [{ value: "abiertas", label: "Abiertas" }, { value: "cerradas", label: "Cerradas" }], value: (row) => (row.closure ? "cerradas" : "abiertas") },
  ];

  const sorts: SortOption<BankLineRow>[] = [
    { id: "date", label: "Fecha valor", type: "date", value: (row) => row.date },
    { id: "amount", label: "Importe", type: "number", value: (row) => Math.abs(row.amount) },
  ];

  return (
    <DataTable
      screen="finanzas-conciliacion"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="líneas"
      searchText={(row) => `${row.code} ${row.description} ${row.bank} ${row.match?.code ?? ""}`}
      searchPlaceholder="Buscar descripción, banco o documento"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
