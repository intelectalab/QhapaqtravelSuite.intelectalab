"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const MAX_FILE_BYTES = 700 * 1024;

function refresh(...paths: string[]) {
  for (const path of ["/proveedor", ...paths]) revalidatePath(path);
}

export async function confirmRequest(code: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/supplier/requests/${encodeURIComponent(code)}/confirm`, "POST", formValues(form, ["confirmation_code", "service_time", "confirmed_by_name", "note"]), "No pudimos registrar la confirmación.");
  if (result.done) refresh("/proveedor/solicitudes", `/proveedor/solicitudes/${code}`, "/proveedor/calendario");
  return result;
}

export async function rejectRequest(code: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/supplier/requests/${encodeURIComponent(code)}/reject`, "POST", formValues(form, ["reason", "note", "alt_date"]), "No pudimos registrar el rechazo.");
  if (result.done) refresh("/proveedor/solicitudes", `/proveedor/solicitudes/${code}`);
  return result;
}

export async function saveRateRequest(code: string | null, _state: StepResult, form: FormData): Promise<StepResult> {
  const body = formValues(form, ["service", "proposed_cost", "effective_from", "reason_type", "reason_detail"]);
  const result = code
    ? await sendStep(`/supplier/rate-requests/${encodeURIComponent(code)}`, "PATCH", body, "No pudimos guardar la solicitud.")
    : await sendStep("/supplier/rate-requests", "POST", body, "No pudimos enviar la solicitud.");
  if (result.done) refresh("/proveedor/tarifas");
  return result;
}

export async function withdrawRateRequest(code: string): Promise<StepResult> {
  const result = await sendStep(`/supplier/rate-requests/${encodeURIComponent(code)}/withdraw`, "POST", {}, "No pudimos retirar la solicitud.");
  if (result.done) refresh("/proveedor/tarifas");
  return result;
}

export async function registerInvoice(code: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "Adjunte la factura en PDF, XML o ZIP.", done: false };
  if (file.size > MAX_FILE_BYTES) return { message: "El archivo supera los 700 KB. Adjunte el XML o un PDF más liviano.", done: false };
  const content = Buffer.from(await file.arrayBuffer()).toString("base64");
  const result = await sendStep(`/supplier/payables/${encodeURIComponent(code)}/invoices`, "POST", { ...formValues(form, ["number", "issue_date", "amount"]), file_name: file.name, file_content: content }, "No pudimos registrar la factura.");
  if (result.done) refresh("/proveedor/pagos");
  return result;
}

export async function annulInvoice(code: string): Promise<StepResult> {
  const result = await sendStep(`/supplier/payables/${encodeURIComponent(code)}/invoices`, "DELETE", {}, "No pudimos anular la factura.");
  if (result.done) refresh("/proveedor/pagos");
  return result;
}

export async function saveContact(id: string | null, _state: StepResult, form: FormData): Promise<StepResult> {
  const body = formValues(form, ["name", "role", "phone", "email"]);
  const result = id
    ? await sendStep(`/supplier/company/contacts/${encodeURIComponent(id)}`, "PATCH", body, "No pudimos guardar el contacto.")
    : await sendStep("/supplier/company/contacts", "POST", body, "No pudimos agregar el contacto.");
  if (result.done) refresh("/proveedor/empresa");
  return result;
}

export async function deleteContact(id: string): Promise<StepResult> {
  const result = await sendStep(`/supplier/company/contacts/${encodeURIComponent(id)}`, "DELETE", {}, "No pudimos quitar el contacto.");
  if (result.done) refresh("/proveedor/empresa");
  return result;
}
