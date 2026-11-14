"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import type { StepResult } from "@/lib/server/resource";

export async function reactivateWebReservation(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const note = String(form.get("note") ?? "").trim();
  const result = await apiFetch(`/reservations/${encodeURIComponent(code)}/web-reactivation`, { method: "POST", body: { mode: String(form.get("mode") ?? ""), note: note === "" ? null : note } });
  revalidatePath(`/reservas/${code}`);
  if (!result.ok) {
    const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { done: false, message: first ?? result.error?.message ?? "No pudimos reactivar la reserva." };
  }
  return { done: true, message: null };
}
