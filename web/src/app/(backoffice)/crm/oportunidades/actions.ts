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
    body: { stage: value("stage"), lost_reason: value("lost_reason"), lost_detail: value("lost_detail"), confirm_reopen: form.get("confirm_reopen") === "on" },
  });

  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos mover la oportunidad.", done: false };
  }

  revalidatePath("/crm/oportunidades", "layout");
  revalidatePath("/dashboard");
  return { message: null, done: true, warnings: result.data?.meta.warnings ?? [] };
}
