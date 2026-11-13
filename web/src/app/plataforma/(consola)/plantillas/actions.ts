"use server";

import { revalidatePath } from "next/cache";
import { platformSend, type ConsoleResult } from "@/lib/server/platformConsole";

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

const optional = (form: FormData, field: string) => text(form, field) || null;

async function finish(result: Promise<ConsoleResult>): Promise<ConsoleResult> {
  const outcome = await result;
  if (outcome.done) revalidatePath("/plataforma/plantillas", "layout");
  return outcome;
}

const number = (form: FormData, field: string) => (text(form, field) === "" ? null : Number(text(form, field)));

export async function saveTemplate(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const original = text(form, "original");
  const body = {
    name: text(form, "name"),
    description: text(form, "description"),
    category: text(form, "category"),
    tier: text(form, "tier"),
    price_once: number(form, "price_once"),
    min_plan_code: optional(form, "min_plan_code"),
    tags: text(form, "tags").split(",").map((tag) => tag.trim()).filter(Boolean),
  };
  if (original) return finish(platformSend(`/templates/${encodeURIComponent(original)}`, "PATCH", body, "No pudimos guardar la plantilla."));
  return finish(platformSend("/templates", "POST", { ...body, slug: text(form, "slug"), author_kind: text(form, "author_kind"), author_name: text(form, "author_name"), repo_url: optional(form, "repo_url") }, "No pudimos crear la plantilla."));
}

export async function changeTemplateState(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const change = text(form, "change");
  const body = change === "default" ? { is_default: true } : { status: change };
  return finish(platformSend(`/templates/${encodeURIComponent(text(form, "code"))}`, "PATCH", body, "No pudimos actualizar la plantilla."));
}

export async function submitTemplateVersion(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  let manifest: unknown;
  try {
    manifest = JSON.parse(text(form, "manifest"));
  } catch {
    return { done: false, message: "El manifiesto no es un JSON válido. Pegue el contenido de template.json." };
  }
  const lighthouse = { performance: number(form, "lh_performance"), accessibility: number(form, "lh_accessibility"), seo: number(form, "lh_seo"), best_practices: number(form, "lh_best_practices") };
  const checks = Object.fromEntries(["build", "datos_estructurados", "seguridad"].map((key) => [key, text(form, key) || "pendiente"]));
  return finish(
    platformSend("/template-submissions", "POST", { template_code: text(form, "template_code"), version: text(form, "version"), bundle_path: text(form, "bundle_path"), bundle_sha256: text(form, "bundle_sha256"), changelog: optional(form, "changelog"), manifest, lighthouse, checks }, "No pudimos registrar el envío."),
  );
}

export async function decideSubmission(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const decision = text(form, "decision");
  return finish(platformSend(`/template-submissions/${encodeURIComponent(text(form, "code"))}/decision`, "POST", decision === "rechazar" ? { decision, reason: text(form, "reason") } : { decision, visual_review: text(form, "visual_review") === "1" }, "No pudimos registrar la decisión."));
}

export async function assignTenantTheme(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(`/tenants/${encodeURIComponent(text(form, "tenant"))}/theme`, "POST", { template_code: text(form, "template_code"), note: optional(form, "note") }, "No pudimos asignar la plantilla."));
}

export async function saveAiPack(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(`/ai/packs/${encodeURIComponent(text(form, "code"))}`, "PATCH", { name: text(form, "name"), price: Number(text(form, "price")), credits: Number(text(form, "credits")), active: text(form, "active") === "1" }, "No pudimos guardar el paquete."));
}
