import "server-only";
import { headers } from "next/headers";
import type { ReviewWidgetFeed, WidgetConfig } from "@/lib/site";
import { apiFetch } from "./api";

export async function widgetHeaders(key: string | undefined): Promise<Record<string, string>> {
  if (key) return { "X-KipuControl-Key": key };
  const host = (await headers()).get("host") ?? "";
  return host ? { "X-Forwarded-Host": host } : {};
}

export async function getWidgetConfig(key: string | undefined, product: string | null): Promise<WidgetConfig | null> {
  const query = product ? `?product=${encodeURIComponent(product)}` : "";
  const result = await apiFetch<WidgetConfig>(`/public/widget/config${query}`, { auth: false, headers: await widgetHeaders(key) });
  return result.ok ? result.data : null;
}

export async function getReviewWidget(key: string | undefined, params: { sources?: string; min_rating?: string; count?: string; layout?: string }): Promise<ReviewWidgetFeed | null> {
  const query = new URLSearchParams({ widget: "1" });
  for (const [name, value] of Object.entries(params)) if (value) query.set(name, value);
  const result = await apiFetch<ReviewWidgetFeed>(`/public/reviews?${query.toString()}`, { auth: false, headers: await widgetHeaders(key) });
  return result.ok ? result.data : null;
}
