"use server";

import { revalidatePath } from "next/cache";
import type { CmsPreview } from "@/lib/channels";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

export async function previewContent(code: string, values: Record<string, string>): Promise<{ data: CmsPreview | null; message: string | null }> {
  const body = Object.fromEntries(["title", "body", "slug", "type", "seo_title", "seo_description"].map((key) => [key, values[key]?.trim() ? values[key].trim() : null]));
  const result = await apiFetch<CmsPreview>(`/cms/contents/${encodeURIComponent(code)}/preview`, { method: "POST", body });
  return result.ok ? { data: result.data, message: null } : { data: null, message: result.error?.message ?? "No pudimos generar la vista previa." };
}

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
