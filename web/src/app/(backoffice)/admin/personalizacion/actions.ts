"use server";

import type { AdminActionState } from "@/lib/admin";
import { fields, sendAdmin, text } from "@/lib/server/admin";

const PATH = "/";

export async function saveBranding(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/admin/branding", "PUT", fields(form, ["brand", "accent", "menu", "tile_variant"]), PATH, "No pudimos guardar la apariencia.");
}

export async function resetBranding(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/admin/branding/reset", "POST", { reason: text(form, "reason") }, PATH, "No pudimos restablecer la apariencia.");
}
