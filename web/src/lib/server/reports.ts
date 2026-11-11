import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { REALMS } from "@/lib/realms";
import type { ReportExport, ReportExportsData, ReportPayload, ReportSchedule, ReportTab } from "@/lib/reports";
import { apiFetch } from "./api";
import { getResource } from "./resource";

export const getReportExports = cache(async (): Promise<ReportExportsData | null> => {
  const result = await apiFetch<{ data: ReportExport[]; meta: { schedules: ReportSchedule[]; can_export: boolean; tabs: ReportTab[]; periods: ReportExportsData["periods"]; frequencies: ReportExportsData["frequencies"] } }>("/reports/exports", { raw: true });
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar las exportaciones.");
  return { exports: result.data.data, ...result.data.meta };
});

export async function getReport(report: string, period?: string, sede?: string): Promise<ReportPayload | null> {
  const query = new URLSearchParams();
  if (period) query.set("period", period);
  if (sede) query.set("sede", sede);
  return getResource<ReportPayload>(`/reports/${encodeURIComponent(report)}${query.size ? `?${query}` : ""}`, "No pudimos cargar el reporte.");
}
