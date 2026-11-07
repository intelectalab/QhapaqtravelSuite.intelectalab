"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

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

export async function changeAgencyStatus(_state: StepResult, form: FormData): Promise<StepResult> {
  const path = `/channels/b2b/agencies/${encodeURIComponent(String(form.get("code") ?? ""))}`;
  const status = String(form.get("status") ?? "");
  const target = status === "bloqueada" ? { path: `${path}/block`, method: "POST" as const } : status === "activa" ? { path: `${path}/unblock`, method: "POST" as const } : status === "inactiva" ? { path, method: "DELETE" as const } : null;
  if (!target) return { message: "Elige el nuevo estado.", done: false };
  const result = await sendStep(target.path, target.method, formValues(form, ["reason", "lock_version"]), "No pudimos cambiar el estado de la agencia.");
  if (result.done) revalidatePath("/canales/b2b");
  return result;
}
