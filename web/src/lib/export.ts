import type { CsvColumn, CsvValue } from "@/lib/csv";

export type ExportType = "text" | "number" | "money" | "date" | "datetime";

export interface ExportInfo {
  title: string;
  company: string;
  user: string;
  scope: string;
  rows: number;
  filters: string[];
  columnsNote?: string;
  currencySymbol: string;
  color: string;
}

type Cell = { value?: unknown; [key: string]: unknown } | null;

const GRID = "#E2E8F0";
const ZEBRA = "#F1F5F9";
const MUTED = "#64748B";
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

const pad = (value: number) => String(value).padStart(2, "0");

function nowText(): string {
  const now = new Date();
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function wallClock(raw: CsvValue, withTime: boolean): Date | null {
  if (raw === null || raw === undefined || raw === "" || typeof raw === "boolean") return null;
  const text = String(raw);
  const dateOnly = DATE_ONLY.exec(text);
  if (dateOnly) return new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])));
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), withTime ? parsed.getHours() : 0, withTime ? parsed.getMinutes() : 0));
}

function plainDate(date: Date, withTime: boolean): string {
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}${withTime ? ` ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}` : ""}`;
}

function numberOf(raw: CsvValue): number | null {
  if (raw === null || raw === undefined || raw === "" || typeof raw === "boolean") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function textOf(raw: CsvValue): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "boolean") return raw ? "Sí" : "No";
  return String(raw);
}

export function columnType<T>(column: CsvColumn<T>, rows: T[]): ExportType {
  if (column.type) return column.type;
  const sample = rows.slice(0, 30).map((row) => column.value(row)).filter((value) => value !== null && value !== undefined && value !== "");
  if (sample.length === 0) return "text";
  if (sample.every((value) => typeof value === "number")) return "number";
  if (sample.every((value) => typeof value === "string" && DATE_ONLY.test(value))) return "date";
  if (sample.every((value) => typeof value === "string" && DATE_TIME.test(value))) return "datetime";
  return "text";
}

export function exportFileName(title: string, company: string, extension: "xlsx" | "csv"): string {
  const now = new Date();
  const clean = (text: string) => text.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${[clean(title), clean(company)].filter(Boolean).join(" - ")} - ${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}.${extension}`;
}

export function titleFromSlug(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Lista";
}

function infoRows(info: ExportInfo): [string, string][] {
  return [
    ["Lista", info.title],
    ["Empresa", info.company],
    ["Exportado por", info.user],
    ["Fecha", nowText()],
    ["Qué se exportó", info.scope],
    ["Filas", String(info.rows)],
    ...(info.columnsNote ? [["Columnas", info.columnsNote] as [string, string]] : []),
    ...(info.filters.length ? info.filters.map((filter, index) => [index === 0 ? "Filtros" : "", filter] as [string, string]) : [["Filtros", "Sin filtros: la lista completa"] as [string, string]]),
  ];
}

const spanned = (cell: Record<string, unknown>, span: number): Cell[] => [{ ...cell, columnSpan: span }, ...Array.from({ length: span - 1 }, () => null)];

export async function downloadXlsx<T>(rows: T[], columns: CsvColumn<T>[], info: ExportInfo, fileName: string) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const money = `"${info.currencySymbol.replace(/"/g, "")} "#,##0.00`;
  const types = columns.map((column) => columnType(column, rows));
  const span = Math.max(columns.length, 1);
  const lastRow = rows.length - 1;

  const header = columns.map((column, index) => ({
    value: column.header,
    fontWeight: "bold" as const,
    backgroundColor: info.color,
    textColor: "#FFFFFF",
    borderColor: info.color,
    borderStyle: "thin" as const,
    alignVertical: "center" as const,
    align: types[index] === "money" || types[index] === "number" ? ("right" as const) : ("left" as const),
    height: 22,
    wrap: true,
  }));

  const body: Cell[][] = rows.map((row, rowIndex) =>
    columns.map((column, index) => {
      const raw = column.value(row);
      const style = { ...(rowIndex % 2 === 1 ? { backgroundColor: ZEBRA } : {}), ...(rowIndex === lastRow ? {} : { bottomBorderColor: GRID, bottomBorderStyle: "thin" }) };
      const type = types[index];
      if (type === "number" || type === "money") {
        const value = numberOf(raw);
        return { ...style, ...(value === null ? {} : { value, type: Number, ...(type === "money" ? { format: money } : {}) }) };
      }
      if (type === "date" || type === "datetime") {
        const value = wallClock(raw, type === "datetime");
        return { ...style, ...(value === null ? {} : { value, type: Date, format: type === "datetime" ? "dd/mm/yyyy hh:mm" : "dd/mm/yyyy" }) };
      }
      const text = textOf(raw);
      return { ...style, ...(text === "" ? {} : { value: text, type: String }) };
    }),
  );

  const totalIndexes = columns.map((column, index) => (column.total ? index : -1)).filter((index) => index >= 0);
  const totals: Cell[][] =
    totalIndexes.length && rows.length > 1
      ? [
          columns.map((_, index) => {
            const style = { fontWeight: "bold" as const, topBorderColor: info.color, topBorderStyle: "medium" as const };
            if (totalIndexes.includes(index)) {
              const sum = body.reduce((acc, row) => acc + (typeof row[index]?.value === "number" ? (row[index]?.value as number) : 0), 0);
              return { ...style, value: Math.round(sum * 100) / 100, type: Number, ...(types[index] === "money" ? { format: money } : {}) };
            }
            return index === 0 ? { ...style, value: "Total", type: String } : style;
          }),
        ]
      : [];

  const summary = [`${info.rows} ${info.rows === 1 ? "fila" : "filas"}`, info.scope, ...info.filters].join(" · ");
  const heading: Cell[][] = [
    spanned({ value: info.company, type: String, fontWeight: "bold", fontSize: 14, textColor: info.color, height: 22 }, span),
    spanned({ value: `${info.title} · ${nowText()}${info.user ? ` · por ${info.user}` : ""}`, type: String, textColor: MUTED }, span),
    spanned({ value: summary.length > 250 ? `${summary.slice(0, 247)}…` : summary, type: String, textColor: MUTED, fontSize: 9 }, span),
    columns.map(() => null),
  ];

  const widths = columns.map((column, index) => ({
    width: Math.min(
      45,
      Math.max(
        10,
        column.header.length + 3,
        ...body.slice(0, 200).map((row) => {
          const cell = row[index];
          if (!cell || cell.value === undefined) return 0;
          if (cell.value instanceof Date) return types[index] === "datetime" ? 17 : 11;
          return String(cell.value).length + (types[index] === "money" ? info.currencySymbol.length + 6 : 2);
        }),
      ),
    ),
  }));

  await writeExcelFile([
    { data: [...heading, header, ...body, ...totals] as never, sheet: info.title.slice(0, 31), columns: widths, stickyRowsCount: heading.length + 1, showGridLines: false },
    { data: infoRows(info).map(([label, value]) => [{ value: label, fontWeight: "bold" as const }, { value }]) as never, sheet: "Filtros", columns: [{ width: 18 }, { width: 70 }] },
  ]).toFile(fileName);
}

const csvText = (value: string) => (/[",\n\r]/.test(value) || value !== value.trim() ? `"${value.replace(/"/g, '""')}"` : value);

export function downloadCsvFile<T>(rows: T[], columns: CsvColumn<T>[], fileName: string) {
  const types = columns.map((column) => columnType(column, rows));
  const lines = [
    columns.map((column) => csvText(column.header)).join(","),
    ...rows.map((row) =>
      columns
        .map((column, index) => {
          const raw = column.value(row);
          const type = types[index];
          if (type === "date" || type === "datetime") {
            const date = wallClock(raw, type === "datetime");
            return date ? plainDate(date, type === "datetime") : "";
          }
          if (type === "number" || type === "money") {
            const value = numberOf(raw);
            return value === null ? "" : String(value);
          }
          return csvText(textOf(raw));
        })
        .join(","),
    ),
  ];
  const url = URL.createObjectURL(new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
