"use server";

import { revalidatePath } from "next/cache";
import { platformSend, type ConsoleResult } from "@/lib/server/platformConsole";

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

export async function attendDemoRequest(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const outcome = await platformSend(`/demo-requests/${encodeURIComponent(text(form, "code"))}`, "PATCH", { status: text(form, "status"), notes: text(form, "notes") || null }, "No pudimos actualizar la solicitud.");
  if (outcome.done) revalidatePath("/plataforma/solicitudes");
  return outcome;
}
