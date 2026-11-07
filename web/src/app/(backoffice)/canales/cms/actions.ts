"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const FIELDS = ["title", "type", "channel", "slug", "body", "seo_title", "seo_description", "placement", "valid_from", "valid_to"];

const ACTIONS: Record<string, string> = { en_revision: "submit", borrador: "return", aprobado: "approve", publicado: "publish", despublicado: "unpublish" };

const path = (code: string) => `/cms/contents/${encodeURIComponent(code)}`;

export async function saveContent(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const body = formValues(form, FIELDS);
  const result = code ? await sendStep(path(code), "PATCH", { ...body, ...formValues(form, ["lock_version"]) }, "No pudimos guardar el contenido.") : await sendStep("/cms/contents", "POST", body, "No pudimos crear el contenido.");
  if (result.done) revalidatePath("/canales/cms");
  return result;
}

export async function transitionContent(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const action = ACTIONS[String(form.get("to") ?? "")];
  if (!action) return { message: "Elige el nuevo estado.", done: false };
  const result = await sendStep(`${path(code)}/${action}`, "POST", formValues(form, ["reason", "lock_version"]), "No pudimos cambiar el estado.");
  if (result.done) revalidatePath("/canales/cms");
  return result;
}

export async function archiveContent(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const result = await sendStep(path(code), "DELETE", {}, "No pudimos archivar el contenido.");
  if (result.done) revalidatePath("/canales/cms");
  return result;
}
