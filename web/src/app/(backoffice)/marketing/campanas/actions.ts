"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/marketing/campanas");
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
  return { message: null, done: true };
}
