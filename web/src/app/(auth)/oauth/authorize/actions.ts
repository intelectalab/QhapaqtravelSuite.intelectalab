"use server";

import { redirect } from "next/navigation";
import { OAUTH_FIELDS } from "@/lib/oauth";
import { apiFetch } from "@/lib/server/api";
import type { FormState } from "@/lib/server/auth";

export async function decideOAuth(_state: FormState, form: FormData): Promise<FormState> {
  const body: Record<string, unknown> = Object.fromEntries(OAUTH_FIELDS.map((field) => [field, form.get(field) || null]));
  body.approve = form.get("decision") === "approve";
  const result = await apiFetch<{ redirect_to: string }>("/oauth/authorize", { method: "POST", body });
  if (!result.ok || !result.data) return { message: result.error?.message ?? "No pudimos registrar tu respuesta." };
  redirect(result.data.redirect_to);
}
