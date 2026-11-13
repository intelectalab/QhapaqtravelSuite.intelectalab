"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/admin/whatsapp");
  return result;
}

export async function saveWhatsappTemplate(_state: StepResult, form: FormData): Promise<StepResult> {
  const id = text(form, "id");
  if (id) return refresh(await sendStep(`/inbox/whatsapp-templates/${encodeURIComponent(id)}`, "PATCH", formValues(form, ["category", "purpose", "body"]), "No pudimos guardar la plantilla."));
  return refresh(await sendStep("/inbox/whatsapp-templates", "POST", formValues(form, ["name", "lang", "category", "purpose", "body"]), "No pudimos crear la plantilla."));
}

export async function whatsappTemplateStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const id = encodeURIComponent(text(form, "id"));
  const step = text(form, "step");
  if (step === "review") return refresh(await sendStep(`/inbox/whatsapp-templates/${id}`, "PATCH", formValues(form, ["meta_status", "rejected_reason"]), "No pudimos registrar la respuesta de Meta."));
  return refresh(await sendStep(`/inbox/whatsapp-templates/${id}`, "PATCH", { action: step }, "No pudimos cambiar el estado de la plantilla."));
}
