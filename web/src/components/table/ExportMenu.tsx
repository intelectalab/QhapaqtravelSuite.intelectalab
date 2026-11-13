"use client";

import * as Popover from "@radix-ui/react-popover";
import { FileDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { useOptionalMe } from "@/components/shell/SessionProvider";
import { cn } from "@/lib/cn";
import type { CsvColumn } from "@/lib/csv";
import { downloadCsvFile, downloadXlsx, exportFileName } from "@/lib/export";
import { logExport } from "@/lib/server/exportLog";
import { useStoredValue } from "@/lib/useStoredValue";

const LIMITS = [50, 100, 500];
const BRAND = "#22306B";
const CURRENCY: Record<string, string> = { PEN: "S/", USD: "US$" };

type Scope = "all" | "selected" | number;

const parseHidden = (raw: string | null): string[] => {
  try {
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

export function ExportMenu<T>({ title, screen, columns, filtered, selected, filters }: { title: string; screen: string; columns: CsvColumn<T>[]; filtered: T[]; selected: T[]; filters: string[] }) {
  const me = useOptionalMe();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("all");
  const [hidden, setHidden] = useStoredValue(`export-columns:${screen}`, parseHidden, JSON.stringify);
  const [busy, setBusy] = useState<"xlsx" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chosen = columns.filter((column) => !hidden.includes(column.header));
  const rows = scope === "selected" ? selected : typeof scope === "number" ? filtered.slice(0, scope) : filtered;
  const limits = LIMITS.filter((limit) => limit < filtered.length);
  const scopeText = scope === "selected" ? "Filas seleccionadas" : typeof scope === "number" ? `Primeras ${scope} según el orden de la lista` : "Todas las filas con los filtros aplicados";

  const openChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setScope(selected.length > 0 ? "selected" : "all");
      setError(null);
    }
  };

  const toggleColumn = (header: string) => setHidden(hidden.includes(header) ? hidden.filter((item) => item !== header) : [...hidden, header]);

  const run = async (format: "xlsx" | "csv") => {
    if (rows.length === 0) return setError("No hay filas para exportar con estos filtros.");
    if (chosen.length === 0) return setError("Marca al menos una columna.");
    setBusy(format);
    setError(null);
    try {
      if (me) {
        const logged = await logExport({ screen, title, format, scope: scope === "selected" ? "selected" : typeof scope === "number" ? "first" : "all", rows: rows.length, columns: hidden.length ? chosen.map((column) => column.header) : [], filters });
        if (!logged) throw new Error("log");
      }
      const company = me?.tenant.name ?? "";
      const fileName = exportFileName(title, company, format);
      if (format === "csv") downloadCsvFile(rows, chosen, fileName);
      else
        await downloadXlsx(rows, chosen, {
          title,
          company,
          user: me?.name ?? "",
          scope: scopeText,
          rows: rows.length,
          filters,
          columnsNote: hidden.length ? chosen.map((column) => column.header).join(", ") : undefined,
          currencySymbol: CURRENCY[me?.tenant.base_currency ?? "PEN"] ?? "S/",
          color: me?.tenant.branding?.brand ?? BRAND,
        }, fileName);
      setOpen(false);
    } catch {
      setError("No se pudo exportar. Inténtalo de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  const chip = (active: boolean) => cn("h-8 rounded-[9px] border px-2.5 text-[12.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40", active ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface text-fg-2 hover:text-fg");

  return (
    <Popover.Root open={open} onOpenChange={openChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={filtered.length === 0}
          title={filtered.length === 0 ? "No hay filas para exportar" : "Exportar a Excel o CSV"}
          aria-label="Exportar"
          data-testid="table-export"
          className={cn("inline-flex h-9 flex-none items-center gap-2 whitespace-nowrap rounded-[10px] border px-3 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50", open ? "border-fg bg-fg text-surface" : "border-line bg-surface text-fg-2 hover:text-fg")}
        >
          <FileDown size={15} className={open ? undefined : "text-accent"} />
          <span className="hidden xl:inline">Exportar</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-80 rounded-2xl border border-line bg-surface p-4 shadow-[0_24px_48px_-20px_rgb(14_17_32/0.45)]">
          <p className="text-[14px] font-bold">Exportar {title.toLowerCase()}</p>
          <p className="mt-0.5 text-[12.5px] text-fg-3">Con los filtros que tienes puestos y en el orden de la lista.</p>

          <p className="mb-1.5 mt-4 text-[12px] font-semibold text-fg-3">Cuántas filas</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(scope === "all")} onClick={() => setScope("all")}>
              Todas ({filtered.length})
            </button>
            {limits.map((limit) => (
              <button key={limit} type="button" className={chip(scope === limit)} onClick={() => setScope(limit)}>
                Primeras {limit}
              </button>
            ))}
            <button type="button" className={chip(scope === "selected")} disabled={selected.length === 0} onClick={() => setScope("selected")}>
              Seleccionadas ({selected.length})
            </button>
          </div>
          {typeof scope === "number" && <p className="mt-1.5 text-[11.5px] text-fg-3">Las primeras {scope} según el orden de la lista. Para tener las más recientes, ordena por fecha antes de exportar.</p>}

          <div className="mb-1.5 mt-4 flex items-center justify-between">
            <p className="text-[12px] font-semibold text-fg-3">
              Columnas ({chosen.length} de {columns.length})
            </p>
            <span className="flex gap-2 text-[12px] font-semibold text-accent">
              <button type="button" onClick={() => setHidden([])}>
                Todas
              </button>
              <button type="button" onClick={() => setHidden(columns.map((column) => column.header))}>
                Ninguna
              </button>
            </span>
          </div>
          <ul className="scroll-thin flex max-h-44 flex-col gap-0.5 overflow-y-auto rounded-xl border border-line p-1.5">
            {columns.map((column) => (
              <li key={column.header}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-surface-2">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--accent,#22306B)]" checked={!hidden.includes(column.header)} onChange={() => toggleColumn(column.header)} />
                  {column.header}
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11.5px] text-fg-3">Se recuerdan para la próxima vez en este equipo.</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy !== null} onClick={() => run("xlsx")} className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-accent text-[13.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60" data-testid="export-xlsx">
              {busy === "xlsx" ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
              Excel
            </button>
            <button type="button" disabled={busy !== null} onClick={() => run("csv")} className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-line text-[13.5px] font-semibold text-fg transition hover:bg-surface-2 disabled:opacity-60" data-testid="export-csv">
              {busy === "csv" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              CSV
            </button>
          </div>
          {error && <p className="mt-2 text-[12.5px] text-bad">{error}</p>}
          <p className="mt-3 text-[11.5px] text-fg-3">
            {rows.length} {rows.length === 1 ? "fila" : "filas"}
            {me ? " · La descarga queda registrada con tu nombre." : ""}
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
