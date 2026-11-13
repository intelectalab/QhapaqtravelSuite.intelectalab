"use server";

import { revalidatePath } from "next/cache";
import type { AdminActionState, ConnectionTestLog } from "@/lib/admin";
import { fields, sendAdmin, text } from "@/lib/server/admin";
import { apiFetch } from "@/lib/server/api";

export interface ConnectionTestState extends AdminActionState {
  log: ConnectionTestLog | null;
  ok?: boolean;
  result?: string | null;
}

const PATH = "/admin/integraciones";

const code = (form: FormData) => encodeURIComponent(text(form, "code") ?? "");

export async function configureAdapter(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/integrations/${code(form)}/config`, "PATCH", fields(form, ["environment", "owner_user_id", "max_retries", "backoff_base_s", "timeout_s"]), PATH, "No pudimos guardar la configuración.");
}

export async function testAdapter(_state: ConnectionTestState, form: FormData): Promise<ConnectionTestState> {
  const result = await apiFetch<{ meta?: { ok: boolean; result: string; log?: ConnectionTestLog } }>(`/integrations/${code(form)}/test`, { method: "POST", body: {}, raw: true });
  if (!result.ok) return { message: result.error?.message ?? "No pudimos probar la conexión.", done: false, log: null };
  revalidatePath(PATH, "layout");
  const meta = result.data?.meta;
  return { message: null, done: false, log: meta?.log ?? null, ok: meta?.ok ?? false, result: meta?.result ?? null };
}

export async function setJobStatus(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const mode = text(form, "mode") === "resume" ? "resume" : "pause";
  return sendAdmin(`/jobs/${code(form)}/${mode}`, "POST", {}, PATH);
}

export async function retryIntegrationError(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/integration-errors/${code(form)}/retry`, "POST", {}, PATH, "No pudimos reintentar.");
}

export async function resolveIntegrationError(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/integration-errors/${code(form)}/resolve`, "POST", { resolution: text(form, "resolution") }, PATH, "No pudimos marcar el error como resuelto.");
}

export async function runJob(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/jobs/${code(form)}/run`, "POST", {}, PATH, "No pudimos ejecutar el proceso.");
}
