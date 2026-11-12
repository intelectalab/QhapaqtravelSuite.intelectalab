"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

const CASE_ACTIONS: Record<string, string> = { start: "start", followup: "follow-ups", resolve: "resolve", close: "close" };

function refresh(result: StepResult): StepResult {
  if (result.done) {
    revalidatePath("/crm/postventa");
    revalidatePath("/crm/clientes", "layout");
  }
  return result;
}

export async function saveSurvey(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  const body = formValues(form, code ? ["score", "channel", "comment"] : ["client", "reservation", "score", "channel", "comment"]);
  return refresh(await sendStep(code ? `/crm/surveys/${encodeURIComponent(code)}` : "/crm/surveys", code ? "PATCH" : "POST", body, "No pudimos guardar la encuesta."));
}

export async function saveCase(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  const fields = ["type", "priority", "subject", "description", "owner_id"];
  const body = formValues(form, code ? fields : ["client", "reservation", ...fields]);
  return refresh(await sendStep(code ? `/crm/cases/${encodeURIComponent(code)}` : "/crm/cases", code ? "PATCH" : "POST", body, "No pudimos guardar el caso."));
}

export async function moveCase(_state: StepResult, form: FormData): Promise<StepResult> {
  const action = CASE_ACTIONS[text(form, "step")];
  if (!action) return { message: "Elige qué paso registrar.", done: false };
  return refresh(await sendStep(`/crm/cases/${encodeURIComponent(text(form, "code"))}/${action}`, "POST", formValues(form, ["note", "lock_version"]), "No pudimos actualizar el caso."));
}

export async function createRebuy(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = {
    ...formValues(form, ["client_code", "title", "amount", "currency", "expected_close_date", "destination", "notes", "owner_id"]),
    stage: "calificacion",
    origin: "fidelizacion",
    confirm_open: form.get("confirm_open") === "on",
  };
  const result = await sendStep("/crm/opportunities", "POST", body, "No pudimos crear la oportunidad de recompra.");
  if (result.done) revalidatePath("/crm/oportunidades");
  return refresh(result);
}
