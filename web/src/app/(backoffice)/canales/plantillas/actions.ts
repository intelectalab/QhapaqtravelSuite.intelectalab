"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import { sendStep, type StepResult } from "@/lib/server/resource";

const done = (result: StepResult) => {
  if (result.done) {
    revalidatePath("/canales/plantillas");
    revalidatePath("/admin/personalizacion");
  }
  return result;
};

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

export async function previewTemplate(code: string): Promise<StepResult & { path?: string }> {
  const result = await apiFetch<{ site_path: string }>(`/cms/templates/${encodeURIComponent(code)}/preview`, { method: "POST", body: {} });
  if (!result.ok || !result.data) return { done: false, message: result.error?.message ?? "No pudimos preparar la vista previa." };
  return { done: true, message: null, path: result.data.site_path };
}

export async function applyTemplate(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep("/cms/theme", "PUT", { template_code: text(form, "code"), lock_version: Number(text(form, "lock_version") || 0) }, "No pudimos aplicar la plantilla."));
}

export async function purchaseTemplate(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/cms/templates/${encodeURIComponent(text(form, "code"))}/purchase`, "POST", { confirm: true }, "No pudimos registrar la compra."));
}

export async function restoreTemplate(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/cms/theme/restore/${encodeURIComponent(text(form, "id"))}`, "POST", {}, "No pudimos restaurar la plantilla."));
}

export async function saveThemeTokens(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(
    await sendStep(
      "/cms/theme/tokens",
      "PATCH",
      { side: text(form, "side"), accent: text(form, "accent"), sun: text(form, "sun"), radius: Number(text(form, "radius")), lock_version: Number(text(form, "lock_version") || 0) },
      "No pudimos guardar la personalización.",
    ),
  );
}
