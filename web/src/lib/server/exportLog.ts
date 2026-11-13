"use server";

import { apiFetch } from "@/lib/server/api";

export interface ExportLogEntry {
  screen: string;
  title: string;
  format: "xlsx" | "csv";
  scope: "all" | "first" | "selected";
  rows: number;
  columns: string[];
  filters: string[];
}

export async function logExport(entry: ExportLogEntry): Promise<boolean> {
  const result = await apiFetch("/me/data-exports", { method: "POST", body: { ...entry } });
  return result.ok;
}
