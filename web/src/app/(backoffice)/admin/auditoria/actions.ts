"use server";

import { apiFetch } from "@/lib/server/api";

export async function exportAudit(days: number, format: string): Promise<{ ok: true; id: string; code: string; rows: number; truncated: boolean } | { ok: false; message: string }> {
  const result = await apiFetch<{ export_id: string; code: string; rows: number; truncated?: boolean }>("/audit-events/exports", { method: "POST", body: { filters: { days }, format } });
  if (!result.ok || !result.data) {
    const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { ok: false, message: first ?? result.error?.message ?? "No pudimos exportar la bitácora." };
  }
  return { ok: true, id: result.data.export_id, code: result.data.code, rows: result.data.rows, truncated: Boolean(result.data.truncated) };
}
