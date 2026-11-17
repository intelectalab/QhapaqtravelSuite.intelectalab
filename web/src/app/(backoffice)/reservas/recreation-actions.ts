"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/server/api";
import type { StepResult } from "@/lib/server/resource";

export async function recreateWebReservation(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const note = String(form.get("note") ?? "").trim();
  const result = await apiFetch<{ reservation: string }>(`/reservations/${encodeURIComponent(code)}/web-recreation`, { method: "POST", body: { note: note === "" ? null : note } });
  revalidatePath(`/reservas/${code}`);
  if (!result.ok) {
    const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { done: false, message: first ?? result.error?.message ?? "No pudimos recrear la reserva." };
  }
  if (!result.data?.reservation) return { done: true, message: null };
  redirect(`/reservas/${encodeURIComponent(result.data.reservation)}`);
}
