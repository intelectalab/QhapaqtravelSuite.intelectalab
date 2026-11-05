"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiFetch } from "@/lib/server/api";
import { confirmMfa, type FormState } from "@/lib/server/auth";

export async function platformVerifyMfa(_state: FormState, form: FormData): Promise<FormState> {
  return confirmMfa("platform", form);
}

export interface StatusState {
  message: string | null;
  done: boolean;
}

const statusSchema = z.object({
  tenant: z.string().min(1),
  mode: z.enum(["suspend", "reactivate"]),
  reason: z.string().trim().min(5, "Explica el motivo con un poco más de detalle.").max(500, "El motivo es demasiado largo."),
});

export async function changeTenantStatus(_state: StatusState, form: FormData): Promise<StatusState> {
  const parsed = statusSchema.safeParse({ tenant: form.get("tenant"), mode: form.get("mode"), reason: form.get("reason") });
  if (!parsed.success) return { message: parsed.error.issues[0].message, done: false };

  const { tenant, mode, reason } = parsed.data;
  const result = await apiFetch(`/platform/tenants/${encodeURIComponent(tenant)}/${mode}`, { method: "POST", body: { reason }, realm: "platform" });
  if (!result.ok) return { message: result.error?.message ?? "No pudimos cambiar el estado de la agencia.", done: false };

  revalidatePath("/plataforma", "layout");
  return { message: null, done: true };
}
