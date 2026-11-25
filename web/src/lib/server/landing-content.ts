import "server-only";
import { headers } from "next/headers";
import type { BlogList, BlogPost, PopupPage, PublicPopup } from "@/lib/landing-content";
import { apiFetch } from "@/lib/server/api";

export async function softwareOrigin(): Promise<string> {
  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host") ?? "localhost";
  const proto = store.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function visitorHeaders(): Promise<Record<string, string>> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for") ?? store.get("x-real-ip");
  return forwarded ? { "X-Forwarded-For": forwarded } : {};
}

export async function getBlogList(filters: { site?: string | null; category?: string | null; q?: string | null; order?: string | null }): Promise<BlogList | null> {
  const params = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""));
  const query = params.toString();
  const result = await apiFetch<BlogList>(`/public/landing/blog${query ? `?${query}` : ""}`, { auth: false });
  return result.ok ? result.data : null;
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const result = await apiFetch<BlogPost>(`/public/landing/blog/${encodeURIComponent(slug)}`, { auth: false });
  return result.ok ? result.data : null;
}

export async function getPopups(page: PopupPage): Promise<PublicPopup[]> {
  const result = await apiFetch<PublicPopup[]>(`/public/landing/popups?page=${page}`, { auth: false });
  return result.ok && result.data ? result.data : [];
}
