import "server-only";
import { revalidatePath } from "next/cache";
import type { AdminActionState } from "@/lib/admin";
import { apiFetch } from "./api";

export async function sendAdmin(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body: Record<string, unknown>, revalidate: string, failure = "No pudimos guardar el cambio."): Promise<AdminActionState> {
  const result = await apiFetch<{ data?: Record<string, unknown>; meta?: { warnings?: string[] } }>(path, { method, body, raw: true });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? failure, done: false };
  }
  revalidatePath(revalidate, "layout");
  const data = result.data?.data ?? {};
  const secret = typeof data.token === "string" ? data.token : typeof data.secret === "string" ? data.secret : undefined;
  return { message: null, done: true, warnings: result.data?.meta?.warnings, secret, label: typeof data.code === "string" ? data.code : undefined };
}

export function text(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function list(form: FormData, key: string): string[] {
  return form.getAll(key).filter((value): value is string => typeof value === "string" && value.trim() !== "");
}

export function flag(form: FormData, key: string): boolean {
  return form.get(key) === "on";
}

export function fields(form: FormData, keys: string[]): Record<string, string | undefined> {
  return Object.fromEntries(keys.map((key) => [key, text(form, key)]));
}
