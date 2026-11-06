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
