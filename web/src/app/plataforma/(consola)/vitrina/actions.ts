"use server";

import { revalidatePath } from "next/cache";
import { platformSend, type ConsoleResult } from "@/lib/server/platformConsole";

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

async function finish(result: Promise<ConsoleResult>): Promise<ConsoleResult> {
  const outcome = await result;
  if (outcome.done) revalidatePath("/plataforma/vitrina");
  return outcome;
}

export async function decideListing(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(`/showcase/listings/${encodeURIComponent(text(form, "code"))}/decision`, "POST", { decision: text(form, "decision"), reason: text(form, "reason") || null }, "No pudimos registrar la decisión."));
}

export async function moderateAgency(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(`/showcase/agencies/${encodeURIComponent(text(form, "code"))}/verify`, "POST", { action: text(form, "action") || "verificar", reason: text(form, "reason") || null }, "No pudimos actualizar la agencia."));
}

export async function savePost(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const id = text(form, "id");
  const body = {
    title: text(form, "title"),
    excerpt: text(form, "excerpt"),
    focus_keyword: text(form, "focus_keyword"),
    city: text(form, "city") || null,
    body: text(form, "body") || null,
    linked_listings: form.getAll("linked_listings").map(String),
    ...(id && text(form, "status") ? { status: text(form, "status") } : {}),
  };
  return finish(id ? platformSend(`/showcase/posts/${encodeURIComponent(id)}`, "PATCH", body, "No pudimos guardar el artículo.") : platformSend("/showcase/posts", "POST", body, "No pudimos crear el artículo."));
}

export async function publishPost(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(`/showcase/posts/${encodeURIComponent(text(form, "id"))}`, "PATCH", { status: text(form, "status") }, "No pudimos cambiar el estado del artículo."));
}
