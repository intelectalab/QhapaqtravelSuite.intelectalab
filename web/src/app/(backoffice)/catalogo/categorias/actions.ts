"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const key = (form: FormData, field: string) => encodeURIComponent(String(form.get(field) ?? ""));

const flag = (form: FormData, field: string) => form.get(field) === "on";

async function run(path: string, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, failure: string): Promise<StepResult> {
  const result = await sendStep(path, method, body, failure);
  if (result.done) {
    revalidatePath("/catalogo/categorias");
    revalidatePath("/catalogo/productos");
  }
  return result;
}

export async function createProductType(_state: StepResult, form: FormData): Promise<StepResult> {
  return run("/catalog/product-types", "POST", { ...formValues(form, ["name"]), requires_itinerary: flag(form, "requires_itinerary"), requires_components: flag(form, "requires_components") }, "No pudimos crear el tipo.");
}

export async function updateProductType(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/product-types/${key(form, "id")}`, "PATCH", { ...formValues(form, ["name", "version"]), requires_itinerary: flag(form, "requires_itinerary"), requires_components: flag(form, "requires_components") }, "No pudimos guardar el tipo.");
}

export async function deleteProductType(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/product-types/${key(form, "id")}`, "DELETE", {}, "No pudimos eliminar el tipo.");
}

export async function createCategory(_state: StepResult, form: FormData): Promise<StepResult> {
  const subcategories = String(form.get("subcategories") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return run("/catalog/categories", "POST", { ...formValues(form, ["name"]), subcategories }, "No pudimos crear la categoría.");
}

export async function updateCategory(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/categories/${key(form, "ref")}`, "PATCH", formValues(form, ["name", "version"]), "No pudimos guardar la categoría.");
}

export async function deleteCategory(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/categories/${key(form, "ref")}`, "DELETE", {}, "No pudimos eliminar la categoría.");
}

export async function createSubcategory(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/categories/${key(form, "ref")}/subcategories`, "POST", formValues(form, ["name"]), "No pudimos agregar la subcategoría.");
}

export async function updateSubcategory(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/categories/${key(form, "ref")}/subcategories/${key(form, "id")}`, "PATCH", formValues(form, ["name", "version"]), "No pudimos guardar la subcategoría.");
}

export async function deleteSubcategory(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/categories/${key(form, "ref")}/subcategories/${key(form, "id")}`, "DELETE", {}, "No pudimos eliminar la subcategoría.");
}
