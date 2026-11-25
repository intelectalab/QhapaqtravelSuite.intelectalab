"use server";

import { revalidatePath } from "next/cache";
import { assistantReturnPath } from "@/lib/assistant";
import type { AiRequest } from "@/lib/growth";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

const refresh = (form: FormData) => {
  revalidatePath("/asistente");
  const back = assistantReturnPath(form.get("return_path"));
  if (back && back !== "/asistente") revalidatePath(back);
};

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
  refresh(form);
  return { message: null, done: true, request: result.data };
}

export async function assistantStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const id = encodeURIComponent(text(form, "id"));
  const step = text(form, "step") === "discard" ? "discard" : "apply";
  const body = step === "apply" ? { confirm: text(form, "confirm") === "1", void_approval: text(form, "void_approval") === "1" } : {};
  const result = await sendStep(`/ai/requests/${id}/${step}`, "POST", body, step === "apply" ? "No pudimos aplicar el borrador." : "No pudimos descartar el borrador.");
  if (result.done) refresh(form);
  return result;
}
