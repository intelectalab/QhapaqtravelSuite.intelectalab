"use client";

import { CircleCheck, CircleDashed, Download, FileSpreadsheet, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { downloadAccountingExport, saveAccountMappings } from "@/app/(backoffice)/finanzas/crecimiento-actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { FormError } from "@/features/auth/AuthForms";
import type { AccountingExportRow, AccountMappings, Option } from "@/lib/growth-ops";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { GrowthStep } from "./GrowthStep";

export function NewExportAction({ targets, scopes, ready }: { targets: Option[]; scopes: Option[]; ready: string[] }) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10);
  const last = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);
  return (
    <GrowthStep step="export_create" label="Nueva exportación" icon={<FileSpreadsheet size={15} />} variant="primary" title="Generar exportación contable" description="Solo entran comprobantes aceptados u observados por SUNAT, con las cuentas de tu plan." submitLabel="Generar archivo">
      <SelectField label="Sistema contable" name="target" options={targets.map((item) => ({ value: item.key, label: ready.includes(item.key) ? item.label : `${item.label} · plan incompleto` }))} defaultValue={ready[0] ?? targets[0]?.key} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Desde" name="period_from" type="date" required defaultValue={first} />
        <TextField label="Hasta" name="period_to" type="date" required defaultValue={last} />
      </div>
      <ChipToggleGroup label="Qué exportar" name="scope" options={scopes.map((item) => ({ value: item.key, label: item.label }))} defaultValue={scopes.map((item) => item.key)} />
    </GrowthStep>
  );
}

function DownloadExport({ code }: { code: string }) {
  const [pending, start] = useTransition();
  return (
    <RowIcon
      tone="view"
      label={pending ? "Preparando…" : "Descargar"}
      icon={<Download size={15} />}
      onClick={() =>
        start(async () => {
          const file = await downloadAccountingExport(code);
          if (!file) return;
          const bytes = Uint8Array.from(atob(file.content), (char) => char.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = file.name;
          anchor.click();
          URL.revokeObjectURL(url);
        })
      }
    />
  );
}

export function ExportsTable({ rows }: { rows: AccountingExportRow[] }) {
  const columns: Column<AccountingExportRow>[] = [
    {
      id: "period",
      header: "Periodo",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <span className="font-semibold">{formatDate(row.period_from)} – {formatDate(row.period_to)}</span>
          <small className="block text-xs text-fg-3">{row.code} · {row.created_by ?? "Sistema"}</small>
        </div>
      ),
    },
    { id: "target", header: "Destino", cell: (row) => <span className="text-[13px]">{row.target_label}</span> },
    { id: "scope", header: "Alcance", wideOnly: true, cell: (row) => <span className="text-[12.5px] text-fg-2">{row.scope_labels.join(" · ")}</span> },
    { id: "rows", header: "Asientos", align: "right", cell: (row) => <span className="font-mono text-[13px]">{formatNumber(row.rows_count)}</span> },
    { id: "status", header: "Estado", cell: (row) => <span className="grid justify-items-start gap-0.5"><Badge tone={row.status === "fallido" ? "bad" : "ok"}>{row.status_label}</Badge><span className="text-[11.5px] text-fg-3">{formatDateTime(row.created_at)}</span></span> },
    { id: "actions", header: "", mobile: "hidden", align: "right", cell: (row) => <RowActions>{row.file_name ? <DownloadExport code={row.code} /> : <RowIcon tone="view" label="Descargar" icon={<Download size={15} />} disabledHint="El archivo no está disponible" />}</RowActions> },
  ];

  const filters: FilterConfig<AccountingExportRow>[] = [{ id: "target", label: "Destino", options: [...new Set(rows.map((row) => row.target_label))].map((value) => ({ value, label: value })), value: (row) => row.target_label }];
  const sorts: SortOption<AccountingExportRow>[] = [
    { id: "created", label: "Fecha de generación", type: "date", value: (row) => row.created_at },
    { id: "period", label: "Inicio del periodo", type: "date", value: (row) => row.period_from },
  ];

  return <DataTable screen="finanzas-exportacion-contable" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="exportaciones" searchText={(row) => `${row.code} ${row.target_label}`} searchPlaceholder="Buscar exportación" filters={filters} sorts={sorts} emptyTitle="Aún no hay exportaciones" />;
}

export function MappingEditor({ data }: { data: AccountMappings }) {
  const router = useRouter();
  const [target, setTarget] = useState(data.targets[0]?.target ?? "csv");
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const current = data.targets.find((item) => item.target === target) ?? data.targets[0];
  const required = new Set(data.scopes.flatMap((scope) => scope.concepts));

  const save = (form: FormData) =>
    start(async () => {
      const mappings = current.concepts.map((concept) => ({ concept: concept.concept, account_code: String(form.get(`account[${concept.concept}]`) ?? "").trim(), cost_center: String(form.get(`center[${concept.concept}]`) ?? "").trim() }));
      const result = await saveAccountMappings(current.target, mappings);
      setMessage(result.message);
      setSaved(result.done);
      if (result.done) router.refresh();
    });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {data.targets.map((item) => (
          <button key={item.target} type="button" onClick={() => { setTarget(item.target); setSaved(false); setMessage(null); }} className={cn("lift flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition", item.target === current.target ? "border-accent bg-accent/10 text-accent" : "border-line text-fg-2 hover:text-fg")}>
            {item.label}
            <span className="font-mono text-[11px] text-fg-3">{item.mapped}/{item.total}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {data.scopes.map((scope) => (
          <span key={scope.key} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold", current.ready[scope.key] ? "bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-ok" : "bg-surface-2 text-fg-3")}>
            {current.ready[scope.key] ? <CircleCheck size={13} /> : <CircleDashed size={13} />}
            {scope.label} {current.ready[scope.key] ? "lista" : "incompleta"}
          </span>
        ))}
      </div>
      <form key={current.target} action={save} className="grid gap-3">
        <FormError message={message} />
        <div className="grid gap-2 sm:grid-cols-2">
          {current.concepts.map((concept) => (
            <div key={concept.concept} className="lift grid grid-cols-[minmax(0,1fr)_110px_90px] items-end gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
              <span className="pb-2 text-[13px] font-semibold">
                {concept.label}
                {required.has(concept.concept) && <span className="block text-[11px] font-normal text-fg-3">Requerida para exportar</span>}
              </span>
              <TextField label="Cuenta" name={`account[${concept.concept}]`} defaultValue={concept.account_code ?? ""} maxLength={30} placeholder="70111" />
              <TextField label="C. costo" name={`center[${concept.concept}]`} defaultValue={concept.cost_center ?? ""} maxLength={30} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-[13px] font-semibold text-ok">Plan de cuentas guardado.</span>}
          <Button type="submit" variant="primary" icon={<Save size={15} />} disabled={pending}>
            {pending ? "Guardando…" : `Guardar plan de ${current.label}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
