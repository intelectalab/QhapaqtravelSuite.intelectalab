"use server";

import { revalidatePath } from "next/cache";
import { sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

async function finish(result: Promise<StepResult>): Promise<StepResult> {
  const outcome = await result;
  if (outcome.done) revalidatePath("/canales/seo");
  return outcome;
}

export async function addDomain(_state: StepResult, form: FormData): Promise<StepResult> {
  return finish(sendStep("/cms/domains", "POST", { host: text(form, "host"), purpose: text(form, "purpose") || "principal" }, "No pudimos agregar el dominio."));
}

export async function verifyDomain(_state: StepResult, form: FormData): Promise<StepResult> {
  return finish(sendStep(`/cms/domains/${encodeURIComponent(text(form, "id"))}/verify`, "POST", {}, "No pudimos verificar el dominio."));
}

export async function retireDomain(_state: StepResult, form: FormData): Promise<StepResult> {
  return finish(sendStep(`/cms/domains/${encodeURIComponent(text(form, "id"))}`, "DELETE", {}, "No pudimos retirar el dominio."));
}

export async function savePage(_state: StepResult, form: FormData): Promise<StepResult> {
  const schema = text(form, "schema_types").split(",").map((item) => item.trim()).filter(Boolean);
  return finish(
    sendStep(
      `/cms/seo/pages/${encodeURIComponent(text(form, "id"))}`,
      "PATCH",
      { title: text(form, "title"), meta_description: text(form, "meta_description") || null, focus_keyword: text(form, "focus_keyword") || null, schema_types: schema, canonical_url: text(form, "canonical_url") || null, indexable: form.get("indexable") === "1" },
      "No pudimos guardar el SEO de la página.",
    ),
  );
}

export async function runAudit(): Promise<StepResult> {
  return finish(sendStep("/cms/seo/audit", "POST", {}, "No pudimos reauditar el sitio."));
}

export async function addRedirect(_state: StepResult, form: FormData): Promise<StepResult> {
  return finish(sendStep("/cms/redirects", "POST", { from_path: text(form, "from_path"), to_path: text(form, "to_path"), code: Number(text(form, "code") || 301) }, "No pudimos crear la redirección."));
}

export async function disableRedirect(_state: StepResult, form: FormData): Promise<StepResult> {
  return finish(sendStep(`/cms/redirects/${encodeURIComponent(text(form, "id"))}`, "DELETE", {}, "No pudimos desactivar la redirección."));
}
