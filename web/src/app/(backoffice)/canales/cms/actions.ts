"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const FIELDS = ["title", "type", "channel", "slug", "body", "seo_title", "seo_description", "placement", "valid_from", "valid_to"];

const path = (code: string) => `/channels/cms/${encodeURIComponent(code)}`;

export async function saveContent(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const body = formValues(form, FIELDS);
  const result = code ? await sendStep(path(code), "PATCH", body, "No pudimos guardar el contenido.") : await sendStep("/channels/cms", "POST", body, "No pudimos crear el contenido.");
  if (result.done) revalidatePath("/canales/cms");
  return result;
}

export async function transitionContent(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const result = await sendStep(`${path(code)}/transition`, "POST", formValues(form, ["to", "reason"]), "No pudimos cambiar el estado.");
  if (result.done) revalidatePath("/canales/cms");
  return result;
}

export async function archiveContent(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const result = await sendStep(path(code), "DELETE", {}, "No pudimos archivar el contenido.");
  if (result.done) revalidatePath("/canales/cms");
  return result;
}
