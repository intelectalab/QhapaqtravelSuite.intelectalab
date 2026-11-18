"use server";

import { revalidatePath } from "next/cache";
import type { AdminActionState } from "@/lib/admin";
import { sendAdmin, text } from "@/lib/server/admin";

const PATH = "/admin/integraciones";

export async function connectAgencyMail(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const provider = text(form, "provider");
  const result = await sendAdmin(
    "/settings/outgoing-mail",
    "PUT",
    {
      provider,
      address: text(form, "address"),
      password: text(form, "password") ?? null,
      from_name: text(form, "from_name") ?? null,
      ...(provider === "otro" ? { host: text(form, "host"), port: Number(text(form, "port") ?? 0), encryption: text(form, "encryption") } : {}),
    },
    PATH,
    "No pudimos conectar tu correo.",
  );
  if (result.done) revalidatePath("/dashboard");
  return result;
}

export async function disconnectAgencyMail(): Promise<AdminActionState> {
  const result = await sendAdmin("/settings/outgoing-mail", "DELETE", {}, PATH, "No pudimos desconectar tu correo.");
  if (result.done) revalidatePath("/dashboard");
  return result;
}
