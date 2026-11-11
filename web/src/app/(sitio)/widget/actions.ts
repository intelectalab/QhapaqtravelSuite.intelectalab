"use server";

import { apiFetch } from "@/lib/server/api";
import { widgetHeaders } from "@/lib/server/widget";
import { NO_EXTRAS, type BookingExtras, type PaymentMode, type WidgetHandoff } from "@/lib/site";

export async function startWidgetHandoff(key: string | undefined, input: { product: string; date: string; adults: number; children: number; infants: number; lang: string; currency: string; origin: string | null; extras?: BookingExtras; payment_mode?: PaymentMode }): Promise<{ ok: boolean; message: string | null; handoff: WidgetHandoff | null }> {
  const { extras, ...rest } = input;
  const result = await apiFetch<WidgetHandoff>("/public/widget-handoffs", { method: "POST", auth: false, body: { ...rest, ...(extras ?? NO_EXTRAS) }, headers: await widgetHeaders(key) });
  return { ok: result.ok, message: result.ok ? null : (result.error?.message ?? null), handoff: result.data };
}
