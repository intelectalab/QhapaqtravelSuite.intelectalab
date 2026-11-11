import "server-only";
import { headers } from "next/headers";
import type { WidgetConfig } from "@/lib/site";
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
