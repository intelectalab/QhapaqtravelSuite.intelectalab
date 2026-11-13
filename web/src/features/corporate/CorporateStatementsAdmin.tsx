"use client";

import { Ban, FilePlus2, Mail } from "lucide-react";
import { generateStatement, sendStatement, voidStatement } from "@/app/(backoffice)/finanzas/estados-cuenta-corporativos/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { num, type CorporateStatement, type StatementsPage } from "@/lib/corporate";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Tone } from "@/lib/tone";
import { CorporateStep } from "./CorporateForms";
import { StatementFigures } from "./CorporateStatementsView";

type Accounts = StatementsPage["meta"]["accounts"];

const STATUS_TONE: Record<CorporateStatement["status"], Tone> = { generado: "info", enviado: "ok", anulado: "mute" };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];

const recentMonths = () => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
  now.setDate(1);
  return Array.from({ length: 13 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: `${MONTHS[date.getMonth()].charAt(0).toUpperCase()}${MONTHS[date.getMonth()].slice(1)} ${date.getFullYear()}${offset === 0 ? " (en curso)" : ""}` };
  });
};

export function GenerateStatementAction({ accounts }: { accounts: Accounts }) {
  return (
    <CorporateStep id="estado-nuevo" label="Generar estado" icon={<FilePlus2 size={16} />} variant="primary" title="Generar estado de cuenta" description="Toma los movimientos del mes en la moneda de la cuenta y los congela." submitLabel="Generar" action={generateStatement}>
      <SelectField label="Cuenta corporativa" name="account_id" options={accounts.map((account) => ({ value: account.id, label: `${account.client_name} · ${account.currency}` }))} placeholder="Elige la empresa" searchable />
      <SelectField label="Mes" name="month" options={recentMonths()} defaultValue={recentMonths()[1].value} />
    </CorporateStep>
  );
}

export function StatementsTable({ statements, accounts }: { statements: CorporateStatement[]; accounts: Accounts }) {
  const columns: Column<CorporateStatement>[] = [
    {
      id: "statement",
      header: "Estado de cuenta",
      mobile: "title",
      cell: (row) => (
        <span className="min-w-0">
          <b className="block font-semibold">
            {row.account.client_name} · {row.label}
          </b>
          <small className="block font-mono text-xs text-fg-3">{row.code}</small>
        </span>
      ),
    },
    { id: "figures", header: "Movimientos", wideOnly: true, cell: (row) => <StatementFigures statement={row} /> },
    { id: "closing", header: "Saldo final", align: "right", cell: (row) => <b className={num(row.closing_balance) > 0 ? "font-mono text-[13px] text-warn" : "font-mono text-[13px]"}>{formatMoney(row.closing_balance, row.currency)}</b> },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="grid justify-items-start gap-0.5">
          <Badge tone={STATUS_TONE[row.status]}>{row.status_label}</Badge>
          {row.sent_at && <small className="text-[11.5px] text-fg-3">{formatDateTime(row.sent_at)}</small>}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "hidden",
      cell: (row) => (
        <RowActions>
          <DownloadButton href={`/finanzas/estados-cuenta-corporativos/${row.code}/pdf`} label="Descargar PDF" size="sm" iconOnly />
          {row.status !== "anulado" ? (
            <CorporateStep id={`enviar-${row.code}`} label="Enviar" title={`Enviar ${row.code}`} description="Se envía con el PDF a los destinatarios de la cuenta. Puedes cambiarlos solo para este envío." submitLabel="Enviar" action={sendStatement} trigger={(open) => <RowIcon tone="edit" label="Enviar por correo" icon={<Mail size={15} />} onClick={open} />}>
              <input type="hidden" name="code" value={row.code} />
              <StatementFigures statement={row} />
              <TextField label="Destinatarios" name="recipients" defaultValue={row.sent_to.join(", ")} hint="Vacío para usar los correos configurados en la cuenta." />
            </CorporateStep>
          ) : (
            <RowIcon tone="edit" label="Enviar por correo" icon={<Mail size={15} />} disabledHint="Un estado anulado no se envía" />
          )}
          {row.status !== "anulado" && (
            <CorporateStep id={`anular-${row.code}`} label="Anular" title={`Anular ${row.code}`} description="Anula el estado para volver a generar el mes con los movimientos actuales." submitLabel="Anular" action={voidStatement} trigger={(open) => <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} onClick={open} />}>
              <input type="hidden" name="code" value={row.code} />
              <TextArea label="Motivo" name="reason" rows={3} maxLength={300} placeholder="Por ejemplo: pago registrado después del cierre" />
            </CorporateStep>
          )}
        </RowActions>
      ),
    },
  ];
  const filters: FilterConfig<CorporateStatement>[] = [
    { id: "account", label: "Empresa", options: accounts.map((account) => ({ value: account.id, label: account.client_name })), value: (row) => row.account.id },
    { id: "status", label: "Estado", options: [{ value: "generado", label: "Generado" }, { value: "enviado", label: "Enviado" }, { value: "anulado", label: "Anulado" }], value: (row) => row.status },
  ];
  const sorts: SortOption<CorporateStatement>[] = [
    { id: "month", label: "Mes", type: "text", value: (row) => row.month },
    { id: "closing", label: "Saldo final", type: "number", value: (row) => num(row.closing_balance) },
  ];
  return <DataTable screen="finanzas-estados-corporativos" rows={statements} columns={columns} getKey={(row) => row.code} entityLabel="estados de cuenta" searchText={(row) => `${row.code} ${row.account.client_name} ${row.label}`} searchPlaceholder="Buscar empresa, mes o código" filters={filters} sorts={sorts} emptyTitle="Aún no hay estados de cuenta" />;
}
