"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";

export interface RoleActionState {
  message: string | null;
  done: boolean;
  code?: string;
}

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

async function send(path: string, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>): Promise<RoleActionState> {
  const result = await apiFetch<{ code: string }>(path, { method, body });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos guardar el rol.", done: false };
  }
  revalidatePath("/admin/roles", "layout");
  return { message: null, done: true, code: result.data?.code };
}

export async function createRole(_state: RoleActionState, form: FormData): Promise<RoleActionState> {
  return send("/iam/roles", "POST", { name: text(form, "name"), description: text(form, "description"), scope: text(form, "scope"), copy_from: text(form, "copy_from") });
}

export async function updateRole(_state: RoleActionState, form: FormData): Promise<RoleActionState> {
  return send(`/iam/roles/${encodeURIComponent(text(form, "code") ?? "")}`, "PATCH", { name: text(form, "name"), description: text(form, "description") });
}

export async function deleteRole(_state: RoleActionState, form: FormData): Promise<RoleActionState> {
  return send(`/iam/roles/${encodeURIComponent(text(form, "code") ?? "")}`, "DELETE", {});
}

export async function setRolePermissions(code: string, permissions: string[], grant: boolean): Promise<{ ok: boolean; message: string | null; blocked: { permission: string; reason: string }[] }> {
  const result = await apiFetch<{ applied: string[]; blocked: { permission: string; reason: string }[] }>(`/iam/roles/${encodeURIComponent(code)}/permissions/bulk`, { method: "POST", body: { permissions, grant } });
  if (!result.ok) return { ok: false, message: result.error?.message ?? "No pudimos cambiar el permiso.", blocked: [] };
  revalidatePath("/admin/roles", "layout");
  return { ok: true, message: null, blocked: result.data?.blocked ?? [] };
}
