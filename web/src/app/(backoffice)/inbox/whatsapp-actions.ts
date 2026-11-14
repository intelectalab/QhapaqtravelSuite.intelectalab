"use server";

import { revalidatePath } from "next/cache";
import { sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function connectWhatsapp(_state: StepResult, form: FormData): Promise<StepResult> {
  const result =
    text(form, "mode") === "propia"
      ? await sendStep(
          "/inbox/whatsapp/connection/own-app",
          "PUT",
          Object.fromEntries(Object.entries({ app_id: text(form, "app_id"), app_secret: text(form, "app_secret"), access_token: text(form, "access_token"), phone_number_id: text(form, "phone_number_id"), waba_id: text(form, "waba_id") }).filter(([, value]) => value !== "")),
          "No pudimos guardar tu app de Meta.",
        )
      : await sendStep("/inbox/whatsapp/connection", "POST", Object.fromEntries(Object.entries({ code: text(form, "code"), waba_id: text(form, "waba_id"), phone_number_id: text(form, "phone_number_id") }).filter(([, value]) => value !== "")), "No pudimos conectar WhatsApp.");
  revalidatePath("/inbox");
  return result;
}

export async function disconnectWhatsapp(): Promise<StepResult> {
  const result = await sendStep("/inbox/whatsapp/connection", "DELETE", {}, "No pudimos desconectar WhatsApp.");
  revalidatePath("/inbox");
  return result;
}
