"use server";

import { revalidatePath } from "next/cache";
import { sendStep, type StepResult } from "@/lib/server/resource";

const done = (result: StepResult) => {
  if (result.done) revalidatePath("/canales/contenido-ia", "layout");
  return result;
};

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

const optional = (form: FormData, field: string) => text(form, field) || null;

export async function createAiJob(_state: StepResult, form: FormData): Promise<StepResult> {
  const [type, id] = text(form, "target").split(":");
  return done(
    await sendStep("/cms/ai/jobs", "POST", { kind: text(form, "kind"), target_type: type || "libre", target_id: id || null, tone: optional(form, "tone"), locale: optional(form, "locale") ?? "es", notes: optional(form, "notes") }, "No pudimos generar el contenido."),
  );
}

export async function aiJobAction(code: string, action: "apply" | "discard" | "regenerate"): Promise<StepResult> {
  const failure = { apply: "No pudimos aplicar el resultado.", discard: "No pudimos descartar el resultado.", regenerate: "No pudimos pedir otra versión." }[action];
  return done(await sendStep(`/cms/ai/jobs/${encodeURIComponent(code)}/${action}`, "POST", {}, failure));
}

export async function createAiImages(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep("/cms/ai/images", "POST", { prompt: text(form, "prompt"), style: text(form, "style"), count: Number(text(form, "count")), quality: text(form, "quality") }, "No pudimos crear las imágenes."));
}

export async function updateAiImage(_state: StepResult, form: FormData): Promise<StepResult> {
  const action = optional(form, "action");
  return done(await sendStep(`/cms/ai/images/${encodeURIComponent(text(form, "id"))}`, "PATCH", { alt_text: optional(form, "alt_text"), action, used_in: action === "usar" ? optional(form, "used_in") : null }, "No pudimos actualizar la imagen."));
}

export async function purchaseAiPack(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/cms/ai/packs/${encodeURIComponent(text(form, "code"))}/purchase`, "POST", { confirm: true }, "No pudimos completar la compra."));
}
