"use server";

import { redirect } from "next/navigation";
import type { RecoveryState } from "@/features/auth/PasswordForms";
import { apiFetch } from "@/lib/server/api";

function firstError(error: { message: string; errors?: Record<string, string[]> } | null, fallback: string): string {
  return (error?.errors ? Object.values(error.errors)[0]?.[0] : undefined) ?? error?.message ?? fallback;
}

export async function requestPasswordReset(_state: RecoveryState, form: FormData): Promise<RecoveryState> {
  const email = String(form.get("email") ?? "").trim();
  const result = await apiFetch<{ message: string }>("/auth/password/forgot", { method: "POST", auth: false, body: { email } });

  if (!result.ok) return { message: firstError(result.error, "No pudimos enviar el enlace."), fields: { email } };

  return { message: null, sent: result.data?.message ?? "Si el correo pertenece a una cuenta activa, te enviamos un enlace." };
}

export async function resetPassword(_state: RecoveryState, form: FormData): Promise<RecoveryState> {
  const body = {
    email: String(form.get("email") ?? ""),
    token: String(form.get("token") ?? ""),
    password: String(form.get("password") ?? ""),
    password_confirmation: String(form.get("password_confirmation") ?? ""),
  };
  const result = await apiFetch<{ email: string }>("/auth/password/reset", { method: "POST", auth: false, body });

  if (!result.ok) return { message: firstError(result.error, "No pudimos guardar la contraseña.") };

  redirect("/login?restablecida=1");
}
