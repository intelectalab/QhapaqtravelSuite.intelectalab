"use server";

import { revalidatePath } from "next/cache";
import { platformSend, type ConsoleResult } from "@/lib/server/platformConsole";

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

const pass = (form: FormData, suffix: string) => `/access-passes/${encodeURIComponent(text(form, "code"))}${suffix}`;

async function finish(result: Promise<ConsoleResult>): Promise<ConsoleResult> {
  const outcome = await result;
  if (outcome.done) revalidatePath("/plataforma/pases");
  return outcome;
}

export async function createPass(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(
    platformSend(
      "/access-passes",
      "POST",
      { tenant: text(form, "tenant"), days: Number(text(form, "days") || 30), price: Number(text(form, "price") || 0), features: form.getAll("features").map(String), reason: text(form, "reason"), convert_to: text(form, "convert_to") || null },
      "No pudimos crear el pase.",
    ),
  );
}

export async function extendPass(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(pass(form, "/extend"), "POST", { days: Number(text(form, "days") || 7) }, "No pudimos extender el pase."));
}

export async function convertPass(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(pass(form, "/convert"), "POST", { plan: text(form, "plan") || null }, "No pudimos convertir el pase."));
}

export async function revokePass(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(pass(form, "/revoke"), "POST", { reason: text(form, "reason") || null }, "No pudimos revocar el pase."));
}

export async function saveAddonBilling(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const mode = text(form, "billing_mode");
  return finish(
    platformSend(
      `/addons/${encodeURIComponent(text(form, "code"))}/billing`,
      "PATCH",
      { billing_mode: mode, price_once: mode === "mensual" ? null : Number(text(form, "price_once") || 0), price_month: mode === "unico" ? null : Number(text(form, "price_month") || 0) },
      "No pudimos guardar el add-on.",
    ),
  );
}
