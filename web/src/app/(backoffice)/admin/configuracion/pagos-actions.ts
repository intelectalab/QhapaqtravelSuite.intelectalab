"use server";

import type { AdminActionState } from "@/lib/admin";
import { flag, sendAdmin, text } from "@/lib/server/admin";

const number = (form: FormData, key: string) => {
  const value = text(form, key);
  return value === undefined ? undefined : Number(value);
};

export async function updateTransferValidation(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(
    "/settings/transfer-validation",
    "PUT",
    {
      alert_finance: flag(form, "alert_finance"),
      alert_minutes: number(form, "alert_minutes"),
      auto_cancel: flag(form, "auto_cancel"),
      cancel_hours: number(form, "cancel_hours"),
      reminder_minutes: number(form, "reminder_minutes"),
      escalate_minutes: number(form, "escalate_minutes"),
      lock_version: text(form, "lock_version") ?? null,
    },
    "/admin/configuracion",
    "No pudimos guardar la configuración de pagos.",
  );
}
