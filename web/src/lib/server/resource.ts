import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";

export async function getResource<T>(path: string, failure: string): Promise<T | null> {
  const result = await apiFetch<T>(path);
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 404) notFound();
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? failure);
  return result.data;
}

export interface StepResult {
  message: string | null;
  done: boolean;
}

export async function sendStep(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body: Record<string, unknown>, failure: string): Promise<StepResult> {
  const result = await apiFetch(path, { method, body });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? failure, done: false };
  }
  return { message: null, done: true };
}

export function formValues(form: FormData, fields: string[]): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = form.get(field);
    if (typeof raw === "string") body[field] = raw.trim() === "" ? null : raw.trim();
  }
  return body;
}

export const getCachedResource = cache(getResource);
