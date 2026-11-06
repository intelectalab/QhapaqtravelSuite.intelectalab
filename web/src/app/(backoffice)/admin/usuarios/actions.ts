"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";

export interface UserActionState {
  message: string | null;
  done: boolean;
  warnings?: string[];
}

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

async function send(path: string, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>): Promise<UserActionState> {
  const result = await apiFetch<{ data: unknown; meta?: { warnings?: string[] } }>(path, { method, body, raw: true });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos guardar el cambio.", done: false };
  }
  revalidatePath("/admin/usuarios", "layout");
  return { message: null, done: true, warnings: result.data?.meta?.warnings };
}

const code = (form: FormData) => encodeURIComponent(text(form, "code") ?? "");

export async function inviteUser(_state: UserActionState, form: FormData): Promise<UserActionState> {
  return send("/iam/users", "POST", { name: text(form, "name"), email: text(form, "email"), phone: text(form, "phone"), role: text(form, "role"), sede_id: text(form, "sede_id") });
}

export async function updateUser(_state: UserActionState, form: FormData): Promise<UserActionState> {
  return send(`/iam/users/${code(form)}`, "PATCH", { name: text(form, "name"), phone: text(form, "phone"), role: text(form, "role"), sede_id: text(form, "sede_id") });
}

export async function deactivateUser(_state: UserActionState, form: FormData): Promise<UserActionState> {
  return send(`/iam/users/${code(form)}/deactivate`, "POST", { reason: text(form, "reason") });
}

export async function activateUser(_state: UserActionState, form: FormData): Promise<UserActionState> {
  return send(`/iam/users/${code(form)}/activate`, "POST", {});
}

export async function resetUserMfa(_state: UserActionState, form: FormData): Promise<UserActionState> {
  return send(`/iam/users/${code(form)}/reset-mfa`, "POST", { reason: text(form, "reason") });
}

export async function resendInvitation(_state: UserActionState, form: FormData): Promise<UserActionState> {
  return send(`/iam/users/${code(form)}/resend-invitation`, "POST", {});
}

const sedeBody = (form: FormData) => ({ name: text(form, "name"), city: text(form, "city"), address: text(form, "address"), phone: text(form, "phone"), manager_id: text(form, "manager_id") });

export async function createSede(_state: UserActionState, form: FormData): Promise<UserActionState> {
  return send("/iam/sedes", "POST", sedeBody(form));
}

export async function updateSede(_state: UserActionState, form: FormData): Promise<UserActionState> {
  return send(`/iam/sedes/${code(form)}`, "PATCH", sedeBody(form));
}

export async function toggleSede(_state: UserActionState, form: FormData): Promise<UserActionState> {
  return send(`/iam/sedes/${code(form)}/${text(form, "mode") === "activate" ? "activate" : "deactivate"}`, "POST", {});
}

export async function deleteSede(_state: UserActionState, form: FormData): Promise<UserActionState> {
  return send(`/iam/sedes/${code(form)}`, "DELETE", {});
}
