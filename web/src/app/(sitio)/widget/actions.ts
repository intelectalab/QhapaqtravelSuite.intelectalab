"use server";

import { apiFetch } from "@/lib/server/api";
import { widgetHeaders } from "@/lib/server/widget";
import type { WidgetHandoff } from "@/lib/site";

export async function startWidgetHandoff(key: string | undefined, input: { product: string; date: string; adults: number; children: number; infants: number; lang: string; currency: string; origin: string | null }): Promise<{ ok: boolean; message: string | null; handoff: WidgetHandoff | null }> {
  const result = await apiFetch<WidgetHandoff>("/public/widget-handoffs", { method: "POST", auth: false, body: input, headers: await widgetHeaders(key) });
  return { ok: result.ok, message: result.ok ? null : (result.error?.message ?? null), handoff: result.data };
}
