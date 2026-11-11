"use server";

import type { AdminActionState } from "@/lib/admin";
import { sendAdmin, text } from "@/lib/server/admin";

export async function exportReport(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(
    "/reports/exports",
    "POST",
    { report_key: text(form, "report_key"), format: text(form, "format"), scope: text(form, "scope") ?? "filtered", filters: { period: text(form, "period"), sede: text(form, "sede") } },
    "/reportes",
    "No pudimos generar la exportación.",
  );
}

export async function scheduleReport(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const recipients = (text(form, "recipients") ?? "")
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);
  return sendAdmin(
    "/reports/schedules",
    "POST",
    { report_key: text(form, "report_key"), frequency: text(form, "frequency"), time: text(form, "time"), format: text(form, "format"), period: text(form, "period"), sede: text(form, "sede"), recipients },
    "/reportes",
    "No pudimos programar el envío.",
  );
}

export async function toggleReportSchedule(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const code = encodeURIComponent(text(form, "code") ?? "");
  return sendAdmin(`/reports/schedules/${code}/${text(form, "mode") === "resume" ? "resume" : "pause"}`, "POST", {}, "/reportes", "No pudimos cambiar el envío programado.");
}

export async function deleteReportSchedule(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/jobs/${encodeURIComponent(text(form, "code") ?? "")}`, "DELETE", {}, "/reportes", "No pudimos eliminar el envío programado.");
}
