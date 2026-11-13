export type CsvValue = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
  type?: "text" | "number" | "money" | "date" | "datetime";
  total?: boolean;
}

export interface CsvExport<T> {
  fileName: string;
  title?: string;
  columns: CsvColumn<T>[];
}

const SEPARATOR = ";";

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "boolean" ? (value ? "Sí" : "No") : String(value);
  return /[";\n\r]/.test(text) || text !== text.trim() ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((column) => csvCell(column.header)).join(SEPARATOR), ...rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(SEPARATOR))];
  return `﻿${lines.join("\r\n")}`;
}

export function csvFileName(base: string, today = new Date()): string {
  const slug = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "exportacion"}-${today.toISOString().slice(0, 10)}.csv`;
}

export function downloadCsv<T>(rows: T[], { fileName, columns }: CsvExport<T>) {
  const url = URL.createObjectURL(new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = csvFileName(fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
