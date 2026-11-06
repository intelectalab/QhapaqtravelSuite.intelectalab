"use server";

import type { AdminActionState } from "@/lib/admin";
import { fields, sendAdmin, text } from "@/lib/server/admin";

const PATH = "/admin/integraciones";

const code = (form: FormData) => encodeURIComponent(text(form, "code") ?? "");

export async function configureAdapter(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/integrations/${code(form)}/config`, "PATCH", fields(form, ["environment", "owner_user_id", "max_retries", "backoff_base_s", "timeout_s"]), PATH, "No pudimos guardar la configuración.");
}

export async function testAdapter(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/integrations/${code(form)}/test`, "POST", {}, PATH, "No pudimos probar la conexión.");
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
