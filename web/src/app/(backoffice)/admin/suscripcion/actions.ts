"use server";

import type { AdminActionState } from "@/lib/admin";
import { fields, sendAdmin } from "@/lib/server/admin";

export async function updateBilling(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/admin/subscription/billing", "PATCH", fields(form, ["ruc", "name", "address", "ubigeo", "email"]), "/admin/suscripcion", "No pudimos guardar los datos de facturación.");
}
