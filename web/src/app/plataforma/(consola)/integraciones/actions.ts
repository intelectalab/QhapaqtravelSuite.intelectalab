"use server";

import { revalidatePath } from "next/cache";
import { platformSend, type ConsoleResult } from "@/lib/server/platformConsole";

export async function runPlatformJob(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const outcome = await platformSend<{ result: string }>(`/jobs/${encodeURIComponent(String(form.get("code") ?? ""))}/run`, "POST", {}, "No pudimos ejecutar la tarea.", (data) => data?.result ?? null);
  revalidatePath("/plataforma", "layout");
  return outcome;
}

export async function pausePlatformJob(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const outcome = await platformSend(`/jobs/${encodeURIComponent(String(form.get("code") ?? ""))}/pause`, "POST", { paused: form.get("paused") === "1" }, "No pudimos cambiar el estado de la tarea.");
  revalidatePath("/plataforma", "layout");
  return outcome;
}

export async function retryIntegrationError(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const outcome = await platformSend(`/integration-errors/${encodeURIComponent(String(form.get("id") ?? ""))}/retry`, "POST", {}, "No pudimos reintentar el envío.");
  revalidatePath("/plataforma", "layout");
  return outcome;
}

export async function resolveIntegrationError(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const resolution = String(form.get("resolution") ?? "").trim();
  if (resolution.length < 5) return { done: false, message: "Describe cómo se resolvió." };
  const outcome = await platformSend(`/integration-errors/${encodeURIComponent(String(form.get("id") ?? ""))}/resolve`, "POST", { resolution }, "No pudimos marcar el error como resuelto.");
  revalidatePath("/plataforma", "layout");
  return outcome;
}
