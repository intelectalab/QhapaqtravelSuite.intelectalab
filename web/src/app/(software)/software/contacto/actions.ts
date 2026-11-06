"use server";

import { apiFetch } from "@/lib/server/api";
import { formValues } from "@/lib/server/resource";
import type { DemoFormState } from "@/lib/software";

const FIELDS = ["kind", "plan", "billing_cycle", "full_name", "email", "phone", "company", "business_type", "city", "team_size", "message", "website"];

export async function requestDemo(_state: DemoFormState, form: FormData): Promise<DemoFormState> {
  const body = { ...formValues(form, FIELDS), consent: form.get("consent") === "on" };
  const result = await apiFetch<{ code: string | null; repeated: boolean; message: string }>("/public/software/demo-requests", { method: "POST", body, auth: false });

  if (!result.ok || !result.data) {
    const errors = Object.fromEntries(Object.entries(result.error?.errors ?? {}).map(([field, messages]) => [field, messages[0] ?? ""]));
    const values = Object.fromEntries(FIELDS.map((field) => [field, String(form.get(field) ?? "")]));
    return { done: false, code: null, errors, values, message: Object.keys(errors).length > 0 ? "Revisa los campos marcados." : (result.error?.message ?? "No pudimos enviar tu solicitud. Inténtalo de nuevo.") };
  }

  return { done: true, code: result.data.code, errors: {}, values: {}, message: result.data.message };
}
