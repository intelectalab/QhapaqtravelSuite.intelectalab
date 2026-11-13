"use server";

import { revalidatePath } from "next/cache";
import type { AiRequest } from "@/lib/growth";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export interface AssistantState extends StepResult {
  request: AiRequest | null;
}

export async function askAssistant(_state: AssistantState, form: FormData): Promise<AssistantState> {
  const body = formValues(form, ["kind", "prompt", "source_type", "source_code"]);
  if (!body.source_code) {
    body.source_type = null;
    body.source_code = null;
  }
  const result = await apiFetch<AiRequest>("/ai/requests", { method: "POST", body });
  if (!result.ok || !result.data) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "El asistente no pudo responder.", done: false, request: null };
  }
  revalidatePath("/asistente");
  return { message: null, done: true, request: result.data };
}

export async function assistantStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const id = encodeURIComponent(text(form, "id"));
  const step = text(form, "step") === "discard" ? "discard" : "apply";
  const result = await sendStep(`/ai/requests/${id}/${step}`, "POST", {}, step === "apply" ? "No pudimos aplicar el borrador." : "No pudimos descartar el borrador.");
  if (result.done) revalidatePath("/asistente");
  return result;
}
