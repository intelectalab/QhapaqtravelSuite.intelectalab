import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { RlListingDetail, RlListings, RlOverview, RlPost } from "@/lib/rutas-libres";
import { isShowcaseHost, SHOWCASE_PREFIX } from "@/lib/showcase-host";
import { apiFetch } from "./api";

export const rlBase = cache(async (): Promise<string> => {
  const store = await headers();
  return isShowcaseHost(store.get("x-forwarded-host") ?? store.get("host")) ? "" : SHOWCASE_PREFIX;
});

export const rlOrigin = cache(async (): Promise<string> => {
  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host") ?? "localhost";
  const proto = store.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https");
  return `${proto}://${host}${await rlBase()}`;
});

async function read<T>(path: string): Promise<T> {
  const result = await apiFetch<T>(`/showcase${path}`, { auth: false });
  if (result.status === 404) notFound();
  if (!result.ok || result.data === null) throw new Error(result.error?.message ?? "No pudimos cargar Rutas Libres.");
  return result.data;
}

export const getRlOverview = cache(() => read<RlOverview>("/overview"));

export const getRlListings = cache((query: string) => read<RlListings>(`/listings${query ? `?${query}` : ""}`));

export const getRlListing = cache((slug: string) => read<RlListingDetail>(`/listings/${encodeURIComponent(slug)}`));

export const getRlPosts = cache(() => read<RlPost[]>("/posts"));

export const getRlPost = cache((slug: string) => read<RlPost>(`/posts/${encodeURIComponent(slug)}`));

export function listingQuery(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  params.sort();
  return params.toString();
}
