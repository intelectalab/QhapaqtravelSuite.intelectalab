"use server";

import { revalidatePath } from "next/cache";
import { sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/inbox");
  return result;
}

export async function replyConversation(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  const body = {
    body: text(form, "body"),
    template: text(form, "template") || null,
    internal: form.get("internal") === "on",
    resolve: text(form, "intent") === "resolve",
  };
  return refresh(await sendStep(`/inbox/conversations/${code}/messages`, "POST", body, "No pudimos enviar el mensaje."));
}

export async function conversationStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  const step = text(form, "step");
  const failure = "No pudimos actualizar la conversación.";
  const lock_version = text(form, "lock_version") || undefined;

  if (step === "assign") return refresh(await sendStep(`/inbox/conversations/${code}/assign`, "POST", { assignee_id: text(form, "assignee_id") || null, lock_version }, failure));
  if (step === "resolve" || step === "reopen") return refresh(await sendStep(`/inbox/conversations/${code}/${step}`, "POST", { lock_version }, failure));
  if (step === "classify") {
    const tags = text(form, "tags").split(",").map((tag) => tag.trim()).filter(Boolean);
    return refresh(await sendStep(`/inbox/conversations/${code}`, "PATCH", { priority: text(form, "priority"), tags, lock_version }, failure));
  }
  return { message: "Acción no disponible.", done: false };
}
