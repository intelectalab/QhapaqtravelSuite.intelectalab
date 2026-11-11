"use server";

import { revalidatePath } from "next/cache";
import type { SegmentPreview } from "@/lib/marketing";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/marketing/campanas", "layout");
  return result;
}

export async function saveCampaign(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  const body = formValues(form, ["name", "channel", "segment", "template", "subject", "body", "promo_code"]);
  return refresh(await sendStep(code ? `/marketing/campaigns/${encodeURIComponent(code)}` : "/marketing/campaigns", code ? "PATCH" : "POST", body, "No pudimos guardar la campaña."));
}

export async function campaignStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  const step = text(form, "intent") || text(form, "step");
  const failure = "No pudimos actualizar la campaña.";
  if (step === "test") return refresh(await sendStep(`/marketing/campaigns/${code}/test-send`, "POST", {}, failure));
  if (step === "schedule") return refresh(await sendStep(`/marketing/campaigns/${code}/schedule`, "POST", formValues(form, ["scheduled_at", "lock_version"]), failure));
  if (step === "unschedule") return refresh(await sendStep(`/marketing/campaigns/${code}/unschedule`, "POST", formValues(form, ["lock_version"]), failure));
  if (step === "cancel") return refresh(await sendStep(`/marketing/campaigns/${code}/cancel`, "POST", formValues(form, ["reason", "lock_version"]), failure));
  if (step === "send") return refresh(await sendStep(`/marketing/campaigns/${code}/send`, "POST", formValues(form, ["lock_version"]), "No pudimos enviar la campaña."));
  if (step === "duplicate") return refresh(await sendStep(`/marketing/campaigns/${code}/duplicate`, "POST", {}, "No pudimos duplicar la campaña."));
  return { message: null, done: true };
}

function parseRules(form: FormData): unknown[] {
  try {
    const parsed: unknown = JSON.parse(text(form, "rules") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSegment(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  const body = { ...formValues(form, ["name", "description", "match", "lock_version"]), rules: parseRules(form) };
  return refresh(await sendStep(code ? `/marketing/segments/${encodeURIComponent(code)}` : "/marketing/segments", code ? "PUT" : "POST", body, "No pudimos guardar el segmento."));
}

export async function segmentStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  const step = text(form, "step");
  if (step === "duplicate") return refresh(await sendStep(`/marketing/segments/${code}/duplicate`, "POST", {}, "No pudimos duplicar el segmento."));
  if (step === "delete") return refresh(await sendStep(`/marketing/segments/${code}`, "DELETE", formValues(form, ["lock_version"]), "No pudimos eliminar el segmento."));
  return { message: null, done: true };
}

export async function previewSegment(match: string, rules: unknown[]): Promise<{ data: SegmentPreview | null; message: string | null }> {
  const result = await apiFetch<SegmentPreview>("/marketing/segments/preview", { method: "POST", body: { match, rules } });
  if (!result.ok || !result.data) return { data: null, message: result.error?.message ?? "No pudimos calcular la audiencia." };
  return { data: result.data, message: null };
}

export async function saveTemplate(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  const body = formValues(form, code ? ["name", "category", "subject", "body", "lock_version"] : ["channel", "name", "category", "subject", "body"]);
  return refresh(await sendStep(code ? `/marketing/templates/${encodeURIComponent(code)}` : "/marketing/templates", code ? "PUT" : "POST", body, "No pudimos guardar la plantilla."));
}

export async function templateReview(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`/marketing/templates/${encodeURIComponent(text(form, "code"))}`, "PUT", formValues(form, ["meta_status", "lock_version"]), "No pudimos registrar la respuesta de Meta."));
}

export async function automationStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  const step = text(form, "intent") || text(form, "step");
  const failure = "No pudimos actualizar la automatización.";
  if (step === "configure") return refresh(await sendStep(`/marketing/automations/${code}`, "PUT", formValues(form, ["template", "delay", "lock_version"]), failure));
  if (step === "activate" || step === "pause") return refresh(await sendStep(`/marketing/automations/${code}/${step}`, "POST", formValues(form, ["lock_version"]), failure));
  if (step === "run") return refresh(await sendStep(`/marketing/automations/${code}/run`, "POST", {}, failure));
  return { message: null, done: true };
}

export async function consentStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const step = text(form, "step");
  if (step === "revoke") return refresh(await sendStep(`/marketing/consents/${encodeURIComponent(text(form, "code"))}/revoke`, "POST", formValues(form, ["source", "lock_version"]), "No pudimos registrar la baja."));
  return refresh(await sendStep("/marketing/consents", "POST", formValues(form, ["subject_type", "subject_id", "channel", "source", "evidence", "policy_version", "lock_version"]), "No pudimos registrar el consentimiento."));
}
