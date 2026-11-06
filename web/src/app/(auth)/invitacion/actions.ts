"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/server/api";
import type { FormState } from "@/lib/server/auth";

export async function acceptInvitation(_state: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("password_confirmation") ?? "");
  const result = await apiFetch<{ email: string }>(`/auth/invitations/${encodeURIComponent(token)}`, { method: "POST", auth: false, body: { password, password_confirmation: confirmation } });

  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos activar tu cuenta." };
  }

  redirect(`/login?activada=${encodeURIComponent(result.data?.email ?? "")}`);
}
