"use server";

import { revalidatePath } from "next/cache";
import { sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

const path = (form: FormData, suffix = "") => `/cms/stories/${encodeURIComponent(text(form, "id"))}${suffix}`;

async function finish(result: Promise<StepResult>): Promise<StepResult> {
  const outcome = await result;
  if (outcome.done) revalidatePath("/canales/aventuras");
  return outcome;
}

export async function saveStory(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = { title: text(form, "title"), city: text(form, "city") || null, quote: text(form, "quote") || null, body: text(form, "body") || null, photo_count: Number(text(form, "photo_count") || 0), product: text(form, "product") || null };
  const id = text(form, "id");
  return finish(id ? sendStep(path(form), "PATCH", body, "No pudimos guardar la historia.") : sendStep("/cms/stories", "POST", { ...body, reservation: text(form, "reservation") }, "No pudimos crear la historia."));
}

export async function requestConsent(_state: StepResult, form: FormData): Promise<StepResult> {
  return finish(sendStep(path(form, "/consent-request"), "POST", {}, "No pudimos pedir el consentimiento."));
}

export async function publishStory(_state: StepResult, form: FormData): Promise<StepResult> {
  return finish(sendStep(path(form, "/publish"), "POST", {}, "No pudimos publicar la historia."));
}

export async function unpublishStory(_state: StepResult, form: FormData): Promise<StepResult> {
  return finish(sendStep(path(form, "/unpublish"), "POST", { reason: text(form, "reason") || null }, "No pudimos despublicar la historia."));
}

export async function deleteStory(_state: StepResult, form: FormData): Promise<StepResult> {
  return finish(sendStep(path(form), "DELETE", {}, "No pudimos eliminar la historia."));
}
