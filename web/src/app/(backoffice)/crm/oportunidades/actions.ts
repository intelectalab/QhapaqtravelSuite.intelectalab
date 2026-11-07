"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";

export interface StageState {
  message: string | null;
  done: boolean;
  warnings?: string[];
}

export async function changeStage(_state: StageState, form: FormData): Promise<StageState> {
  const code = String(form.get("code") ?? "");
  const value = (key: string) => {
    const raw = form.get(key);
    return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
  };

  const result = await apiFetch<{ data: unknown; meta: { warnings: string[] } }>(`/crm/opportunities/${encodeURIComponent(code)}/stage`, {
    method: "POST",
    raw: true,
    body: { stage: value("stage"), lost_reason: value("lost_reason"), lost_detail: value("lost_detail"), confirm_reopen: form.get("confirm_reopen") === "on", lock_version: numeric(form, "lock_version") },
  });

  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos mover la oportunidad.", done: false };
  }

  revalidatePath("/crm/oportunidades", "layout");
  revalidatePath("/dashboard");
  return { message: null, done: true, warnings: result.data?.meta.warnings ?? [] };
}

export interface OpportunityFormState {
  message: string | null;
  done: boolean;
  code?: string;
}

const field = (form: FormData, key: string) => {
  const raw = form.get(key);
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
};

const numeric = (form: FormData, key: string) => {
  const raw = field(form, key);
  return raw === undefined ? undefined : Number(raw);
};

async function save(path: string, method: "POST" | "PATCH", form: FormData): Promise<OpportunityFormState> {
  const result = await apiFetch<{ code: string }>(path, {
    method,
    body: {
      client_code: field(form, "client_code"),
      title: field(form, "title"),
      amount: numeric(form, "amount"),
      currency: field(form, "currency"),
      expected_close_date: field(form, "expected_close_date"),
      probability: numeric(form, "probability"),
      owner_id: field(form, "owner_id"),
      destination: field(form, "destination"),
      pax: numeric(form, "pax"),
      notes: field(form, "notes"),
      lock_version: numeric(form, "lock_version"),
    },
  });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos guardar la oportunidad.", done: false };
  }
  revalidatePath("/crm/oportunidades", "layout");
  revalidatePath("/crm/clientes", "layout");
  return { message: null, done: true, code: result.data?.code };
}

export async function createOpportunity(_state: OpportunityFormState, form: FormData): Promise<OpportunityFormState> {
  return save("/crm/opportunities", "POST", form);
}

export async function updateOpportunity(_state: OpportunityFormState, form: FormData): Promise<OpportunityFormState> {
  return save(`/crm/opportunities/${encodeURIComponent(field(form, "code") ?? "")}`, "PATCH", form);
}
