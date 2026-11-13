"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AGENCY_PREVIEW_BACK } from "@/lib/agency-preview";
import { AGENCY_HOME } from "@/lib/b2b-portal";
import { apiFetch } from "@/lib/server/api";
import { startPreviewSession } from "@/lib/server/preview-session";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

export async function previewAgencyPortal(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await apiFetch<{ token: string; expires_at: string }>(`/channels/b2b/agencies/${encodeURIComponent(String(form.get("code") ?? ""))}/impersonation`, { method: "POST", body: {} });
  if (!result.ok || !result.data) return { message: result.error?.message ?? "No pudimos abrir la vista previa del portal.", done: false };
  if (!(await startPreviewSession(result.data.token, result.data.expires_at, AGENCY_PREVIEW_BACK))) return { message: "Tu sesión venció. Vuelve a ingresar.", done: false };
  redirect(AGENCY_HOME);
}

const FIELDS = ["legal_name", "ruc", "contact_name", "booking_email", "client", "price_list_id", "commission_pct", "currency", "credit_limit", "valid_from", "valid_to"];

export async function saveAgency(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = form.get("code");
  const body = formValues(form, FIELDS);
  const result = typeof code === "string" && code !== ""
    ? await sendStep(`/channels/b2b/agencies/${encodeURIComponent(code)}`, "PATCH", { ...body, ...formValues(form, ["lock_version"]) }, "No pudimos guardar la agencia.")
    : await sendStep("/channels/b2b/agencies", "POST", body, "No pudimos registrar la agencia.");
  if (result.done) revalidatePath("/canales/b2b");
  return result;
}

export async function b2bRateStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const product = encodeURIComponent(String(form.get("product") ?? ""));
  const agency = encodeURIComponent(String(form.get("agency") ?? ""));
  const path = `/catalog/products/${product}/b2b-rates/${agency}`;
  const result =
    form.get("step") === "remove"
      ? await sendStep(path, "DELETE", {}, "No pudimos quitar la tarifa.")
      : await sendStep(path, "PUT", { ...formValues(form, ["net_price", "currency", "commission_pct", "valid_to", "conditions", "restrictions"]), credit_allowed: form.get("credit_allowed") === "on" }, "No pudimos guardar la tarifa.");
  if (result.done) {
    revalidatePath("/canales/b2b");
    revalidatePath("/catalogo/productos", "layout");
  }
  return result;
}

export async function changeAgencyStatus(_state: StepResult, form: FormData): Promise<StepResult> {
  const path = `/channels/b2b/agencies/${encodeURIComponent(String(form.get("code") ?? ""))}`;
  const status = String(form.get("status") ?? "");
  const target = status === "bloqueada" ? { path: `${path}/block`, method: "POST" as const } : status === "activa" ? { path: `${path}/unblock`, method: "POST" as const } : status === "inactiva" ? { path, method: "DELETE" as const } : null;
  if (!target) return { message: "Elige el nuevo estado.", done: false };
  const result = await sendStep(target.path, target.method, formValues(form, ["reason", "lock_version"]), "No pudimos cambiar el estado de la agencia.");
  if (result.done) revalidatePath("/canales/b2b");
  return result;
}
