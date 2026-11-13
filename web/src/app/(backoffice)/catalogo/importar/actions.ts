"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/catalogo/importar");
  return result;
}

export async function startImport(_state: StepResult, form: FormData): Promise<StepResult> {
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    const payload = new FormData();
    payload.set("source_type", text(form, "source_type"));
    payload.set("file", file);
    const result = await apiFetch("/catalog/imports", { method: "POST", form: payload });
    if (!result.ok) {
      const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
      return { message: firstError ?? result.error?.message ?? "No pudimos leer el archivo.", done: false };
    }
    return refresh({ message: null, done: true });
  }
  return refresh(await sendStep("/catalog/imports", "POST", formValues(form, ["source_type", "source_url", "content"]), "No pudimos iniciar la importación."));
}

export async function confirmImport(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  if (text(form, "step") === "cancel") return refresh(await sendStep(`/catalog/imports/${code}/cancel`, "POST", {}, "No pudimos cancelar la importación."));
  const products = form.getAll("products").map(String);
  if (products.length === 0) return { message: "Elige al menos un producto para crear.", done: false };
  return refresh(await sendStep(`/catalog/imports/${code}/confirm`, "POST", { products }, "No pudimos crear los productos."));
}
