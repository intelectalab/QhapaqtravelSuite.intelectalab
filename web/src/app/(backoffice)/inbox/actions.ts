"use server";

import { revalidatePath } from "next/cache";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_FILES, type LinkKind, type LinkOption } from "@/lib/inbox";
import { apiFetch } from "@/lib/server/api";
import { sendStep, type StepResult } from "@/lib/server/resource";

const KINDS: LinkKind[] = ["client", "lead", "reservation"];

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/inbox");
  return result;
}

async function uploadAttachments(files: File[]): Promise<{ ids: string[]; message: string | null }> {
  const ids: string[] = [];
  for (const file of files) {
    const payload = new FormData();
    payload.set("file", file, file.name);
    const result = await apiFetch<{ upload_id: string }>("/inbox/attachments", { method: "POST", form: payload });
    if (!result.ok || !result.data) {
      const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
      return { ids, message: firstError ?? result.error?.message ?? `No pudimos adjuntar ${file.name}.` };
    }
    ids.push(result.data.upload_id);
  }
  return { ids, message: null };
}

export async function replyConversation(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length > ATTACHMENT_MAX_FILES) return { message: `Puedes adjuntar hasta ${ATTACHMENT_MAX_FILES} archivos por mensaje.`, done: false };
  if (files.reduce((total, file) => total + file.size, 0) > ATTACHMENT_MAX_BYTES) return { message: "Los adjuntos de un mensaje pueden sumar hasta 10 MB.", done: false };
  const uploads = await uploadAttachments(files);
  if (uploads.message) return { message: uploads.message, done: false };
  const body = {
    body: text(form, "body") || null,
    attachments: uploads.ids.length > 0 ? uploads.ids : undefined,
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

export async function searchConversationLinks(code: string, kind: LinkKind, query: string): Promise<LinkOption[]> {
  if (!KINDS.includes(kind)) return [];
  const params = new URLSearchParams({ kind, q: query.trim().slice(0, 80) });
  const result = await apiFetch<LinkOption[]>(`/inbox/conversations/${encodeURIComponent(code)}/link-options?${params.toString()}`);
  return result.ok && result.data ? result.data : [];
}

export async function linkConversation(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  const unlink = text(form, "intent") === "unlink";
  const body = { kind: text(form, "kind"), lock_version: text(form, "lock_version") || undefined, ...(unlink ? {} : { code: text(form, "target") }) };
  if (!unlink && !body.code) return { message: "Elige un registro de la lista.", done: false };
  return refresh(await sendStep(`/inbox/conversations/${code}/${unlink ? "unlink" : "link"}`, "POST", body, unlink ? "No pudimos quitar el vínculo." : "No pudimos vincular la conversación."));
}
