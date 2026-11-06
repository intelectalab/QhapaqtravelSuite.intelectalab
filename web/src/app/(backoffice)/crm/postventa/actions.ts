"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

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
  return refresh(await sendStep(`/crm/cases/${encodeURIComponent(text(form, "code"))}/transition`, "POST", formValues(form, ["step", "note"]), "No pudimos actualizar el caso."));
}
